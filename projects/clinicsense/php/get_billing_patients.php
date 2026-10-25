<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

try {
    $stmt = $pdo->query('
        SELECT 
            p.Patient_ID,
            p.FirstName,
            p.LastName,
            p.Status
        FROM patient p
        ORDER BY p.LastName ASC, p.FirstName ASC
    ');
    $patients = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'patients' => $patients]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>