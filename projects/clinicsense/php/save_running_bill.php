<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$input      = json_decode(file_get_contents('php://input'), true);
$patient_id = $input['patient_id'] ?? '';
$bill_id    = $input['bill_id'] ?? null;
$items      = $input['items'] ?? [];
$grandTotal = $input['grand_total'] ?? 0;

if (!$patient_id || empty($items)) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

try {
    // Delete existing unsaved items for this patient
    if ($bill_id) {
        $del = $pdo->prepare('DELETE FROM bill_items WHERE Patient_ID = ? AND Bill_ID = ?');
        $del->execute([$patient_id, $bill_id]);
    } else {
        $del = $pdo->prepare('DELETE FROM bill_items WHERE Patient_ID = ? AND Bill_ID IS NULL');
        $del->execute([$patient_id]);
    }

    // Insert new items
    $insert = $pdo->prepare('
        INSERT INTO bill_items (Bill_ID, Patient_ID, Type, Description, Rate, Days, Quantity, Amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ');

    foreach ($items as $item) {
        $insert->execute([
            $bill_id,
            $patient_id,
            $item['type'],
            $item['description'],
            $item['rate'] ?? 0,
            $item['days'] ?? 0,
            $item['quantity'] ?? 1,
            $item['amount']
        ]);
    }

    // Update the bill amount if bill_id exists
    if ($bill_id) {
        $update = $pdo->prepare('UPDATE patientbill SET Amount = ? WHERE Bill_ID = ?');
        $update->execute([$grandTotal, $bill_id]);
    }

    echo json_encode(['success' => true, 'grand_total' => $grandTotal]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>