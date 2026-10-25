<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$patientId = $_GET['patient_id'] ?? '';
if (!$patientId) {
    echo json_encode(['success' => false, 'message' => 'Missing patient ID']);
    exit;
}

try {
    // Patient info
    $stmt = $pdo->prepare('
        SELECT
            p.Patient_ID,
            p.FirstName,
            p.MiddleName,
            p.LastName,
            p.Status,
            pd.Diagnosis,
            pd.Diagnosed_by,
            ad.Admission_DateTime
        FROM patient p
        LEFT JOIN patientdiagnosis pd ON p.Patient_ID = pd.Patient_ID
        LEFT JOIN admissiondischarge ad ON p.Patient_ID = ad.Patient_ID
        WHERE p.Patient_ID = ?
        ORDER BY ad.Admission_DateTime DESC, pd.Date DESC
        LIMIT 1
    ');
    $stmt->execute([$patientId]);
    $patient = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$patient) {
        echo json_encode(['success' => false, 'message' => 'Patient not found']);
        exit;
    }

    // Payment bills from patientbill
    $billStmt = $pdo->prepare('
        SELECT
            Bill_ID,
            Date,
            Payer_Name,
            BankCard,
            Amount,
            Status
        FROM patientbill
        WHERE Patient_ID = ?
        ORDER BY Date DESC
    ');
    $billStmt->execute([$patientId]);
    $bills = $billStmt->fetchAll(PDO::FETCH_ASSOC);

    // Outstanding balance from patientbill
    $unpaidTotal = array_reduce($bills, function($carry, $bill) {
        if (strtolower($bill['Status']) !== 'paid') {
            $carry += floatval($bill['Amount']);
        }
        return $carry;
    }, 0);

    // Also pull from balance table using Patient_ID now (no more name matching)
    $balanceStmt = $pdo->prepare('
        SELECT
            b.Balance_ID,
            b.Name,
            b.Amount AS totalBill,
            b.DueDate,
            COALESCE(SUM(CASE WHEN pb.Status = "paid" THEN pb.Amount ELSE 0 END), 0) AS paidAmount
        FROM balance b
        LEFT JOIN patientbill pb ON pb.Patient_ID = b.Patient_ID
        WHERE b.Patient_ID = ?
        GROUP BY b.Balance_ID, b.Name, b.Amount, b.DueDate
    ');
    $balanceStmt->execute([$patientId]);
    $balances = $balanceStmt->fetchAll(PDO::FETCH_ASSOC);

    // Merge balance records into bills if there's still an unpaid net amount
    foreach ($balances as $balance) {
        $netAmount = max(floatval($balance['totalBill']) - floatval($balance['paidAmount']), 0);
        if ($netAmount > 0) {
            $bills[] = [
                'Bill_ID'    => 'balance_' . $balance['Balance_ID'],
                'Date'       => $balance['DueDate'],
                'Payer_Name' => $balance['Name'],
                'BankCard'   => 'Balance',
                'Amount'     => $netAmount,
                'Status'     => 'unpaid'
            ];
            $unpaidTotal += $netAmount;
        }
    }

    echo json_encode([
        'success'       => true,
        'patient'       => $patient,
        'bills'         => $bills,
        'unpaidBalance' => $unpaidTotal
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>