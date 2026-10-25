<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

if (!isset($_SESSION['email_verified']) || !$_SESSION['email_verified']) {
    echo json_encode(['success' => false, 'message' => 'Email not verified']);
    exit;
}

$username = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';
$user     = $_SESSION['pending_user'] ?? null;

if (!$username || !$password || !$user) {
    echo json_encode(['success' => false, 'message' => 'Missing required information']);
    exit;
}

if (strlen($password) < 8) {
    echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters']);
    exit;
}

// Check if username already exists in Guardian
$stmt = $pdo->prepare('SELECT Guardian_ID FROM Guardian WHERE Username = ?');
$stmt->execute([$username]);
if ($stmt->rowCount() > 0) {
    echo json_encode(['success' => false, 'message' => 'Username already taken']);
    exit;
}

// Check if username already exists in Staffs
$stmt = $pdo->prepare('SELECT Staff_ID FROM Staffs WHERE Username = ?');
$stmt->execute([$username]);
if ($stmt->rowCount() > 0) {
    echo json_encode(['success' => false, 'message' => 'Username already taken']);
    exit;
}

$hashedPassword = password_hash($password, PASSWORD_BCRYPT);

$stmt = $pdo->prepare('
    INSERT INTO Guardian 
    (Username, Password, FirstName, MiddleInitial, LastName, Birthdate, Sex, Email, Contact_No) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
');

$stmt->execute([
    $username,
    $hashedPassword,
    $user['firstname'],
    $user['middlename'],
    $user['lastname'],
    $user['birthdate'],
    $user['gender'],
    $user['email'],
    $user['contact']
]);

unset($_SESSION['email_verified'], $_SESSION['pending_user']);

echo json_encode(['success' => true]);
?>