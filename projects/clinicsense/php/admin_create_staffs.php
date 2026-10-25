<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$role      = strtolower(trim($_POST['role'] ?? ''));
$firstname = trim($_POST['firstname'] ?? '');
$lastname  = trim($_POST['lastname'] ?? '');
$contact   = trim($_POST['contact'] ?? '');
$username  = trim($_POST['username'] ?? '');
$password  = $_POST['password'] ?? '';

if (!$role || !$firstname || !$lastname || !$contact || !$username || !$password) {
    echo json_encode(['success' => false, 'message' => 'All fields are required']);
    exit;
}

// Check if username already exists in Staffs
$stmt = $pdo->prepare('SELECT Staff_ID FROM Staffs WHERE Username = ?');
$stmt->execute([$username]);
if ($stmt->rowCount() > 0) {
    echo json_encode(['success' => false, 'message' => 'Username already taken']);
    exit;
}

// Check if username already exists in Guardian
$stmt = $pdo->prepare('SELECT Guardian_ID FROM Guardian WHERE Username = ?');
$stmt->execute([$username]);
if ($stmt->rowCount() > 0) {
    echo json_encode(['success' => false, 'message' => 'Username already taken']);
    exit;
}

$hashedPassword = password_hash($password, PASSWORD_BCRYPT);

$stmt = $pdo->prepare('INSERT INTO Staffs (Role, Username, Password, FirstName, LastName, Contact_No) VALUES (?, ?, ?, ?, ?, ?)');
$stmt->execute([$role, $username, $hashedPassword, $firstname, $lastname, $contact]);

echo json_encode(['success' => true, 'message' => 'Account created successfully!']);
?>      