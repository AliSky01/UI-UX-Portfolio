<?php
header('Content-Type: application/json');
require_once 'config.php';
require_once 'notification_service.php';
session_start();

function ensureAvailableScheduleTable(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS availableschedule (
            id INT AUTO_INCREMENT PRIMARY KEY,
            schedule_date DATE NOT NULL,
            schedule_time TIME NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT "available",
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_schedule_slot (schedule_date, schedule_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );

    $columnCheck = $pdo->query("SHOW COLUMNS FROM availableschedule LIKE 'status'");
    $statusColumn = $columnCheck ? $columnCheck->fetch(PDO::FETCH_ASSOC) : false;

    if (!$statusColumn) {
        $pdo->exec(
            'ALTER TABLE availableschedule
             ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT "available" AFTER schedule_time'
        );
    }

    $createdByCheck = $pdo->query("SHOW COLUMNS FROM availableschedule LIKE 'created_by'");
    $createdByColumn = $createdByCheck ? $createdByCheck->fetch(PDO::FETCH_ASSOC) : false;

    if (!$createdByColumn) {
        $pdo->exec(
            'ALTER TABLE availableschedule
             ADD COLUMN created_by INT AFTER status'
        );
    }

    $pdo->exec(
        "UPDATE availableschedule
         SET status = 'available'
         WHERE status IS NULL OR status = ''"
    );
}

function ensureAppointmentsAddressColumns(PDO $pdo): void
{
    $patientAddrCheck = $pdo->query("SHOW COLUMNS FROM Appointments LIKE 'PatientAddress'");
    $hasPatientAddr = $patientAddrCheck ? $patientAddrCheck->fetch(PDO::FETCH_ASSOC) : false;

    if (!$hasPatientAddr) {
        $pdo->exec(
            "ALTER TABLE Appointments ADD COLUMN PatientAddress TEXT NULL"
        );
    }

    $guardianAddrCheck = $pdo->query("SHOW COLUMNS FROM Appointments LIKE 'GuardianAddress'");
    $hasGuardianAddr = $guardianAddrCheck ? $guardianAddrCheck->fetch(PDO::FETCH_ASSOC) : false;

    if (!$hasGuardianAddr) {
        $pdo->exec(
            "ALTER TABLE Appointments ADD COLUMN GuardianAddress TEXT NULL"
        );
    }
}

function ensureAppointmentTypeColumn(PDO $pdo): void
{
    $columnCheck = $pdo->query("SHOW COLUMNS FROM Appointments LIKE 'AppointmentType'");
    $appointmentTypeColumn = $columnCheck ? $columnCheck->fetch(PDO::FETCH_ASSOC) : false;

    if ($appointmentTypeColumn) {
        return;
    }

    $legacyColumnCheck = $pdo->query("SHOW COLUMNS FROM Appointments LIKE 'AppointmenType'");
    $legacyColumn = $legacyColumnCheck ? $legacyColumnCheck->fetch(PDO::FETCH_ASSOC) : false;

    if ($legacyColumn) {
        $pdo->exec(
            'ALTER TABLE Appointments
             CHANGE COLUMN AppointmenType AppointmentType VARCHAR(100) NULL'
        );
        return;
    }

    $pdo->exec(
        'ALTER TABLE Appointments
         ADD COLUMN AppointmentType VARCHAR(100) NULL AFTER AppointmentTime'
    );
}

function normalizeDate(string $value): ?string
{
    $date = DateTime::createFromFormat('Y-m-d', $value);
    return $date && $date->format('Y-m-d') === $value ? $value : null;
}

function normalizeTime(string $value): ?string
{
    foreach (['H:i:s', 'H:i'] as $format) {
        $time = DateTime::createFromFormat($format, $value);
        if ($time) {
            return $time->format('H:i:s');
        }
    }

    return null;
}

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

if ($_SESSION['user_type'] !== 'guardian' && $_SESSION['user_type'] !== 'staff') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

try {
    ensureNotificationsTable($pdo);

    if ($_SESSION['user_type'] === 'guardian') {
        $guardianId = $_SESSION['user_id'];
    } else {
        // receptionist/staff: allow schedule on behalf of a guardian
        $guardianId = isset($_POST['guardianId']) ? intval($_POST['guardianId']) : 0;
    }

    $required_fields = ['firstName', 'lastName', 'age', 'sex', 'patientAddress', 'reason', 'guardianRelation', 'income', 'guardianAddress', 'date', 'time', 'type'];
    foreach ($required_fields as $field) {
        if (!isset($_POST[$field]) || $_POST[$field] === '') {
            echo json_encode(['success' => false, 'message' => 'Missing required field: ' . $field]);
            exit;
        }
    }

    $firstName        = trim($_POST['firstName']);
    $middleName       = trim($_POST['middleName'] ?? '');
    $lastName         = trim($_POST['lastName']);
    $age              = intval($_POST['age']);
    $sex              = trim($_POST['sex']);
    $patientAddress   = trim($_POST['patientAddress'] ?? '');
    $symptoms         = trim($_POST['reason']);
    $pastLaboratories = trim($_POST['diagnosis'] ?? '');
    $guardianRelation = trim($_POST['guardianRelation']);
    $guardianIncome   = trim($_POST['income']);
    $guardianAddress  = trim($_POST['guardianAddress'] ?? '');
    $appointmentDate  = normalizeDate(trim($_POST['date']));
    $appointmentTime  = normalizeTime(trim($_POST['time']));
    $appointmentType  = strtolower(trim($_POST['type'] ?? ''));
    $notes            = trim($_POST['notes'] ?? '');

    if (!in_array($appointmentType, ['consultation', 'follow-up'], true)) {
        echo json_encode(['success' => false, 'message' => 'Invalid appointment type']);
        exit;
    }

    if (!$appointmentDate) {
        echo json_encode(['success' => false, 'message' => 'Invalid date format']);
        exit;
    }

    if (!$appointmentTime) {
        echo json_encode(['success' => false, 'message' => 'Invalid time format']);
        exit;
    }

    $appointmentDateTime = DateTime::createFromFormat('Y-m-d H:i:s', $appointmentDate . ' ' . $appointmentTime);
    $now = new DateTime();
    if (!$appointmentDateTime || $appointmentDateTime < $now) {
        echo json_encode(['success' => false, 'message' => 'The selected schedule time has already passed. Please choose another slot.']);
        exit;
    }

    ensureAvailableScheduleTable($pdo);
    ensureAppointmentsAddressColumns($pdo);
    ensureAppointmentTypeColumn($pdo);

    $pdo->beginTransaction();

    $scheduleStmt = $pdo->prepare(
        'SELECT status
         FROM availableschedule
         WHERE schedule_date = ? AND schedule_time = ?
         FOR UPDATE'
    );
    $scheduleStmt->execute([$appointmentDate, $appointmentTime]);
    $schedule = $scheduleStmt->fetch(PDO::FETCH_ASSOC);

    if (!$schedule) {
        $pdo->rollBack();
        echo json_encode([
            'success' => false,
            'message' => 'The selected schedule no longer exists. Please choose another available slot.'
        ]);
        exit;
    }

    if (($schedule['status'] ?? '') !== 'available') {
        $pdo->rollBack();
        echo json_encode([
            'success' => false,
            'message' => 'The selected schedule is no longer available. Please choose another slot.'
        ]);
        exit;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO Appointments (
            Guardian_ID,
            PatientFirstName,
            PatientMiddleName,
            PatientLastName,
            Age,
            Sex,
            PatientAddress,
            Symptoms,
            PastLaboratories,
            GuardianRelation,
            IncomeRange,
            GuardianAddress,
            AppointmentDate,
            AppointmentTime,
            AppointmentType,
            Notes,
            Status,
            CreatedDate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
    );

    $stmt->execute([
        $guardianId,
        $firstName,
        $middleName,
        $lastName,
        $age,
        $sex,
        $patientAddress,
        $symptoms,
        $pastLaboratories,
        $guardianRelation,
        $guardianIncome,
        $guardianAddress,
        $appointmentDate,
        $appointmentTime,
        $appointmentType,
        $notes,
        'pending'
    ]);

    $updateScheduleStmt = $pdo->prepare(
        'UPDATE availableschedule
         SET status = ?
         WHERE schedule_date = ? AND schedule_time = ? AND status = ?'
    );
    $updateScheduleStmt->execute(['occupied', $appointmentDate, $appointmentTime, 'available']);

    if ($updateScheduleStmt->rowCount() !== 1) {
        $pdo->rollBack();
        echo json_encode([
            'success' => false,
            'message' => 'The selected schedule was just booked by another user. Please choose another slot.'
        ]);
        exit;
    }

    $appointmentId = $pdo->lastInsertId();

    $patientName = trim($firstName . ' ' . $middleName . ' ' . $lastName);
    $creatorName = '';
    if (strtolower(trim($_SESSION['user_type'] ?? '')) === 'staff') {
        $creatorName = lookupStaffDisplayName($pdo, (int) $_SESSION['user_id']);
    } elseif (strtolower(trim($_SESSION['user_type'] ?? '')) === 'guardian') {
        $creatorName = trim((string) ($_SESSION['username'] ?? ''));
    }

    createAdminNotification($pdo, [
        'category' => 'appointment',
        'action_type' => 'appointment_created',
        'title' => 'New appointment booked',
        'message' => trim($patientName ?: 'A patient') . ' booked an appointment for ' . $appointmentDate . ' at ' . $appointmentTime . '.',
        'entity_type' => 'Appointments',
        'entity_id' => (int) $appointmentId,
        'patient_id' => null,
        'patient_name' => $patientName ?: null,
        'created_by_staff_id' => $_SESSION['user_type'] === 'staff' ? (int) $_SESSION['user_id'] : null,
        'created_by_name' => $creatorName ?: null
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Appointment saved successfully',
        'appointmentId' => $appointmentId
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>