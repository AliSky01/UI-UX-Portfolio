<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

function findDiagnosisSymptomsColumn(PDO $pdo): string
{
    foreach (['Symptoms', 'observations'] as $columnName) {
        $columnStmt = $pdo->prepare("SHOW COLUMNS FROM `clinicsense`.`PatientDiagnosis` LIKE ?");
        $columnStmt->execute([$columnName]);

        if ($columnStmt->fetch(PDO::FETCH_ASSOC)) {
            return $columnName;
        }
    }

    $pdo->exec('ALTER TABLE `clinicsense`.`PatientDiagnosis` ADD COLUMN `Symptoms` TEXT NULL AFTER `notes`');

    return 'Symptoms';
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

if (!in_array(strtolower(trim($_SESSION['role'] ?? '')), ['doctor', 'admin'], true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Only doctors or admins can create diagnoses']);
    exit;
}

try {
    $patient_id  = intval($_POST['patient_id'] ?? 0);
    $diagnosis   = trim($_POST['diagnosis'] ?? '');
    $notes       = trim($_POST['notes'] ?? '');
    $symptoms    = trim($_POST['symptoms'] ?? '');
    $staff_id = $_SESSION['user_id'];
    $diagnosis_date = trim($_POST['date'] ?? date('Y-m-d'));

    if (!$patient_id || !$diagnosis) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    // Get doctor name from Staff_ID
    $doctorStmt = $pdo->prepare('SELECT FirstName, LastName FROM `clinicsense`.`Staffs` WHERE Staff_ID = ?');
    $doctorStmt->execute([$staff_id]);
    $doctor = $doctorStmt->fetch(PDO::FETCH_ASSOC);
    $diagnosed_by = ($doctor && $doctor['FirstName']) ? $doctor['FirstName'] . ' ' . $doctor['LastName'] : 'Dr. On Record';
    $symptomsColumn = findDiagnosisSymptomsColumn($pdo);

    // Insert new diagnosis with doctor's name in diagnosed_by
    $stmt = $pdo->prepare(sprintf('
        INSERT INTO `clinicsense`.`PatientDiagnosis` 
        (patient_id, diagnosis, notes, diagnosed_by, date, `%s`)
        VALUES (?, ?, ?, ?, ?, ?)
    ', $symptomsColumn));
    
    $result = $stmt->execute([$patient_id, $diagnosis, $notes, $diagnosed_by, $diagnosis_date, $symptoms]);
    
    if ($result) {
        $patientName = lookupPatientDisplayName($pdo, $patient_id);
        createAdminNotification($pdo, [
            'category' => 'diagnosis',
            'action_type' => 'diagnosis_created',
            'title' => 'New diagnosis added',
            'message' => $patientName . ' received a new diagnosis: ' . $diagnosis . '.',
            'entity_type' => 'PatientDiagnosis',
            'entity_id' => (int) $pdo->lastInsertId(),
            'patient_id' => $patient_id,
            'patient_name' => $patientName,
            'created_by_staff_id' => $staff_id,
            'created_by_name' => $diagnosed_by
        ]);

        // Notify guardian of patient about the new diagnosis
        try {
            $gstmt = $pdo->prepare('SELECT Guardian_ID FROM `clinicsense`.`patient` WHERE Patient_ID = ? LIMIT 1');
            $gstmt->execute([$patient_id]);
            $g = $gstmt->fetch(PDO::FETCH_ASSOC) ?: [];
            $guardianId = isset($g['Guardian_ID']) ? (int) $g['Guardian_ID'] : 0;
            if ($guardianId > 0) {
                createNotification($pdo, [
                    'recipient_role' => 'guardian',
                    'category' => 'diagnosis',
                    'action_type' => 'diagnosis_created',
                    'title' => 'New diagnosis added',
                    'message' => 'A new diagnosis for ' . $patientName . ': ' . $diagnosis . '.',
                    'entity_type' => 'PatientDiagnosis',
                    'entity_id' => (int) $pdo->lastInsertId(),
                    'patient_id' => $patient_id,
                    'patient_name' => $patientName,
                    'created_by_staff_id' => $staff_id,
                    'created_by_name' => $diagnosed_by
                ]);
            }
        } catch (Exception $e) {
            // ignore
        }

        echo json_encode([
            'success' => true, 
            'message' => 'Diagnosis saved successfully!',
            'data' => [
                'diagnosis' => $diagnosis,
                'date' => $diagnosis_date,
                'notes' => $notes,
                'symptoms' => $symptoms,
                'diagnosed_by' => $diagnosed_by
            ]
        ]);
    } else {
        $errorInfo = $stmt->errorInfo();
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $errorInfo[2]]);
    }
} catch (PDOException $e) {
    error_log('PDO Error in save_diagnosis.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log('Error in save_diagnosis.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>