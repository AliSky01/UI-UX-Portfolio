<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

try {
    $search = trim((string) ($_GET['search'] ?? ''));
    $status = $_GET['status'] ?? 'All';

    $query = '
        SELECT
            p.Patient_ID,
            CONCAT(p.FirstName, " ", p.LastName) AS PatientName,
            MAX(ad.Admission_DateTime) AS AdmissionDate,
            MAX(COALESCE(charges.TotalCharge, 0)) AS TotalBill,
            CASE
                WHEN MAX(COALESCE(charges.TotalCharge, 0)) <= MAX(COALESCE(paid.PaidAmount, 0)) THEN "Paid"
                ELSE "Pending"
            END AS BillingStatus
        FROM patient p
        LEFT JOIN admissiondischarge ad ON p.Patient_ID = ad.Patient_ID
        LEFT JOIN (
            SELECT Patient_ID, SUM(Amount) AS TotalCharge
            FROM bill_items
            GROUP BY Patient_ID
        ) charges ON charges.Patient_ID = p.Patient_ID
        LEFT JOIN (
            SELECT Patient_ID, SUM(Amount) AS PaidAmount
            FROM patientbill
            WHERE LOWER(COALESCE(Status, "")) IN ("paid", "partial")
            GROUP BY Patient_ID
        ) paid ON paid.Patient_ID = p.Patient_ID
        WHERE ad.Admission_DateTime IS NOT NULL
    ';

    $params = [];

    if ($search !== '') {
        $query .= ' AND (p.Patient_ID LIKE ? OR CONCAT(p.FirstName, " ", p.LastName) LIKE ?)';
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $query .= ' GROUP BY p.Patient_ID, p.FirstName, p.LastName';

    if ($status !== 'All') {
        $statusLower = strtolower($status);
        if ($statusLower === 'paid') {
            $query .= ' HAVING BillingStatus = "Paid"';
        } elseif ($statusLower === 'overdue') {
            $query .= ' HAVING BillingStatus = "Overdue"';
        } else {
            $query .= ' HAVING BillingStatus = "Pending"';
        }
    }

    $query .= ' ORDER BY PatientName ASC';

    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $bills = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'bills' => $bills]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>