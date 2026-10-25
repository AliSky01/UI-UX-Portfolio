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

if (strtolower(trim($_SESSION['role'] ?? '')) !== 'doctor') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Only doctors can delete prescriptions']);
    exit;
}

try {
    $prescription_id = intval($_POST['prescription_id'] ?? 0);

    if (!$prescription_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Prescription ID is required']);
        exit;
    }

    $lookupStmt = $pdo->prepare('SELECT Patient_ID, Medicine FROM `clinicsense`.`PatientPrescription` WHERE Prescription_ID = ? LIMIT 1');
    $lookupStmt->execute([$prescription_id]);
    $prescription = $lookupStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $stmt = $pdo->prepare('DELETE FROM `clinicsense`.`PatientPrescription` WHERE Prescription_ID = ?');
    $stmt->execute([$prescription_id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Prescription not found']);
        exit;
    }

    $patientId = isset($prescription['Patient_ID']) ? (int) $prescription['Patient_ID'] : null;
    $patientName = lookupPatientDisplayName($pdo, $patientId);
    createAdminNotification($pdo, [
        'category' => 'prescription',
        'action_type' => 'prescription_deleted',
        'title' => 'Prescription removed',
        'message' => 'A prescription for ' . $patientName . ' was deleted.',
        'entity_type' => 'PatientPrescription',
        'entity_id' => $prescription_id,
        'patient_id' => $patientId,
        'patient_name' => $patientName,
        'created_by_staff_id' => (int) $_SESSION['user_id'],
        'created_by_name' => lookupStaffDisplayName($pdo, (int) $_SESSION['user_id'])
    ]);

    echo json_encode(['success' => true, 'message' => 'Prescription deleted successfully']);
} catch (PDOException $e) {
    error_log('PDO Error in delete_prescription.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log('Error in delete_prescription.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>