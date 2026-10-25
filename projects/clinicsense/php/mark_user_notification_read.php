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
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        exit;
    }

    $notificationId = intval($_POST['notification_id'] ?? 0);
    if ($notificationId <= 0) {
        // mark all as read for this recipient
        $role = strtolower(trim($_SESSION['user_type'] ?? 'guardian')) ?: 'guardian';
        $stmt = $pdo->prepare('UPDATE `clinicsense`.`notifications` SET is_read = 1, read_at = NOW() WHERE recipient_role = ? AND is_read = 0');
        $stmt->execute([$role]);
        $affected = $stmt->rowCount();
    } else {
        $stmt = $pdo->prepare('UPDATE `clinicsense`.`notifications` SET is_read = 1, read_at = NOW() WHERE notification_id = ?');
        $stmt->execute([$notificationId]);
        $affected = $stmt->rowCount();
    }

    // return new unread count for role (guardians limited to their patients)
    $role = strtolower(trim($_SESSION['user_type'] ?? 'guardian')) ?: 'guardian';
    if ($role === 'guardian') {
        $guardianId = (int) ($_SESSION['user_id'] ?? 0);
        $pstmt = $pdo->prepare('SELECT Patient_ID FROM `clinicsense`.`patient` WHERE Guardian_ID = ?');
        $pstmt->execute([$guardianId]);
        $patientIds = $pstmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
        if (empty($patientIds)) {
            $unreadCount = 0;
        } else {
            $placeholders = implode(',', array_fill(0, count($patientIds), '?'));
            $cstmt = $pdo->prepare("SELECT COUNT(*) FROM `clinicsense`.`notifications` WHERE recipient_role = 'guardian' AND patient_id IN ($placeholders) AND is_read = 0");
            $cstmt->execute($patientIds);
            $unreadCount = (int) $cstmt->fetchColumn();
        }
    } else {
        $cstmt = $pdo->prepare('SELECT COUNT(*) FROM `clinicsense`.`notifications` WHERE recipient_role = ? AND is_read = 0');
        $cstmt->execute([$role]);
        $unreadCount = (int) $cstmt->fetchColumn();
    }

    echo json_encode(['success' => true, 'affected' => $affected, 'unreadCount' => $unreadCount]);
} catch (Throwable $e) {
    error_log('Error in mark_user_notification_read.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to update notification']);
}

?>
