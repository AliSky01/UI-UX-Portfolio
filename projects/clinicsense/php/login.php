<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

// Auto login if cookie exists
if (!isset($_SESSION['user_id']) && isset($_COOKIE['remember_user'])) {
    $type = $_COOKIE['remember_type'] ?? 'guardian';

    if ($type === 'staff') {
        $stmt = $pdo->prepare('SELECT * FROM Staffs WHERE Staff_ID = ?');
    } else {
        $stmt = $pdo->prepare('SELECT * FROM Guardian WHERE Guardian_ID = ?');
    }

    $stmt->execute([$_COOKIE['remember_user']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        $_SESSION['user_id']   = $type === 'staff' ? $user['Staff_ID'] : $user['Guardian_ID'];
        $_SESSION['username']  = $user['Username'];
        $_SESSION['role']      = $type === 'staff' ? $user['Role'] : 'patient';
        $_SESSION['user_type'] = $type;

        // Set staff as online and record login time
        if ($type === 'staff') {
            $pdo->prepare('UPDATE Staffs SET is_online = 1, login_time = NOW(), logout_time = NULL WHERE Staff_ID = ?')
                ->execute([$user['Staff_ID']]);
            // Insert new log entry
            $pdo->prepare('INSERT INTO Staff_Logs (Staff_ID, login_time) VALUES (?, NOW())')
                ->execute([$user['Staff_ID']]);
        }

        echo json_encode(['success' => true, 'role' => $_SESSION['role']]);
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

$username = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';
$remember = $_POST['remember'] ?? 'false';

if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Please enter all fields']);
    exit;
}

// Check Staffs table first
$stmt = $pdo->prepare('SELECT * FROM Staffs WHERE Username = ?');
$stmt->execute([$username]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if ($user) {
    if (!password_verify($password, $user['Password'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
        exit;
    }

    $_SESSION['user_id']   = $user['Staff_ID'];
    $_SESSION['username']  = $user['Username'];
    $_SESSION['role']      = $user['Role'];
    $_SESSION['user_type'] = 'staff';

    // Set staff as online and record login time
    $pdo->prepare('UPDATE Staffs SET is_online = 1, login_time = NOW(), logout_time = NULL WHERE Staff_ID = ?')
        ->execute([$user['Staff_ID']]);
    // Insert new log entry
    $pdo->prepare('INSERT INTO Staff_Logs (Staff_ID, login_time) VALUES (?, NOW())')
        ->execute([$user['Staff_ID']]);

    if ($remember === 'true') {
        setcookie('remember_user', $user['Staff_ID'], time() + (30 * 24 * 60 * 60), '/');
        setcookie('remember_type', 'staff', time() + (30 * 24 * 60 * 60), '/');
    }

    echo json_encode(['success' => true, 'role' => $user['Role']]);
    exit;
}

// Check Guardian table
$stmt = $pdo->prepare('SELECT * FROM Guardian WHERE Username = ?');
$stmt->execute([$username]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Username not found']);
    exit;
}

if (!password_verify($password, $user['Password'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
    exit;
}

$_SESSION['user_id']   = $user['Guardian_ID'];
$_SESSION['username']  = $user['Username'];
$_SESSION['role']      = 'patient';
$_SESSION['user_type'] = 'guardian';

if ($remember === 'true') {
    setcookie('remember_user', $user['Guardian_ID'], time() + (30 * 24 * 60 * 60), '/');
    setcookie('remember_type', 'guardian', time() + (30 * 24 * 60 * 60), '/');
}

echo json_encode(['success' => true, 'role' => 'patient']);
?>