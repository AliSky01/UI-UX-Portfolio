// Patient data - will be loaded from database
let patientsData = [];
let patientPrescriptionsById = new Map();

// Medication activity data - will be loaded from database
let medicationActivities = [];
// Pagination variables
let currentPage = 1;
const itemsPerPage = 5;
let filteredPatients = [];
let nurseDashboardConfirmResolver = null;
let nurseDashboardConfirmModalInstance = null;
let nurseDashboardFeedbackModalInstance = null;

function getNurseDashboardModalConfig(variant) {
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

function getNurseDashboardConfirmModal() {
    const modalElement = document.getElementById('nurseDashboardConfirmModal');
    if (!modalElement) {
        return null;
    }

    if (!nurseDashboardConfirmModalInstance) {
        nurseDashboardConfirmModalInstance = bootstrap.Modal.getOrCreateInstance(modalElement, {
            backdrop: 'static',
            keyboard: false
        });

        modalElement.addEventListener('hidden.bs.modal', () => {
            if (typeof nurseDashboardConfirmResolver === 'function') {
                const resolve = nurseDashboardConfirmResolver;
                nurseDashboardConfirmResolver = null;
                resolve(false);
            }
        });
    }

    return nurseDashboardConfirmModalInstance;
}

function getNurseDashboardFeedbackModal() {
    const modalElement = document.getElementById('nurseDashboardFeedbackModal');
    if (!modalElement) {
        return null;
    }

    if (!nurseDashboardFeedbackModalInstance) {
        nurseDashboardFeedbackModalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
    }

    return nurseDashboardFeedbackModalInstance;
}

function showNurseDashboardFeedback(message, title = 'Notice', variant = 'success') {
    const modal = getNurseDashboardFeedbackModal();
    if (!modal) {
        return;
    }

    const config = getNurseDashboardModalConfig(variant);
    const badge = document.getElementById('nurseDashboardFeedbackBadge');
    const button = document.getElementById('nurseDashboardFeedbackButton');

    document.getElementById('nurseDashboardFeedbackTitle').textContent = title;
    document.getElementById('nurseDashboardFeedbackMessage').textContent = message;

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

function showNurseDashboardConfirm(message, title = 'Confirm Save', variant = 'primary', confirmLabel = 'Save') {
    const modal = getNurseDashboardConfirmModal();
    if (!modal) {
        return Promise.resolve(false);
    }

    if (typeof nurseDashboardConfirmResolver === 'function') {
        nurseDashboardConfirmResolver(false);
        nurseDashboardConfirmResolver = null;
    }

    const config = getNurseDashboardModalConfig(variant);
    const badge = document.getElementById('nurseDashboardConfirmBadge');
    const confirmButton = document.getElementById('nurseDashboardConfirmButton');

    document.getElementById('nurseDashboardConfirmTitle').textContent = title;
    document.getElementById('nurseDashboardConfirmMessage').textContent = message;

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
        nurseDashboardConfirmResolver = resolve;
    });
}

function resolveNurseDashboardConfirm(result) {
    const modal = getNurseDashboardConfirmModal();
    if (modal) {
        modal.hide();
    }

    if (typeof nurseDashboardConfirmResolver === 'function') {
        const resolve = nurseDashboardConfirmResolver;
        nurseDashboardConfirmResolver = null;
        resolve(result);
    }
}

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    setupEventListeners();
});

// Initialize dashboard
async function initializeDashboard() {
    try {
        await loadUserInfo();

        // Load patients from database
        await loadPatientsFromDatabase();
        
        // Load medication activity from database
        await loadMedicationActivityFromDatabase();
        
        filteredPatients = [...patientsData];
        loadMedicationActivity();
        loadPatientChart();
        updateActivePatientCount();
        populatePatientDropdowns();
        setTodayDate();
        setCurrentTime();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
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

            const welcomeTitle = document.querySelector('.welcome-title');
            if (welcomeTitle) {
                welcomeTitle.textContent = `Welcome back, Nurse ${firstName}!`;
            }

            const headerName = document.getElementById('headerName');
            if (headerName) {
                headerName.innerHTML = `<strong>${firstName} ${lastName}</strong>`;
            }
        }
    } catch (error) {
        console.error('Error loading user information:', error);
    }
}

// Load patients from database
async function loadPatientsFromDatabase() {
    try {
        const response = await fetch('../php/get_doctor_patients.php?status=admitted');
        const data = await response.json();
        
        if (data.success && data.patients && data.patients.length > 0) {
            patientsData = data.patients;
        } else {
            patientsData = [];
        }
    } catch (error) {
        console.error('Error fetching patients:', error);
        patientsData = [];
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
    
    // Show all medications (scrollable)
    activityToShow.forEach(activity => {
        const medicationItem = document.createElement('div');
        medicationItem.className = 'medication-item';
        const medicationDisplay = activity.dosage ? `${activity.medication} ${activity.dosage}` : activity.medication;
        medicationItem.innerHTML = `
            <div class="medication-bullet"></div>
            <div class="medication-details">
                <p class="medication-patient"><strong>${activity.patient}</strong></p>
                <p class="medication-drug">${medicationDisplay}</p>
            </div>
            <div class="medication-info">
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

function buildPrescriptionOptionLabel(prescription) {
    const medicine = prescription.Medicine || 'Unnamed medicine';
    const dosage = prescription.Dosage || '';
    const frequency = prescription.Frequency || '';
    const duration = prescription.Duration || '';
    const medicineLabel = [medicine, dosage].filter(Boolean).join(' ');
    const detailsLabel = [frequency, duration].filter(Boolean).join(' • ');

    return detailsLabel ? `${medicineLabel} (${detailsLabel})` : medicineLabel;
}

function populateMedicalIntakePrescriptionOptions(prescriptions, emptyLabel = 'No prescribed medicines available') {
    const prescriptionSelect = document.getElementById('medicalIntakePrescription');
    if (!prescriptionSelect) {
        return;
    }

    prescriptionSelect.innerHTML = '';

    if (!Array.isArray(prescriptions) || prescriptions.length === 0) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = emptyLabel;
        prescriptionSelect.appendChild(emptyOption);
        prescriptionSelect.disabled = true;
        return;
    }

    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Select prescribed medicine';
    prescriptionSelect.appendChild(placeholderOption);

    prescriptions.forEach((prescription, index) => {
        const option = document.createElement('option');
        option.value = String(prescription.Prescription_ID || index + 1);
        option.textContent = buildPrescriptionOptionLabel(prescription);
        option.dataset.medicine = prescription.Medicine || '';
        option.dataset.dosage = prescription.Dosage || '';
        option.dataset.frequency = prescription.Frequency || '';
        option.dataset.duration = prescription.Duration || '';
        prescriptionSelect.appendChild(option);
    });

    prescriptionSelect.disabled = false;
}

async function fetchPatientPrescriptionsForIntake(patientId) {
    const normalizedId = String(patientId || '');
    if (!normalizedId) {
        populateMedicalIntakePrescriptionOptions([], 'Select a patient first');
        return [];
    }

    if (patientPrescriptionsById.has(normalizedId)) {
        const cachedPrescriptions = patientPrescriptionsById.get(normalizedId);
        populateMedicalIntakePrescriptionOptions(cachedPrescriptions);
        return cachedPrescriptions;
    }

    try {
        const response = await fetch(`../php/get_patient_prescriptions.php?patient_id=${encodeURIComponent(normalizedId)}&source=nurse&_=${Date.now()}`, {
            cache: 'no-store'
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to load prescribed medicines');
        }

        const prescriptions = Array.isArray(data.prescriptions) ? data.prescriptions : [];
        patientPrescriptionsById.set(normalizedId, prescriptions);
        populateMedicalIntakePrescriptionOptions(prescriptions);
        return prescriptions;
    } catch (error) {
        console.error('Error loading prescribed medicines:', error);
        populateMedicalIntakePrescriptionOptions([], 'Unable to load prescribed medicines');
        return [];
    }
}

// Populate patient dropdowns in modals
function populatePatientDropdowns() {
    const medicalIntakeSelect = document.getElementById('medicalIntakePatient');
    if (!medicalIntakeSelect) {
        return;
    }

    medicalIntakeSelect.innerHTML = '<option value="">Select Patient</option>';
    
    patientsData.forEach(patient => {
        const option = document.createElement('option');
        option.value = patient.id;
        option.textContent = patient.name;
        medicalIntakeSelect.appendChild(option);
    });
}

// Set today's date in form inputs
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    const medicalIntakeDate = document.getElementById('medicalIntakeDate');
    if (medicalIntakeDate) {
        medicalIntakeDate.value = today;
    }
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

    const medicalIntakePatient = document.getElementById('medicalIntakePatient');
    if (medicalIntakePatient) {
        medicalIntakePatient.addEventListener('change', function() {
            fetchPatientPrescriptionsForIntake(this.value);
        });
    }

    const medicalIntakeModal = document.getElementById('medicalIntakeModal');
    if (medicalIntakeModal) {
        medicalIntakeModal.addEventListener('show.bs.modal', function() {
            const patientId = document.getElementById('medicalIntakePatient')?.value || '';
            fetchPatientPrescriptionsForIntake(patientId);
        });
    }
    
    // Notification bell
    const notificationWrapper = document.querySelector('.notification-wrapper');
    const notificationBell = document.getElementById('notificationBell');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationBadge = document.getElementById('notificationBadge');
    
    // Initialize notifications
    if (notificationDropdown) {
        loadNotifications();
        
        // Toggle notification dropdown when clicking on the wrapper
        if (notificationWrapper) {
            notificationWrapper.addEventListener('click', function(e) {
                e.stopPropagation();
                notificationDropdown.classList.toggle('show');
            });
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (notificationWrapper && !notificationWrapper.contains(e.target) && !notificationDropdown.contains(e.target)) {
                notificationDropdown.classList.remove('show');
            }
        });
        
        // Clear all notifications
        const clearAllBtn = document.getElementById('clearAllNotifications');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                notifications = [];
                loadNotifications();
                updateNotificationBadge();
            });
        }
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
    window.location.href = 'nursepatientfile.html?id=' + patientId;
}

// Notifications data
let notifications = [
    {
        id: 1,
        type: 'medication',
        message: 'Medication reminder for Carlos Alberto',
        time: '2 hours ago',
        read: false
    },
    {
        id: 2,
        type: 'admission',
        message: 'New patient admission - Room 109',
        time: '4 hours ago',
        read: false
    },
    {
        id: 3,
        type: 'lab',
        message: 'Lab results ready for Lourdes Ramos',
        time: '6 hours ago',
        read: false
    }
];

// Load and display notifications
function loadNotifications() {
    const notificationList = document.getElementById('notificationList');
    notificationList.innerHTML = '';
    
    if (notifications.length === 0) {
        notificationList.innerHTML = '<div class="notification-empty">No notifications</div>';
        return;
    }
    
    notifications.forEach(notification => {
        const notificationItem = document.createElement('div');
        notificationItem.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
        notificationItem.innerHTML = `
            <div class="notification-content">
                <p class="notification-message">${notification.message}</p>
                <span class="notification-time">${notification.time}</span>
            </div>
            <button class="btn-notification-close" onclick="removeNotification(${notification.id})">
                <i class="bi bi-x"></i>
            </button>
        `;
        
        notificationItem.addEventListener('click', function(e) {
            if (!e.target.closest('.btn-notification-close')) {
                markNotificationAsRead(notification.id);
            }
        });
        
        notificationList.appendChild(notificationItem);
    });
    
    updateNotificationBadge();
}

// Update notification badge count
function updateNotificationBadge() {
    const unreadCount = notifications.filter(n => !n.read).length;
    const badge = document.getElementById('notificationBadge');
    
    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

// Mark notification as read
function markNotificationAsRead(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
        notification.read = true;
        loadNotifications();
    }
}

// Remove notification (global function for onclick)
window.removeNotification = function(notificationId) {
    notifications = notifications.filter(n => n.id !== notificationId);
    loadNotifications();
};

// Save medical intake
function saveMedicalIntake() {
    const patientId = document.getElementById('medicalIntakePatient').value;
    const medicalIntakeDate = document.getElementById('medicalIntakeDate').value;
    const medicalIntakeTime = document.getElementById('medicalIntakeTime').value;
    const prescriptionSelect = document.getElementById('medicalIntakePrescription');
    const selectedOption = prescriptionSelect ? prescriptionSelect.options[prescriptionSelect.selectedIndex] : null;
    const medicalIntakeMedicine = selectedOption?.dataset.medicine || '';
    const dosage = selectedOption?.dataset.dosage || '';
    const frequency = selectedOption?.dataset.frequency || '';
    const duration = selectedOption?.dataset.duration || '';
    const selectedPrescriptionLabel = selectedOption?.textContent || medicalIntakeMedicine;

    if (!patientId || !medicalIntakeDate || !medicalIntakeTime || !medicalIntakeMedicine) {
        showNurseDashboardFeedback('Please fill in the patient name, date, time, and prescribed medicine fields.', 'Missing Information', 'warning');
        return;
    }
    
    const patient = patientsData.find(p => p.id == patientId);
    if (!patient) {
        showNurseDashboardFeedback('Patient not found.', 'Save Failed', 'danger');
        return;
    }

    showNurseDashboardConfirm(
        'Are you sure you want to save this medical intake information?',
        'Save Medical Intake',
        'primary',
        'Save Intake'
    ).then(shouldSave => {
        if (!shouldSave) {
            return;
        }

        const dateAdministered = `${medicalIntakeDate} ${medicalIntakeTime.length === 5 ? `${medicalIntakeTime}:00` : medicalIntakeTime}`;

        const formData = new FormData();
        formData.append('patient_id', patientId);
        formData.append('medicine', medicalIntakeMedicine);
        formData.append('dosage', dosage);
        formData.append('frequency', frequency);
        formData.append('duration', duration);
        formData.append('date', medicalIntakeDate);
        formData.append('time', medicalIntakeTime);
        formData.append('date_administered', dateAdministered);

        fetch('../php/save_medication_intake.php', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.message || 'Failed to save medical intake');
                }

                const dateObj = new Date(medicalIntakeDate);
                const formattedDate = dateObj.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });

                const timeObj = new Date('2000-01-01T' + medicalIntakeTime);
                const formattedTime = timeObj.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });

                showNurseDashboardFeedback(
                    `Medical intake saved successfully for ${patient.name}. Date: ${formattedDate}. Time: ${formattedTime}. Medicine: ${selectedPrescriptionLabel}`,
                    'Saved',
                    'success'
                );

                document.getElementById('medicalIntakeForm').reset();
                populateMedicalIntakePrescriptionOptions(patientPrescriptionsById.get(String(patientId)) || []);
                setTodayDate();
                setCurrentTime();

                const modal = bootstrap.Modal.getInstance(document.getElementById('medicalIntakeModal'));
                if (modal) {
                    modal.hide();
                }
            })
            .catch(error => {
                console.error('Error saving medical intake:', error);
                showNurseDashboardFeedback(error.message || 'Unable to save medical intake information.', 'Save Failed', 'danger');
            });
        });
}

// Set current time in form input
function setCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;
    const medicalIntakeTime = document.getElementById('medicalIntakeTime');
    if (medicalIntakeTime) {
        medicalIntakeTime.value = currentTime;
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
