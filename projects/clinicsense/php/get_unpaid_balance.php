<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

try {
    // Unpaid from patientbill
    $billStmt = $pdo->query('
        SELECT 
            pb.Bill_ID,
            pb.Patient_ID,
            pb.Date,
            pb.Amount,
            pb.Status,
            CONCAT(p.FirstName, " ", p.LastName) as PatientName,
            ad.Admission_DateTime as AdmissionDate
        FROM patientbill pb
        LEFT JOIN patient p ON pb.Patient_ID = p.Patient_ID
        LEFT JOIN admissiondischarge ad ON pb.Patient_ID = ad.Patient_ID
        WHERE pb.Status = "unpaid"
        ORDER BY pb.Date DESC
    ');
    $unpaidBills = $billStmt->fetchAll(PDO::FETCH_ASSOC);

    // From balance table with paid amounts
    $balanceStmt = $pdo->query('
        SELECT b.Balance_ID, b.Name, b.Amount as totalBill, b.DueDate, COALESCE(SUM(pb.Amount), 0) as paidAmount
        FROM balance b
        LEFT JOIN patientbill pb ON pb.Payer_Name = b.Name AND pb.Status = "paid"
        GROUP BY b.Balance_ID, b.Name, b.Amount, b.DueDate
    ');
    $balances = $balanceStmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success'      => true,
        'unpaidBills'  => $unpaidBills,
        'balances'     => $balances
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>