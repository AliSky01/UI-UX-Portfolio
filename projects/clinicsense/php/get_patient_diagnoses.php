<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

function getDiagnosisSymptomsColumn(PDO $pdo): ?string
{
    foreach (['Symptoms', 'observations'] as $columnName) {
        $columnStmt = $pdo->prepare("SHOW COLUMNS FROM `clinicsense`.`PatientDiagnosis` LIKE ?");
        $columnStmt->execute([$columnName]);

        if ($columnStmt->fetch(PDO::FETCH_ASSOC)) {
            return $columnName;
        }
    }

    return null;
}

function normalizeSymptomsValue($value): string
{
    $text = trim((string) ($value ?? ''));
    if ($text === '') {
        return '';
    }

    $decoded = json_decode($text, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        $parts = array_values(array_filter(array_map(static function ($item): string {
            return trim((string) $item);
        }, $decoded), static function ($item): bool {
            return $item !== '';
        }));

        return implode(', ', $parts);
    }

    return preg_replace('/\s*\r?\n\s*/', ', ', $text) ?: $text;
}

try {
    if (!isset($_GET['patient_id'])) {
        echo json_encode(['success' => false, 'message' => 'Patient ID required']);
        exit;
    }
    
    $patient_id = intval($_GET['patient_id']);
    $symptomsColumn = getDiagnosisSymptomsColumn($pdo);
    $symptomsSelect = $symptomsColumn
        ? sprintf('d.`%s` AS symptoms,', $symptomsColumn)
        : 'NULL AS symptoms,';
    
    // Fetch diagnoses for this patient
    $stmt = $pdo->prepare(sprintf('
        SELECT 
            d.diagnosis_id,
            d.diagnosis,
            d.date,
            d.notes,
            %s
            d.diagnosed_by
        FROM `clinicsense`.`PatientDiagnosis` d
        WHERE d.patient_id = ?
        ORDER BY d.date DESC
        LIMIT 50
    ', $symptomsSelect));
    
    $stmt->execute([$patient_id]);
    $diagnoses = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $formatted_diagnoses = [];
    foreach ($diagnoses as $diag) {
        $doctor_name = $diag['diagnosed_by'] ?? 'Dr. On Record';
            
        $formatted_diagnoses[] = [
            'id' => $diag['diagnosis_id'],
            'diagnosis' => $diag['diagnosis'],
            'date' => $diag['date'] ? date('F j, Y', strtotime($diag['date'])) : 'N/A',
            'notes' => $diag['notes'] ?? '',
            'symptoms' => normalizeSymptomsValue($diag['symptoms'] ?? ''),
            'doctor' => $doctor_name
        ];
    }
    
    echo json_encode(['success' => true, 'diagnoses' => $formatted_diagnoses]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>
