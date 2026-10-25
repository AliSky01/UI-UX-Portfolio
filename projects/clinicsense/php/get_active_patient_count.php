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
    $columnStmt = $pdo->query("SHOW COLUMNS FROM `clinicsense`.`patient` LIKE 'Status'");
    $hasStatusColumn = $columnStmt && $columnStmt->fetch(PDO::FETCH_ASSOC);

    if ($hasStatusColumn) {
        $stmt = $pdo->query(
            "SELECT COUNT(*) AS active_count
             FROM `clinicsense`.`patient`
             WHERE LOWER(COALESCE(NULLIF(`Status`, ''), 'active')) IN ('active', 'admitted')"
        );
    } else {
        $stmt = $pdo->query("SELECT COUNT(*) AS active_count FROM `clinicsense`.`patient`");
    }

    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $count = (int) ($result['active_count'] ?? 0);

    echo json_encode([
        'success' => true,
        'count' => $count
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Unable to load active patient count',
        'error' => $e->getMessage()
    ]);
}
?>