<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$stmt = $pdo->prepare('
    SELECT FirstName, LastName, Role, is_online, login_time, logout_time 
    FROM Staffs 
    ORDER BY login_time DESC
');
$stmt->execute();
$logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(['success' => true, 'logs' => $logs]);
?>