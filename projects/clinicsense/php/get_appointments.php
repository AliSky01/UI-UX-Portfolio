<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$month = isset($_GET['month']) ? (int)$_GET['month'] : null;
$year  = isset($_GET['year'])  ? (int)$_GET['year']  : null;
$status = isset($_GET['status']) ? strtolower(trim((string) $_GET['status'])) : '';
$statusFilters = [
    'pending' => ['pending'],
    'confirmed' => ['confirmed'],
    'complete' => ['complete', 'completed'],
    'completed' => ['complete', 'completed'],
    'cancelled' => ['cancelled'],
    'admitted' => ['admitted'],
    'for_admission' => ['for admission', 'for_admission'],
    'for admission' => ['for admission', 'for_admission'],
    'declined' => ['declined', 'not_admitted', 'not admitted'],
    'not_admitted' => ['declined', 'not_admitted', 'not admitted'],
    'not admitted' => ['declined', 'not_admitted', 'not admitted']
];

try {
    $conditions = [];
    $params = [];
    $requestedStatuses = [];

    if ($month && $year) {
        $conditions[] = 'MONTH(a.AppointmentDate) = ?';
        $conditions[] = 'YEAR(a.AppointmentDate) = ?';
        $params[] = $month;
        $params[] = $year;
    }

    if ($status !== '') {
        $requestedStatuses = array_filter(array_map('trim', explode(',', $status)));

        if (count($requestedStatuses) === 1 && isset($statusFilters[$requestedStatuses[0]])) {
            $statusValues = $statusFilters[$requestedStatuses[0]];
        } else {
            $statusValues = [];

            foreach ($requestedStatuses as $requestedStatus) {
                if (isset($statusFilters[$requestedStatus])) {
                    $statusValues = array_merge($statusValues, $statusFilters[$requestedStatus]);
                }
            }

            $statusValues = array_values(array_unique($statusValues));
        }

        if (!empty($statusValues)) {
            $conditions[] = 'LOWER(a.Status) IN (' . implode(', ', array_fill(0, count($statusValues), '?')) . ')';
            $params = array_merge($params, $statusValues);
        }
    }

    $sql = '
        SELECT
            a.Appointment_ID,
            a.Appointment_ID AS AppointmentID,
            a.Staff_ID,
            a.Staff_ID AS StaffID,
            a.Guardian_ID,
            a.Guardian_ID AS GuardianID,
            a.PatientFirstName,
            a.PatientMiddleName,
            a.PatientLastName,
            a.Age,
            a.Sex,
            a.PatientAddress,
            a.Symptoms,
            a.PastLaboratories,
            a.GuardianRelation,
            a.IncomeRange,
            a.GuardianAddress,
            DATE_FORMAT(a.AppointmentDate, "%Y-%m-%d") AS AppointmentDate,
            TIME_FORMAT(a.AppointmentTime, "%H:%i:%s") AS AppointmentTime,
            a.AppointmentType,
            a.Notes,
            a.Status,
            a.CreatedDate,
            g.FirstName AS GuardianFirstName,
            g.MiddleInitial AS GuardianMiddleName,
            g.LastName AS GuardianLastName,
            g.Contact_No AS GuardianContact,
            NULL AS GuardianMonthlyIncome
        FROM Appointments a
        LEFT JOIN Guardian g ON a.Guardian_ID = g.Guardian_ID
    ';

    if (!empty($conditions)) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }

    $sql .= $month && $year
        ? ' ORDER BY a.AppointmentDate ASC, a.AppointmentTime ASC'
        : ' ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'appointments' => $appointments]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>