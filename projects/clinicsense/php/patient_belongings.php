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

function ensurePatientBelongingsTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `clinicsense`.`patientbelongings` (
            Belonging_ID INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            Patient_ID INT NOT NULL,
            Date DATE NOT NULL,
            Item VARCHAR(255) NOT NULL,
            Quantity VARCHAR(255) NOT NULL,
            Sent_By VARCHAR(255) DEFAULT NULL,
            Received_By VARCHAR(255) DEFAULT NULL,
            INDEX idx_patientbelongings_patient (Patient_ID),
            INDEX idx_patientbelongings_date (Date)
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

function fetchBelongings(PDO $pdo, int $patientId): array
{
    $stmt = $pdo->prepare(
        'SELECT Belonging_ID AS id,
                Patient_ID AS patient_id,
                Date AS belongings_date,
                Item AS item,
                Quantity AS quantity,
                Sent_By AS sent_by,
                Received_By AS received_by
         FROM `clinicsense`.`patientbelongings`
         WHERE Patient_ID = ?
         ORDER BY Date DESC, Belonging_ID DESC'
    );
    $stmt->execute([$patientId]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

try {
    ensurePatientBelongingsTable($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $patientId = (int) ($_GET['patient_id'] ?? 0);

        if ($patientId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Patient ID is required']);
            exit;
        }

        echo json_encode([
            'success' => true,
            'records' => fetchBelongings($pdo, $patientId)
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
    $belongingsDate = normalizeDate(trim((string) ($payload['date'] ?? '')));
    $item = trim((string) ($payload['item'] ?? ''));
    $quantity = trim((string) ($payload['quantity'] ?? ''));
    $sentBy = trim((string) ($payload['sent_by'] ?? ''));
    $receivedBy = trim((string) ($payload['received_by'] ?? ''));

    if ($patientId <= 0 || !$belongingsDate || $item === '' || $quantity === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Patient, date, item, and quantity are required']);
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
        'INSERT INTO `clinicsense`.`patientbelongings`
            (Patient_ID, Date, Item, Quantity, Sent_By, Received_By)
         VALUES (?, ?, ?, ?, ?, ?)'
    );

    $stmt->execute([
        $patientId,
        $belongingsDate,
        $item,
        $quantity,
        $sentBy !== '' ? $sentBy : null,
        $receivedBy !== '' ? $receivedBy : null
    ]);

    // Notify guardian about new belongings record
    try {
        $pstmt = $pdo->prepare('SELECT Guardian_ID FROM `clinicsense`.`patient` WHERE Patient_ID = ? LIMIT 1');
        $pstmt->execute([$patientId]);
        $p = $pstmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $guardianId = isset($p['Guardian_ID']) ? (int) $p['Guardian_ID'] : 0;
        $patientName = lookupPatientDisplayName($pdo, $patientId);
        if ($guardianId > 0) {
            createNotification($pdo, [
                'recipient_role' => 'guardian',
                'category' => 'belongings',
                'action_type' => 'belonging_added',
                'title' => 'Patient belongings recorded',
                'message' => 'A new belongings entry for ' . $patientName . ': ' . $item . '.',
                'entity_type' => 'patientbelongings',
                'entity_id' => (int) $pdo->lastInsertId(),
                'patient_id' => $patientId,
                'patient_name' => $patientName,
                'created_by_staff_id' => isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null,
                'created_by_name' => isset($_SESSION['user_id']) ? lookupStaffDisplayName($pdo, (int) $_SESSION['user_id']) : null
            ]);
        }
    } catch (Exception $e) {
        // ignore
    }

    echo json_encode([
        'success' => true,
        'message' => 'Belongings saved successfully',
        'records' => fetchBelongings($pdo, $patientId)
    ]);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to save belongings record.',
        'error' => $error->getMessage()
    ]);
}
?>