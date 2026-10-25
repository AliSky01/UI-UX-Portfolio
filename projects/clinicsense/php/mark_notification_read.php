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
    $notificationId = intval($_POST['notification_id'] ?? 0);
    $affected = markAdminNotificationRead($pdo, $notificationId > 0 ? $notificationId : null);

    echo json_encode([
        'success' => true,
        'affected' => $affected,
        'unreadCount' => countUnreadAdminNotifications($pdo)
    ]);
} catch (Throwable $e) {
    error_log('Error in mark_notification_read.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to update notification']);
}
?>