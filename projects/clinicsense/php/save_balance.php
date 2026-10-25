<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$patient_id = $_POST['patient_id'] ?? '';
$name       = $_POST['patient_name'] ?? '';
$amount     = $_POST['total_bill']   ?? 0;
$dueDate    = $_POST['admission_date'] ?? date('Y-m-d');

if (!$patient_id || !$name || !$amount) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

try {
    $stmt = $pdo->prepare('
        INSERT INTO balance (Staff_ID, Patient_ID, Name, Amount, DueDate)
        VALUES (?, ?, ?, ?, ?)
    ');
    $stmt->execute([$_SESSION['user_id'], $patient_id, $name, $amount, $dueDate]);

    createAdminNotification($pdo, [
        'category'            => 'billing',
        'action_type'         => 'balance_created',
        'title'               => 'New unpaid balance added',
        'message'             => 'A new balance was created for ' . $name . ' with an amount of PHP ' . $amount . '.',
        'entity_type'         => 'balance',
        'entity_id'           => (int) $pdo->lastInsertId(),
        'patient_id'          => (int) $patient_id,
        'patient_name'        => $name,
        'created_by_staff_id' => (int) $_SESSION['user_id'],
        'created_by_name'     => lookupStaffDisplayName($pdo, (int) $_SESSION['user_id'])
    ]);

    echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>