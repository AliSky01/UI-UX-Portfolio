<?php
header('Content-Type: application/json');
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

$code = trim($_POST['code'] ?? '');

if (empty($code)) {
    echo json_encode(['success' => false, 'message' => 'Please enter the confirmation code']);
    exit;
}

if (!isset($_SESSION['confirmation_code']) || !isset($_SESSION['code_expires'])) {
    echo json_encode(['success' => false, 'message' => 'No confirmation code found. Please register again']);
    exit;
}

if (time() > $_SESSION['code_expires']) {
    unset($_SESSION['confirmation_code'], $_SESSION['code_expires']);
    echo json_encode(['success' => false, 'message' => 'Code has expired. Please request a new one']);
    exit;
}

if ($code !== $_SESSION['confirmation_code']) {
    echo json_encode(['success' => false, 'message' => 'Incorrect code. Please try again']);
    exit;
}

unset($_SESSION['confirmation_code'], $_SESSION['code_expires']);
$_SESSION['email_verified'] = true;

echo json_encode(['success' => true]);
?>