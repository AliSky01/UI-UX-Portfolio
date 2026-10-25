<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

try {
    $stmt = $pdo->prepare('
        SELECT
            a.Appointment_ID,
            a.PatientFirstName,
            a.PatientMiddleName,
            a.PatientLastName,
            DATE_FORMAT(a.AppointmentDate, "%Y-%m-%d") AS AppointmentDate,
            TIME_FORMAT(a.AppointmentTime, "%H:%i:%s") AS AppointmentTime,
            a.Status,
            g.Contact_No AS GuardianContact,
            g.FirstName AS GuardianFirstName,
            g.MiddleInitial AS GuardianMiddleName,
            g.LastName AS GuardianLastName
        FROM `clinicsense`.`Appointments` a
        LEFT JOIN `clinicsense`.`Guardian` g ON a.Guardian_ID = g.Guardian_ID
        WHERE LOWER(COALESCE(a.Status, "")) IN (?, ?, ?)
        ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC, a.Appointment_ID DESC
    ');
    $stmt->execute(['pending', 'confirmed', 'cancelled']);

    $appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'appointments' => $appointments
    ]);
} catch (Throwable $e) {
    error_log('Error in get_admin_dashboard_appointments.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to load dashboard appointments'
    ]);
}
?>