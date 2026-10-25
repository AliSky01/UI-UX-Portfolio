<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once 'notification_service.php';
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

function getStaffDisplayName(PDO $pdo, $staffId) {
    $stmt = $pdo->prepare('SELECT FirstName, LastName FROM `clinicsense`.`Staffs` WHERE Staff_ID = ? LIMIT 1');
    $stmt->execute([$staffId]);
    $staff = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$staff) {
        return '';
    }

    return trim(($staff['FirstName'] ?? '') . ' ' . ($staff['LastName'] ?? ''));
}

function normalizeDateForColumn($value, $columnName) {
    if (!$value) {
        return $value;
    }

    $timestamp = strtotime($value);
    if ($timestamp === false) {
        return $value;
    }

    $normalizedColumn = strtolower($columnName);
    if ($normalizedColumn === 'date') {
        return date('Y-m-d', $timestamp);
    }

    return date('Y-m-d H:i:s', $timestamp);
}

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
    $medicine = trim($_POST['medicine'] ?? '');
    $date_administered = trim($_POST['date_administered'] ?? '');
    $date = trim($_POST['date'] ?? '');
    $time = trim($_POST['time'] ?? '');
    $dosage = trim($_POST['dosage'] ?? '');
    $frequency = trim($_POST['frequency'] ?? '');
    $duration = trim($_POST['duration'] ?? '');
    $administered_by = intval($_SESSION['user_id']);
    $nurse_name = getStaffDisplayName($pdo, $administered_by);

    if (!$date_administered && $date) {
        $selectedTime = $time ?: date('H:i:s');
        if (preg_match('/^\d{2}:\d{2}$/', $selectedTime)) {
            $selectedTime .= ':00';
        }
        $date_administered = trim($date . ' ' . $selectedTime);
    }

    if (!$patient_id || !$medicine || !$date_administered) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Patient, medicine, and date are required']);
        exit;
    }

    $tableName = findMedicationIntakeTable($pdo);
    if (!$tableName) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Medication intake table not found']);
        exit;
    }

    $columns = getTableColumns($pdo, $tableName);
    $valuesByColumn = [];

    $patientColumn = findMatchingColumn($columns, ['Patient_ID', 'patient_id']);
    $medicineColumn = findMatchingColumn($columns, ['Medicine', 'medicine']);
    $dateColumn = findMatchingColumn($columns, ['Date_Administered', 'date_administered', 'Date', 'date']);
    $administeredByColumn = findMatchingColumn($columns, ['Administered_By', 'administered_by']);
    $givenByColumn = findMatchingColumn($columns, ['Given_By', 'given_by']);
    $dosageColumn = findMatchingColumn($columns, ['Dosage', 'dosage']);
    $frequencyColumn = findMatchingColumn($columns, ['Frequency', 'frequency']);
    $durationColumn = findMatchingColumn($columns, ['Duration', 'duration']);

    if (!$patientColumn || !$medicineColumn || !$dateColumn) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Medication intake table is missing required columns']);
        exit;
    }

    $valuesByColumn[$patientColumn] = $patient_id;
    $valuesByColumn[$medicineColumn] = $medicine;
    $valuesByColumn[$dateColumn] = normalizeDateForColumn($date_administered, $dateColumn);

    if ($administeredByColumn) {
        $valuesByColumn[$administeredByColumn] = $administered_by;
    }
    if ($givenByColumn) {
        $valuesByColumn[$givenByColumn] = $nurse_name ?: ($_SESSION['username'] ?? 'Nurse on record');
    }
    if ($dosageColumn) {
        $valuesByColumn[$dosageColumn] = $dosage;
    }
    if ($frequencyColumn) {
        $valuesByColumn[$frequencyColumn] = $frequency;
    }
    if ($durationColumn) {
        $valuesByColumn[$durationColumn] = $duration;
    }

    $columnNames = array_keys($valuesByColumn);
    $placeholders = implode(', ', array_fill(0, count($columnNames), '?'));
    $escapedColumns = implode(', ', array_map(function ($columnName) {
        return "`{$columnName}`";
    }, $columnNames));

    $stmt = $pdo->prepare("INSERT INTO `{$tableName}` ({$escapedColumns}) VALUES ({$placeholders})");
    $stmt->execute(array_values($valuesByColumn));

    $patientName = lookupPatientDisplayName($pdo, $patient_id);
    createAdminNotification($pdo, [
        'category' => 'medication',
        'action_type' => 'medication_intake_recorded',
        'title' => 'Medication intake recorded',
        'message' => 'Medication intake was recorded for ' . $patientName . '.',
        'entity_type' => $tableName,
        'entity_id' => (int) $pdo->lastInsertId(),
        'patient_id' => $patient_id,
        'patient_name' => $patientName,
        'created_by_staff_id' => $administered_by,
        'created_by_name' => $nurse_name
    ]);

    // Notify guardian about medication intake
    try {
        $gstmt = $pdo->prepare('SELECT Guardian_ID FROM `clinicsense`.`patient` WHERE Patient_ID = ? LIMIT 1');
        $gstmt->execute([$patient_id]);
        $g = $gstmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $guardianId = isset($g['Guardian_ID']) ? (int) $g['Guardian_ID'] : 0;
        if ($guardianId > 0) {
            createNotification($pdo, [
                'recipient_role' => 'guardian',
                'category' => 'medication',
                'action_type' => 'medication_intake_recorded',
                'title' => 'Medication intake recorded',
                'message' => 'Medication was given to ' . $patientName . '.',
                'entity_type' => $tableName,
                'entity_id' => (int) $pdo->lastInsertId(),
                'patient_id' => $patient_id,
                'patient_name' => $patientName,
                'created_by_staff_id' => $administered_by,
                'created_by_name' => $nurse_name
            ]);
        }
    } catch (Exception $e) {
        // ignore
    }

    echo json_encode([
        'success' => true,
        'message' => 'Medication intake recorded successfully!',
        'table' => $tableName,
        'intake_id' => $pdo->lastInsertId()
    ]);
} catch (Exception $e) {
    error_log('Error in save_medication_intake.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>
