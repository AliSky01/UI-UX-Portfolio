<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

try {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['success' => false, 'message' => 'Not logged in']);
        exit;
    }

    // determine recipient role based on session (fallback to 'guardian')
    $role = strtolower(trim($_SESSION['user_type'] ?? 'guardian'));
    if ($role === '') $role = 'guardian';

    $limit = intval($_GET['limit'] ?? 50);
    $unreadOnly = filter_var($_GET['unread'] ?? false, FILTER_VALIDATE_BOOLEAN);

    // reuse notification_service table ensure
    ensureNotificationsTable($pdo);

    $params = [];
    // If guardian, restrict to notifications that reference this guardian's patients
    if ($role === 'guardian') {
        $guardianId = (int) ($_SESSION['user_id'] ?? 0);
        // get patient IDs for this guardian
        $pstmt = $pdo->prepare('SELECT Patient_ID FROM `clinicsense`.`patient` WHERE Guardian_ID = ?');
        $pstmt->execute([$guardianId]);
        $patientIds = $pstmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

        if (empty($patientIds)) {
            echo json_encode(['success' => true, 'notifications' => [], 'unreadCount' => 0]);
            exit;
        }

        // build placeholders for IN
        $placeholders = implode(',', array_fill(0, count($patientIds), '?'));
        $sql = "SELECT notification_id, recipient_role, category, action_type, title, message, entity_type, entity_id, patient_id, patient_name, created_by_staff_id, created_by_name, created_at, is_read FROM `clinicsense`.`notifications` WHERE recipient_role = 'guardian' AND patient_id IN ($placeholders)";
        $params = $patientIds;
        if ($unreadOnly) {
            $sql .= ' AND is_read = 0';
        }
        $sql .= ' ORDER BY created_at DESC, notification_id DESC LIMIT ' . max(1, min($limit, 200));

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $countSql = "SELECT COUNT(*) FROM `clinicsense`.`notifications` WHERE recipient_role = 'guardian' AND patient_id IN ($placeholders) AND is_read = 0";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($patientIds);
        $unreadCount = (int) $countStmt->fetchColumn();
    } else {
        $sql = '
        SELECT notification_id, recipient_role, category, action_type, title, message, entity_type, entity_id, patient_id, patient_name, created_by_staff_id, created_by_name, created_at, is_read
        FROM `clinicsense`.`notifications`
        WHERE recipient_role = ?'
        ;

        $params = [$role];
        if ($unreadOnly) {
            $sql .= ' AND is_read = 0';
        }
        $sql .= ' ORDER BY created_at DESC, notification_id DESC LIMIT ' . max(1, min($limit, 200));

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $countStmt = $pdo->prepare('SELECT COUNT(*) FROM `clinicsense`.`notifications` WHERE recipient_role = ? AND is_read = 0');
        $countStmt->execute([$role]);
        $unreadCount = (int) $countStmt->fetchColumn();
    }

    echo json_encode([
        'success' => true,
        'notifications' => $notifications,
        'unreadCount' => $unreadCount
    ]);
} catch (Throwable $e) {
    error_log('Error in get_user_notifications.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to load notifications']);
}

?>
