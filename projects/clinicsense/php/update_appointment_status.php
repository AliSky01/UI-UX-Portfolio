<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$appointment_id = $_POST['appointment_id'] ?? '';
$status         = strtolower(trim((string) ($_POST['status'] ?? '')));

$status_aliases = [
    'pending' => 'pending',
    'confirmed' => 'confirmed',
    'cancelled' => 'cancelled',
    'complete' => 'complete',
    'completed' => 'complete',
    'admitted' => 'for admission',
    'for_admission' => 'for admission',
    'for admission' => 'for admission',
    'not_admitted' => 'declined',
    'not admitted' => 'declined',
    'declined' => 'declined'
];

if (!$appointment_id || !isset($status_aliases[$status])) {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

$normalized_status = $status_aliases[$status];

try {
    $appointmentStmt = $pdo->prepare('SELECT PatientFirstName, PatientMiddleName, PatientLastName, Guardian_ID FROM Appointments WHERE Appointment_ID = ? LIMIT 1');
    $appointmentStmt->execute([$appointment_id]);
    $appointment = $appointmentStmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $stmt = $pdo->prepare('UPDATE Appointments SET Status = ? WHERE Appointment_ID = ?');
    $stmt->execute([$normalized_status, $appointment_id]);

    $patientName = trim((string) ($appointment['PatientFirstName'] ?? '') . ' ' . (string) ($appointment['PatientMiddleName'] ?? '') . ' ' . (string) ($appointment['PatientLastName'] ?? ''));
    $category = in_array($normalized_status, ['for admission', 'admitted'], true) ? 'admission' : 'appointment';
    createAdminNotification($pdo, [
        'category' => $category,
        'action_type' => 'appointment_status_updated',
        'title' => 'Appointment status updated',
        'message' => ($patientName !== '' ? $patientName : 'An appointment') . ' was marked as ' . $normalized_status . '.',
        'entity_type' => 'Appointments',
        'entity_id' => (int) $appointment_id,
        'patient_name' => $patientName !== '' ? $patientName : null,
        'created_by_staff_id' => (int) $_SESSION['user_id'],
        'created_by_name' => lookupStaffDisplayName($pdo, (int) $_SESSION['user_id'])
    ]);

    // Also notify guardian (if available)
    try {
        $guardianId = isset($appointment['Guardian_ID']) ? (int) $appointment['Guardian_ID'] : 0;
        if ($guardianId > 0) {
            // try to resolve a Patient_ID from the patient table using guardian and patient name
            $patientIdForNotif = null;
            try {
                $pf = trim((string) ($appointment['PatientFirstName'] ?? ''));
                $pl = trim((string) ($appointment['PatientLastName'] ?? ''));
                if ($pf !== '' || $pl !== '') {
                    $lookup = $pdo->prepare('SELECT Patient_ID FROM `clinicsense`.`patient` WHERE Guardian_ID = ? AND FirstName = ? AND LastName = ? LIMIT 1');
                    $lookup->execute([$guardianId, $pf, $pl]);
                    $found = $lookup->fetch(PDO::FETCH_ASSOC);
                    if ($found && isset($found['Patient_ID'])) {
                        $patientIdForNotif = (int) $found['Patient_ID'];
                    }
                }

                // fallback: if no exact name match, and the guardian has exactly one patient, use that patient id
                if ($patientIdForNotif === null) {
                    $pcountStmt = $pdo->prepare('SELECT Patient_ID FROM `clinicsense`.`patient` WHERE Guardian_ID = ? LIMIT 2');
                    $pcountStmt->execute([$guardianId]);
                    $pRows = $pcountStmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
                    if (count($pRows) === 1) {
                        $patientIdForNotif = (int) $pRows[0];
                    }
                }
            } catch (Exception $e) {
                // ignore lookup failure
            }

            createNotification($pdo, [
                'recipient_role' => 'guardian',
                'category' => $category,
                'action_type' => 'appointment_status_updated',
                'title' => 'Appointment status updated',
                'message' => 'Your appointment for ' . ($patientName !== '' ? $patientName : 'the patient') . ' was marked as ' . $normalized_status . '.',
                'entity_type' => 'Appointments',
                'entity_id' => (int) $appointment_id,
                'patient_id' => $patientIdForNotif,
                'patient_name' => $patientName !== '' ? $patientName : null,
                'created_by_staff_id' => (int) $_SESSION['user_id'],
                'created_by_name' => lookupStaffDisplayName($pdo, (int) $_SESSION['user_id'])
            ]);
        }
    } catch (Exception $e) {
        // non-fatal
    }

    echo json_encode(['success' => true, 'message' => 'Status updated successfully']);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>