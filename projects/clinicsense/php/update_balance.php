<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$id     = $_POST['id']           ?? '';
$source = $_POST['source']       ?? '';
$name   = $_POST['patient_name'] ?? '';
$amount = $_POST['total_bill']   ?? 0;
$due    = $_POST['admission_date'] ?? date('Y-m-d');
$status = $_POST['status']       ?? 'Pending';

if (!$id || !$source) {
    echo json_encode(['success' => false, 'message' => 'Missing ID or source']);
    exit;
}

try {
    if ($source === 'balance') {
        $stmt = $pdo->prepare('UPDATE balance SET Name = ?, Amount = ?, DueDate = ? WHERE Balance_ID = ?');
        $stmt->execute([$name, $amount, $due, $id]);
    } else {
        $stmt = $pdo->prepare('UPDATE patientbill SET Status = ? WHERE Bill_ID = ?');
        $stmt->execute([strtolower($status), $id]);
    }

    createAdminNotification($pdo, [
        'category' => 'billing',
        'action_type' => 'billing_updated',
        'title' => 'Billing record updated',
        'message' => $source === 'balance'
            ? 'Balance details were updated for ' . ($name ?: ('record #' . $id)) . '.'
            : 'Billing status was updated to ' . strtolower($status) . ' for bill #' . $id . '.',
        'entity_type' => $source === 'balance' ? 'balance' : 'patientbill',
        'entity_id' => (int) $id,
        'patient_name' => $name ?: null,
        'created_by_staff_id' => (int) $_SESSION['user_id'],
        'created_by_name' => lookupStaffDisplayName($pdo, (int) $_SESSION['user_id'])
    ]);

    // If this is a patient bill update and status is not paid, notify guardian of the patient
    try {
        if ($source !== 'balance') {
            $billStmt = $pdo->prepare('SELECT Patient_ID FROM patientbill WHERE Bill_ID = ? LIMIT 1');
            $billStmt->execute([$id]);
            $billRow = $billStmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $patientId = isset($billRow['Patient_ID']) ? (int) $billRow['Patient_ID'] : 0;
            if ($patientId > 0 && strtolower($status) !== 'paid') {
                $pstmt = $pdo->prepare('SELECT Guardian_ID FROM `clinicsense`.`patient` WHERE Patient_ID = ? LIMIT 1');
                $pstmt->execute([$patientId]);
                $p = $pstmt->fetch(PDO::FETCH_ASSOC) ?: [];
                $guardianId = isset($p['Guardian_ID']) ? (int) $p['Guardian_ID'] : 0;
                $patientName = lookupPatientDisplayName($pdo, $patientId);
                if ($guardianId > 0) {
                    createNotification($pdo, [
                        'recipient_role' => 'guardian',
                        'category' => 'billing',
                        'action_type' => 'billing_updated',
                        'title' => 'Billing updated',
                        'message' => 'A billing record for ' . $patientName . ' was updated. Outstanding: ' . $amount . '.',
                        'entity_type' => 'patientbill',
                        'entity_id' => (int) $id,
                        'patient_id' => $patientId,
                        'patient_name' => $patientName,
                        'created_by_staff_id' => (int) $_SESSION['user_id'],
                        'created_by_name' => lookupStaffDisplayName($pdo, (int) $_SESSION['user_id'])
                    ]);
                }
            }
        }
    } catch (Exception $e) {
        // ignore non-fatal notification error
    }

    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>