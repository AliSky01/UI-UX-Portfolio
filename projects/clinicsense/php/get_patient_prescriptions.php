<?php
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

try {
    $patient_id = intval($_GET['patient_id'] ?? 0);

    if (!$patient_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Patient ID is required']);
        exit;
    }

    $stmt = $pdo->prepare('
        SELECT 
            pp.Prescription_ID,
            pp.Patient_ID,
            pp.Medicine,
            pp.Dosage,
            pp.Frequency,
            pp.Duration,
            pp.Special_Instructions,
            pp.Date,
            pp.Prescribed_By,
            CONCAT(st.FirstName, " ", st.LastName) as PrescribedByName,
            st.Role as PrescribedByRole
        FROM `clinicsense`.`PatientPrescription` pp
        LEFT JOIN `clinicsense`.`Staffs` st ON pp.Prescribed_By = st.Staff_ID
        WHERE pp.Patient_ID = ?
        ORDER BY pp.Date DESC
    ');

    $stmt->execute([$patient_id]);
    $prescriptions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'prescriptions' => $prescriptions]);
} catch (Exception $e) {
    error_log('Error in get_patient_prescriptions.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>

