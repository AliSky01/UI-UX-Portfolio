<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

try {
    $month = $_GET['month'] ?? null;
    $year  = $_GET['year']  ?? null;
    $consultationFee = 1000;

    $monthFilter = '';
    $params = [];

    if ($month && $year) {
        $monthFilter = ' AND MONTH(date_field) = ? AND YEAR(date_field) = ?';
        $params[] = $month;
        $params[] = $year;
    }

    $query = '
        SELECT 
            pb.Bill_ID,
            pb.Date,
            pb.Payer_Name,
            pb.BankCard,
            pb.Amount,
            pb.Status,
            CONCAT(p.FirstName, " ", p.LastName) as PatientName,
            "Patient" as IncomeCategory,
            pb.Date as date_field
        FROM patientbill pb
        LEFT JOIN patient p ON pb.Patient_ID = p.Patient_ID
        WHERE LOWER(COALESCE(pb.Status, "")) = "paid"
    ';

    $query .= $monthFilter ? str_replace('date_field', 'pb.Date', $monthFilter) : '';

    $query .= '
        UNION ALL
        SELECT
            CONCAT("appointment_", a.Appointment_ID) as Bill_ID,
            DATE_FORMAT(a.AppointmentDate, "%Y-%m-%d") as Date,
            TRIM(CONCAT(a.PatientFirstName, " ", COALESCE(a.PatientMiddleName, ""), " ", a.PatientLastName)) as Payer_Name,
            "Consultation" as BankCard,
            ' . (int) $consultationFee . ' as Amount,
            "paid" as Status,
            TRIM(CONCAT(a.PatientFirstName, " ", COALESCE(a.PatientMiddleName, ""), " ", a.PatientLastName)) as PatientName,
            "Consultation" as IncomeCategory,
            a.AppointmentDate as date_field
        FROM Appointments a
        WHERE LOWER(COALESCE(a.Status, "")) IN ("complete", "completed")
    ';

    $query .= $monthFilter ? str_replace('date_field', 'a.AppointmentDate', $monthFilter) : '';

    $query .= ' ORDER BY Date DESC';

    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Monthly totals
    $thisMonth = date('m');
    $thisYear  = date('Y');
    $lastMonth = date('m', strtotime('first day of last month'));
    $lastYear  = date('Y', strtotime('first day of last month'));

    $totalsSql = '
        SELECT SUM(Amount) as total, COUNT(*) as count
        FROM (
            SELECT pb.Amount as Amount, pb.Date as Date
            FROM patientbill pb
            WHERE LOWER(COALESCE(pb.Status, "")) = "paid"
            UNION ALL
            SELECT ' . (int) $consultationFee . ' as Amount, a.AppointmentDate as Date
            FROM Appointments a
            WHERE LOWER(COALESCE(a.Status, "")) IN ("complete", "completed")
        ) income_rows
        WHERE MONTH(Date) = ? AND YEAR(Date) = ?
    ';

    $thisMonthStmt = $pdo->prepare($totalsSql);
    $thisMonthStmt->execute([$thisMonth, $thisYear]);
    $thisMonthData = $thisMonthStmt->fetch(PDO::FETCH_ASSOC);

    $lastMonthStmt = $pdo->prepare($totalsSql);
    $lastMonthStmt->execute([$lastMonth, $lastYear]);
    $lastMonthData = $lastMonthStmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success'        => true,
        'records'        => $records,
        'thisMonthTotal' => (float)($thisMonthData['total'] ?? 0),
        'thisMonthCount' => (int)($thisMonthData['count'] ?? 0),
        'lastMonthTotal' => (float)($lastMonthData['total'] ?? 0),
        'lastMonthCount' => (int)($lastMonthData['count'] ?? 0),
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>