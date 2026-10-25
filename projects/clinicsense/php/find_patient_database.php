<?php
// Find where patient data is stored
header('Content-Type: application/json');
require_once 'config.php';

try {
    // Get all available databases
    $result = $pdo->query("SHOW DATABASES");
    $allDatabases = $result->fetchAll(PDO::FETCH_COLUMN);
    
    // Search for Patient table in all databases
    $databasesWithPatientTable = [];
    
    foreach ($allDatabases as $dbName) {
        // Skip system databases
        if (in_array($dbName, ['information_schema', 'mysql', 'performance_schema', 'sys'])) {
            continue;
        }
        
        try {
            $query = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?";
            $stmt = $pdo->prepare($query);
            $stmt->execute([$dbName]);
            $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            // Check if this database has a Patient-related table
            foreach ($tables as $table) {
                if (stripos($table, 'patient') !== false) {
                    if (!isset($databasesWithPatientTable[$dbName])) {
                        $databasesWithPatientTable[$dbName] = [];
                    }
                    $databasesWithPatientTable[$dbName][] = $table;
                }
            }
            
            // Also check what's the current default database
            if ($dbName === substr(strrchr($pdo->getAttribute(PDO::ATTR_CONNECTION_STATUS), '=db=') ?: $dbName, -strlen($dbName))) {
                $databasesWithPatientTable[$dbName . ' (DEFAULT)'] = $tables;
            }
        } catch (Exception $e) {
            // Skip if we can't access this database
        }
    }
    
    // If we found Patient tables, get details
    $patientDetails = [];
    foreach ($databasesWithPatientTable as $dbName => $tables) {
        foreach ($tables as $table) {
            $cleanDbName = str_replace(' (DEFAULT)', '', $dbName);
            try {
                $countResult = $pdo->query("SELECT COUNT(*) as count FROM `$cleanDbName`.`$table`");
                $count = $countResult->fetch(PDO::FETCH_ASSOC)['count'];
                
                $sampleResult = $pdo->query("SELECT * FROM `$cleanDbName`.`$table` LIMIT 1");
                $sample = $sampleResult->fetch(PDO::FETCH_ASSOC);
                
                $patientDetails[$cleanDbName][$table] = [
                    'count' => $count,
                    'sample_record' => $sample
                ];
            } catch (Exception $e) {
                $patientDetails[$cleanDbName][$table] = ['error' => $e->getMessage()];
            }
        }
    }
    
    echo json_encode([
        'success' => true,
        'all_databases' => $allDatabases,
        'databases_with_patient_tables' => $databasesWithPatientTable,
        'patient_details' => $patientDetails,
        'recommendation' => count($databasesWithPatientTable) > 0 
            ? 'Update get_doctor_patients.php to use: ' . array_key_first($databasesWithPatientTable)
            : 'No Patient tables found. Please create patient data.'
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
