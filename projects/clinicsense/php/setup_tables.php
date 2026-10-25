<?php
header('Content-Type: application/json');
require_once 'config.php';

try {
    // Create PatientPrescription table
    $sqlPrescription = "CREATE TABLE IF NOT EXISTS `clinicsense`.`PatientPrescription` (
        `Prescription_ID` INT AUTO_INCREMENT PRIMARY KEY,
        `Patient_ID` INT NOT NULL,
        `Medicine` VARCHAR(255) NOT NULL,
        `Dosage` VARCHAR(100),
        `Frequency` VARCHAR(100),
        `Duration` VARCHAR(100),
        `Special_Instructions` TEXT,
        `Date` DATE,
        `Prescribed_By` INT,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (Patient_ID) REFERENCES `clinicsense`.`patient`(Patient_ID),
        FOREIGN KEY (Prescribed_By) REFERENCES `clinicsense`.`Staffs`(Staff_ID),
        INDEX `idx_patient` (`Patient_ID`),
        INDEX `idx_date` (`Date`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sqlPrescription);
    
    // Create PatientDiagnosis table
    $sqlDiagnosis = "CREATE TABLE IF NOT EXISTS `clinicsense`.`PatientDiagnosis` (
        `diagnosis_id` INT AUTO_INCREMENT PRIMARY KEY,
        `patient_id` INT NOT NULL,
        `diagnosis` TEXT NOT NULL,
        `date` DATE,
        `notes` TEXT,
        `observations` TEXT,
        `prescribed_by` INT,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES `clinicsense`.`patient`(Patient_ID),
        FOREIGN KEY (prescribed_by) REFERENCES `clinicsense`.`Staffs`(Staff_ID),
        INDEX `idx_patient` (`patient_id`),
        INDEX `idx_date` (`date`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sqlDiagnosis);
    
    echo json_encode([
        'success' => true,
        'message' => 'Tables created successfully!',
        'PatientPrescription' => 'Created',
        'PatientDiagnosis' => 'Created'
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error creating tables: ' . $e->getMessage()
    ]);
}
?>
