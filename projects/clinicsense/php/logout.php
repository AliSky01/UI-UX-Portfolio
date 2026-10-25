<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (isset($_SESSION['user_id']) && $_SESSION['user_type'] === 'staff') {
    // Update Staffs table
    $pdo->prepare('UPDATE Staffs SET is_online = 0, logout_time = NOW() WHERE Staff_ID = ?')
        ->execute([$_SESSION['user_id']]);

    // Update the latest log entry with logout time
    $pdo->prepare('
        UPDATE Staff_Logs SET logout_time = NOW() 
        WHERE Staff_ID = ? AND logout_time IS NULL 
        ORDER BY login_time DESC LIMIT 1
    ')->execute([$_SESSION['user_id']]);
}

session_destroy();
setcookie('remember_user', '', time() - 3600, '/');
setcookie('remember_type', '', time() - 3600, '/');

echo json_encode(['success' => true]);
?>