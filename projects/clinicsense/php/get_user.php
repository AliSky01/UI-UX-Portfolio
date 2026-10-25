<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

try {
    $type = $_SESSION['user_type'] ?? 'guardian';

    if ($type === 'staff') {
        $stmt = $pdo->prepare('SELECT FirstName as firstname, LastName as lastname, Role as role FROM Staffs WHERE Staff_ID = ?');
    } else {
        $stmt = $pdo->prepare('
            SELECT 
                FirstName     as firstname,
                MiddleInitial as middlename,
                LastName      as lastname,
                Contact_No    as contact,
                Address       as address,
                NULL          as relation,
                NULL          as income,
                "patient"     as role
            FROM Guardian WHERE Guardian_ID = ?
        ');
    }

    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to load user']);
    exit;
}

if (!$user) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'User not found']);
    exit;
}

echo json_encode(['success' => true, 'user' => $user]);
?>