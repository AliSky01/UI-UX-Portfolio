<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$staff_id = $_POST['staff_id'] ?? '';

if (!$staff_id) {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

// Delete from Staff_Logs first (foreign key)
$pdo->prepare('DELETE FROM Staff_Logs WHERE Staff_ID = ?')->execute([$staff_id]);

// Then delete from Staffs
$pdo->prepare('DELETE FROM Staffs WHERE Staff_ID = ?')->execute([$staff_id]);

echo json_encode(['success' => true]);
?>