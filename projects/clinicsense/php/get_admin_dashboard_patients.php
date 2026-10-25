<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

try {
    $stmt = $pdo->prepare('
        SELECT
            p.Patient_ID,
            p.FirstName,
            p.MiddleName,
            p.LastName,
            p.Age,
            p.Sex,
            (
                SELECT pd.Diagnosis
                FROM `clinicsense`.`PatientDiagnosis` pd
                WHERE pd.patient_id = p.Patient_ID
                ORDER BY pd.Date DESC, pd.diagnosis_id DESC
                LIMIT 1
            ) AS Diagnosis
        FROM `clinicsense`.`patient` p
        WHERE LOWER(COALESCE(p.Status, "")) = \'admitted\'
        ORDER BY p.Patient_ID DESC
    ');
    $stmt->execute();

    $patients = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'patients' => $patients
    ]);
} catch (Throwable $e) {
    error_log('Error in get_admin_dashboard_patients.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to load dashboard patients'
    ]);
}
?>