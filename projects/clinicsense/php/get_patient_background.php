<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$patientId = (int) ($_GET['patient_id'] ?? 0);
if ($patientId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Patient ID is required']);
    exit;
}

try {
    $observationStmt = $pdo->prepare('
        SELECT Observation_ID, observation_date, observation
        FROM `clinicsense`.`PatientObservation`
        WHERE Patient_ID = ?
        ORDER BY observation_date DESC, Observation_ID DESC
        LIMIT 100
    ');
    $observationStmt->execute([$patientId]);
    $observationRows = $observationStmt->fetchAll(PDO::FETCH_ASSOC);

    $medicalStmt = $pdo->prepare('
        SELECT Chronic_condition, Food_allergy, Medical_allergy, psychiatric_condition
        FROM `clinicsense`.`PatientMedHistory`
        WHERE Patient_ID = ?
        ORDER BY Medhistory_ID DESC
        LIMIT 1
    ');
    $medicalStmt->execute([$patientId]);
    $medicalHistory = $medicalStmt->fetch(PDO::FETCH_ASSOC) ?: null;

    // Extract psychiatric condition from medical history
    $psychiatricCondition = null;
    if ($medicalHistory && isset($medicalHistory['psychiatric_condition'])) {
        $psychiatricCondition = $medicalHistory['psychiatric_condition'];
    }

    $familyStmt = $pdo->prepare('
        SELECT paternal_psych, maternal_psych, paternal_med, maternal_med
        FROM `clinicsense`.`PatientFamHistory`
        WHERE Patient_ID = ?
        ORDER BY Famhistory_ID DESC
        LIMIT 1
    ');
    $familyStmt->execute([$patientId]);
    $familyHistory = $familyStmt->fetch(PDO::FETCH_ASSOC) ?: null;

    $observations = array_map(function (array $row): array {
        $formattedDate = 'Not recorded';
        if (!empty($row['observation_date'])) {
            $timestamp = strtotime($row['observation_date']);
            if ($timestamp !== false) {
                $formattedDate = date('M j, Y \a\t g:i A', $timestamp);
            }
        }

        return [
            'id' => (int) ($row['Observation_ID'] ?? 0),
            'observation' => $row['observation'] ?? '',
            'observationDate' => $row['observation_date'] ?? null,
            'observationDateLabel' => $formattedDate
        ];
    }, $observationRows);

    echo json_encode([
        'success' => true,
        'observations' => $observations,
        'medicalHistory' => $medicalHistory ? [
            'chronicCondition' => $medicalHistory['Chronic_condition'] ?? '',
            'psychiatricCondition' => $psychiatricCondition ?? '',
            'foodAllergy' => $medicalHistory['Food_allergy'] ?? '',
            'medicalAllergy' => $medicalHistory['Medical_allergy'] ?? ''
        ] : null,
        'familyHistory' => $familyHistory ? [
            'paternalPsych' => $familyHistory['paternal_psych'] ?? '',
            'maternalPsych' => $familyHistory['maternal_psych'] ?? '',
            'paternalMed' => $familyHistory['paternal_med'] ?? '',
            'maternalMed' => $familyHistory['maternal_med'] ?? ''
        ] : null
    ]);
} catch (Throwable $e) {
    error_log('Error in get_patient_background.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>