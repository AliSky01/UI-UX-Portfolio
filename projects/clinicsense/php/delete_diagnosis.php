<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

if (!in_array(strtolower(trim($_SESSION['role'] ?? '')), ['doctor', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Only doctors or admins can remove diagnoses']);
    exit;
}

try {
    $diagnosisId = intval($_POST['diagnosis_id'] ?? 0);

    if (!$diagnosisId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Diagnosis ID is required']);
        exit;
    }

    $lookupStmt = $pdo->prepare('SELECT Patient_ID, Diagnosis FROM `clinicsense`.`PatientDiagnosis` WHERE diagnosis_id = ? LIMIT 1');
    $lookupStmt->execute([$diagnosisId]);
    $diagnosis = $lookupStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $stmt = $pdo->prepare('DELETE FROM `clinicsense`.`PatientDiagnosis` WHERE diagnosis_id = ?');
    $stmt->execute([$diagnosisId]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Diagnosis not found']);
        exit;
    }

    $patientId = isset($diagnosis['Patient_ID']) ? (int) $diagnosis['Patient_ID'] : null;
    $patientName = lookupPatientDisplayName($pdo, $patientId);
    createAdminNotification($pdo, [
        'category' => 'diagnosis',
        'action_type' => 'diagnosis_deleted',
        'title' => 'Diagnosis removed',
        'message' => 'A diagnosis for ' . $patientName . ' was removed.',
        'entity_type' => 'PatientDiagnosis',
        'entity_id' => $diagnosisId,
        'patient_id' => $patientId,
        'patient_name' => $patientName,
        'created_by_staff_id' => (int) $_SESSION['user_id'],
        'created_by_name' => lookupStaffDisplayName($pdo, (int) $_SESSION['user_id'])
    ]);

    echo json_encode(['success' => true, 'message' => 'Diagnosis moved to psychiatric record']);
} catch (PDOException $e) {
    error_log('PDO Error in delete_diagnosis.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log('Error in delete_diagnosis.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>