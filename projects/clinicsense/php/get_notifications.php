<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

try {
    $limit = intval($_GET['limit'] ?? 50);
    $unreadOnly = filter_var($_GET['unread'] ?? false, FILTER_VALIDATE_BOOLEAN);

    $notifications = fetchAdminNotifications($pdo, $limit, $unreadOnly);
    $unreadCount = countUnreadAdminNotifications($pdo);

    echo json_encode([
        'success' => true,
        'notifications' => $notifications,
        'unreadCount' => $unreadCount
    ]);
} catch (Throwable $e) {
    error_log('Error in get_notifications.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to load notifications']);
}
?>