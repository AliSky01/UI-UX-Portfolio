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
    $condition_to_remove = trim($_POST['condition_to_remove'] ?? '');

    if (!$patient_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Patient ID is required']);
        exit;
    }

    if (empty($condition_to_remove)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Condition to remove is required']);
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

    if (!$latestHistory) {
        echo json_encode(['success' => true, 'message' => 'No psychiatric conditions to remove']);
        exit;
    }

    // Parse existing conditions from JSON
    $conditions = [];
    if (!empty($latestHistory['psychiatric_condition'])) {
        $decoded = json_decode($latestHistory['psychiatric_condition'], true);
        if (is_array($decoded)) {
            $conditions = $decoded;
        }
    }

    // Remove the condition
    $conditions = array_filter($conditions, function($c) use ($condition_to_remove) {
        return $c !== $condition_to_remove;
    });
    $conditions = array_values($conditions); // Re-index array

    $conditions_json = !empty($conditions) ? json_encode($conditions) : json_encode([]);

    // Update the record
    $stmt = $pdo->prepare('
        UPDATE `clinicsense`.`PatientMedHistory`
        SET psychiatric_condition = ?
        WHERE Medhistory_ID = ?
    ');
    
    $result = $stmt->execute([$conditions_json, $latestHistory['Medhistory_ID']]);
    
    if ($result) {
        error_log("Successfully removed psychiatric_condition '$condition_to_remove' for patient $patient_id");
        echo json_encode([
            'success' => true, 
            'message' => 'Psychiatric condition removed successfully!',
            'data' => [
                'psychiatric_conditions' => $conditions
            ]
        ]);
    } else {
        throw new Exception('Failed to remove psychiatric condition');
    }
} catch (PDOException $e) {
    error_log('PDO Error in remove_psychiatric_condition.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log('Error in remove_psychiatric_condition.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>
