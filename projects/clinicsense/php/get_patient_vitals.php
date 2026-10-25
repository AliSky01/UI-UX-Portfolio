<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

try {
    if (!isset($_GET['patient_id'])) {
        echo json_encode(['success' => false, 'message' => 'Patient ID required']);
        exit;
    }
    
    $patient_id = intval($_GET['patient_id']);
    
    // Fetch the most recent vitals for this patient
    $stmt = $pdo->prepare('
        SELECT 
            vital_id,
            patient_id,
            blood_pressure,
            pulse_rate,
            temperature,
            weight,
            height,
            respiratory_rate,
            oxygen_saturation,
            date_recorded
        FROM `clinicsense`.`PatientVitals`
        WHERE patient_id = ?
        ORDER BY date_recorded DESC, vital_id DESC
        LIMIT 1
    ');
    
    $stmt->execute([$patient_id]);
    $vitals = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($vitals) {
        echo json_encode([
            'success' => true, 
            'vitals' => [
                'id' => $vitals['vital_id'],
                'blood_pressure' => $vitals['blood_pressure'],
                'pulse_rate' => $vitals['pulse_rate'],
                'temperature' => $vitals['temperature'],
                'weight' => $vitals['weight'],
                'height' => $vitals['height'],
                'respiratory_rate' => $vitals['respiratory_rate'],
                'oxygen_saturation' => $vitals['oxygen_saturation'],
                'date' => $vitals['date_recorded'] ? date('M j, Y \a\t g:i A', strtotime($vitals['date_recorded'])) : 'N/A'
            ]
        ]);
    } else {
        echo json_encode(['success' => true, 'vitals' => null]);
    }
} catch (Exception $e) {
    error_log('Error in get_patient_vitals.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>
