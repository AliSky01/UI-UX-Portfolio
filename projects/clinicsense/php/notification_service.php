<?php
function ensureNotificationsTable(PDO $pdo): void
{
    static $initialized = false;

    if ($initialized) {
        return;
    }

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS `clinicsense`.`notifications` (
            `notification_id` INT AUTO_INCREMENT PRIMARY KEY,
            `recipient_role` VARCHAR(50) NOT NULL DEFAULT \'admin\',
            `category` VARCHAR(50) NOT NULL,
            `action_type` VARCHAR(100) NOT NULL,
            `title` VARCHAR(255) NOT NULL,
            `message` TEXT NOT NULL,
            `entity_type` VARCHAR(100) DEFAULT NULL,
            `entity_id` INT DEFAULT NULL,
            `patient_id` INT DEFAULT NULL,
            `patient_name` VARCHAR(255) DEFAULT NULL,
            `created_by_staff_id` INT DEFAULT NULL,
            `created_by_name` VARCHAR(255) DEFAULT NULL,
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `is_read` TINYINT(1) NOT NULL DEFAULT 0,
            `read_at` TIMESTAMP NULL DEFAULT NULL,
            INDEX `idx_notifications_recipient_read` (`recipient_role`, `is_read`, `created_at`),
            INDEX `idx_notifications_category` (`category`),
            INDEX `idx_notifications_entity` (`entity_type`, `entity_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');

    $initialized = true;
}

function normalizeNotificationText($value, ?string $fallback = ''): ?string
{
    if (!is_scalar($value)) {
        return $fallback;
    }

    $text = trim((string) $value);
    return $text === '' ? $fallback : $text;
}

function lookupStaffDisplayName(PDO $pdo, ?int $staffId): string
{
    if (!$staffId) {
        return '';
    }

    $stmt = $pdo->prepare('SELECT FirstName, LastName, Role FROM `clinicsense`.`Staffs` WHERE Staff_ID = ? LIMIT 1');
    $stmt->execute([$staffId]);
    $staff = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$staff) {
        return '';
    }

    $fullName = trim((string) ($staff['FirstName'] ?? '') . ' ' . (string) ($staff['LastName'] ?? ''));
    $role = strtolower(trim((string) ($staff['Role'] ?? '')));

    if ($role === 'doctor' && stripos($fullName, 'dr.') !== 0) {
        return 'Dr. ' . $fullName;
    }

    return $fullName;
}

function lookupPatientDisplayName(PDO $pdo, ?int $patientId): string
{
    if (!$patientId) {
        return '';
    }

    $stmt = $pdo->prepare('
        SELECT FirstName, MiddleName, LastName
        FROM `clinicsense`.`patient`
        WHERE Patient_ID = ?
        LIMIT 1
    ');
    $stmt->execute([$patientId]);
    $patient = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$patient) {
        return 'Patient #' . $patientId;
    }

    $parts = [
        normalizeNotificationText($patient['FirstName'] ?? null),
        normalizeNotificationText($patient['MiddleName'] ?? null),
        normalizeNotificationText($patient['LastName'] ?? null)
    ];

    $name = trim(implode(' ', array_filter($parts)));
    return $name !== '' ? $name : 'Patient #' . $patientId;
}

function createAdminNotification(PDO $pdo, array $payload): void
{
    ensureNotificationsTable($pdo);

    $stmt = $pdo->prepare('
        INSERT INTO `clinicsense`.`notifications` (
            recipient_role,
            category,
            action_type,
            title,
            message,
            entity_type,
            entity_id,
            patient_id,
            patient_name,
            created_by_staff_id,
            created_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');

    $stmt->execute([
        'admin',
        normalizeNotificationText($payload['category'] ?? null, 'update'),
        normalizeNotificationText($payload['action_type'] ?? null, 'update'),
        normalizeNotificationText($payload['title'] ?? null, 'System update'),
        normalizeNotificationText($payload['message'] ?? null, 'An update is available.'),
        normalizeNotificationText($payload['entity_type'] ?? null, null),
        isset($payload['entity_id']) ? (int) $payload['entity_id'] : null,
        isset($payload['patient_id']) ? (int) $payload['patient_id'] : null,
        normalizeNotificationText($payload['patient_name'] ?? null, null),
        isset($payload['created_by_staff_id']) ? (int) $payload['created_by_staff_id'] : null,
        normalizeNotificationText($payload['created_by_name'] ?? null, null)
    ]);
}

function createNotification(PDO $pdo, array $payload): void
{
    ensureNotificationsTable($pdo);

    $recipient = normalizeNotificationText($payload['recipient_role'] ?? null, 'admin');

    $stmt = $pdo->prepare('
        INSERT INTO `clinicsense`.`notifications` (
            recipient_role,
            category,
            action_type,
            title,
            message,
            entity_type,
            entity_id,
            patient_id,
            patient_name,
            created_by_staff_id,
            created_by_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');

    $stmt->execute([
        $recipient,
        normalizeNotificationText($payload['category'] ?? null, 'update'),
        normalizeNotificationText($payload['action_type'] ?? null, 'update'),
        normalizeNotificationText($payload['title'] ?? null, 'System update'),
        normalizeNotificationText($payload['message'] ?? null, 'An update is available.'),
        normalizeNotificationText($payload['entity_type'] ?? null, null),
        isset($payload['entity_id']) ? (int) $payload['entity_id'] : null,
        isset($payload['patient_id']) ? (int) $payload['patient_id'] : null,
        normalizeNotificationText($payload['patient_name'] ?? null, null),
        isset($payload['created_by_staff_id']) ? (int) $payload['created_by_staff_id'] : null,
        normalizeNotificationText($payload['created_by_name'] ?? null, null)
    ]);
}

function fetchAdminNotifications(PDO $pdo, int $limit = 50, bool $unreadOnly = false): array
{
    ensureNotificationsTable($pdo);
    $limit = max(1, min($limit, 100));

    $sql = '
        SELECT
            notification_id,
            category,
            action_type,
            title,
            message,
            entity_type,
            entity_id,
            patient_id,
            patient_name,
            created_by_staff_id,
            created_by_name,
            created_at,
            is_read
        FROM `clinicsense`.`notifications`
        WHERE recipient_role = ?';

    $params = ['admin'];
    if ($unreadOnly) {
        $sql .= ' AND is_read = 0';
    }

    $sql .= ' ORDER BY created_at DESC, notification_id DESC LIMIT ' . $limit;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function countUnreadAdminNotifications(PDO $pdo): int
{
    ensureNotificationsTable($pdo);

    $stmt = $pdo->prepare('
        SELECT COUNT(*)
        FROM `clinicsense`.`notifications`
        WHERE recipient_role = ? AND is_read = 0
    ');
    $stmt->execute(['admin']);

    return (int) $stmt->fetchColumn();
}

function markAdminNotificationRead(PDO $pdo, ?int $notificationId = null): int
{
    ensureNotificationsTable($pdo);

    if ($notificationId && $notificationId > 0) {
        $stmt = $pdo->prepare('
            UPDATE `clinicsense`.`notifications`
            SET is_read = 1,
                read_at = NOW()
            WHERE recipient_role = ?
              AND notification_id = ?
        ');
        $stmt->execute(['admin', $notificationId]);

        return $stmt->rowCount();
    }

    $stmt = $pdo->prepare('
        UPDATE `clinicsense`.`notifications`
        SET is_read = 1,
            read_at = NOW()
        WHERE recipient_role = ? AND is_read = 0
    ');
    $stmt->execute(['admin']);

    return $stmt->rowCount();
}

function clearAdminNotifications(PDO $pdo): int
{
    ensureNotificationsTable($pdo);

    $stmt = $pdo->prepare('DELETE FROM `clinicsense`.`notifications` WHERE recipient_role = ?');
    $stmt->execute(['admin']);

    return $stmt->rowCount();
}
?>