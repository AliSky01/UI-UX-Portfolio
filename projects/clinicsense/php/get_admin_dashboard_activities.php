<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

function resolveExistingTable(PDO $pdo, array $preferredTables)
{
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

function getTableColumns(PDO $pdo, $tableName)
{
    $stmt = $pdo->prepare('
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    ');
    $stmt->execute([$tableName]);

    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

function findMatchingColumn(array $columns, array $candidates)
{
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

function normalizeTimestamp($value)
{
    $trimmed = trim((string) $value);
    if ($trimmed === '') {
        return null;
    }

    $timestamp = strtotime($trimmed);
    if ($timestamp === false) {
        return null;
    }

    return date('Y-m-d H:i:s', $timestamp);
}

function buildFullNameFromParts(...$parts)
{
    $filteredParts = array_filter(array_map(function ($part) {
        $trimmed = trim((string) $part);
        return $trimmed === '' ? null : $trimmed;
    }, $parts));

    return trim(implode(' ', $filteredParts));
}

function buildPatientName(array $row, $fallbackLabel = 'Unknown Patient')
{
    $name = buildFullNameFromParts(
        $row['PatientFirstName'] ?? $row['FirstName'] ?? '',
        $row['PatientMiddleName'] ?? $row['MiddleName'] ?? '',
        $row['PatientLastName'] ?? $row['LastName'] ?? ''
    );

    if ($name !== '') {
        return $name;
    }

    return $fallbackLabel;
}

function buildActivity($type, $icon, $name, $description, $timestamp, $timeKnown = true)
{
    $normalizedTimestamp = normalizeTimestamp($timestamp);
    if ($normalizedTimestamp === null) {
        return null;
    }

    return [
        'type' => $type,
        'icon' => $icon,
        'name' => $name !== '' ? $name : 'Unknown Patient',
        'description' => $description,
        'timestamp' => $normalizedTimestamp,
        'timeKnown' => (bool) $timeKnown
    ];
}

function fetchPendingAppointments(PDO $pdo)
{
    $stmt = $pdo->prepare('
        SELECT
            a.PatientFirstName,
            a.PatientMiddleName,
            a.PatientLastName,
            DATE_FORMAT(a.AppointmentDate, "%Y-%m-%d") AS AppointmentDate,
            TIME_FORMAT(a.AppointmentTime, "%H:%i:%s") AS AppointmentTime,
            g.FirstName AS GuardianFirstName,
            g.MiddleInitial AS GuardianMiddleName,
            g.LastName AS GuardianLastName
        FROM `clinicsense`.`Appointments` a
        LEFT JOIN `clinicsense`.`Guardian` g ON a.Guardian_ID = g.Guardian_ID
        WHERE LOWER(COALESCE(a.Status, "")) = ?
        ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC, a.Appointment_ID DESC
        LIMIT 20
    ');
    $stmt->execute(['pending']);

    $activities = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $patientName = buildFullNameFromParts(
            $row['PatientFirstName'] ?? '',
            $row['PatientMiddleName'] ?? '',
            $row['PatientLastName'] ?? ''
        );
        $guardianName = buildFullNameFromParts(
            $row['GuardianFirstName'] ?? '',
            $row['GuardianMiddleName'] ?? '',
            $row['GuardianLastName'] ?? ''
        );
        $activity = buildActivity(
            'appointment',
            'bi-calendar-check',
            $patientName !== '' ? $patientName : ($guardianName !== '' ? $guardianName : 'Unknown Patient'),
            'Upcoming Appointment',
            trim(($row['AppointmentDate'] ?? '') . ' ' . ($row['AppointmentTime'] ?? '00:00:00')),
            true
        );

        if ($activity !== null) {
            $activities[] = $activity;
        }
    }

    return $activities;
}

function fetchPrescriptionActivities(PDO $pdo)
{
    $tableName = resolveExistingTable($pdo, ['PatientPrescription']);
    if (!$tableName) {
        return [];
    }

    $columns = getTableColumns($pdo, $tableName);
    $createdAtColumn = findMatchingColumn($columns, ['created_at']);
    $dateColumn = findMatchingColumn($columns, ['Date', 'date']);
    $timestampSelect = $createdAtColumn
        ? "pp.`{$createdAtColumn}`"
        : ($dateColumn ? "pp.`{$dateColumn}`" : 'NULL');
    $orderBy = $createdAtColumn
        ? "pp.`{$createdAtColumn}` DESC, pp.`Prescription_ID` DESC"
        : ($dateColumn ? "pp.`{$dateColumn}` DESC, pp.`Prescription_ID` DESC" : 'pp.`Prescription_ID` DESC');

    $stmt = $pdo->query("
        SELECT
            TRIM(CONCAT_WS(' ', NULLIF(p.FirstName, ''), NULLIF(p.MiddleName, ''), NULLIF(p.LastName, ''))) AS PatientName,
            pp.Medicine,
            pp.Dosage,
            {$timestampSelect} AS ActivityTimestamp
        FROM `{$tableName}` pp
        LEFT JOIN `clinicsense`.`patient` p ON p.Patient_ID = pp.Patient_ID
        ORDER BY {$orderBy}
        LIMIT 20
    ");

    $activities = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $medicine = trim((string) ($row['Medicine'] ?? 'Prescription'));
        $dosage = trim((string) ($row['Dosage'] ?? ''));
        $description = 'New Prescription: ' . $medicine . ($dosage !== '' ? ' ' . $dosage : '');
        $activity = buildActivity(
            'prescription',
            'bi-prescription',
            trim((string) ($row['PatientName'] ?? '')),
            $description,
            $row['ActivityTimestamp'] ?? null,
            (bool) $createdAtColumn
        );

        if ($activity !== null) {
            $activities[] = $activity;
        }
    }

    return $activities;
}

function fetchDiagnosisActivities(PDO $pdo)
{
    $tableName = resolveExistingTable($pdo, ['PatientDiagnosis']);
    if (!$tableName) {
        return [];
    }

    $columns = getTableColumns($pdo, $tableName);
    $createdAtColumn = findMatchingColumn($columns, ['created_at']);
    $dateColumn = findMatchingColumn($columns, ['Date', 'date']);
    $patientColumn = findMatchingColumn($columns, ['Patient_ID', 'patient_id']);
    $diagnosisColumn = findMatchingColumn($columns, ['Diagnosis', 'diagnosis']);
    $idColumn = findMatchingColumn($columns, ['diagnosis_id', 'Diagnosis_ID']);

    if (!$patientColumn || !$diagnosisColumn) {
        return [];
    }

    $timestampSelect = $createdAtColumn
        ? "d.`{$createdAtColumn}`"
        : ($dateColumn ? "d.`{$dateColumn}`" : 'NULL');
    $orderBy = $createdAtColumn
        ? "d.`{$createdAtColumn}` DESC"
        : ($dateColumn ? "d.`{$dateColumn}` DESC" : '');
    if ($idColumn) {
        $orderBy = trim($orderBy . ($orderBy !== '' ? ', ' : '') . "d.`{$idColumn}` DESC");
    }
    if ($orderBy === '') {
        $orderBy = '1 DESC';
    }

    $stmt = $pdo->query("
        SELECT
            TRIM(CONCAT_WS(' ', NULLIF(p.FirstName, ''), NULLIF(p.MiddleName, ''), NULLIF(p.LastName, ''))) AS PatientName,
            d.`{$diagnosisColumn}` AS DiagnosisText,
            {$timestampSelect} AS ActivityTimestamp
        FROM `{$tableName}` d
        LEFT JOIN `clinicsense`.`patient` p ON p.Patient_ID = d.`{$patientColumn}`
        ORDER BY {$orderBy}
        LIMIT 20
    ");

    $activities = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $diagnosis = trim((string) ($row['DiagnosisText'] ?? 'Diagnosis updated'));
        $activity = buildActivity(
            'diagnosis',
            'bi-clipboard-pulse',
            trim((string) ($row['PatientName'] ?? '')),
            'New Diagnosis: ' . $diagnosis,
            $row['ActivityTimestamp'] ?? null,
            (bool) $createdAtColumn
        );

        if ($activity !== null) {
            $activities[] = $activity;
        }
    }

    return $activities;
}

function fetchMedicationIntakeActivities(PDO $pdo)
{
    $tableName = resolveExistingTable($pdo, ['PatientMedIntake', 'MedicationIntake']);
    if (!$tableName) {
        return [];
    }

    $columns = getTableColumns($pdo, $tableName);
    $idColumn = findMatchingColumn($columns, ['MedicationIntake_ID', 'PatientMedIntake_ID', 'id']);
    $patientColumn = findMatchingColumn($columns, ['Patient_ID', 'patient_id']);
    $medicineColumn = findMatchingColumn($columns, ['Medicine', 'medicine']);
    $dateColumn = findMatchingColumn($columns, ['Date_Administered', 'date_administered', 'Date', 'date']);

    if (!$patientColumn || !$medicineColumn || !$dateColumn) {
        return [];
    }

    $orderBy = "mi.`{$dateColumn}` DESC";
    if ($idColumn) {
        $orderBy .= ", mi.`{$idColumn}` DESC";
    }

    $stmt = $pdo->query("
        SELECT
            TRIM(CONCAT_WS(' ', NULLIF(p.FirstName, ''), NULLIF(p.MiddleName, ''), NULLIF(p.LastName, ''))) AS PatientName,
            mi.`{$medicineColumn}` AS Medicine,
            mi.`{$dateColumn}` AS ActivityTimestamp
        FROM `{$tableName}` mi
        LEFT JOIN `clinicsense`.`patient` p ON p.Patient_ID = mi.`{$patientColumn}`
        ORDER BY {$orderBy}
        LIMIT 20
    ");

    $activities = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $medicine = trim((string) ($row['Medicine'] ?? 'Medication'));
        $activity = buildActivity(
            'medical-intake',
            'bi-heart-pulse',
            trim((string) ($row['PatientName'] ?? '')),
            'Medical Intake Updated: ' . $medicine,
            $row['ActivityTimestamp'] ?? null,
            strtolower($dateColumn) !== 'date'
        );

        if ($activity !== null) {
            $activities[] = $activity;
        }
    }

    return $activities;
}

try {
    $activities = array_merge(
        fetchPendingAppointments($pdo),
        fetchPrescriptionActivities($pdo),
        fetchDiagnosisActivities($pdo),
        fetchMedicationIntakeActivities($pdo)
    );

    usort($activities, function ($left, $right) {
        return strtotime($right['timestamp']) <=> strtotime($left['timestamp']);
    });

    echo json_encode([
        'success' => true,
        'activities' => array_slice($activities, 0, 20)
    ]);
} catch (Throwable $e) {
    error_log('Error in get_admin_dashboard_activities.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to load dashboard activities'
    ]);
}
?>