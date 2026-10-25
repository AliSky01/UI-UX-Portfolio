<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$patient_id = $_GET['patient_id'] ?? '';
$bill_id    = $_GET['bill_id'] ?? null;

if (!$patient_id) {
    echo json_encode(['success' => false, 'message' => 'Missing patient ID']);
    exit;
}

try {
    // Get patient info + room type + admission/discharge
    $stmt = $pdo->prepare('
        SELECT
            p.Patient_ID,
            p.FirstName,
            p.MiddleName,
            p.LastName,
            p.Room_type,
            p.Status,
            ad.Admission_DateTime,
            ad.Discharge_DateTime
        FROM patient p
        LEFT JOIN admissiondischarge ad ON p.Patient_ID = ad.Patient_ID
        WHERE p.Patient_ID = ?
        ORDER BY ad.Admission_DateTime DESC
        LIMIT 1
    ');
    $stmt->execute([$patient_id]);
    $patient = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$patient) {
        echo json_encode(['success' => false, 'message' => 'Patient not found']);
        exit;
    }

    // Calculate days admitted
    $admissionDate  = new DateTime($patient['Admission_DateTime']);
    $dischargeDate  = $patient['Discharge_DateTime']
        ? new DateTime($patient['Discharge_DateTime'])
        : new DateTime();
    $daysAdmitted   = (int) $admissionDate->diff($dischargeDate)->days + 1;

    // Room rate based on room type
    $roomRate = strtolower($patient['Room_type']) === 'private' ? 1000 : 800;

    // Fixed rates
    $foodRate  = 300;
    $miscRate  = round(2500 / 30, 2); // 83.33/day

    // Auto calculated particulars
    $particulars = [
        [
            'Type'        => 'room',
            'Description' => 'Room fee',
            'Rate'        => $roomRate,
            'Days'        => $daysAdmitted,
            'Quantity'    => 1,
            'Amount'      => $roomRate * $daysAdmitted
        ],
        [
            'Type'        => 'food',
            'Description' => 'Food fee',
            'Rate'        => $foodRate,
            'Days'        => $daysAdmitted,
            'Quantity'    => 1,
            'Amount'      => $foodRate * $daysAdmitted
        ],
        [
            'Type'        => 'misc',
            'Description' => 'Miscellaneous',
            'Rate'        => $miscRate,
            'Days'        => $daysAdmitted,
            'Quantity'    => 1,
            'Amount'      => round($miscRate * $daysAdmitted, 2)
        ]
    ];

    // Get saved doctor visits and pharmacy items
    $query  = 'SELECT * FROM bill_items WHERE Patient_ID = ?';
    $params = [$patient_id];

    if ($bill_id) {
        $query  .= ' AND Bill_ID = ?';
        $params[] = $bill_id;
    } else {
        $query .= ' AND Bill_ID IS NULL';
    }

    $itemStmt = $pdo->prepare($query);
    $itemStmt->execute($params);
    $savedItems = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

    $doctorVisits = array_filter($savedItems, fn($i) => $i['Type'] === 'doctor_visit');
    $pharmacyItems = array_filter($savedItems, fn($i) => $i['Type'] === 'pharmacy');

    // Totals
    $roomTotal   = $roomRate * $daysAdmitted;
    $foodTotal   = $foodRate * $daysAdmitted;
    $miscTotal   = round($miscRate * $daysAdmitted, 2);
    $doctorTotal = count($doctorVisits) * 1000;
    $pharmTotal  = array_reduce(array_values($pharmacyItems), fn($carry, $i) => $carry + floatval($i['Amount']), 0);
    $grandTotal  = $roomTotal + $foodTotal + $miscTotal + $doctorTotal + $pharmTotal;

    echo json_encode([
        'success'       => true,
        'patient'       => $patient,
        'daysAdmitted'  => $daysAdmitted,
        'roomRate'      => $roomRate,
        'particulars'   => $particulars,
        'doctorVisits'  => array_values($doctorVisits),
        'pharmacyItems' => array_values($pharmacyItems),
        'totals'        => [
            'room'      => $roomTotal,
            'food'      => $foodTotal,
            'misc'      => $miscTotal,
            'doctor'    => $doctorTotal,
            'pharmacy'  => $pharmTotal,
            'grand'     => $grandTotal
        ]
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>