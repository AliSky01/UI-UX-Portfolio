<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$stmt = $pdo->prepare('
    SELECT p.*, 
           pd.Diagnosis,
           ad.Admission_DateTime
    FROM Patient p
    LEFT JOIN PatientDiagnosis pd ON p.Patient_ID = pd.Patient_ID
    LEFT JOIN AdmissionDischarge ad ON p.Patient_ID = ad.Patient_ID
    ORDER BY p.created_at DESC
');
$stmt->execute();
$patients = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(['success' => true, 'patients' => $patients]);
?>