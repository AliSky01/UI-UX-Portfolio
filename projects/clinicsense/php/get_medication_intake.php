<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

function findMedicationIntakeTable(PDO $pdo) {
    $preferredTables = ['PatientMedIntake', 'MedicationIntake'];

    foreach ($preferredTables as $tableName) {
        $stmt = $pdo->prepare('
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(?)
            LIMIT 1
        ');
        $stmt->execute([$tableName]);
        $resolvedTable = $stmt->fetchColumn();

        if ($resolvedTable) {
            return $resolvedTable;
        }
    }

    return null;
}

function findPrescriptionTable(PDO $pdo) {
    $preferredTables = ['PatientPrescription'];

    foreach ($preferredTables as $tableName) {
        $stmt = $pdo->prepare('
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(?)
            LIMIT 1
        ');
        $stmt->execute([$tableName]);
        $resolvedTable = $stmt->fetchColumn();

        if ($resolvedTable) {
            return $resolvedTable;
        }
    }

    return null;
}

function getTableColumns(PDO $pdo, $tableName) {
    $stmt = $pdo->prepare('
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    ');
    $stmt->execute([$tableName]);

    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

function findMatchingColumn(array $columns, array $candidates) {
    $normalizedMap = [];
    foreach ($columns as $columnName) {
        $normalizedMap[strtolower($columnName)] = $columnName;
    }

    foreach ($candidates as $candidate) {
        $normalizedCandidate = strtolower($candidate);
        if (isset($normalizedMap[$normalizedCandidate])) {
            return $normalizedMap[$normalizedCandidate];
        }
    }

    return null;
}

function isDateOnlyColumn($columnName) {
    return strtolower($columnName) === 'date';
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$patient_id = isset($_GET['patient_id']) ? trim($_GET['patient_id']) : '';

if (!$patient_id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Patient ID is required']);
    exit;
}

try {
    $tableName = findMedicationIntakeTable($pdo);
    if (!$tableName) {
        echo json_encode(['success' => true, 'medicationIntake' => []]);
        exit;
    }

    $prescriptionTable = findPrescriptionTable($pdo);

    $columns = getTableColumns($pdo, $tableName);
    $idColumn = findMatchingColumn($columns, ['MedicationIntake_ID', 'PatientMedIntake_ID', 'id']);
    $patientColumn = findMatchingColumn($columns, ['Patient_ID', 'patient_id']);
    $medicineColumn = findMatchingColumn($columns, ['Medicine', 'medicine']);
    $dosageColumn = findMatchingColumn($columns, ['Dosage', 'dosage']);
    $frequencyColumn = findMatchingColumn($columns, ['Frequency', 'frequency']);
    $durationColumn = findMatchingColumn($columns, ['Duration', 'duration']);
    $dateColumn = findMatchingColumn($columns, ['Date_Administered', 'date_administered', 'Date', 'date']);
    $administeredByColumn = findMatchingColumn($columns, ['Administered_By', 'administered_by']);
    $givenByColumn = findMatchingColumn($columns, ['Given_By', 'given_by']);

    if (!$patientColumn || !$medicineColumn || !$dateColumn) {
        echo json_encode(['success' => true, 'medicationIntake' => []]);
        exit;
    }

    $idSelect = $idColumn ? "mi.`{$idColumn}` AS MedicationIntake_ID" : 'NULL AS MedicationIntake_ID';
    $dosageSelect = $dosageColumn ? "NULLIF(mi.`{$dosageColumn}`, '')" : 'NULL';
    $frequencySelect = $frequencyColumn ? "mi.`{$frequencyColumn}` AS Frequency" : "'' AS Frequency";
    $durationSelect = $durationColumn ? "mi.`{$durationColumn}` AS Duration" : "'' AS Duration";
    $administeredBySelect = $administeredByColumn ? "mi.`{$administeredByColumn}` AS Administered_By" : 'NULL AS Administered_By';
    $staffJoin = $administeredByColumn ? "LEFT JOIN Staffs st ON mi.`{$administeredByColumn}` = st.Staff_ID" : '';
    $fallbackDosageSelect = $prescriptionTable ? "(
        SELECT NULLIF(pp.Dosage, '')
        FROM `{$prescriptionTable}` pp
        WHERE pp.Patient_ID = mi.`{$patientColumn}`
          AND LOWER(TRIM(pp.Medicine)) = LOWER(TRIM(mi.`{$medicineColumn}`))
        ORDER BY pp.Date DESC, pp.Prescription_ID DESC
        LIMIT 1
    )" : 'NULL';
    $resolvedDosageSelect = "COALESCE({$dosageSelect}, {$fallbackDosageSelect}, 'Not recorded') AS Dosage";
    if ($givenByColumn) {
        $administeredByNameSelect = "mi.`{$givenByColumn}` AS AdministeredByName";
    } elseif ($administeredByColumn) {
        $administeredByNameSelect = 'CONCAT(st.FirstName, " ", st.LastName) AS AdministeredByName';
    } else {
        $administeredByNameSelect = 'NULL AS AdministeredByName';
    }

    $sql = "
        SELECT
            {$idSelect},
            mi.`{$patientColumn}` AS Patient_ID,
            mi.`{$medicineColumn}` AS Medicine,
            {$resolvedDosageSelect},
            {$frequencySelect},
            {$durationSelect},
            mi.`{$dateColumn}` AS Date_Administered,
            {$administeredBySelect},
            {$administeredByNameSelect}
        FROM `{$tableName}` mi
        {$staffJoin}
        WHERE mi.`{$patientColumn}` = ?
        ORDER BY mi.`{$dateColumn}` DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$patient_id]);
    $intake = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'medicationIntake' => $intake]);
} catch (Exception $e) {
    error_log('Error in get_medication_intake.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
