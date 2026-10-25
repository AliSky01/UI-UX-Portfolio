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
    echo json_encode(['success' => false, 'message' => 'Only doctors can update prescriptions']);
    exit;
}

try {
    $prescription_id = intval($_POST['prescription_id'] ?? 0);
    $patient_id = intval($_POST['patient_id'] ?? 0);
    $medicine = trim($_POST['medicine'] ?? '');
    $dosage = trim($_POST['dosage'] ?? '');
    $frequency = trim($_POST['frequency'] ?? '');
    $duration = trim($_POST['duration'] ?? '');
    $date = trim($_POST['date'] ?? '');

    if (!$prescription_id || !$patient_id || !$medicine || !$dosage || !$frequency || !$duration || !$date) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    $existingStmt = $pdo->prepare('SELECT Prescription_ID FROM `clinicsense`.`PatientPrescription` WHERE Prescription_ID = ? AND Patient_ID = ?');
    $existingStmt->execute([$prescription_id, $patient_id]);

    if (!$existingStmt->fetchColumn()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Prescription not found']);
        exit;
    }

    $stmt = $pdo->prepare('
        UPDATE `clinicsense`.`PatientPrescription`
        SET Medicine = ?, Dosage = ?, Frequency = ?, Duration = ?, Date = ?
        WHERE Prescription_ID = ? AND Patient_ID = ?
    ');

    $stmt->execute([
        $medicine,
        $dosage,
        $frequency,
        $duration,
        $date,
        $prescription_id,
        $patient_id
    ]);

    $patientName = lookupPatientDisplayName($pdo, $patient_id);
    createAdminNotification($pdo, [
        'category' => 'prescription',
        'action_type' => 'prescription_updated',
        'title' => 'Prescription updated',
        'message' => 'The prescription for ' . $patientName . ' was updated.',
        'entity_type' => 'PatientPrescription',
        'entity_id' => $prescription_id,
        'patient_id' => $patient_id,
        'patient_name' => $patientName,
        'created_by_staff_id' => (int) $_SESSION['user_id'],
        'created_by_name' => lookupStaffDisplayName($pdo, (int) $_SESSION['user_id'])
    ]);

    echo json_encode(['success' => true, 'message' => 'Prescription updated successfully']);
} catch (PDOException $e) {
    error_log('PDO Error in update_prescription.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log('Error in update_prescription.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>