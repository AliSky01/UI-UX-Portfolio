<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

if (!isset($_SESSION['reset_verified']) || !$_SESSION['reset_verified']) {
    echo json_encode(['success' => false, 'message' => 'Not verified. Please restart the process']);
    exit;
}

$password = $_POST['password'] ?? '';

if (strlen($password) < 8) {
    echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters']);
    exit;
}

$email          = $_SESSION['reset_email'] ?? '';
$hashedPassword = password_hash($password, PASSWORD_BCRYPT);

$stmt = $pdo->prepare('UPDATE Guardian SET Password = ? WHERE Email = ?');
$stmt->execute([$hashedPassword, $email]);

unset($_SESSION['reset_verified'], $_SESSION['reset_email'], $_SESSION['reset_user_type']);

echo json_encode(['success' => true]);
?>