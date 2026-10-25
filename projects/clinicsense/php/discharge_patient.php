<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

function ensureDischargeDateTimeColumn(PDO $pdo): void
{
    $columnCheck = $pdo->query("SHOW COLUMNS FROM `clinicsense`.`AdmissionDischarge` LIKE 'Discharge_DateTime'");
    if ($columnCheck->fetch(PDO::FETCH_ASSOC)) {
        return;
    }

    $pdo->exec('ALTER TABLE `clinicsense`.`AdmissionDischarge` ADD COLUMN `Discharge_DateTime` DATETIME NULL AFTER `Admission_DateTime`');
}

function fetchLatestDischargeDateTime(PDO $pdo, int $patientId): ?string
{
    $stmt = $pdo->prepare('
        SELECT Discharge_DateTime
        FROM `clinicsense`.`AdmissionDischarge`
        WHERE Patient_ID = ?
          AND Discharge_DateTime IS NOT NULL
        ORDER BY Discharge_DateTime DESC
        LIMIT 1
    ');
    $stmt->execute([$patientId]);

    $value = $stmt->fetchColumn();
    return $value !== false ? (string) $value : null;
}

try {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        $payload = $_POST;
    }

    $patientId = (int) ($payload['patient_id'] ?? 0);
    if ($patientId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Patient ID is required']);
        exit;
    }

    $pdo->beginTransaction();
    ensureDischargeDateTimeColumn($pdo);

    $patientStmt = $pdo->prepare('SELECT Patient_ID, Status FROM `clinicsense`.`patient` WHERE Patient_ID = ? FOR UPDATE');
    $patientStmt->execute([$patientId]);
    $patient = $patientStmt->fetch(PDO::FETCH_ASSOC);

    if (!$patient) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Patient not found']);
        exit;
    }

    $currentStatus = strtolower(trim((string) ($patient['Status'] ?? '')));

    if ($currentStatus !== 'discharged') {
        $updatePatientStmt = $pdo->prepare('UPDATE `clinicsense`.`patient` SET Status = ? WHERE Patient_ID = ?');
        $updatePatientStmt->execute(['discharged', $patientId]);

        $updateAdmissionStmt = $pdo->prepare('
            UPDATE `clinicsense`.`AdmissionDischarge`
            SET Discharge_DateTime = NOW()
            WHERE Patient_ID = ?
              AND (Discharge_DateTime IS NULL OR Discharge_DateTime = "0000-00-00 00:00:00")
            ORDER BY Admission_DateTime DESC
            LIMIT 1
        ');
        $updateAdmissionStmt->execute([$patientId]);

        if ($updateAdmissionStmt->rowCount() === 0) {
            $insertAdmissionStmt = $pdo->prepare('
                INSERT INTO `clinicsense`.`AdmissionDischarge` (Patient_ID, Admission_DateTime, Discharge_DateTime)
                VALUES (?, NOW(), NOW())
            ');
            $insertAdmissionStmt->execute([$patientId]);
        }
    }

    $dischargeDateTime = fetchLatestDischargeDateTime($pdo, $patientId) ?: date('Y-m-d H:i:s');
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => $currentStatus === 'discharged' ? 'Patient already discharged' : 'Patient discharged successfully',
        'patientId' => $patientId,
        'status' => 'discharged',
        'dischargeDateTime' => $dischargeDateTime
    ]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to discharge patient.',
        'error' => $error->getMessage()
    ]);
}
?>