<?php
header('Content-Type: application/json');
require_once 'config.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

try {
    $guardianId = (int) $_SESSION['user_id'];

    $stmt = $pdo->prepare('
        SELECT Patient_ID
        FROM `clinicsense`.`patient`
        WHERE Guardian_ID = ?
          AND LOWER(COALESCE(Status, "")) = ?
        ORDER BY Patient_ID DESC
        LIMIT 1
    ');
    $stmt->execute([$guardianId, 'admitted']);

    $patient = $stmt->fetch(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'hasAdmittedPatient' => (bool) $patient,
        'patientId' => $patient['Patient_ID'] ?? null
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to load admitted patient']);
}
?>