<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$bill_id    = $_GET['bill_id'] ?? '';
$patient_id = $_GET['patient_id'] ?? '';

if (!$bill_id || !$patient_id) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

try {
    // Get bill info
    $billStmt = $pdo->prepare('
        SELECT 
            pb.*,
            p.FirstName, p.MiddleName, p.LastName,
            p.Room_type, p.Status,
            ad.Admission_DateTime,
            ad.Discharge_DateTime
        FROM patientbill pb
        JOIN patient p ON pb.Patient_ID = p.Patient_ID
        LEFT JOIN admissiondischarge ad ON p.Patient_ID = ad.Patient_ID
        WHERE pb.Bill_ID = ? AND pb.Patient_ID = ?
        ORDER BY ad.Admission_DateTime DESC
        LIMIT 1
    ');
    $billStmt->execute([$bill_id, $patient_id]);
    $bill = $billStmt->fetch(PDO::FETCH_ASSOC);

    if (!$bill) {
        echo json_encode(['success' => false, 'message' => 'Bill not found']);
        exit;
    }

    // Get all items for this bill
    $itemStmt = $pdo->prepare('
        SELECT * FROM bill_items 
        WHERE Bill_ID = ? AND Patient_ID = ?
        ORDER BY Type ASC
    ');
    $itemStmt->execute([$bill_id, $patient_id]);
    $items = $itemStmt->fetchAll(PDO::FETCH_ASSOC);

    // Group by type
    $particulars   = array_values(array_filter($items, fn($i) => in_array($i['Type'], ['room', 'food', 'misc'])));
    $doctorVisits  = array_values(array_filter($items, fn($i) => $i['Type'] === 'doctor_visit'));
    $pharmacyItems = array_values(array_filter($items, fn($i) => $i['Type'] === 'pharmacy'));

    echo json_encode([
        'success'       => true,
        'bill'          => $bill,
        'particulars'   => $particulars,
        'doctorVisits'  => $doctorVisits,
        'pharmacyItems' => $pharmacyItems
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>