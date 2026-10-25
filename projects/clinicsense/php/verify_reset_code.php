<?php
header('Content-Type: application/json');
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

$code = trim($_POST['code'] ?? '');

if (empty($code)) {
    echo json_encode(['success' => false, 'message' => 'Please enter the code']);
    exit;
}

if (!isset($_SESSION['reset_code']) || !isset($_SESSION['reset_expires'])) {
    echo json_encode(['success' => false, 'message' => 'No reset code found. Please try again']);
    exit;
}

if (time() > $_SESSION['reset_expires']) {
    unset($_SESSION['reset_code'], $_SESSION['reset_expires']);
    echo json_encode(['success' => false, 'message' => 'Code has expired. Please request a new one']);
    exit;
}

if ($code !== $_SESSION['reset_code']) {
    echo json_encode(['success' => false, 'message' => 'Incorrect code. Please try again']);
    exit;
}

unset($_SESSION['reset_code'], $_SESSION['reset_expires']);
$_SESSION['reset_verified'] = true;

echo json_encode(['success' => true]);
?>