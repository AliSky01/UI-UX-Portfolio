<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

function ensurePatientVisitorsTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `clinicsense`.`patientvisitor` (
            Visitor_ID INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            Patient_ID INT NOT NULL,
            Date DATE NOT NULL,
            Time VARCHAR(255) NOT NULL,
            Name VARCHAR(255) NOT NULL,
            Relationship VARCHAR(255) NOT NULL,
            INDEX idx_patientvisitor_patient (Patient_ID),
            INDEX idx_patientvisitor_date (Date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

function normalizeDate(string $value): ?string
{
    $date = DateTime::createFromFormat('Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) {
        return null;
    }

    return $value;
}

function normalizeTime(string $value): ?string
{
    $time = DateTime::createFromFormat('H:i', $value);
    if (!$time || $time->format('H:i') !== $value) {
        return null;
    }

    return $value;
}

function formatStoredTimeRange(string $timeFrom, string $timeTo): string
{
    $from = DateTime::createFromFormat('H:i', $timeFrom);
    $to = DateTime::createFromFormat('H:i', $timeTo);

    if (!$from || !$to) {
        return $timeFrom . ' - ' . $timeTo;
    }

    return $from->format('g:i A') . ' - ' . $to->format('g:i A');
}

function fetchVisitors(PDO $pdo, int $patientId): array
{
    $stmt = $pdo->prepare(
        'SELECT Visitor_ID AS id,
                Patient_ID AS patient_id,
                Date AS visit_date,
                Time AS visit_time,
                Name AS visitor_name,
                Relationship AS relationship
         FROM `clinicsense`.`patientvisitor`
         WHERE Patient_ID = ?
         ORDER BY Date DESC, Visitor_ID DESC'
    );
    $stmt->execute([$patientId]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

try {
    ensurePatientVisitorsTable($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $patientId = (int) ($_GET['patient_id'] ?? 0);

        if ($patientId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Patient ID is required']);
            exit;
        }

        echo json_encode([
            'success' => true,
            'records' => fetchVisitors($pdo, $patientId)
        ]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        exit;
    }

    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        $payload = $_POST;
    }

    $patientId = (int) ($payload['patient_id'] ?? 0);
    $visitDate = normalizeDate(trim((string) ($payload['date'] ?? '')));
    $timeFrom = normalizeTime(trim((string) ($payload['time_from'] ?? '')));
    $timeTo = normalizeTime(trim((string) ($payload['time_to'] ?? '')));
    $visitorName = trim((string) ($payload['name'] ?? ''));
    $relationship = trim((string) ($payload['relationship'] ?? ''));

    if ($patientId <= 0 || !$visitDate || !$timeFrom || !$timeTo || $visitorName === '' || $relationship === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Patient, date, time, name, and relationship are required']);
        exit;
    }

    if ($timeFrom >= $timeTo) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Time To must be later than Time From']);
        exit;
    }

    $patientCheck = $pdo->prepare('SELECT COUNT(*) FROM `clinicsense`.`patient` WHERE Patient_ID = ?');
    $patientCheck->execute([$patientId]);
    if ((int) $patientCheck->fetchColumn() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Patient not found']);
        exit;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO `clinicsense`.`patientvisitor`
            (Patient_ID, Date, Time, Name, Relationship)
         VALUES (?, ?, ?, ?, ?)'
    );

    $stmt->execute([
        $patientId,
        $visitDate,
        formatStoredTimeRange($timeFrom, $timeTo),
        $visitorName,
        $relationship
    ]);

    // Notify guardian about new visitor
    try {
        $pstmt = $pdo->prepare('SELECT Guardian_ID FROM `clinicsense`.`patient` WHERE Patient_ID = ? LIMIT 1');
        $pstmt->execute([$patientId]);
        $p = $pstmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $guardianId = isset($p['Guardian_ID']) ? (int) $p['Guardian_ID'] : 0;
        $patientName = lookupPatientDisplayName($pdo, $patientId);
        if ($guardianId > 0) {
            createNotification($pdo, [
                'recipient_role' => 'guardian',
                'category' => 'visitor',
                'action_type' => 'visitor_added',
                'title' => 'New visitor registered',
                'message' => 'A new visitor for ' . $patientName . ' was registered: ' . $visitorName . '.',
                'entity_type' => 'patientvisitor',
                'entity_id' => (int) $pdo->lastInsertId(),
                'patient_id' => $patientId,
                'patient_name' => $patientName,
                'created_by_staff_id' => isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null,
                'created_by_name' => isset($_SESSION['user_id']) ? lookupStaffDisplayName($pdo, (int) $_SESSION['user_id']) : null
            ]);
        }
    } catch (Exception $e) {
        // non-fatal
    }

    echo json_encode([
        'success' => true,
        'message' => 'Visitor saved successfully',
        'records' => fetchVisitors($pdo, $patientId)
    ]);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to save visitor record.',
        'error' => $error->getMessage()
    ]);
}
?>