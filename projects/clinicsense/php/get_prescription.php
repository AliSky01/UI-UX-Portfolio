<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

try {
    $stmt = $pdo->prepare('
        SELECT pp.*, 
               CONCAT(p.FirstName, " ", p.LastName) as PatientName,
               CONCAT(st.FirstName, " ", st.LastName) as PrescribedByName
        FROM `clinicsense`.`PatientPrescription` pp
        JOIN `clinicsense`.`patient` p ON pp.Patient_ID = p.Patient_ID
        LEFT JOIN `clinicsense`.`Staffs` st ON pp.Prescribed_By = st.Staff_ID
        ORDER BY pp.Date DESC
        LIMIT 20
    ');
    $stmt->execute();
    $prescriptions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'prescriptions' => $prescriptions]);
} catch (Exception $e) {
    error_log('Error in get_prescription.php: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>