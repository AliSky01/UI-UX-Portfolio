<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$stmt = $pdo->prepare('
    SELECT
        a.*,
        a.Symptoms AS Reason,
        a.PastLaboratories AS PastLaboratory,
        a.IncomeRange AS GuardianIncome,
        a.PatientAddress AS PatientAddress,
        COALESCE(a.GuardianAddress, g.Address) AS GuardianAddress,
        g.FirstName AS GuardianFirstName,
        g.MiddleInitial AS GuardianMiddleName,
        g.LastName AS GuardianLastName,
        g.Contact_No AS GuardianContact
    FROM Appointments a
    LEFT JOIN Guardian g ON a.Guardian_ID = g.Guardian_ID
    WHERE a.Guardian_ID = ?
    ORDER BY a.AppointmentDate DESC, a.AppointmentTime DESC
');
$stmt->execute([$_SESSION['user_id']]);
$appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(['success' => true, 'appointments' => $appointments]);
?>