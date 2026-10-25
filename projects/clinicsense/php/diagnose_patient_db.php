<?php
// Diagnostic file to check patient database structure
header('Content-Type: application/json');
require_once 'config.php';

try {
    // Test 1: Check if patient database exists
    $result = $pdo->query("SHOW DATABASES LIKE 'patient'");
    $databases = $result->fetchAll(PDO::FETCH_COLUMN);
    
    if (empty($databases)) {
        echo json_encode(['error' => 'patient database does not exist']);
        exit;
    }
    
    // Test 2: Get all tables in patient database
    $result = $pdo->query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'patient'");
    $tables = $result->fetchAll(PDO::FETCH_COLUMN);
    
    // Test 3: Check Patient table structure
    $patientTableInfo = [];
    if (in_array('Patient', $tables)) {
        $result = $pdo->query("DESCRIBE patient.Patient");
        $patientTableInfo = $result->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Test 4: Count patients
    $patientCount = 0;
    try {
        $result = $pdo->query("SELECT COUNT(*) as count FROM patient.Patient");
        $row = $result->fetch(PDO::FETCH_ASSOC);
        $patientCount = $row['count'] ?? 0;
    } catch (Exception $e) {
        // Table might not exist
    }
    
    // Test 5: Get sample patient if exists
    $samplePatient = null;
    try {
        $result = $pdo->query("SELECT * FROM patient.Patient LIMIT 1");
        $samplePatient = $result->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        // Table might not exist
    }
    
    echo json_encode([
        'success' => true,
        'patient_database_exists' => true,
        'tables' => $tables,
        'patient_table_structure' => $patientTableInfo,
        'patient_count' => $patientCount,
        'sample_patient' => $samplePatient,
        'diagnostic_info' => [
            'PDO connected' => true,
            'Testing database' => 'patient',
            'Looking for columns' => ['Patient_ID', 'FirstName', 'LastName', 'Age', 'Sex']
        ]
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'diagnostic_info' => [
            'issue' => 'Cannot connect to patient database',
            'action' => 'Check database connection and permissions'
        ]
    ]);
}
?>
