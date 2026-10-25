<?php
header('Content-Type: application/json');
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

if (strtolower(trim($_SESSION['user_type'] ?? '')) !== 'staff') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Only staff accounts can create prescriptions']);
    exit;
}

if (strtolower(trim($_SESSION['role'] ?? '')) === 'nurse') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Nurse accounts cannot create prescriptions']);
    exit;
}

try {
    $patient_id  = intval($_POST['patient_id'] ?? 0);
    $medicine    = trim($_POST['medicine'] ?? '');
    $dosage      = trim($_POST['dosage'] ?? '');
    $frequency   = trim($_POST['frequency'] ?? '');
    $duration    = trim($_POST['duration'] ?? '');
    $instructions = trim($_POST['instructions'] ?? '');
    $date        = trim($_POST['date'] ?? date('Y-m-d'));
    $prescribed_by = $_SESSION['user_id'];

    if (!$patient_id || !$medicine || !$dosage || !$frequency) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    // Try to insert into PatientPrescription table
    $stmt = $pdo->prepare('
        INSERT INTO `clinicsense`.`PatientPrescription` 
        (Patient_ID, Medicine, Dosage, Frequency, Duration, Special_Instructions, Date, Prescribed_By)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ');
    
    $result = $stmt->execute([$patient_id, $medicine, $dosage, $frequency, $duration, $instructions, $date, $prescribed_by]);
    
    if ($result) {
        $patientName = lookupPatientDisplayName($pdo, $patient_id);
        $prescriberName = lookupStaffDisplayName($pdo, (int) $prescribed_by);
        createAdminNotification($pdo, [
            'category' => 'prescription',
            'action_type' => 'prescription_created',
            'title' => 'New prescription issued',
            'message' => $patientName . ' was prescribed ' . $medicine . '.',
            'entity_type' => 'PatientPrescription',
            'entity_id' => (int) $pdo->lastInsertId(),
            'patient_id' => $patient_id,
            'patient_name' => $patientName,
            'created_by_staff_id' => $prescribed_by,
            'created_by_name' => $prescriberName
        ]);

        // Notify guardian for this patient (if any)
        try {
            $gstmt = $pdo->prepare('SELECT Guardian_ID FROM `clinicsense`.`patient` WHERE Patient_ID = ? LIMIT 1');
            $gstmt->execute([$patient_id]);
            $g = $gstmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $guardianId = isset($g['Guardian_ID']) ? (int) $g['Guardian_ID'] : 0;
            if ($guardianId > 0) {
                createNotification($pdo, [
                    'recipient_role' => 'guardian',
                    'category' => 'prescription',
                    'action_type' => 'prescription_created',
                    'title' => 'New prescription issued',
                    'message' => 'A new prescription for ' . $patientName . ' was issued: ' . $medicine . '.',
                    'entity_type' => 'PatientPrescription',
                    'entity_id' => (int) $pdo->lastInsertId(),
                    'patient_id' => $patient_id,
                    'patient_name' => $patientName,
                    'created_by_staff_id' => $prescribed_by,
                    'created_by_name' => $prescriberName
                ]);
            }
        } catch (Exception $e) {
            // ignore
        }

        echo json_encode(['success' => true, 'message' => 'Prescription saved successfully!']);
    } else {
        $errorInfo = $stmt->errorInfo();
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $errorInfo[2]]);
    }
} catch (PDOException $e) {
    error_log('PDO Error in save_prescription.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log('Error in save_prescription.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>