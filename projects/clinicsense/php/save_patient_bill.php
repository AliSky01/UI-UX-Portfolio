<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$bill_id        = $_POST['bill_id']        ?? '';
$patient_id     = $_POST['patient_id']     ?? '';
$payer_name     = $_POST['payer_name']     ?? '';
$bank_card      = $_POST['bank_card']      ?? '';
$amount         = $_POST['amount']         ?? '';
$staff_id       = $_SESSION['user_id'];

if (!$bill_id || !$patient_id || !$amount) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

try {
    // Check bill exists and isn't already paid
    $checkStmt = $pdo->prepare('
        SELECT Bill_ID, Status 
        FROM patientbill 
        WHERE Bill_ID = ? AND Patient_ID = ?
    ');
    $checkStmt->execute([$bill_id, $patient_id]);
    $bill = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$bill) {
        echo json_encode(['success' => false, 'message' => 'Bill not found']);
        exit;
    }

    if (strtolower($bill['Status']) === 'paid') {
        echo json_encode(['success' => false, 'message' => 'Bill is already paid']);
        exit;
    }

    // Mark bill as paid and update amount/payer info
    $updateStmt = $pdo->prepare('
        UPDATE patientbill
        SET 
            Status     = "paid",
            Amount     = ?,
            Payer_Name = ?,
            BankCard   = ?,
            Staff_ID   = ?
        WHERE Bill_ID = ? AND Patient_ID = ?
    ');
    $updateStmt->execute([$amount, $payer_name, $bank_card, $staff_id, $bill_id, $patient_id]);

    // Link any unattached bill_items to this bill
    $linkStmt = $pdo->prepare('
        UPDATE bill_items
        SET Bill_ID = ?
        WHERE Patient_ID = ? AND Bill_ID IS NULL
    ');
    $linkStmt->execute([$bill_id, $patient_id]);

    // Send notification
    $patientName = lookupPatientDisplayName($pdo, (int) $patient_id);
    $staffName   = lookupStaffDisplayName($pdo, (int) $staff_id);

    createAdminNotification($pdo, [
        'category'            => 'billing',
        'action_type'         => 'billing_paid',
        'title'               => 'Bill marked as paid',
        'message'             => $patientName . '\'s bill has been settled amounting to PHP ' . $amount . '.',
        'entity_type'         => 'patientbill',
        'entity_id'           => (int) $bill_id,
        'patient_id'          => (int) $patient_id,
        'patient_name'        => $patientName,
        'created_by_staff_id' => (int) $staff_id,
        'created_by_name'     => $staffName
    ]);

    echo json_encode(['success' => true, 'bill_id' => $bill_id]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>