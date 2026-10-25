<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$id     = $_POST['id']     ?? '';
$source = $_POST['source'] ?? '';

if (!$id || !$source) {
    echo json_encode(['success' => false, 'message' => 'Missing ID or source']);
    exit;
}

try {
    if ($source === 'balance') {
        $lookupStmt = $pdo->prepare('SELECT Name FROM balance WHERE Balance_ID = ? LIMIT 1');
        $lookupStmt->execute([$id]);
        $record = $lookupStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $stmt = $pdo->prepare('DELETE FROM balance WHERE Balance_ID = ?');
        $stmt->execute([$id]);

        createAdminNotification($pdo, [
            'category' => 'billing',
            'action_type' => 'balance_deleted',
            'title' => 'Balance record removed',
            'message' => 'A balance record' . (!empty($record['Name']) ? ' for ' . $record['Name'] : '') . ' was deleted.',
            'entity_type' => 'balance',
            'entity_id' => (int) $id,
            'patient_name' => normalizeNotificationText($record['Name'] ?? null, null),
            'created_by_staff_id' => (int) $_SESSION['user_id'],
            'created_by_name' => lookupStaffDisplayName($pdo, (int) $_SESSION['user_id'])
        ]);
    } else {
        $lookupStmt = $pdo->prepare('SELECT Patient_ID FROM patientbill WHERE Bill_ID = ? LIMIT 1');
        $lookupStmt->execute([$id]);
        $record = $lookupStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $stmt = $pdo->prepare('DELETE FROM patientbill WHERE Bill_ID = ?');
        $stmt->execute([$id]);

        $patientId = isset($record['Patient_ID']) ? (int) $record['Patient_ID'] : null;
        $patientName = lookupPatientDisplayName($pdo, $patientId);
        createAdminNotification($pdo, [
            'category' => 'billing',
            'action_type' => 'billing_deleted',
            'title' => 'Billing record removed',
            'message' => 'A billing record for ' . $patientName . ' was deleted.',
            'entity_type' => 'patientbill',
            'entity_id' => (int) $id,
            'patient_id' => $patientId,
            'patient_name' => $patientName,
            'created_by_staff_id' => (int) $_SESSION['user_id'],
            'created_by_name' => lookupStaffDisplayName($pdo, (int) $_SESSION['user_id'])
        ]);
    }

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>