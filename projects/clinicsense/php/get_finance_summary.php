<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

try {
    $consultationFee = 1000;

    // Income = paid patientbill + completed consultation fees
    $incomeStmt = $pdo->query('
        SELECT SUM(Amount) as total 
        FROM patientbill 
        WHERE LOWER(COALESCE(Status, "")) = "paid"
    ');
    $income = $incomeStmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0;

    $consultStmt = $pdo->query('
        SELECT COUNT(*) as total
        FROM Appointments
        WHERE LOWER(COALESCE(Status, "")) IN ("complete", "completed")
    ');
    $consultCount = $consultStmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0;
    $income += ((int) $consultCount) * $consultationFee;

    $chargeRows = $pdo->query('
        SELECT
            COALESCE((SELECT SUM(Amount) FROM bill_items bi WHERE bi.Patient_ID = p.Patient_ID), 0) AS charge,
            COALESCE((
                SELECT SUM(Amount)
                FROM patientbill pb
                WHERE pb.Patient_ID = p.Patient_ID
                  AND LOWER(COALESCE(pb.Status, "")) IN ("paid", "partial")
            ), 0) AS paid
        FROM patient p
    ')->fetchAll(PDO::FETCH_ASSOC);

    $totalUnpaid = 0;
    foreach ($chargeRows as $row) {
        $totalUnpaid += max(((float) $row['charge']) - ((float) $row['paid']), 0);
    }

    echo json_encode([
        'success'      => true,
        'income'       => (float) $income,
        'unpaidBalance'=> (float) $totalUnpaid
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>