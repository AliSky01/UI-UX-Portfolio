<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

// Only staff/admins can remove schedule slots
if ($_SESSION['user_type'] !== 'staff') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$scheduleDate = trim($_POST['schedule_date'] ?? '');
$scheduleTime = trim($_POST['schedule_time'] ?? '');

if (!$scheduleDate && !$scheduleTime) {
    echo json_encode(['success' => false, 'message' => 'schedule_date or schedule_time is required']);
    exit;
}

try {
    if ($scheduleTime) {
        $stmt = $pdo->prepare('DELETE FROM availableschedule WHERE schedule_date = ? AND schedule_time = ?');
        $stmt->execute([$scheduleDate, $scheduleTime]);
    } else {
        $stmt = $pdo->prepare('DELETE FROM availableschedule WHERE schedule_date = ?');
        $stmt->execute([$scheduleDate]);
    }

    echo json_encode(['success' => true, 'message' => 'Schedule deleted successfully']);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
