<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

try {
    $deleted = clearAdminNotifications($pdo);

    echo json_encode([
        'success' => true,
        'deleted' => $deleted,
        'unreadCount' => 0
    ]);
} catch (Throwable $e) {
    error_log('Error in clear_notifications.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to clear notifications']);
}
?>