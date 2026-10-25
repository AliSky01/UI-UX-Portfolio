<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$search = trim((string) ($_GET['search'] ?? ''));
$doctorName = 'Dr. Alex Estrellas';
$consultationFee = 1000;

try {
    $conditions = ['LOWER(COALESCE(a.Status, "")) IN ("confirmed", "complete", "completed")'];
    $params = [];

    if ($search !== '') {
        $conditions[] = '(
            a.Appointment_ID LIKE ?
            OR CONCAT(a.PatientFirstName, " ", a.PatientLastName) LIKE ?
            OR CONCAT(a.PatientFirstName, " ", COALESCE(a.PatientMiddleName, ""), " ", a.PatientLastName) LIKE ?
            OR ? LIKE CONCAT("%", ?, "%")
        )';
        $params[] = "%$search%";
        $params[] = "%$search%";
        $params[] = "%$search%";
        $params[] = $doctorName;
        $params[] = $search;
    }

    $query = '
        SELECT
            a.Appointment_ID,
            a.PatientFirstName,
            a.PatientMiddleName,
            a.PatientLastName,
            DATE_FORMAT(a.AppointmentDate, "%Y-%m-%d") AS AppointmentDate,
            a.Status
        FROM Appointments a
    ';

    if (!empty($conditions)) {
        $query .= ' WHERE ' . implode(' AND ', $conditions);
    }

    $query .= ' ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC, a.Appointment_ID DESC';

    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $records = array_map(function ($row) use ($doctorName, $consultationFee) {
        $patientName = trim((string) ($row['PatientFirstName'] ?? '') . ' ' . (string) ($row['PatientMiddleName'] ?? '') . ' ' . (string) ($row['PatientLastName'] ?? ''));
        $rawStatus = strtolower(trim((string) ($row['Status'] ?? '')));
        $status = $rawStatus === 'confirmed' ? 'Pending' : 'Paid';
        return [
            'Appointment_ID' => $row['Appointment_ID'] ?? null,
            'PatientName' => $patientName !== '' ? $patientName : 'Unknown Patient',
            'DoctorName' => $doctorName,
            'Date' => $row['AppointmentDate'] ?? null,
            'Fee' => $consultationFee,
            'Status' => $status
        ];
    }, $appointments);

    echo json_encode(['success' => true, 'records' => $records]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
