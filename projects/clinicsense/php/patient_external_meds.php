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

function ensurePatientExternalMedsTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS `clinicsense`.`patientexternalmeds` (
            ExtMed_ID INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            Patient_ID INT NOT NULL,
            Date DATE NOT NULL,
            Medicine VARCHAR(255) NOT NULL,
            Quantity VARCHAR(255) NOT NULL,
            Sent_By VARCHAR(255) DEFAULT NULL,
            Received_By VARCHAR(255) DEFAULT NULL,
            INDEX idx_patientexternalmeds_patient (Patient_ID),
            INDEX idx_patientexternalmeds_date (Date)
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

function fetchExternalMeds(PDO $pdo, int $patientId): array
{
    $stmt = $pdo->prepare(
        'SELECT ExtMed_ID AS id,
                Patient_ID AS patient_id,
                Date AS med_date,
                Medicine AS medicine,
                Quantity AS quantity,
                Sent_By AS sent_by,
                Received_By AS received_by
         FROM `clinicsense`.`patientexternalmeds`
         WHERE Patient_ID = ?
         ORDER BY Date DESC, ExtMed_ID DESC'
    );
    $stmt->execute([$patientId]);

    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

try {
    ensurePatientExternalMedsTable($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $patientId = (int) ($_GET['patient_id'] ?? 0);

        if ($patientId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Patient ID is required']);
            exit;
        }

        echo json_encode([
            'success' => true,
            'records' => fetchExternalMeds($pdo, $patientId)
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
    $medDate = normalizeDate(trim((string) ($payload['date'] ?? '')));
    $medicine = trim((string) ($payload['medicine'] ?? ''));
    $quantity = trim((string) ($payload['quantity'] ?? ''));
    $sentBy = trim((string) ($payload['sent_by'] ?? ''));
    $receivedBy = trim((string) ($payload['received_by'] ?? ''));

    if ($patientId <= 0 || !$medDate || $medicine === '' || $quantity === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Patient, date, medicine, and quantity are required']);
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
        'INSERT INTO `clinicsense`.`patientexternalmeds`
            (Patient_ID, Date, Medicine, Quantity, Sent_By, Received_By)
         VALUES (?, ?, ?, ?, ?, ?)'
    );

    $stmt->execute([
        $patientId,
        $medDate,
        $medicine,
        $quantity,
        $sentBy !== '' ? $sentBy : null,
        $receivedBy !== '' ? $receivedBy : null
    ]);

    // Notify guardian about external medicine entry
    try {
        $pstmt = $pdo->prepare('SELECT Guardian_ID FROM `clinicsense`.`patient` WHERE Patient_ID = ? LIMIT 1');
        $pstmt->execute([$patientId]);
        $p = $pstmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $guardianId = isset($p['Guardian_ID']) ? (int) $p['Guardian_ID'] : 0;
        $patientName = lookupPatientDisplayName($pdo, $patientId);
        if ($guardianId > 0) {
            createNotification($pdo, [
                'recipient_role' => 'guardian',
                'category' => 'external_medicine',
                'action_type' => 'external_medicine_added',
                'title' => 'External medicine recorded',
                'message' => 'External medicine for ' . $patientName . ': ' . $medicine . ' was recorded.',
                'entity_type' => 'patientexternalmeds',
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
        'message' => 'External medicine saved successfully',
        'records' => fetchExternalMeds($pdo, $patientId)
    ]);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to save external medicine record.',
        'error' => $error->getMessage()
    ]);
}
?>