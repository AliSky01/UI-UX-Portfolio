<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
require_once 'config.php';
session_start();

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

try {
    $patient_id = intval($_POST['patient_id'] ?? 0);
    $new_condition = trim($_POST['psychiatric_condition'] ?? '');

    if (!$patient_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Patient ID is required']);
        exit;
    }

    if (empty($new_condition)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Psychiatric condition is required']);
        exit;
    }

    // Check if patient exists
    $checkStmt = $pdo->prepare('SELECT Patient_ID FROM `clinicsense`.`patient` WHERE Patient_ID = ?');
    $checkStmt->execute([$patient_id]);
    if (!$checkStmt->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Patient not found']);
        exit;
    }

    // Get the latest medical history record
    $getHistoryStmt = $pdo->prepare('
        SELECT Medhistory_ID, psychiatric_condition
        FROM `clinicsense`.`PatientMedHistory`
        WHERE Patient_ID = ?
        ORDER BY Medhistory_ID DESC
        LIMIT 1
    ');
    $getHistoryStmt->execute([$patient_id]);
    $latestHistory = $getHistoryStmt->fetch(PDO::FETCH_ASSOC);

    // Parse existing conditions from JSON
    $conditions = [];
    if ($latestHistory && !empty($latestHistory['psychiatric_condition'])) {
        $decoded = json_decode($latestHistory['psychiatric_condition'], true);
        if (is_array($decoded)) {
            $conditions = $decoded;
        }
    }

    // Add new condition if not already present
    if (!in_array($new_condition, $conditions, true)) {
        $conditions[] = $new_condition;
    }

    $conditions_json = json_encode($conditions);

    if ($latestHistory) {
        // Update the latest record with psychiatric condition
        $stmt = $pdo->prepare('
            UPDATE `clinicsense`.`PatientMedHistory`
            SET psychiatric_condition = ?
            WHERE Medhistory_ID = ?
        ');
        
        try {
            $result = $stmt->execute([$conditions_json, $latestHistory['Medhistory_ID']]);
        } catch (PDOException $e) {
            // Column might not exist - create it
            if (strpos($e->getMessage(), 'Unknown column') !== false) {
                error_log('Creating psychiatric_condition column in PatientMedHistory...');
                $pdo->exec('ALTER TABLE `clinicsense`.`PatientMedHistory` ADD COLUMN `psychiatric_condition` JSON NULL');
                
                // Try again
                $stmt = $pdo->prepare('
                    UPDATE `clinicsense`.`PatientMedHistory`
                    SET psychiatric_condition = ?
                    WHERE Medhistory_ID = ?
                ');
                $result = $stmt->execute([$conditions_json, $latestHistory['Medhistory_ID']]);
            } else {
                throw $e;
            }
        }
    } else {
        // No medical history exists, create a new one
        $stmt = $pdo->prepare('
            INSERT INTO `clinicsense`.`PatientMedHistory` (
                Patient_ID,
                psychiatric_condition
            ) VALUES (?, ?)
        ');
        
        try {
            $result = $stmt->execute([$patient_id, $conditions_json]);
        } catch (PDOException $e) {
            // Column might not exist - create it
            if (strpos($e->getMessage(), 'Unknown column') !== false) {
                error_log('Creating psychiatric_condition column in PatientMedHistory...');
                $pdo->exec('ALTER TABLE `clinicsense`.`PatientMedHistory` ADD COLUMN `psychiatric_condition` JSON NULL');
                
                // Try again
                $stmt = $pdo->prepare('
                    INSERT INTO `clinicsense`.`PatientMedHistory` (
                        Patient_ID,
                        psychiatric_condition
                    ) VALUES (?, ?)
                ');
                $result = $stmt->execute([$patient_id, $conditions_json]);
            } else {
                throw $e;
            }
        }
    }
    
    if ($result) {
        error_log("Successfully updated psychiatric_condition for patient $patient_id in PatientMedHistory");
        echo json_encode([
            'success' => true, 
            'message' => 'Psychiatric condition saved successfully!',
            'data' => [
                'psychiatric_conditions' => $conditions
            ]
        ]);
    } else {
        throw new Exception('Failed to save psychiatric condition');
    }
} catch (PDOException $e) {
    error_log('PDO Error in save_psychiatric_condition.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log('Error in save_psychiatric_condition.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>