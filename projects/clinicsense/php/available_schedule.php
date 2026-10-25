<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

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

try {
    ensureAvailableScheduleTable($pdo);
} catch (Exception $e) {
    // Ignore errors, table might already exist or permissions issue
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $month = isset($_GET['month']) ? (int) $_GET['month'] : 0;
    $year = isset($_GET['year']) ? (int) $_GET['year'] : 0;
    $onlyBookable = isset($_GET['only_bookable']) && $_GET['only_bookable'] === '1';

    if ($month < 1 || $month > 12 || $year < 2000 || $year > 2100) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid month or year']);
        exit;
    }

    try {
        // Auto-expire slots whose schedule date/time has already passed.
        $expireStmt = $pdo->prepare(
            "UPDATE availableschedule
             SET status = 'expired'
             WHERE status = 'available'
               AND TIMESTAMP(schedule_date, schedule_time) < NOW()"
        );
        $expireStmt->execute();

        if ($onlyBookable) {
            $stmt = $pdo->prepare(
                'SELECT a.schedule_date, TIME_FORMAT(a.schedule_time, "%H:%i:%s") AS schedule_time, a.status,
                        CONCAT(s.FirstName, " ", s.LastName) AS created_by_name
                 FROM availableschedule a
                 LEFT JOIN Staffs s ON a.created_by = s.Staff_ID
                 WHERE MONTH(a.schedule_date) = ?
                   AND YEAR(a.schedule_date) = ?
                   AND a.status = "available"
                   AND TIMESTAMP(a.schedule_date, a.schedule_time) >= NOW()
                   AND NOT EXISTS (
                        SELECT 1
                        FROM Appointments ap
                        WHERE ap.AppointmentDate = a.schedule_date
                          AND ap.AppointmentTime = a.schedule_time
                   )
                 ORDER BY a.schedule_date ASC, a.schedule_time ASC'
            );
            $stmt->execute([$month, $year]);
        } else {
            $stmt = $pdo->prepare(
                'SELECT a.schedule_date, TIME_FORMAT(a.schedule_time, "%H:%i:%s") AS schedule_time, a.status,
                        CONCAT(s.FirstName, " ", s.LastName) AS created_by_name
                 FROM availableschedule a
                 LEFT JOIN Staffs s ON a.created_by = s.Staff_ID
                 WHERE MONTH(a.schedule_date) = ? AND YEAR(a.schedule_date) = ?
                 ORDER BY a.schedule_date ASC, a.schedule_time ASC'
            );
            $stmt->execute([$month, $year]);
        }

        $schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'schedules' => $schedules
        ]);
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody, true);

if (!is_array($payload)) {
    $payload = $_POST;
}

$scheduleDate = normalizeDate(trim((string) ($payload['schedule_date'] ?? '')));
$scheduleTime = normalizeTime(trim((string) ($payload['schedule_time'] ?? '')));

if (!$scheduleDate || !$scheduleTime) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Valid schedule date and time are required']);
    exit;
}

$today = new DateTime('today');
$selectedDate = DateTime::createFromFormat('Y-m-d', $scheduleDate);

if (!$selectedDate || $selectedDate < $today) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Schedule date must be today or later']);
    exit;
}

try {
    $duplicateStmt = $pdo->prepare(
        'SELECT status
         FROM availableschedule
         WHERE schedule_date = ? AND schedule_time = ?
         LIMIT 1'
    );
    $duplicateStmt->execute([$scheduleDate, $scheduleTime]);
    $existingSchedule = $duplicateStmt->fetch(PDO::FETCH_ASSOC);

    if ($existingSchedule) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'This schedule time already exists in the database.'
        ]);
        exit;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO availableschedule (schedule_date, schedule_time, status, created_by)
         VALUES (?, ?, ?, ?)' 
    );
    $stmt->execute([$scheduleDate, $scheduleTime, 'available', $_SESSION['user_id']]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Available schedule saved successfully',
    'schedule' => [
        'schedule_date' => $scheduleDate,
        'schedule_time' => $scheduleTime,
        'status' => 'available'
    ]
]);
?>