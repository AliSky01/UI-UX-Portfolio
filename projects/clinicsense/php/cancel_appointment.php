<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

$input = json_decode(file_get_contents('php://input'), true);
$appointmentId = isset($input['appointmentId']) ? (int)$input['appointmentId'] : 0;

if (!$appointmentId) {
    echo json_encode(['success' => false, 'message' => 'Missing appointmentId']);
    exit;
}

try {
    // mark appointment cancelled
    $stmt = $pdo->prepare('SELECT PatientFirstName, PatientMiddleName, PatientLastName FROM Appointments WHERE Appointment_ID = ? LIMIT 1');
    $stmt->execute([$appointmentId]);
    $appointment = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $update = $pdo->prepare('UPDATE Appointments SET Status = ? WHERE Appointment_ID = ?');
    $update->execute(['cancelled', $appointmentId]);

    $patientName = trim((string)($appointment['PatientFirstName'] ?? '') . ' ' . (string)($appointment['PatientMiddleName'] ?? '') . ' ' . (string)($appointment['PatientLastName'] ?? ''));

    // create notification for receptionist
    createNotification($pdo, [
        'recipient_role' => 'receptionist',
        'category' => 'appointment',
        'action_type' => 'appointment_cancelled',
        'title' => 'Appointment cancelled',
        'message' => ($patientName !== '' ? $patientName : 'An appointment') . ' was cancelled.',
        'entity_type' => 'Appointments',
        'entity_id' => $appointmentId,
        'patient_name' => $patientName !== '' ? $patientName : null,
        'created_by_staff_id' => isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null,
        'created_by_name' => isset($_SESSION['user_id']) ? lookupStaffDisplayName($pdo, (int)$_SESSION['user_id']) : null
    ]);

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    error_log('cancel_appointment error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
