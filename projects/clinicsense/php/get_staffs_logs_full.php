<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$filter    = $_GET['filter'] ?? 'today';
$startDate = $_GET['start'] ?? '';
$endDate   = $_GET['end'] ?? '';
$month     = $_GET['month'] ?? date('m');
$year      = $_GET['year'] ?? date('Y');

if ($filter === 'today') {
    $stmt = $pdo->prepare('
        SELECT s.FirstName, s.LastName, s.Role, s.is_online,
               l.log_id, l.login_time, l.logout_time
        FROM Staff_Logs l
        JOIN Staffs s ON l.Staff_ID = s.Staff_ID
        WHERE DATE(l.login_time) = CURDATE()
        ORDER BY l.login_time DESC
    ');
    $stmt->execute();

} elseif ($filter === 'previous') {
    if ($startDate && $endDate) {
        $stmt = $pdo->prepare('
            SELECT s.FirstName, s.LastName, s.Role, s.is_online,
                   l.log_id, l.login_time, l.logout_time
            FROM Staff_Logs l
            JOIN Staffs s ON l.Staff_ID = s.Staff_ID
            WHERE DATE(l.login_time) BETWEEN ? AND ?
            AND DATE(l.login_time) < CURDATE()
            ORDER BY l.login_time DESC
        ');
        $stmt->execute([$startDate, $endDate]);
    } else {
        $stmt = $pdo->prepare('
            SELECT s.FirstName, s.LastName, s.Role, s.is_online,
                   l.log_id, l.login_time, l.logout_time
            FROM Staff_Logs l
            JOIN Staffs s ON l.Staff_ID = s.Staff_ID
            WHERE DATE(l.login_time) < CURDATE()
            ORDER BY l.login_time DESC
        ');
        $stmt->execute();
    }

} elseif ($filter === 'monthly') {
    $stmt = $pdo->prepare('
        SELECT s.FirstName, s.LastName, s.Role, s.is_online,
               l.log_id, l.login_time, l.logout_time
        FROM Staff_Logs l
        JOIN Staffs s ON l.Staff_ID = s.Staff_ID
        WHERE MONTH(l.login_time) = ? AND YEAR(l.login_time) = ?
        ORDER BY l.login_time DESC
    ');
    $stmt->execute([$month, $year]);
}

$logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['success' => true, 'logs' => $logs]);
?>