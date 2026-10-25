// Patient data - will be loaded from database
let patientsData = [];

// Medication activity data - will be loaded from database
let medicationActivities = [];

// Pagination variables
let currentPage = 1;
const itemsPerPage = 5;
let filteredPatients = [];
let doctorDashboardConfirmResolver = null;
let doctorDashboardConfirmModalInstance = null;
let doctorDashboardFeedbackModalInstance = null;

function getDashboardModalConfig(variant) {
    const variants = {
        primary: {
            badgeClass: 'action-modal-badge is-primary',
            iconClass: 'bi bi-save-fill',
            buttonClass: 'btn btn-primary'
        },
        success: {
            badgeClass: 'action-modal-badge is-success',
            iconClass: 'bi bi-check-circle-fill',
            buttonClass: 'btn btn-primary'
        },
        warning: {
            badgeClass: 'action-modal-badge is-warning',
            iconClass: 'bi bi-exclamation-triangle-fill',
            buttonClass: 'btn btn-secondary'
        },
        danger: {
            badgeClass: 'action-modal-badge is-danger',
            iconClass: 'bi bi-x-circle-fill',
            buttonClass: 'btn btn-primary'
        }
    };

    return variants[variant] || variants.primary;
}

function getDoctorDashboardConfirmModal() {
    const modalElement = document.getElementById('doctorDashboardConfirmModal');
    if (!modalElement) {
        return null;
    }

    if (!doctorDashboardConfirmModalInstance) {
        doctorDashboardConfirmModalInstance = bootstrap.Modal.getOrCreateInstance(modalElement, {
            backdrop: 'static',
            keyboard: false
        });

        modalElement.addEventListener('hidden.bs.modal', () => {
            if (typeof doctorDashboardConfirmResolver === 'function') {
                const resolve = doctorDashboardConfirmResolver;
                doctorDashboardConfirmResolver = null;
                resolve(false);
            }
        });
    }

    return doctorDashboardConfirmModalInstance;
}

function getDoctorDashboardFeedbackModal() {
    const modalElement = document.getElementById('doctorDashboardFeedbackModal');
    if (!modalElement) {
        return null;
    }

    if (!doctorDashboardFeedbackModalInstance) {
        doctorDashboardFeedbackModalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
    }

    return doctorDashboardFeedbackModalInstance;
}

function showDoctorDashboardFeedback(message, title = 'Notice', variant = 'success') {
    const modal = getDoctorDashboardFeedbackModal();
    if (!modal) {
        return;
    }

    const config = getDashboardModalConfig(variant);
    const badge = document.getElementById('doctorDashboardFeedbackBadge');
    const button = document.getElementById('doctorDashboardFeedbackButton');

    document.getElementById('doctorDashboardFeedbackTitle').textContent = title;
    document.getElementById('doctorDashboardFeedbackMessage').textContent = message;

    if (badge) {
        badge.className = config.badgeClass;
        badge.innerHTML = `<i class="${config.iconClass}"></i>`;
    }

    if (button) {
        button.className = config.buttonClass;
        button.textContent = 'OK';
    }

    modal.show();
}

function showDoctorDashboardConfirm(message, title = 'Confirm Save', variant = 'primary', confirmLabel = 'Save') {
    const modal = getDoctorDashboardConfirmModal();
    if (!modal) {
        return Promise.resolve(false);
    }

    if (typeof doctorDashboardConfirmResolver === 'function') {
        doctorDashboardConfirmResolver(false);
        doctorDashboardConfirmResolver = null;
    }

    const config = getDashboardModalConfig(variant);
    const badge = document.getElementById('doctorDashboardConfirmBadge');
    const confirmButton = document.getElementById('doctorDashboardConfirmButton');

    document.getElementById('doctorDashboardConfirmTitle').textContent = title;
    document.getElementById('doctorDashboardConfirmMessage').textContent = message;

    if (badge) {
        badge.className = config.badgeClass;
        badge.innerHTML = `<i class="${config.iconClass}"></i>`;
    }

    if (confirmButton) {
        confirmButton.className = config.buttonClass;
        confirmButton.textContent = confirmLabel;
    }

    modal.show();

    return new Promise(resolve => {
        doctorDashboardConfirmResolver = resolve;
    });
}

function resolveDoctorDashboardConfirm(result) {
    const modal = getDoctorDashboardConfirmModal();
    if (modal) {
        modal.hide();
    }

    if (typeof doctorDashboardConfirmResolver === 'function') {
        const resolve = doctorDashboardConfirmResolver;
        doctorDashboardConfirmResolver = null;
        resolve(result);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard().then(() => {
        console.log('Dashboard initialization complete');
        console.log('patientData count:', patientsData.length);
    }).catch(error => {
        console.error('Dashboard initialization failed:', error);
    });
    setupEventListeners();
});

// Initialize dashboard
async function initializeDashboard() {
    try {
        // Load patients from database
        await loadPatientsFromDatabase();
        
        // Load medication activity from database
        await loadMedicationActivityFromDatabase();
        
        loadMedicationActivity();
        loadPatientChart();
        updateActivePatientCount();
        populatePatientDropdowns();
        setTodayDate();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showDoctorDashboardFeedback('Error loading dashboard data. Please refresh the page.', 'Load Failed', 'danger');
    }
}

// Load patients from database
async function loadPatientsFromDatabase() {
    try {
        const response = await fetch('../php/get_doctor_patients.php?status=admitted');
        const data = await response.json();
        
        console.log('Patients API Response:', data);
        
        if (data.success && data.patients && data.patients.length > 0) {
            patientsData = data.patients;
            filteredPatients = [...patientsData];
            console.log(`Successfully loaded ${patientsData.length} patients`);
        } else {
            console.warn('No patients found or API error:', data.message);
            patientsData = [];
            filteredPatients = [];
        }
    } catch (error) {
        console.error('Error fetching patients:', error);
        patientsData = [];
        filteredPatients = [];
    }
}

// Load medication activity from database
async function loadMedicationActivityFromDatabase() {
    try {
        const response = await fetch('../php/get_prescription.php');
        const data = await response.json();
        
        if (data.success && data.prescriptions) {
            medicationActivities = data.prescriptions.map(p => ({
                patient: p.PatientName || 'Unknown',
                medication: p.Medicine || 'Unknown',
                dosage: p.Dosage || '',
                frequency: p.Frequency || '',
                date: new Date(p.Date).toLocaleString() || new Date().toLocaleString(),
                doctor: p.PrescribedByName || 'Unknown'
            }));
        } else {
            medicationActivities = [];
        }
    } catch (error) {
        console.error('Error fetching medication activities:', error);
        medicationActivities = [];
    }
}

// Load medication activity (Prescribed Medicines)
function loadMedicationActivity() {
    const medicationList = document.getElementById('medicationList');
    medicationList.innerHTML = '';
    
    const activityToShow = medicationActivities.slice(0, 15);
    
    if (activityToShow.length === 0) {
        medicationList.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">No medication activity recorded yet</p>';
        return;
    }
    
    activityToShow.forEach(activity => {
        const medicationItem = document.createElement('div');
        medicationItem.className = 'medication-item';
        const medicationDisplay = activity.dosage ? `${activity.medication} ${activity.dosage}` : activity.medication;
        medicationItem.innerHTML = `
            <div class="medication-bullet"></div>
            <div class="medication-details">
                <p class="medication-patient"><strong>${activity.patient}</strong></p>
                <p class="medication-name">${medicationDisplay}</p>
                <p class="medication-date">${activity.date}</p>
                <p class="medication-nurse">${activity.doctor}</p>
            </div>
        `;
        medicationList.appendChild(medicationItem);
    });
}

// Load patient chart
function loadPatientChart(page = 1) {
    currentPage = page;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const patientsToShow = filteredPatients.slice(startIndex, endIndex);
    
    const tableBody = document.getElementById('patientTableBody');
    tableBody.innerHTML = '';
    
    patientsToShow.forEach(patient => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <td>${patient.name}</td>
            <td>${patient.age}</td>
            <td>${patient.sex}</td>
            <td>${patient.diagnosis || "—"}</td>
            <td>
                <button class="btn-view-details" onclick="event.stopPropagation(); viewPatientDetails(${patient.id})" title="View Details">
                    <i class="bi bi-three-dots-vertical"></i>
                </button>
            </td>
        `;
        
        // Make entire row clickable
        row.addEventListener('click', function() {
            viewPatientDetails(patient.id);
        });
        
        tableBody.appendChild(row);
    });
    
    updatePagination();
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    
    // Update button states
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
    
    // Update page numbers
    document.querySelectorAll('.page-number').forEach(pageNum => {
        const pageNumber = parseInt(pageNum.getAttribute('data-page'));
        if (pageNumber === currentPage) {
            pageNum.classList.add('active');
        } else {
            pageNum.classList.remove('active');
        }
    });
}

// Update active patient count
function updateActivePatientCount() {
    const count = patientsData.length;
    document.getElementById('activePatientCount').textContent = count;
}

// Populate patient dropdowns in modals
function populatePatientDropdowns() {
    const diagnosisSelect = document.getElementById('diagnosisPatient');
    const prescriptionSelect = document.getElementById('prescriptionPatient');
    
    console.log('Populating dropdowns with', patientsData.length, 'patients');
    console.log('patientsData:', patientsData);
    
    if (!diagnosisSelect || !prescriptionSelect) {
        console.error('Patient select elements not found in HTML');
        return;
    }
    
    // Clear existing options except the first one
    while (diagnosisSelect.options.length > 1) {
        diagnosisSelect.remove(1);
    }
    while (prescriptionSelect.options.length > 1) {
        prescriptionSelect.remove(1);
    }
    
    if (patientsData.length === 0) {
        console.warn('No patients available to populate dropdowns - attempting to reload from database');
        // Try to reload if empty
        loadPatientsFromDatabase().then(() => {
            console.log('Reload complete, patientsData now has', patientsData.length, 'patients');
            // Recursively call to populate after reload
            if (patientsData.length > 0) {
                populatePatientDropdowns();
            }
        });
        return;
    }
    
    patientsData.forEach(patient => {
        const option1 = document.createElement('option');
        option1.value = patient.id;
        option1.textContent = patient.name;
        diagnosisSelect.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = patient.id;
        option2.textContent = patient.name;
        prescriptionSelect.appendChild(option2);
    });
    
    console.log('Successfully populated dropdowns for', patientsData.length, 'patients');
}

// Set today's date in form inputs
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('diagnosisDate').value = today;
    document.getElementById('prescriptionDate').value = today;
}

// Setup event listeners
function setupEventListeners() {
    // Pagination buttons
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            loadPatientChart(currentPage - 1);
        }
    });
    
    document.getElementById('nextPage').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
        if (currentPage < totalPages) {
            loadPatientChart(currentPage + 1);
        }
    });
    
    // Page number clicks
    document.querySelectorAll('.page-number').forEach(pageNum => {
        pageNum.addEventListener('click', function() {
            const page = parseInt(this.getAttribute('data-page'));
            loadPatientChart(page);
        });
    });
    
    // Header search
    document.getElementById('headerSearch').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm === '') {
            filteredPatients = [...patientsData];
        } else {
            filteredPatients = patientsData.filter(patient => {
                return patient.name.toLowerCase().includes(searchTerm) ||
                       (patient.diagnosis || "").toLowerCase().includes(searchTerm) ||
                       patient.age.toString().includes(searchTerm);
            });
        }
        
        currentPage = 1;
        loadPatientChart(1);
    });
    
    // Notification bell
    document.getElementById('notificationBell').addEventListener('click', function() {
        alert('You have 3 new notifications:\n\n1. Medication reminder for Carlos Alberto\n2. New patient admission - Room 109\n3. Lab results ready for Lourdes Ramos');
        
        // Clear notification badge
        const badge = document.getElementById('notificationBadge');
        badge.style.display = 'none';
    });
    
    // Modal event listeners - Repopulate dropdowns when modals open
    const diagnosisModal = document.getElementById('diagnosisModal');
    const prescriptionModal = document.getElementById('prescriptionModal');
    
    if (diagnosisModal) {
        diagnosisModal.addEventListener('show.bs.modal', function() {
            console.log('Diagnosis modal opened - refreshing patient dropdown');
            populatePatientDropdowns();
        });
    }
    
    if (prescriptionModal) {
        prescriptionModal.addEventListener('show.bs.modal', function() {
            console.log('Prescription modal opened - refreshing patient dropdown');
            populatePatientDropdowns();
        });
    }
}

// View patient details - Redirect to patient file page
function viewPatientDetails(patientId) {
    const patient = patientsData.find(p => p.id === patientId);
    
    if (!patient) {
        alert('Patient not found');
        return;
    }
    
    // Store patient data in localStorage to access on the patient file page
    try {
        localStorage.setItem('selectedPatient', JSON.stringify(patient));
    } catch (e) {
        // Handle tracking prevention or storage quota errors silently
        console.warn('Could not save to localStorage:', e.message);
    }
    
    // Redirect to patient file page
    window.location.href = 'doctorpatientfile.html?id=' + patientId;
}

// Save diagnosis
async function saveDiagnosis() {
    const patientId = document.getElementById('diagnosisPatient').value;
    const diagnosisText = document.getElementById('diagnosisText').value.trim();
    const diagnosisDate = document.getElementById('diagnosisDate').value;
    const diagnosisNotes = document.getElementById('diagnosisNotes').value.trim();
    
    if (!patientId || !diagnosisText || !diagnosisDate) {
        showDoctorDashboardFeedback('Please fill in the patient, diagnosis, and date fields.', 'Missing Information', 'warning');
        return;
    }

    const shouldSave = await showDoctorDashboardConfirm(
        'Are you sure you want to save this diagnosis information?',
        'Save Diagnosis',
        'primary',
        'Save Diagnosis'
    );

    if (!shouldSave) {
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('patient_id', patientId);
        formData.append('diagnosis', diagnosisText);
        formData.append('observations', diagnosisNotes);
        formData.append('notes', diagnosisNotes);
        formData.append('date', diagnosisDate);
        
        const response = await fetch('../php/save_diagnosis.php', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            const patient = patientsData.find(p => p.id == patientId);
            showDoctorDashboardFeedback(`Diagnosis saved successfully for ${patient ? patient.name : 'patient'}!`, 'Saved', 'success');
            
            // Update patient diagnosis in local data
            if (patient) {
                patient.diagnosis = diagnosisText;
            }
            
            // Reload patient chart
            loadPatientChart(currentPage);
            
            // Reset form
            document.getElementById('diagnosisForm').reset();
            setTodayDate();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('diagnosisModal'));
            if (modal) {
                modal.hide();
            }
        } else {
            showDoctorDashboardFeedback(data.message || 'Unable to save diagnosis information.', 'Save Failed', 'danger');
        }
    } catch (error) {
        console.error('Error saving diagnosis:', error);
        showDoctorDashboardFeedback(error.message || 'Unable to save diagnosis information.', 'Save Failed', 'danger');
    }
}

// Save prescription
async function savePrescription() {
    const patientId = document.getElementById('prescriptionPatient').value;
    const prescriptionDate = document.getElementById('prescriptionDate').value;
    const medicationName = document.getElementById('medicationName').value.trim();
    const medicationDosage = document.getElementById('medicationDosage').value.trim();
    const medicationFrequency = document.getElementById('medicationFrequency').value.trim();
    const medicationDuration = document.getElementById('medicationDuration').value.trim();
    const medicationInstructions = document.getElementById('medicationInstructions').value.trim();
    
    if (!patientId || !prescriptionDate || !medicationName || !medicationDosage || !medicationFrequency) {
        showDoctorDashboardFeedback('Please fill in the patient, date, medication, dosage, and frequency fields.', 'Missing Information', 'warning');
        return;
    }

    const shouldSave = await showDoctorDashboardConfirm(
        'Are you sure you want to save this prescription information?',
        'Save Prescription',
        'primary',
        'Save Prescription'
    );

    if (!shouldSave) {
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('patient_id', patientId);
        formData.append('medicine', medicationName);
        formData.append('dosage', medicationDosage);
        formData.append('frequency', medicationFrequency);
        formData.append('duration', medicationDuration);
        formData.append('instructions', medicationInstructions);
        formData.append('date', prescriptionDate);
        
        const response = await fetch('../php/save_prescription.php', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            const patient = patientsData.find(p => p.id == patientId);
            showDoctorDashboardFeedback(`Prescription saved successfully for ${patient ? patient.name : 'patient'}!`, 'Saved', 'success');
            
            // Reload medication activity
            await loadMedicationActivityFromDatabase();
            loadMedicationActivity();
            
            // Reset form
            document.getElementById('prescriptionForm').reset();
            setTodayDate();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('prescriptionModal'));
            if (modal) {
                modal.hide();
            }
        } else {
            showDoctorDashboardFeedback(data.message || 'Unable to save prescription information.', 'Save Failed', 'danger');
        }
    } catch (error) {
        console.error('Error saving prescription:', error);
        showDoctorDashboardFeedback(error.message || 'Unable to save prescription information.', 'Save Failed', 'danger');
    }
}

// Load user information from server
async function loadUserInfo() {
    try {
        const response = await fetch('../php/get_user.php');
        const data = await response.json();
        
        if (data.success && data.user) {
            const user = data.user;
            const firstName = user.firstname;
            const lastName = user.lastname;
            
            // Update welcome title with user's first name
            const welcomeTitle = document.querySelector('.welcome-title');
            if (welcomeTitle) {
                welcomeTitle.textContent = `Welcome back - Dr. ${firstName}!`;
            }
            
            // Update header name with full name
            const headerName = document.getElementById('headerName');
            if (headerName) {
                headerName.innerHTML = `<strong>Dr. ${firstName} ${lastName}</strong>`;
            }
        }
    } catch (error) {
        console.error('Error loading user information:', error);
    }
}
// Sidebar navigation active state
document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        if (this.getAttribute('href') === '#') {
            e.preventDefault();
        }
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.classList.remove('active');
        });
        this.closest('.nav-item').classList.add('active');
    });
});
