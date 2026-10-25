<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

function normalizeString($value): string
{
    if ($value === null) {
        return '';
    }

    return trim((string) $value);
}

function formatPersonName($firstName, $middleName, $lastName): string
{
    return trim(implode(' ', array_filter([
        normalizeString($firstName),
        normalizeString($middleName),
        normalizeString($lastName)
    ])));
}

function formatStaffDisplayName($firstName, $lastName, $role): string
{
    $fullName = trim(implode(' ', array_filter([
        normalizeString($firstName),
        normalizeString($lastName)
    ])));

    if ($fullName === '') {
        return 'Doctor on record';
    }

    $normalizedRole = strtolower(normalizeString($role));
    if ($normalizedRole === 'doctor' && stripos($fullName, 'dr.') !== 0) {
        return 'Dr. ' . $fullName;
    }

    return $fullName;
}

function formatDateLabel($value, bool $includeTime = false): string
{
    $normalizedValue = normalizeString($value);
    if ($normalizedValue === '') {
        return 'Not recorded';
    }

    $timestamp = strtotime($normalizedValue);
    if ($timestamp === false) {
        return $normalizedValue;
    }

    return $includeTime
        ? date('M j, Y \a\t g:i A', $timestamp)
        : date('F j, Y', $timestamp);
}

function tableExists(PDO $pdo, string $tableName): bool
{
    $stmt = $pdo->prepare('
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = LOWER(?)
        LIMIT 1
    ');
    $stmt->execute([$tableName]);

    return (bool) $stmt->fetchColumn();
}

function decodePsychiatricCondition($value): string
{
    $normalizedValue = normalizeString($value);
    if ($normalizedValue === '') {
        return '';
    }

    $decoded = json_decode($normalizedValue, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
        return $normalizedValue;
    }

    $flattened = [];
    array_walk_recursive($decoded, function ($item) use (&$flattened): void {
        $item = normalizeString($item);
        if ($item !== '') {
            $flattened[] = $item;
        }
    });

    return $flattened ? implode(', ', array_values(array_unique($flattened))) : '';
}

function findMedicationIntakeTable(PDO $pdo): ?string
{
    foreach (['PatientMedIntake', 'MedicationIntake'] as $tableName) {
        if (tableExists($pdo, $tableName)) {
            return $tableName;
        }
    }

    return null;
}

function getTableColumns(PDO $pdo, string $tableName): array
{
    $stmt = $pdo->prepare('
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    ');
    $stmt->execute([$tableName]);

    return $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
}

function findMatchingColumn(array $columns, array $candidates): ?string
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

function fetchGuardianPatients(PDO $pdo, int $guardianId): array
{
    $stmt = $pdo->prepare('
        SELECT
            p.Patient_ID,
            p.FirstName,
            p.MiddleName,
            p.LastName,
            p.Age,
            p.Sex,
            p.Birthdate,
            p.Address,
            p.Status,
            p.CivilStatus,
            p.Religion,
            p.PreviousOccupation,
            p.Hobbies,
            latest_admission.Admission_DateTime,
            st.FirstName AS StaffFirstName,
            st.LastName AS StaffLastName,
            st.Role AS StaffRole
        FROM `clinicsense`.`patient` p
        LEFT JOIN (
            SELECT Patient_ID, MAX(Admission_DateTime) AS Admission_DateTime
            FROM `clinicsense`.`AdmissionDischarge`
            GROUP BY Patient_ID
        ) latest_admission ON latest_admission.Patient_ID = p.Patient_ID
        LEFT JOIN `clinicsense`.`Staffs` st ON p.Staff_ID = st.Staff_ID
        WHERE p.Guardian_ID = ?
          AND LOWER(COALESCE(p.Status, "")) = ?
        ORDER BY COALESCE(latest_admission.Admission_DateTime, p.created_at) DESC, p.Patient_ID DESC
        LIMIT 25
    ');
    $stmt->execute([$guardianId, 'admitted']);

    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function fetchDiagnoses(PDO $pdo, int $patientId): array
{
    if (!tableExists($pdo, 'PatientDiagnosis')) {
        return [];
    }

    $stmt = $pdo->prepare('
        SELECT diagnosis_id, diagnosis, date, notes, diagnosed_by
        FROM `clinicsense`.`PatientDiagnosis`
        WHERE patient_id = ?
        ORDER BY date DESC, diagnosis_id DESC
        LIMIT 50
    ');
    $stmt->execute([$patientId]);

    return array_map(function (array $row): array {
        return [
            'id' => (int) ($row['diagnosis_id'] ?? 0),
            'diagnosis' => normalizeString($row['diagnosis']) ?: 'Not specified',
            'notes' => normalizeString($row['notes']),
            'doctor' => normalizeString($row['diagnosed_by']) ?: 'Doctor on record',
            'date' => $row['date'] ?: null,
            'dateLabel' => formatDateLabel($row['date'])
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
}

function fetchVitals(PDO $pdo, int $patientId): ?array
{
    if (!tableExists($pdo, 'PatientVitals')) {
        return null;
    }

    $stmt = $pdo->prepare('
        SELECT vital_id, blood_pressure, pulse_rate, temperature, weight, height, respiratory_rate, oxygen_saturation, date_recorded
        FROM `clinicsense`.`PatientVitals`
        WHERE patient_id = ?
        ORDER BY date_recorded DESC, vital_id DESC
        LIMIT 1
    ');
    $stmt->execute([$patientId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        return null;
    }

    return [
        'id' => (int) ($row['vital_id'] ?? 0),
        'bloodPressure' => normalizeString($row['blood_pressure']),
        'pulseRate' => normalizeString($row['pulse_rate']),
        'temperature' => normalizeString($row['temperature']),
        'weight' => normalizeString($row['weight']),
        'height' => normalizeString($row['height']),
        'respiratoryRate' => normalizeString($row['respiratory_rate']),
        'oxygenSaturation' => normalizeString($row['oxygen_saturation']),
        'dateRecorded' => $row['date_recorded'] ?: null,
        'lastUpdatedLabel' => formatDateLabel($row['date_recorded'], true)
    ];
}

function fetchBackground(PDO $pdo, int $patientId): array
{
    $observations = [];
    if (tableExists($pdo, 'PatientObservation')) {
        $observationStmt = $pdo->prepare('
            SELECT Observation_ID, observation_date, observation
            FROM `clinicsense`.`PatientObservation`
            WHERE Patient_ID = ?
            ORDER BY observation_date DESC, Observation_ID DESC
            LIMIT 100
        ');
        $observationStmt->execute([$patientId]);
        $observations = array_map(function (array $row): array {
            return [
                'id' => (int) ($row['Observation_ID'] ?? 0),
                'observation' => normalizeString($row['observation']),
                'observationDate' => $row['observation_date'] ?: null,
                'observationDateLabel' => formatDateLabel($row['observation_date'], true)
            ];
        }, $observationStmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    $medicalHistory = null;
    if (tableExists($pdo, 'PatientMedHistory')) {
        $medicalStmt = $pdo->prepare('
            SELECT Chronic_condition, Food_allergy, Medical_allergy, psychiatric_condition
            FROM `clinicsense`.`PatientMedHistory`
            WHERE Patient_ID = ?
            ORDER BY Medhistory_ID DESC
            LIMIT 1
        ');
        $medicalStmt->execute([$patientId]);
        $row = $medicalStmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $medicalHistory = [
                'chronicCondition' => normalizeString($row['Chronic_condition']),
                'psychiatricCondition' => decodePsychiatricCondition($row['psychiatric_condition'] ?? ''),
                'foodAllergy' => normalizeString($row['Food_allergy']),
                'medicalAllergy' => normalizeString($row['Medical_allergy'])
            ];
        }
    }

    $familyHistory = null;
    if (tableExists($pdo, 'PatientFamHistory')) {
        $familyStmt = $pdo->prepare('
            SELECT paternal_psych, maternal_psych, paternal_med, maternal_med
            FROM `clinicsense`.`PatientFamHistory`
            WHERE Patient_ID = ?
            ORDER BY Famhistory_ID DESC
            LIMIT 1
        ');
        $familyStmt->execute([$patientId]);
        $row = $familyStmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $familyHistory = [
                'paternalPsych' => normalizeString($row['paternal_psych']),
                'maternalPsych' => normalizeString($row['maternal_psych']),
                'paternalMed' => normalizeString($row['paternal_med']),
                'maternalMed' => normalizeString($row['maternal_med'])
            ];
        }
    }

    return [
        'observations' => $observations,
        'medicalHistory' => $medicalHistory,
        'familyHistory' => $familyHistory
    ];
}

function fetchMedicationIntake(PDO $pdo, int $patientId): array
{
    $tableName = findMedicationIntakeTable($pdo);
    if (!$tableName) {
        return [];
    }

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
        return [];
    }

    $staffJoin = $administeredByColumn ? "LEFT JOIN `clinicsense`.`Staffs` st ON mi.`{$administeredByColumn}` = st.Staff_ID" : '';
    $administeredByNameSelect = $givenByColumn
        ? "mi.`{$givenByColumn}` AS administered_by_name"
        : ($administeredByColumn
            ? 'CONCAT(st.FirstName, " ", st.LastName) AS administered_by_name'
            : 'NULL AS administered_by_name');
    $idSelect = $idColumn ? "mi.`{$idColumn}` AS intake_id" : 'NULL AS intake_id';
    $dosageSelect = $dosageColumn ? "mi.`{$dosageColumn}`" : 'NULL';
    $frequencySelect = $frequencyColumn ? "mi.`{$frequencyColumn}`" : "''";
    $durationSelect = $durationColumn ? "mi.`{$durationColumn}`" : "''";

    $sql = "
        SELECT
            {$idSelect},
            mi.`{$medicineColumn}` AS medicine,
            {$dosageSelect} AS dosage,
            {$frequencySelect} AS frequency,
            {$durationSelect} AS duration,
            mi.`{$dateColumn}` AS date_administered,
            {$administeredByNameSelect}
        FROM `{$tableName}` mi
        {$staffJoin}
        WHERE mi.`{$patientColumn}` = ?
        ORDER BY mi.`{$dateColumn}` DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$patientId]);

    return array_map(function (array $row): array {
        return [
            'id' => isset($row['intake_id']) ? (int) $row['intake_id'] : 0,
            'medicine' => normalizeString($row['medicine']) ?: 'Unnamed medicine',
            'dosage' => normalizeString($row['dosage']) ?: 'Not recorded',
            'frequency' => normalizeString($row['frequency']),
            'duration' => normalizeString($row['duration']),
            'dateAdministered' => $row['date_administered'] ?: null,
            'dateAdministeredLabel' => formatDateLabel($row['date_administered'], true),
            'administeredByName' => normalizeString($row['administered_by_name']) ?: 'Staff on record'
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
}

function fetchPrescriptions(PDO $pdo, int $patientId): array
{
    if (!tableExists($pdo, 'PatientPrescription')) {
        return [];
    }

    $stmt = $pdo->prepare('
        SELECT
            pp.Prescription_ID,
            pp.Medicine,
            pp.Dosage,
            pp.Frequency,
            pp.Duration,
            pp.Special_Instructions,
            pp.Date,
            CONCAT(st.FirstName, " ", st.LastName) AS prescribed_by_name,
            st.Role AS prescribed_by_role
        FROM `clinicsense`.`PatientPrescription` pp
        LEFT JOIN `clinicsense`.`Staffs` st ON pp.Prescribed_By = st.Staff_ID
        WHERE pp.Patient_ID = ?
        ORDER BY pp.Date DESC, pp.Prescription_ID DESC
    ');
    $stmt->execute([$patientId]);

    return array_map(function (array $row): array {
        return [
            'id' => (int) ($row['Prescription_ID'] ?? 0),
            'medicine' => normalizeString($row['Medicine']) ?: 'Unnamed prescription',
            'dosage' => normalizeString($row['Dosage']) ?: 'N/A',
            'frequency' => normalizeString($row['Frequency']) ?: 'N/A',
            'duration' => normalizeString($row['Duration']),
            'specialInstructions' => normalizeString($row['Special_Instructions']),
            'date' => $row['Date'] ?: null,
            'dateLabel' => formatDateLabel($row['Date']),
            'prescribedByName' => normalizeString($row['prescribed_by_name']) ?: 'Doctor on record',
            'prescribedByRole' => normalizeString($row['prescribed_by_role'])
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
}

function fetchExternalMedicine(PDO $pdo, int $patientId): array
{
    if (!tableExists($pdo, 'patientexternalmeds')) {
        return [];
    }

    $stmt = $pdo->prepare('
        SELECT ExtMed_ID, Date, Medicine, Quantity, Sent_By, Received_By
        FROM `clinicsense`.`patientexternalmeds`
        WHERE Patient_ID = ?
        ORDER BY Date DESC, ExtMed_ID DESC
    ');
    $stmt->execute([$patientId]);

    return array_map(function (array $row): array {
        return [
            'id' => (int) ($row['ExtMed_ID'] ?? 0),
            'date' => $row['Date'] ?: null,
            'dateLabel' => formatDateLabel($row['Date']),
            'medicine' => normalizeString($row['Medicine']),
            'quantity' => normalizeString($row['Quantity']),
            'sentBy' => normalizeString($row['Sent_By']),
            'receivedBy' => normalizeString($row['Received_By'])
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
}

function fetchBelongings(PDO $pdo, int $patientId): array
{
    if (!tableExists($pdo, 'patientbelongings')) {
        return [];
    }

    $stmt = $pdo->prepare('
        SELECT Belonging_ID, Date, Item, Quantity, Sent_By, Received_By
        FROM `clinicsense`.`patientbelongings`
        WHERE Patient_ID = ?
        ORDER BY Date DESC, Belonging_ID DESC
    ');
    $stmt->execute([$patientId]);

    return array_map(function (array $row): array {
        return [
            'id' => (int) ($row['Belonging_ID'] ?? 0),
            'date' => $row['Date'] ?: null,
            'dateLabel' => formatDateLabel($row['Date']),
            'item' => normalizeString($row['Item']),
            'quantity' => normalizeString($row['Quantity']),
            'sentBy' => normalizeString($row['Sent_By']),
            'receivedBy' => normalizeString($row['Received_By'])
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
}

function fetchVisitors(PDO $pdo, int $patientId): array
{
    if (!tableExists($pdo, 'patientvisitor')) {
        return [];
    }

    $stmt = $pdo->prepare('
        SELECT Visitor_ID, Date, Time, Name, Relationship
        FROM `clinicsense`.`patientvisitor`
        WHERE Patient_ID = ?
        ORDER BY Date DESC, Visitor_ID DESC
    ');
    $stmt->execute([$patientId]);

    return array_map(function (array $row): array {
        return [
            'id' => (int) ($row['Visitor_ID'] ?? 0),
            'date' => $row['Date'] ?: null,
            'dateLabel' => formatDateLabel($row['Date']),
            'time' => normalizeString($row['Time']),
            'name' => normalizeString($row['Name']),
            'relationship' => normalizeString($row['Relationship'])
        ];
    }, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

if (($_SESSION['user_type'] ?? 'guardian') === 'staff') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Guardian access only']);
    exit;
}

try {
    $guardianId = (int) $_SESSION['user_id'];
    $patientRows = fetchGuardianPatients($pdo, $guardianId);
    $patients = [];

    foreach ($patientRows as $row) {
        $patientId = (int) ($row['Patient_ID'] ?? 0);
        if ($patientId <= 0) {
            continue;
        }

        $diagnoses = fetchDiagnoses($pdo, $patientId);

        $patients[] = [
            'id' => $patientId,
            'firstName' => normalizeString($row['FirstName']),
            'middleName' => normalizeString($row['MiddleName']),
            'lastName' => normalizeString($row['LastName']),
            'fullName' => formatPersonName($row['FirstName'], $row['MiddleName'], $row['LastName']) ?: 'Patient',
            'age' => isset($row['Age']) && $row['Age'] !== null ? (int) $row['Age'] : null,
            'sex' => normalizeString($row['Sex']),
            'birthdate' => $row['Birthdate'] ?: null,
            'address' => normalizeString($row['Address']),
            'status' => normalizeString($row['Status']),
            'civilStatus' => normalizeString($row['CivilStatus']),
            'religion' => normalizeString($row['Religion']),
            'hobbies' => normalizeString($row['Hobbies']),
            'previousOccupation' => normalizeString($row['PreviousOccupation']),
            'admissionDateTime' => $row['Admission_DateTime'] ?: null,
            'attendingPhysician' => formatStaffDisplayName($row['StaffFirstName'] ?? '', $row['StaffLastName'] ?? '', $row['StaffRole'] ?? ''),
            'primaryDiagnosis' => $diagnoses[0]['diagnosis'] ?? '',
            'diagnoses' => $diagnoses,
            'vitals' => fetchVitals($pdo, $patientId),
            'background' => fetchBackground($pdo, $patientId),
            'medicationIntake' => fetchMedicationIntake($pdo, $patientId),
            'prescriptions' => fetchPrescriptions($pdo, $patientId),
            'externalMedicine' => fetchExternalMedicine($pdo, $patientId),
            'belongings' => fetchBelongings($pdo, $patientId),
            'visitors' => fetchVisitors($pdo, $patientId)
        ];
    }

    echo json_encode([
        'success' => true,
        'patients' => $patients,
        'count' => count($patients)
    ]);
} catch (Throwable $e) {
    error_log('Error in get_guardian_patient_file.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to load guardian patient file']);
}
?>