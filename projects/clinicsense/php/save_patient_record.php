<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

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

function getRequestPayload(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return $_POST;
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $_POST;
}

function normalizeNullableString($value): ?string
{
    if (!is_scalar($value)) {
        return null;
    }

    $trimmed = trim((string) $value);
    return $trimmed === '' ? null : $trimmed;
}

function normalizeSex($value): ?string
{
    $normalized = strtolower(trim((string) $value));

    if (in_array($normalized, ['male', 'm'], true)) {
        return 'male';
    }

    if (in_array($normalized, ['female', 'f'], true)) {
        return 'female';
    }

    if ($normalized === 'other') {
        return 'other';
    }

    return null;
}

function normalizeBirthdate($value): ?string
{
    $trimmed = trim((string) $value);
    if ($trimmed === '') {
        return null;
    }

    $timestamp = strtotime($trimmed);
    if ($timestamp === false) {
        return null;
    }

    return date('Y-m-d', $timestamp);
}

function normalizeRoomType($value): ?string
{
    $normalized = strtolower(trim((string) $value));

    if (in_array($normalized, ['private', 'ward'], true)) {
        return $normalized;
    }

    return null;
}

function calculateAgeFromBirthdate(string $birthdate): int
{
    $dob = new DateTimeImmutable($birthdate);
    $today = new DateTimeImmutable('today');
    return (int) $dob->diff($today)->y;
}

function buildFullName(?string $firstName, ?string $middleName, ?string $lastName): string
{
    return trim(implode(' ', array_filter([$firstName, $middleName, $lastName], function ($part) {
        return $part !== null && trim($part) !== '';
    })));
}

function patientEmergencyContactColumnExists(PDO $pdo): bool
{
    $stmt = $pdo->query("SHOW COLUMNS FROM `clinicsense`.`patient` LIKE 'EmergencyContact'");
    return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
}

function ensurePatientEmergencyContactColumn(PDO $pdo): bool
{
    if (patientEmergencyContactColumnExists($pdo)) {
        return true;
    }

    $pdo->exec('ALTER TABLE `clinicsense`.`patient` ADD COLUMN `EmergencyContact` VARCHAR(50) NULL AFTER `Guardian`');
    return true;
}

function fetchDoctor(PDO $pdo, int $staffId): ?array
{
    $stmt = $pdo->prepare('SELECT Staff_ID, FirstName, LastName FROM `clinicsense`.`Staffs` WHERE Staff_ID = ? AND LOWER(Role) = ? LIMIT 1');
    $stmt->execute([$staffId, 'doctor']);
    $doctor = $stmt->fetch(PDO::FETCH_ASSOC);

    return $doctor ?: null;
}

function fetchAppointment(PDO $pdo, int $appointmentId): ?array
{
    $stmt = $pdo->prepare('
        SELECT
            a.Appointment_ID,
            a.Guardian_ID,
            a.PatientFirstName,
            a.PatientMiddleName,
            a.PatientLastName,
            a.Age,
            a.Sex,
            a.Status,
            g.FirstName AS GuardianFirstName,
            g.MiddleInitial AS GuardianMiddleName,
            g.LastName AS GuardianLastName,
            g.Contact_No AS GuardianContact,
            g.Address AS GuardianAddress
        FROM `clinicsense`.`Appointments` a
        LEFT JOIN `clinicsense`.`Guardian` g ON a.Guardian_ID = g.Guardian_ID
        WHERE a.Appointment_ID = ?
          AND LOWER(a.Status) IN (?, ?, ?)
        LIMIT 1
    ');
    $stmt->execute([$appointmentId, 'for admission', 'admitted', 'for_admission']);
    $appointment = $stmt->fetch(PDO::FETCH_ASSOC);

    return $appointment ?: null;
}

function patientAlreadyExists(PDO $pdo, array $appointment): ?int
{
    $guardianId = isset($appointment['Guardian_ID']) ? (int) $appointment['Guardian_ID'] : 0;
    $firstName = strtolower(trim((string) ($appointment['PatientFirstName'] ?? '')));
    $lastName = strtolower(trim((string) ($appointment['PatientLastName'] ?? '')));

    if ($firstName === '' || $lastName === '') {
        return null;
    }

    if ($guardianId > 0) {
        $stmt = $pdo->prepare('
            SELECT Patient_ID
            FROM `clinicsense`.`patient`
            WHERE COALESCE(Guardian_ID, 0) = ?
              AND LOWER(COALESCE(FirstName, "")) = ?
              AND LOWER(COALESCE(LastName, "")) = ?
            ORDER BY Patient_ID DESC
            LIMIT 1
        ');
        $stmt->execute([$guardianId, $firstName, $lastName]);
    } else {
        $stmt = $pdo->prepare('
            SELECT Patient_ID
            FROM `clinicsense`.`patient`
            WHERE LOWER(COALESCE(FirstName, "")) = ?
              AND LOWER(COALESCE(LastName, "")) = ?
              AND COALESCE(Age, 0) = ?
              AND LOWER(COALESCE(Sex, "")) = ?
            ORDER BY Patient_ID DESC
            LIMIT 1
        ');
        $stmt->execute([
            $firstName,
            $lastName,
            (int) ($appointment['Age'] ?? 0),
            strtolower((string) ($appointment['Sex'] ?? ''))
        ]);
    }

    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    return $existing ? (int) $existing['Patient_ID'] : null;
}

try {
    ensureNotificationsTable($pdo);

    $payload = getRequestPayload();
    $appointmentId = (int) ($payload['appointmentId'] ?? $payload['appointment_id'] ?? 0);
    $staffId = (int) ($payload['staffId'] ?? $payload['staff_id'] ?? 0);

    if ($appointmentId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Appointment selection is required']);
        exit;
    }

    if ($staffId <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Attending physician is required']);
        exit;
    }

    $doctor = fetchDoctor($pdo, $staffId);
    if (!$doctor) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Selected attending physician was not found']);
        exit;
    }

    $appointment = fetchAppointment($pdo, $appointmentId);
    if (!$appointment) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'For admission appointment not found']);
        exit;
    }

    $existingPatientId = patientAlreadyExists($pdo, $appointment);
    if ($existingPatientId) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'This appointment already has a patient record.',
            'patientId' => $existingPatientId
        ]);
        exit;
    }

    $hasEmergencyContactColumn = ensurePatientEmergencyContactColumn($pdo);

    $firstName = normalizeNullableString($appointment['PatientFirstName'] ?? null);
    $middleName = normalizeNullableString($appointment['PatientMiddleName'] ?? null);
    $lastName = normalizeNullableString($appointment['PatientLastName'] ?? null);
    $birthdate = normalizeBirthdate($payload['birthdate'] ?? $payload['dob'] ?? null);
    $age = isset($payload['age']) && trim((string) $payload['age']) !== '' ? (int) $payload['age'] : (int) ($appointment['Age'] ?? 0);
    if ($age <= 0 && $birthdate) {
        $age = calculateAgeFromBirthdate($birthdate);
    }

    $sex = normalizeSex($payload['sex'] ?? $appointment['Sex'] ?? null);
    $civilStatus = normalizeNullableString($payload['civilStatus'] ?? null);
    $address = normalizeNullableString($payload['address'] ?? $appointment['GuardianAddress'] ?? null);
    $roomType = normalizeRoomType($payload['roomType'] ?? $payload['room_type'] ?? null);
    $religion = normalizeNullableString($payload['religion'] ?? null);
    $previousOccupation = normalizeNullableString($payload['previousOccupation'] ?? null);
    $hobbies = normalizeNullableString($payload['hobbies'] ?? null);
    $guardianName = normalizeNullableString($payload['guardianName'] ?? null);
    if ($guardianName === null) {
        $guardianName = normalizeNullableString(buildFullName(
            $appointment['GuardianFirstName'] ?? null,
            $appointment['GuardianMiddleName'] ?? null,
            $appointment['GuardianLastName'] ?? null
        ));
    }

    $emergencyContact = normalizeNullableString($payload['emergencyContact'] ?? $appointment['GuardianContact'] ?? null);
    $diagnosis = normalizeNullableString($payload['diagnosis'] ?? null);
    $observations = is_array($payload['observations'] ?? null) ? $payload['observations'] : [];
    $chronicCondition = normalizeNullableString($payload['chronicCondition'] ?? null);
    $foodAllergy = normalizeNullableString($payload['foodAllergy'] ?? null);
    $medicalAllergy = normalizeNullableString($payload['medicalAllergy'] ?? null);
    $paternalPsych = normalizeNullableString($payload['paternalPsych'] ?? null);
    $maternalPsych = normalizeNullableString($payload['maternalPsych'] ?? null);
    $paternalMed = normalizeNullableString($payload['paternalMed'] ?? null);
    $maternalMed = normalizeNullableString($payload['maternalMed'] ?? null);
    $vitals = is_array($payload['vitals'] ?? null) ? $payload['vitals'] : [];

    $doctorName = trim(($doctor['FirstName'] ?? '') . ' ' . ($doctor['LastName'] ?? '')) ?: 'Doctor on record';
    $guardianId = isset($appointment['Guardian_ID']) ? (int) $appointment['Guardian_ID'] : null;

    if ($roomType === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Room type is required']);
        exit;
    }

    $hasAnyVitalValue = false;
    $normalizedVitals = [
        'blood_pressure' => normalizeNullableString($vitals['bloodPressure'] ?? null),
        'pulse_rate' => normalizeNullableString($vitals['pulseRate'] ?? null),
        'temperature' => normalizeNullableString($vitals['temperature'] ?? null),
        'weight' => normalizeNullableString($vitals['weight'] ?? null),
        'height' => normalizeNullableString($vitals['height'] ?? null),
        'respiratory_rate' => normalizeNullableString($vitals['respiratoryRate'] ?? null),
        'oxygen_saturation' => normalizeNullableString($vitals['oxygenSaturation'] ?? null)
    ];

    foreach ($normalizedVitals as $value) {
        if ($value !== null) {
            $hasAnyVitalValue = true;
            break;
        }
    }

    if ($hasAnyVitalValue) {
        foreach ($normalizedVitals as $key => $value) {
            if ($value === null) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'All vital fields are required when saving vitals']);
                exit;
            }
        }
    }

    $normalizedObservations = array_values(array_filter(array_map(function ($item) {
        return normalizeNullableString($item);
    }, $observations)));

    $pdo->beginTransaction();

    $patientColumns = [
        'Staff_ID',
        'Guardian_ID',
        'Status',
        'Room_type',
        'FirstName',
        'MiddleName',
        'LastName',
        'Sex',
        'Birthdate',
        'Age',
        'CivilStatus',
        'Address',
        'Religion',
        'Education',
        'PreviousOccupation',
        'Hobbies',
        'Guardian'
    ];
    $patientValues = [
        $staffId,
        $guardianId,
        'admitted',
        $roomType,
        $firstName,
        $middleName,
        $lastName,
        $sex,
        $birthdate,
        $age > 0 ? $age : null,
        $civilStatus,
        $address,
        $religion,
        null,
        $previousOccupation,
        $hobbies,
        $guardianName
    ];

    if ($hasEmergencyContactColumn) {
        $patientColumns[] = 'EmergencyContact';
        $patientValues[] = $emergencyContact;
    }

    $placeholders = implode(', ', array_fill(0, count($patientColumns), '?'));
    $patientInsertSql = 'INSERT INTO `clinicsense`.`patient` (' . implode(', ', $patientColumns) . ') VALUES (' . $placeholders . ')';
    $patientStmt = $pdo->prepare($patientInsertSql);
    $patientStmt->execute($patientValues);

    $patientId = (int) $pdo->lastInsertId();

    $admissionStmt = $pdo->prepare('INSERT INTO `clinicsense`.`AdmissionDischarge` (Patient_ID, Admission_DateTime) VALUES (?, NOW())');
    $admissionStmt->execute([$patientId]);

    if ($hasAnyVitalValue) {
        $vitalsStmt = $pdo->prepare('
            INSERT INTO `clinicsense`.`PatientVitals` (
                Patient_ID,
                Blood_pressure,
                Temperature,
                Height,
                Weight,
                Pulse_rate,
                Respiratory_rate,
                Oxygen_saturation,
                Date_recorded
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ');
        $vitalsStmt->execute([
            $patientId,
            $normalizedVitals['blood_pressure'],
            $normalizedVitals['temperature'],
            $normalizedVitals['height'],
            $normalizedVitals['weight'],
            $normalizedVitals['pulse_rate'],
            $normalizedVitals['respiratory_rate'],
            $normalizedVitals['oxygen_saturation']
        ]);
    }

    if ($diagnosis !== null) {
        $diagnosisStmt = $pdo->prepare('
            INSERT INTO `clinicsense`.`PatientDiagnosis` (
                Patient_ID,
                Diagnosis,
                Diagnosed_by,
                Date,
                Notes
            ) VALUES (?, ?, ?, ?, ?)
        ');
        $diagnosisStmt->execute([
            $patientId,
            $diagnosis,
            $doctorName,
            date('Y-m-d'),
            ''
        ]);
    }

    if (!empty($normalizedObservations)) {
        $observationStmt = $pdo->prepare('
            INSERT INTO `clinicsense`.`PatientObservation` (
                Patient_ID,
                observation_date,
                observation
            ) VALUES (?, NOW(), ?)
        ');

        foreach ($normalizedObservations as $observation) {
            $observationStmt->execute([$patientId, $observation]);
        }
    }

    if ($chronicCondition !== null || $foodAllergy !== null || $medicalAllergy !== null) {
        $medicalStmt = $pdo->prepare('
            INSERT INTO `clinicsense`.`PatientMedHistory` (
                Patient_ID,
                Chronic_condition,
                Food_allergy,
                Medical_allergy
            ) VALUES (?, ?, ?, ?)
        ');
        $medicalStmt->execute([$patientId, $chronicCondition, $foodAllergy, $medicalAllergy]);
    }

    if ($paternalPsych !== null || $maternalPsych !== null || $paternalMed !== null || $maternalMed !== null) {
        $familyStmt = $pdo->prepare('
            INSERT INTO `clinicsense`.`PatientFamHistory` (
                Patient_ID,
                paternal_psych,
                maternal_psych,
                paternal_med,
                maternal_med
            ) VALUES (?, ?, ?, ?, ?)
        ');
        $familyStmt->execute([$patientId, $paternalPsych, $maternalPsych, $paternalMed, $maternalMed]);
    }

    $appointmentStatusStmt = $pdo->prepare('
        UPDATE `clinicsense`.`Appointments`
        SET `Status` = ?
        WHERE `Appointment_ID` = ?
    ');
    $appointmentStatusStmt->execute(['admitted', $appointmentId]);

    $patientName = buildFullName($firstName, $middleName, $lastName);
    $admittingStaffName = lookupStaffDisplayName($pdo, $staffId);
    createAdminNotification($pdo, [
        'category' => 'admission',
        'action_type' => 'patient_admitted',
        'title' => 'New patient admission',
        'message' => ($patientName !== '' ? $patientName : 'A patient') . ' was admitted by ' . ($admittingStaffName !== '' ? $admittingStaffName : 'medical staff') . '.',
        'entity_type' => 'patient',
        'entity_id' => $patientId,
        'patient_id' => $patientId,
        'patient_name' => $patientName,
        'created_by_staff_id' => $staffId,
        'created_by_name' => $admittingStaffName
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Patient record saved successfully.',
        'patientId' => $patientId,
        'patientName' => buildFullName($firstName, $middleName, $lastName)
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Error in save_patient_record.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>