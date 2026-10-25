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
    $emergencyContactSelect = 'g.Contact_No AS EmergencyContact,';
    $requestedStatus = strtolower(trim((string) ($_GET['status'] ?? '')));
    $queryParams = [];
    $statusWhereClause = '';

    $emergencyContactColumnStmt = $pdo->query("SHOW COLUMNS FROM `clinicsense`.`patient` LIKE 'EmergencyContact'");
    if ($emergencyContactColumnStmt->fetch(PDO::FETCH_ASSOC)) {
        $emergencyContactSelect = 'COALESCE(NULLIF(p.EmergencyContact, ""), g.Contact_No) AS EmergencyContact,';
    }

    if ($requestedStatus !== '' && $requestedStatus !== 'all') {
        $statusWhereClause = 'WHERE LOWER(COALESCE(p.Status, "")) = ?';
        $queryParams[] = $requestedStatus;
    }

    // Fetch all patients from clinicsense database, patient table
    // This allows doctors to add diagnosis/prescription to any patient
    $stmt = $pdo->prepare('
        SELECT 
            p.Patient_ID,
            p.Staff_ID,
            p.Guardian_ID,
            p.FirstName,
            p.MiddleName,
            p.LastName,
            p.Age,
            p.Sex,
            p.Birthdate,
            p.Address,
            p.Room_type,
            p.Status,
            p.Guardian,
            p.CivilStatus,
            p.Religion,
            p.Education,
            p.PreviousOccupation,
            p.Hobbies,
            p.created_at,
            (
                SELECT pd.Diagnosis
                FROM `clinicsense`.`patientdiagnosis` pd
                WHERE pd.Patient_ID = p.Patient_ID
                ORDER BY pd.Date DESC, pd.Diagnosis_ID DESC
                LIMIT 1
            ) AS Diagnosis,
            latest_admission.Admission_DateTime,
            latest_admission.Discharge_DateTime,
            ' . $emergencyContactSelect . '
            g.FirstName AS GuardianFirstName,
            g.MiddleInitial AS GuardianMiddleName,
            g.LastName AS GuardianLastName,
            st.FirstName AS StaffFirstName,
            st.LastName AS StaffLastName,
            st.Role AS StaffRole
        FROM `clinicsense`.`patient` p
        LEFT JOIN (
            SELECT ad.Patient_ID, ad.Admission_DateTime, ad.Discharge_DateTime
            FROM `clinicsense`.`AdmissionDischarge` ad
            INNER JOIN (
                SELECT Patient_ID, MAX(Admission_DateTime) AS Admission_DateTime
                FROM `clinicsense`.`AdmissionDischarge`
                GROUP BY Patient_ID
            ) latest ON latest.Patient_ID = ad.Patient_ID AND latest.Admission_DateTime = ad.Admission_DateTime
        ) latest_admission ON latest_admission.Patient_ID = p.Patient_ID
        LEFT JOIN `clinicsense`.`Guardian` g ON p.Guardian_ID = g.Guardian_ID
        LEFT JOIN `clinicsense`.`Staffs` st ON p.Staff_ID = st.Staff_ID
        ' . $statusWhereClause . '
        ORDER BY p.LastName ASC, p.FirstName ASC
        LIMIT 500
    ');
    
    $stmt->execute($queryParams);
    $patients = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Format the response
    $formatted_patients = [];
    foreach ($patients as $patient) {
        $attendingPhysician = trim(($patient['StaffFirstName'] ?? '') . ' ' . ($patient['StaffLastName'] ?? ''));
        $guardianName = trim(($patient['GuardianFirstName'] ?? '') . ' ' . ($patient['GuardianMiddleName'] ?? '') . ' ' . ($patient['GuardianLastName'] ?? ''));

        $formatted_patients[] = [
            'id' => $patient['Patient_ID'],
            'name' => $patient['LastName'] . ', ' . $patient['FirstName'],
            'staffId' => $patient['Staff_ID'] ?? null,
            'guardianId' => $patient['Guardian_ID'] ?? null,
            'firstName' => $patient['FirstName'],
            'middleName' => $patient['MiddleName'] ?? '',
            'lastName' => $patient['LastName'],
            'age' => $patient['Age'] ?? 0,
            'sex' => $patient['Sex'] ?? 'M',
            'birthdate' => $patient['Birthdate'] ?? 'N/A',
            'address' => $patient['Address'] ?? 'N/A',
            'roomType' => $patient['Room_type'] ?? '',
            'status' => $patient['Status'] ?? 'active',
            'guardian' => $patient['Guardian'] ?? ($guardianName ?: 'N/A'),
            'emergencyContact' => $patient['EmergencyContact'] ?? 'N/A',
            'civilStatus' => $patient['CivilStatus'] ?? 'N/A',
            'religion' => $patient['Religion'] ?? 'N/A',
            'education' => $patient['Education'] ?? 'N/A',
            'previousOccupation' => $patient['PreviousOccupation'] ?? 'N/A',
            'hobbies' => $patient['Hobbies'] ?? 'N/A',
            'diagnosis' => $patient['Diagnosis'] ?: '—',
            'createdAt' => $patient['created_at'] ?? null,
            'admissionDateTime' => $patient['Admission_DateTime'] ?? null,
            'dischargeDateTime' => $patient['Discharge_DateTime'] ?? null,
            'attendingPhysician' => $attendingPhysician,
            'attendingRole' => $patient['StaffRole'] ?? ''
        ];
    }
    
    error_log('Successfully fetched ' . count($formatted_patients) . ' patients from clinicsense.patient');
    
    echo json_encode(['success' => true, 'patients' => $formatted_patients, 'count' => count($formatted_patients)]);
} catch (PDOException $e) {
    error_log('PDO Error in get_doctor_patients.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log('General Error in get_doctor_patients.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}
?>
