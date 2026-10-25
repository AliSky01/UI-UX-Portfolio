<?php
header('Content-Type: application/json');
require_once 'config.php';

try {
    // Get all tables in clinicsense database
    $result = $pdo->query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'clinicsense'");
    $tables = $result->fetchAll(PDO::FETCH_COLUMN);
    
    // Check for prescription-related tables
    $prescription_tables = [];
    foreach ($tables as $table) {
        if (stripos($table, 'prescription') !== false || stripos($table, 'diagnosis') !== false) {
            $prescription_tables[$table] = [];
            
            // Get columns for this table
            $colResult = $pdo->query("DESCRIBE clinicsense.`$table`");
            $prescription_tables[$table] = $colResult->fetchAll(PDO::FETCH_ASSOC);
        }
    }
    
    echo json_encode([
        'success' => true,
        'all_tables' => $tables,
        'prescription_related_tables' => $prescription_tables
    ], JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
