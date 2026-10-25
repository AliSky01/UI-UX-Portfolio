<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

$email = strtolower(trim($_POST['email'] ?? ''));
if ($email === '') {
    echo json_encode(['success' => false, 'message' => 'Please enter an email']);
    exit;
}

$pages = [
    'admin' => '../admin/admindashboard.html',
    'doctor' => '../doctor/doctordashboard.html',
    'nurse' => '../nurse/nursedashboard.html',
    'receptionist' => '../receptionist/receptionistdashboard.html',
    'finance' => '../finance/finances.html',
    'guardian' => 'dashboard.html',
];

function startStaffSession(PDO $pdo, array $user): void
{
    $_SESSION['user_id'] = $user['Staff_ID'];
    $_SESSION['username'] = $user['Username'];
    $_SESSION['role'] = $user['Role'];
    $_SESSION['user_type'] = 'staff';

    try {
        $pdo->prepare('UPDATE Staffs SET is_online = 1, login_time = NOW(), logout_time = NULL WHERE Staff_ID = ?')
            ->execute([$user['Staff_ID']]);
        $pdo->prepare('INSERT INTO Staff_Logs (Staff_ID, login_time) VALUES (?, NOW())')
            ->execute([$user['Staff_ID']]);
    } catch (Throwable $e) {
        error_log('hardcoded session staff log: ' . $e->getMessage());
    }
}

function startGuardianSession(array $user): void
{
    $_SESSION['user_id'] = $user['Guardian_ID'];
    $_SESSION['username'] = $user['Username'];
    $_SESSION['role'] = 'patient';
    $_SESSION['user_type'] = 'guardian';
}

function respond(string $roleKey, array $pages): void
{
    echo json_encode([
        'success' => true,
        'role' => $roleKey === 'guardian' ? 'patient' : $roleKey,
        'page' => $pages[$roleKey],
    ]);
    exit;
}

try {
    $guardian = $pdo->prepare('SELECT * FROM Guardian WHERE LOWER(Email) = ? OR LOWER(Username) = ? LIMIT 1');
    $guardian->execute([$email, $email]);
    $user = $guardian->fetch(PDO::FETCH_ASSOC);
    if ($user) {
        startGuardianSession($user);
        respond('guardian', $pages);
    }

    $staff = $pdo->prepare('SELECT * FROM Staffs WHERE LOWER(Username) = ? LIMIT 1');
    $staff->execute([$email]);
    $user = $staff->fetch(PDO::FETCH_ASSOC);
    if ($user && isset($pages[$user['Role']])) {
        startStaffSession($pdo, $user);
        respond($user['Role'], $pages);
    }

    $roleKey = null;
    $rules = [
        ['receptionist', '/receptionist|markcastillo/'],
        ['nurse', '/nurse|rachelmendoza/'],
        ['doctor', '/doctor|raven/'],
        ['finance', '/finance/'],
        ['guardian', '/guardian|patient|rossy/'],
        ['admin', '/admin|alexestrellas/'],
    ];
    foreach ($rules as [$key, $pattern]) {
        if (preg_match($pattern, $email)) {
            $roleKey = $key;
            break;
        }
    }

    if ($roleKey === null) {
        echo json_encode(['success' => false, 'message' => 'Use an email with Guardian, Admin, Doctor, Nurse, Finance, or Receptionist.']);
        exit;
    }

    if ($roleKey === 'guardian') {
        $row = $pdo->query('
            SELECT g.*
            FROM Guardian g
            ORDER BY (
                (SELECT COUNT(*) FROM patient p WHERE p.Guardian_ID = g.Guardian_ID)
                + (SELECT COUNT(*) FROM Appointments a WHERE a.Guardian_ID = g.Guardian_ID)
            ) DESC, g.Guardian_ID ASC
            LIMIT 1
        ')->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            echo json_encode(['success' => false, 'message' => 'No guardian account in the database']);
            exit;
        }
        startGuardianSession($row);
        respond('guardian', $pages);
    }

    $stmt = $pdo->prepare('SELECT * FROM Staffs WHERE Role = ? ORDER BY Staff_ID ASC LIMIT 1');
    $stmt->execute([$roleKey]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        echo json_encode(['success' => false, 'message' => 'No ' . $roleKey . ' account in the database']);
        exit;
    }
    startStaffSession($pdo, $row);
    respond($roleKey, $pages);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
}
