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

try {
    $patient_id = intval($_POST['patient_id'] ?? 0);
    $blood_pressure = trim($_POST['blood_pressure'] ?? '');
    $pulse_rate = trim($_POST['pulse_rate'] ?? '');
    $temperature = trim($_POST['temperature'] ?? '');
    $weight = trim($_POST['weight'] ?? '');
    $height = trim($_POST['height'] ?? '');
    $respiratory_rate = trim($_POST['respiratory_rate'] ?? '');
    $oxygen_saturation = trim($_POST['oxygen_saturation'] ?? '');
    $date_recorded = trim($_POST['date_recorded'] ?? '');

    if (!$patient_id || !$blood_pressure || !$pulse_rate || !$temperature || !$weight || !$height || !$respiratory_rate || !$oxygen_saturation || !$date_recorded) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'All vitals fields are required']);
        exit;
    }

    $selectedDate = date('Y-m-d', strtotime($date_recorded));
    $dateTimeRecorded = $selectedDate . ' ' . date('H:i:s');

    $stmt = $pdo->prepare('
        INSERT INTO `clinicsense`.`PatientVitals` (
            patient_id,
            blood_pressure,
            pulse_rate,
            temperature,
            weight,
            height,
            respiratory_rate,
            oxygen_saturation,
            date_recorded
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');

    $stmt->execute([
        $patient_id,
        $blood_pressure,
        $pulse_rate,
        $temperature,
        $weight,
        $height,
        $respiratory_rate,
        $oxygen_saturation,
        $dateTimeRecorded
    ]);

    $patientName = lookupPatientDisplayName($pdo, $patient_id);
    createAdminNotification($pdo, [
        'category' => 'record',
        'action_type' => 'vitals_recorded',
        'title' => 'Patient vitals updated',
        'message' => 'Vitals were recorded for ' . $patientName . '.',
        'entity_type' => 'PatientVitals',
        'entity_id' => (int) $pdo->lastInsertId(),
        'patient_id' => $patient_id,
        'patient_name' => $patientName,
        'created_by_staff_id' => (int) $_SESSION['user_id'],
        'created_by_name' => lookupStaffDisplayName($pdo, (int) $_SESSION['user_id'])
    ]);

    // Notify guardian about vitals update
    try {
        $gstmt = $pdo->prepare('SELECT Guardian_ID FROM `clinicsense`.`patient` WHERE Patient_ID = ? LIMIT 1');
        $gstmt->execute([$patient_id]);
        $g = $gstmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $guardianId = isset($g['Guardian_ID']) ? (int) $g['Guardian_ID'] : 0;
        if ($guardianId > 0) {
            createNotification($pdo, [
                'recipient_role' => 'guardian',
                'category' => 'record',
                'action_type' => 'vitals_recorded',
                'title' => 'Patient vitals updated',
                'message' => 'Vitals were recorded for ' . $patientName . '.',
                'entity_type' => 'PatientVitals',
                'entity_id' => (int) $pdo->lastInsertId(),
                'patient_id' => $patient_id,
                'patient_name' => $patientName,
                'created_by_staff_id' => (int) $_SESSION['user_id'],
                'created_by_name' => lookupStaffDisplayName($pdo, (int) $_SESSION['user_id'])
            ]);
        }
    } catch (Exception $e) {
        // ignore
    }

    echo json_encode([
        'success' => true,
        'message' => 'Vitals saved successfully',
        'vital_id' => $pdo->lastInsertId()
    ]);
} catch (Exception $e) {
    error_log('Error in save_patient_vitals.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>