<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$stmt = $pdo->prepare('SELECT Staff_ID, Role, FirstName, LastName, Username, Contact_No, is_online, created_at FROM Staffs ORDER BY created_at DESC');
$stmt->execute();
$staffs = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(['success' => true, 'staffs' => $staffs]);
?>