// Load patients from database
let patientsFromDB = [];
let editingPrescriptionId = null;
let currentPatientPrescriptions = [];
let currentMedicationIntakeEntries = [];
let selectedMedicationDateKey = null;
let medicationCalendarMonth = null;
let medicationCalendarYear = null;

const medicationCalendarMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDisplayDate(dateValue) {
    if (!dateValue) {
        return 'Not recorded';
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return String(dateValue);
    }

    return parsedDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatDisplayTime(dateValue) {
    if (!dateValue) {
        return 'Not recorded';
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return 'Not recorded';
    }

    return parsedDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).replace('12:00 PM', '12:00 NN');
}

function formatPersonalInfoValue(value, fallback = 'Not specified') {
    if (value === null || value === undefined) {
        return fallback;
    }

    const normalizedValue = String(value).trim();
    if (!normalizedValue || normalizedValue.toUpperCase() === 'N/A') {
        return fallback;
    }

    return normalizedValue;
}

function getPatientById(patientId) {
    const normalizedId = String(patientId || '');
    return patientsFromDB.find(patient => String(patient.id) === normalizedId) || null;
}

async function loadPatientsFromDatabase() {
    try {
        const response = await fetch('../php/get_doctor_patients.php?status=admitted');
        const data = await response.json();
        
        console.log('Loaded patients from DB:', data);
        
        if (data.success && data.patients && data.patients.length > 0) {
            patientsFromDB = data.patients;
            populatePatientList();
            
            // Select the first patient by default
            if (patientsFromDB.length > 0) {
                selectPatientById(patientsFromDB[0].id);
            }
        } else {
            patientsFromDB = [];
            populatePatientList();
            console.warn('No patients found in database');
        }
    } catch (error) {
        console.error('Error loading patients from database:', error);
        patientsFromDB = [];
        populatePatientList();
    }
}

// Populate the patient list UI with database patients
function populatePatientList() {
    const patientList = document.getElementById('patientList');
    if (!patientList) {
        console.error('Patient list element not found');
        return;
    }
    
    patientList.innerHTML = '';
    
    patientsFromDB.forEach((patient, index) => {
        const li = document.createElement('li');
        li.className = 'patient-list-item' + (index === 0 ? ' active' : '');
        li.setAttribute('data-patient-id', patient.id);
        li.setAttribute('data-patient-name', patient.name);
        
        li.innerHTML = `
            <input type="radio" name="patientRadio" class="patient-radio" ${index === 0 ? 'checked' : ''}>
            <span class="patient-item-name">${patient.name}</span>
        `;
        
        // Add click event for list item
        li.addEventListener('click', function(e) {
            document.querySelectorAll('.patient-list-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            const radio = this.querySelector('.patient-radio');
            if (radio) radio.checked = true;
            
            updatePatientDetails(this.getAttribute('data-patient-id'));
        });
        
        // Add click event for radio button
        const radio = li.querySelector('.patient-radio');
        if (radio) {
            radio.addEventListener('click', function(e) {
                e.stopPropagation();
                const listItem = this.closest('.patient-list-item');
                if (listItem) {
                    document.querySelectorAll('.patient-list-item').forEach(i => i.classList.remove('active'));
                    listItem.classList.add('active');
                    updatePatientDetails(listItem.getAttribute('data-patient-id'));
                }
            });
        }
        
        patientList.appendChild(li);
    });
    
    console.log(`Populated patient list with ${patientsFromDB.length} patients`);
}

// Select patient by database ID
function selectPatientById(patientId) {
    const normalizedId = String(patientId || '');
    const listItems = document.querySelectorAll('.patient-list-item');
    listItems.forEach(item => {
        if (item.getAttribute('data-patient-id') === normalizedId) {
            item.classList.add('active');
            const radio = item.querySelector('.patient-radio');
            if (radio) radio.checked = true;
            updatePatientDetails(normalizedId);
        } else {
            item.classList.remove('active');
            const radio = item.querySelector('.patient-radio');
            if (radio) radio.checked = false;
        }
    });
}

// Fetch and display patient diagnoses from database
async function fetchPatientDiagnoses(patientId, container) {
    try {
        const response = await fetch(`../php/get_patient_diagnoses.php?patient_id=${patientId}`);
        const data = await response.json();
        const diagnosisSummary = document.querySelector('.patient-diagnosis');
        
        console.log('Diagnoses response:', data);
        
        if (data.success && data.diagnoses && data.diagnoses.length > 0) {
            const diagnosisTitles = Array.from(new Set(
                data.diagnoses
                    .map(diag => String(diag.diagnosis || '').trim())
                    .filter(Boolean)
            ));

            if (diagnosisSummary) {
                diagnosisSummary.textContent = diagnosisTitles.length
                    ? diagnosisTitles.join(', ')
                    : 'Diagnosis recorded';
            }

            // Display all diagnosis cards
            container.innerHTML = data.diagnoses.map(diag => `
                <div class="col-md-6">
                    <div class="diagnosis-card">
                        <div class="diagnosis-date">${diag.date}</div>
                        <h6 class="diagnosis-title">${diag.diagnosis}</h6>
                        <p class="diagnosis-doctor">Dr. ${diag.doctor}</p>
                        ${diag.notes ? `<p class="diagnosis-notes">${diag.notes}</p>` : ''}
                    </div>
                </div>
            `).join('');
        } else {
            if (diagnosisSummary) {
                diagnosisSummary.textContent = 'No diagnosis recorded';
            }

            // No diagnoses found - show empty state
            container.innerHTML = '<p style="padding: 20px; color: #999;">No diagnoses recorded yet. Click "Add new" to add a diagnosis.</p>';
        }
    } catch (error) {
        console.error('Error fetching diagnoses:', error);
        const diagnosisSummary = document.querySelector('.patient-diagnosis');
        if (diagnosisSummary) {
            diagnosisSummary.textContent = 'No diagnosis recorded';
        }
        container.innerHTML = '<p style="padding: 20px; color: #c00;">Error loading diagnoses.</p>';
    }
}

// Fetch and display patient prescriptions from database
async function fetchPatientPrescriptions(patientId) {
    const prescriptionList = document.getElementById('prescriptionList');
    if (!prescriptionList) {
        return;
    }

    try {
        const response = await fetch(`../php/get_patient_prescriptions.php?patient_id=${patientId}&_=${Date.now()}`, {
            cache: 'no-store'
        });
        const data = await response.json();

        console.log('Prescriptions response:', data);

        if (data.success && data.prescriptions && data.prescriptions.length > 0) {
            currentPatientPrescriptions = Array.isArray(data.prescriptions) ? data.prescriptions : [];
            renderPrescriptionCards(currentPatientPrescriptions);
        } else {
            currentPatientPrescriptions = [];
            renderPrescriptionCards([]);
        }
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        currentPatientPrescriptions = [];
        const prescriptionList = document.getElementById('prescriptionList');
        if (prescriptionList) {
            prescriptionList.innerHTML = '<p style="padding: 20px; color: #c00;">Error loading prescriptions.</p>';
        }
    }
}

function renderPrescriptionCards(prescriptions) {
    const prescriptionList = document.getElementById('prescriptionList');
    if (!prescriptionList) {
        return;
    }

    const statusSelect = document.querySelector('.prescription-status-select');
    const badgeLabel = statusSelect ? statusSelect.value : 'Active';
    const badgeClass = badgeLabel.toLowerCase() === 'discontinued' ? 'inactive' : 'active';

    if (!Array.isArray(prescriptions) || prescriptions.length === 0) {
        prescriptionList.innerHTML = '<p style="padding: 20px; color: #999;">No prescriptions recorded for this patient.</p>';
        return;
    }

    prescriptionList.innerHTML = prescriptions.map(prescription => `
        <div class="prescription-card">
            <div class="prescription-header">
                <div class="prescription-name">${escapeHtml(prescription.Medicine || 'Unnamed prescription')}</div>
                <span class="pill-status ${badgeClass}">${escapeHtml(badgeLabel)}</span>
            </div>
            <div class="prescription-grid">
                <div>
                    <div class="prescription-label">Dosage & frequency</div>
                    <div class="prescription-value">${escapeHtml((prescription.Dosage || 'N/A') + ' - ' + (prescription.Frequency || 'N/A'))}</div>
                </div>
                <div>
                    <div class="prescription-label">Start date & duration</div>
                    <div class="prescription-value">${escapeHtml(formatDisplayDate(prescription.Date || ''))}${prescription.Duration ? ` - ${escapeHtml(prescription.Duration)}` : ''}</div>
                </div>
                <div>
                    <div class="prescription-label">Prescribing doctor</div>
                    <div class="prescription-value">${escapeHtml(prescription.PrescribedByName || 'Doctor on record')}</div>
                </div>
            </div>
        </div>
    `).join('');
}

function handlePrescriptionStatusChange() {
    renderPrescriptionCards(currentPatientPrescriptions);
}

function getPrescriptionSubmitButton() {
    return document.querySelector('#addPrescriptionModal .btn-primary');
}

function resetPrescriptionModal() {
    editingPrescriptionId = null;

    const prescriptionForm = document.getElementById('prescriptionForm');
    if (prescriptionForm) {
        prescriptionForm.reset();
    }

    const prescriptionDateInput = document.getElementById('prescriptionDate');
    if (prescriptionDateInput) {
        prescriptionDateInput.value = new Date().toISOString().split('T')[0];
    }

    const submitButton = getPrescriptionSubmitButton();
    if (submitButton) {
        submitButton.textContent = 'Add Prescription';
    }

    const modalTitle = document.querySelector('#addPrescriptionModal .modal-title');
    if (modalTitle) {
        modalTitle.textContent = 'Add Prescription';
    }
}

function setPrescriptionModalForEdit(row) {
    const cells = row.querySelectorAll('td');

    editingPrescriptionId = row.getAttribute('data-prescription-id');
    document.getElementById('prescriptionMedicine').value = cells[0].textContent.trim();
    document.getElementById('prescriptionDosage').value = cells[1].textContent.trim();
    document.getElementById('prescriptionFrequency').value = cells[2].textContent.trim();
    document.getElementById('prescriptionDuration').value = cells[4].textContent.trim();
    document.getElementById('prescriptionDate').value = row.getAttribute('data-prescription-date') || new Date().toISOString().split('T')[0];

    const submitButton = getPrescriptionSubmitButton();
    if (submitButton) {
        submitButton.textContent = 'Update Prescription';
    }

    const modalTitle = document.querySelector('#addPrescriptionModal .modal-title');
    if (modalTitle) {
        modalTitle.textContent = 'Edit Prescription';
    }
}

let doctorSaveConfirmResolver = null;
let doctorSaveConfirmModalInstance = null;
let doctorSaveFeedbackModalInstance = null;

function getDoctorSaveModalConfig(variant) {
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

function getDoctorSaveConfirmModal() {
    const modalElement = document.getElementById('doctorSaveConfirmModal');
    if (!modalElement) {
        return null;
    }

    if (!doctorSaveConfirmModalInstance) {
        doctorSaveConfirmModalInstance = bootstrap.Modal.getOrCreateInstance(modalElement, {
            backdrop: 'static',
            keyboard: false
        });

        modalElement.addEventListener('hidden.bs.modal', () => {
            if (typeof doctorSaveConfirmResolver === 'function') {
                const resolve = doctorSaveConfirmResolver;
                doctorSaveConfirmResolver = null;
                resolve(false);
            }
        });
    }

    return doctorSaveConfirmModalInstance;
}

function getDoctorSaveFeedbackModal() {
    const modalElement = document.getElementById('doctorSaveFeedbackModal');
    if (!modalElement) {
        return null;
    }

    if (!doctorSaveFeedbackModalInstance) {
        doctorSaveFeedbackModalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
    }

    return doctorSaveFeedbackModalInstance;
}

function showDoctorSaveFeedback(message, title = 'Notice', variant = 'success') {
    const modal = getDoctorSaveFeedbackModal();
    if (!modal) {
        return;
    }

    const config = getDoctorSaveModalConfig(variant);
    const badge = document.getElementById('doctorSaveFeedbackBadge');
    const button = document.getElementById('doctorSaveFeedbackButton');

    document.getElementById('doctorSaveFeedbackTitle').textContent = title;
    document.getElementById('doctorSaveFeedbackMessage').textContent = message;

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

function showDoctorSaveConfirm(message, title = 'Confirm Save', variant = 'primary', confirmLabel = 'Save') {
    const modal = getDoctorSaveConfirmModal();
    if (!modal) {
        return Promise.resolve(false);
    }

    if (typeof doctorSaveConfirmResolver === 'function') {
        doctorSaveConfirmResolver(false);
        doctorSaveConfirmResolver = null;
    }

    const config = getDoctorSaveModalConfig(variant);
    const badge = document.getElementById('doctorSaveConfirmBadge');
    const confirmButton = document.getElementById('doctorSaveConfirmButton');

    document.getElementById('doctorSaveConfirmTitle').textContent = title;
    document.getElementById('doctorSaveConfirmMessage').textContent = message;

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
        doctorSaveConfirmResolver = resolve;
    });
}

function resolveDoctorSaveConfirm(result) {
    const modal = getDoctorSaveConfirmModal();
    if (modal) {
        modal.hide();
    }

    if (typeof doctorSaveConfirmResolver === 'function') {
        const resolve = doctorSaveConfirmResolver;
        doctorSaveConfirmResolver = null;
        resolve(result);
    }
}

// Load user information from server
async function loadUserInfo() {
    try {
        const response = await fetch('../php/get_user.php');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.user) {
            const user = data.user;
            const firstName = user.firstname || '';
            const lastName = user.lastname || '';
            
            // Update header name with full name
            const headerName = document.getElementById('patientFileHeaderName');
            if (headerName && firstName && lastName) {
                headerName.innerHTML = `<strong>Dr. ${firstName} ${lastName}</strong>`;
            }
        } else {
            console.warn('User data not found in response:', data);
            // Show a default message if no user data
            const headerName = document.getElementById('patientFileHeaderName');
            if (headerName) {
                headerName.innerHTML = '<strong>Doctor</strong>';
            }
        }
    } catch (error) {
        console.error('Error loading user information:', error);
        // Show a default message on error
        const headerName = document.getElementById('patientFileHeaderName');
        if (headerName) {
            headerName.innerHTML = '<strong>Doctor</strong>';
        }
    }
}

function renderPatientVitals(vitals) {
    const vitalBP = document.getElementById('vitalBP');
    const vitalPulse = document.getElementById('vitalPulse');
    const vitalTemp = document.getElementById('vitalTemp');
    const vitalWeight = document.getElementById('vitalWeight');
    const vitalHeight = document.getElementById('vitalHeight');
    const vitalRespiratory = document.getElementById('vitalRespiratory');
    const vitalO2 = document.getElementById('vitalO2');
    const vitalLastUpdated = document.getElementById('vitalLastUpdated');

    if (!vitals) {
        if (vitalBP) vitalBP.textContent = 'Not recorded';
        if (vitalPulse) vitalPulse.textContent = 'Not recorded';
        if (vitalTemp) vitalTemp.textContent = 'Not recorded';
        if (vitalWeight) vitalWeight.textContent = 'Not recorded';
        if (vitalHeight) vitalHeight.textContent = 'Not recorded';
        if (vitalRespiratory) vitalRespiratory.textContent = 'Not recorded';
        if (vitalO2) vitalO2.textContent = 'Not recorded';
        if (vitalLastUpdated) vitalLastUpdated.textContent = 'Not recorded';
        return;
    }

    if (vitalBP) vitalBP.textContent = vitals.blood_pressure || 'Not recorded';
    if (vitalPulse) vitalPulse.textContent = vitals.pulse_rate || 'Not recorded';
    if (vitalTemp) vitalTemp.textContent = vitals.temperature || 'Not recorded';
    if (vitalWeight) vitalWeight.textContent = vitals.weight || 'Not recorded';
    if (vitalHeight) vitalHeight.textContent = vitals.height || 'Not recorded';
    if (vitalRespiratory) vitalRespiratory.textContent = vitals.respiratory_rate || 'Not recorded';
    if (vitalO2) vitalO2.textContent = vitals.oxygen_saturation || 'Not recorded';
    if (vitalLastUpdated) vitalLastUpdated.textContent = vitals.date || 'Not recorded';
}

function renderPatientBackground(background) {
    const mentalStatusList = document.querySelector('.mental-status-list');
    const medicalSubsections = document.querySelectorAll('.medical-subsection');
    const familyCards = document.querySelectorAll('.family-card');

    if (mentalStatusList) {
        if (background && Array.isArray(background.observations) && background.observations.length > 0) {
            mentalStatusList.innerHTML = background.observations.map(entry => {
                const observationText = escapeHtml(entry.observation || 'No observation details');
                const observationDate = entry.observationDateLabel
                    ? `<span class="mental-status-date">${escapeHtml(entry.observationDateLabel)}</span>`
                    : '';

                return `<li class="mental-status-entry"><span class="mental-status-text">${observationText}</span>${observationDate}</li>`;
            }).join('');
        } else {
            mentalStatusList.innerHTML = '<li class="mental-status-empty">No mental status observations recorded</li>';
        }
    }

    if (medicalSubsections.length >= 2) {
        const medicalHistory = background && background.medicalHistory ? background.medicalHistory : null;
        const chronicConditionValue = medicalSubsections[0].querySelector('.personal-value');
        if (chronicConditionValue) {
            chronicConditionValue.textContent = medicalHistory && medicalHistory.chronicCondition
                ? medicalHistory.chronicCondition
                : 'Not specified';
        }

        const allergyRows = medicalSubsections[1].querySelectorAll('.personal-row');
        if (allergyRows.length >= 2) {
            const foodAllergyValue = allergyRows[0].querySelector('.personal-value');
            const medicalAllergyValue = allergyRows[1].querySelector('.personal-value');

            if (foodAllergyValue) {
                foodAllergyValue.textContent = medicalHistory && medicalHistory.foodAllergy
                    ? medicalHistory.foodAllergy
                    : 'None reported';
            }

            if (medicalAllergyValue) {
                medicalAllergyValue.textContent = medicalHistory && medicalHistory.medicalAllergy
                    ? medicalHistory.medicalAllergy
                    : 'None reported';
            }
        }
    }

    if (familyCards.length >= 2) {
        const familyHistory = background && background.familyHistory ? background.familyHistory : null;
        const psychiatricValues = familyCards[0].querySelectorAll('.family-value');
        const medicalValues = familyCards[1].querySelectorAll('.family-value');

        if (psychiatricValues.length >= 2) {
            psychiatricValues[0].textContent = familyHistory && familyHistory.paternalPsych
                ? familyHistory.paternalPsych
                : 'None reported';
            psychiatricValues[1].textContent = familyHistory && familyHistory.maternalPsych
                ? familyHistory.maternalPsych
                : 'None reported';
        }

        if (medicalValues.length >= 2) {
            medicalValues[0].textContent = familyHistory && familyHistory.paternalMed
                ? familyHistory.paternalMed
                : 'None reported';
            medicalValues[1].textContent = familyHistory && familyHistory.maternalMed
                ? familyHistory.maternalMed
                : 'None reported';
        }
    }
}

async function fetchPatientBackground(patientId) {
    try {
        const response = await fetch(`../php/get_patient_background.php?patient_id=${encodeURIComponent(patientId)}&_=${Date.now()}`, {
            cache: 'no-store'
        });
        const data = await response.json();

        const selectedPatient = getSelectedPatient();
        if (!selectedPatient || String(selectedPatient.id) !== String(patientId)) {
            return;
        }

        if (response.ok && data.success) {
            renderPatientBackground(data);
            return;
        }

        console.warn('No patient background returned:', data.message);
        renderPatientBackground(null);
    } catch (error) {
        console.error('Error fetching patient background:', error);
        const selectedPatient = getSelectedPatient();
        if (selectedPatient && String(selectedPatient.id) === String(patientId)) {
            renderPatientBackground(null);
        }
    }
}

function formatMedicationIntakeDate(dateValue) {
    if (!dateValue) {
        return 'Not recorded';
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return String(dateValue);
    }

    return parsedDate.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).replace('12:00 PM', '12:00 NN');
}

function formatMedicationIntakeTime(dateValue) {
    if (!dateValue) {
        return 'Not recorded';
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return 'Not recorded';
    }

    return parsedDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).replace('12:00 PM', '12:00 NN');
}

function getMedicationDateKey(dateValue) {
    if (!dateValue) {
        return '';
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return '';
    }

    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateKeyLabel(dateKey) {
    if (!dateKey) {
        return 'No medicine intake history available';
    }

    const parsedDate = new Date(dateKey);
    if (Number.isNaN(parsedDate.getTime())) {
        return dateKey;
    }

    return parsedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function setMedicineIntakeHistoryVisibility(hasHistory) {
    const toggle = document.getElementById('medicineIntakeHistoryToggle');
    const panel = document.getElementById('medicineIntakeHistoryPanel');

    if (toggle) {
        toggle.classList.toggle('has-history', !!hasHistory);
    }

    if (!hasHistory && panel) {
        panel.style.display = 'none';
    }
}

function renderMedicationIntakeCalendar() {
    const daysContainer = document.getElementById('miCalDays');
    const monthLabel = document.getElementById('miCalMonthLabel');
    const legend = document.getElementById('miCalLegend');

    if (!daysContainer || !monthLabel) {
        return;
    }

    const recordDateKeys = currentMedicationIntakeEntries
        .map(entry => getMedicationDateKey(entry.Date_Administered))
        .filter(Boolean);
    const recordDates = new Set(recordDateKeys);

    if (legend) {
        legend.classList.toggle('no-records', recordDates.size === 0);
    }

    if (medicationCalendarMonth === null || medicationCalendarYear === null) {
        const baseDate = selectedMedicationDateKey
            ? new Date(selectedMedicationDateKey)
            : (currentMedicationIntakeEntries[0]?.Date_Administered
                ? new Date(currentMedicationIntakeEntries[0].Date_Administered)
                : new Date());

        medicationCalendarMonth = baseDate.getMonth();
        medicationCalendarYear = baseDate.getFullYear();
    }

    const firstDay = new Date(medicationCalendarYear, medicationCalendarMonth, 1).getDay();
    const daysInMonth = new Date(medicationCalendarYear, medicationCalendarMonth + 1, 0).getDate();
    const prevMonthDays = new Date(medicationCalendarYear, medicationCalendarMonth, 0).getDate();

    monthLabel.textContent = `${medicationCalendarMonthNames[medicationCalendarMonth]} ${medicationCalendarYear}`;
    daysContainer.innerHTML = '';

    for (let i = firstDay - 1; i >= 0; i -= 1) {
        const span = document.createElement('span');
        span.className = 'muted';
        span.textContent = String(prevMonthDays - i);
        daysContainer.appendChild(span);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        const span = document.createElement('span');
        span.textContent = String(day);
        const dateKey = [
            medicationCalendarYear,
            String(medicationCalendarMonth + 1).padStart(2, '0'),
            String(day).padStart(2, '0')
        ].join('-');

        if (recordDates.has(dateKey)) {
            span.classList.add('has-record');
            if (selectedMedicationDateKey === dateKey) {
                span.classList.add('selected');
            }

            span.addEventListener('click', function() {
                selectedMedicationDateKey = dateKey;
                renderMedicationIntakeCalendar();
                renderMedicationIntakeHistoryByDate();
            });
        }

        daysContainer.appendChild(span);
    }

    const cellsUsed = firstDay + daysInMonth;
    const trailing = Math.max(0, 42 - cellsUsed);
    for (let i = 1; i <= trailing; i += 1) {
        const span = document.createElement('span');
        span.className = 'muted';
        span.textContent = String(i);
        daysContainer.appendChild(span);
    }
}

function renderMedicationIntakeHistoryByDate() {
    const activeDate = document.getElementById('medicineIntakeHistoryActiveDate');
    const historyList = document.getElementById('medicineIntakeHistoryList');

    if (!activeDate || !historyList) {
        return;
    }

    if (!currentMedicationIntakeEntries.length) {
        activeDate.textContent = 'No medicine intake history available';
        historyList.innerHTML = '<p style="padding: 12px 0; color: #999;">No medicine intake history available.</p>';
        return;
    }

    const dateKeys = currentMedicationIntakeEntries
        .map(entry => getMedicationDateKey(entry.Date_Administered))
        .filter(Boolean);
    const availableDateKeys = Array.from(new Set(dateKeys));

    if (!selectedMedicationDateKey || !availableDateKeys.includes(selectedMedicationDateKey)) {
        selectedMedicationDateKey = availableDateKeys[0] || null;
    }

    const filteredEntries = currentMedicationIntakeEntries.filter(entry => {
        return getMedicationDateKey(entry.Date_Administered) === selectedMedicationDateKey;
    });

    const latestDateKey = getMedicationDateKey(currentMedicationIntakeEntries[0]?.Date_Administered);
    const isLatestDate = !!selectedMedicationDateKey && selectedMedicationDateKey === latestDateKey;
    activeDate.innerHTML = `${escapeHtml(formatDateKeyLabel(selectedMedicationDateKey))}${isLatestDate ? ' - <span class="mi-history-heading-latest">Latest</span>' : ''}`;

    if (!filteredEntries.length) {
        historyList.innerHTML = '<div class="mi-history-empty">No intake records for this date.</div>';
        return;
    }

    historyList.innerHTML = filteredEntries.map(entry => {
        const dateTime = formatMedicationIntakeDate(entry.Date_Administered);
        return `
            <div class="medicine-intake-history-card">
                <div class="mi-history-header">
                    <div class="mi-history-meta">
                        <span>${escapeHtml(formatMedicationIntakeTime(entry.Date_Administered))}</span>
                        <span class="mi-history-dot">•</span>
                        <span>${escapeHtml(entry.AdministeredByName || 'Nurse on record')}</span>
                    </div>
                </div>
                <div class="mi-history-rows">
                    <div class="mi-history-row">
                        <div>
                            <div class="mi-history-label">Medicine</div>
                            <div class="mi-history-value">${escapeHtml(entry.Medicine || 'Unnamed medicine')}</div>
                        </div>
                        <div>
                            <div class="mi-history-label">Dosage</div>
                            <div class="mi-history-value">${escapeHtml(entry.Dosage || 'Not recorded')}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function initMedicineIntakeHistoryControls() {
    const toggle = document.getElementById('medicineIntakeHistoryToggle');
    const panel = document.getElementById('medicineIntakeHistoryPanel');
    const prevBtn = document.getElementById('miCalPrev');
    const nextBtn = document.getElementById('miCalNext');

    if (!toggle || !panel) {
        return;
    }

    panel.style.display = 'none';
    if (!toggle.dataset.bound) {
        toggle.dataset.bound = '1';
        toggle.addEventListener('click', function() {
            const isOpen = panel.style.display === 'block';
            panel.style.display = isOpen ? 'none' : 'block';
            if (!isOpen) {
                renderMedicationIntakeCalendar();
                renderMedicationIntakeHistoryByDate();
            }
        });
    }

    if (prevBtn && !prevBtn.dataset.bound) {
        prevBtn.dataset.bound = '1';
        prevBtn.addEventListener('click', function() {
            medicationCalendarMonth -= 1;
            if (medicationCalendarMonth < 0) {
                medicationCalendarMonth = 11;
                medicationCalendarYear -= 1;
            }
            renderMedicationIntakeCalendar();
        });
    }

    if (nextBtn && !nextBtn.dataset.bound) {
        nextBtn.dataset.bound = '1';
        nextBtn.addEventListener('click', function() {
            medicationCalendarMonth += 1;
            if (medicationCalendarMonth > 11) {
                medicationCalendarMonth = 0;
                medicationCalendarYear += 1;
            }
            renderMedicationIntakeCalendar();
        });
    }

    renderMedicationIntakeCalendar();
    renderMedicationIntakeHistoryByDate();
}

async function fetchPatientMedicationIntake(patientId) {
    const medicineIntakeList = document.getElementById('medicineIntakeList');
    if (!medicineIntakeList) {
        return;
    }

    try {
        const response = await fetch(`../php/get_medication_intake.php?patient_id=${encodeURIComponent(patientId)}&_=${Date.now()}`, {
            cache: 'no-store'
        });
        const data = await response.json();

        if (data.success && Array.isArray(data.medicationIntake) && data.medicationIntake.length > 0) {
            const sortedEntries = [...data.medicationIntake].sort((a, b) => {
                const aTime = new Date(a.Date_Administered || 0).getTime();
                const bTime = new Date(b.Date_Administered || 0).getTime();
                return bTime - aTime;
            });

            currentMedicationIntakeEntries = sortedEntries;
            selectedMedicationDateKey = getMedicationDateKey(sortedEntries[0]?.Date_Administered);
            medicationCalendarMonth = null;
            medicationCalendarYear = null;

            let previousDateLabel = '';
            medicineIntakeList.innerHTML = sortedEntries.map((entry, index) => {
                const parsedDate = new Date(entry.Date_Administered || '');
                const dateLabel = Number.isNaN(parsedDate.getTime())
                    ? 'Not recorded'
                    : parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeLabel = Number.isNaN(parsedDate.getTime())
                    ? 'Not recorded'
                    : parsedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).replace('12:00 PM', '12:00 NN');
                const showDateLabel = dateLabel !== previousDateLabel;
                previousDateLabel = dateLabel;

                return `
                    ${showDateLabel ? `<div class="intake-date">${escapeHtml(dateLabel)}</div>` : ''}
                    <div class="medicine-intake-card">
                        <div class="medicine-intake-top">
                            <span class="intake-time">${escapeHtml(timeLabel)}</span>
                            <span class="intake-dot">•</span>
                            <span class="intake-nurse">${escapeHtml(entry.AdministeredByName || 'Staff on record')}</span>
                            ${index === 0 ? '<span class="intake-latest">Latest</span>' : ''}
                        </div>
                        <div class="medicine-intake-cols">
                            <div class="intake-col">
                                <div class="intake-label">Medicine</div>
                                <div class="intake-value">${escapeHtml(entry.Medicine || 'Unnamed medicine')}</div>
                            </div>
                            <div class="intake-col">
                                <div class="intake-label">Dosage</div>
                                <div class="intake-value">${escapeHtml(entry.Dosage || 'Not recorded')}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            setMedicineIntakeHistoryVisibility(true);
            renderMedicationIntakeCalendar();
            renderMedicationIntakeHistoryByDate();
            return;
        }

        currentMedicationIntakeEntries = [];
        selectedMedicationDateKey = null;
        medicationCalendarMonth = null;
        medicationCalendarYear = null;
        medicineIntakeList.innerHTML = '<p style="padding: 20px; color: #999;">No medicine intake entries recorded yet.</p>';
        setMedicineIntakeHistoryVisibility(false);
        renderMedicationIntakeCalendar();
        renderMedicationIntakeHistoryByDate();
    } catch (error) {
        console.error('Error fetching medication intake:', error);
        currentMedicationIntakeEntries = [];
        selectedMedicationDateKey = null;
        medicationCalendarMonth = null;
        medicationCalendarYear = null;
        medicineIntakeList.innerHTML = '<p style="padding: 20px; color: #c00;">Error loading medicine intake records.</p>';
        setMedicineIntakeHistoryVisibility(false);
        renderMedicationIntakeCalendar();
        renderMedicationIntakeHistoryByDate();
    }
}

async function fetchPatientVitals(patientId) {
    try {
        const response = await fetch(`../php/get_patient_vitals.php?patient_id=${patientId}`);
        const data = await response.json();

        if (data.success) {
            renderPatientVitals(data.vitals);
        } else {
            console.warn('No vitals returned:', data.message);
            renderPatientVitals(null);
        }
    } catch (error) {
        console.error('Error fetching vitals:', error);
        renderPatientVitals(null);
    }
}

async function fetchPatientExternalMedicine(patientId) {
    const tableBody = document.getElementById('externalMedicineTableBody');
    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">Loading external medicine entries...</td></tr>';

    try {
        const response = await fetch(`../php/patient_external_meds.php?patient_id=${encodeURIComponent(patientId)}&_=${Date.now()}`, {
            cache: 'no-store',
            credentials: 'include'
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to load external medicine entries.');
        }

        if (Array.isArray(data.records) && data.records.length > 0) {
            tableBody.innerHTML = data.records.map((record, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(formatDisplayDate(record.med_date || record.Date || ''))}</td>
                    <td>${escapeHtml(record.medicine || record.Medicine || 'N/A')}</td>
                    <td>${escapeHtml(record.quantity || record.Quantity || 'N/A')}</td>
                    <td>${escapeHtml(record.received_by || record.Received_By || '')}</td>
                    <td>${escapeHtml(record.sent_by || record.Sent_By || '')}</td>
                </tr>
            `).join('');
            return;
        }

        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No external medicine entries available.</td></tr>';
    } catch (error) {
        console.error('Error fetching external medicine:', error);
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #c00;">Error loading external medicine entries.</td></tr>';
    }
}

function getSelectedPatient() {
    const activeItem = document.querySelector('.patient-list-item.active');
    if (!activeItem) {
        return null;
    }

    return getPatientById(activeItem.getAttribute('data-patient-id'));
}

// Function to update patient details
function updatePatientDetails(patientId) {
    const patient = getPatientById(patientId);
    if (!patient) {
        console.warn('Patient not found:', patientId);
        return;
    }

    console.log('Updating details for patient:', patient);

    // Update header
    const fullName = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ');
    document.querySelector('.patient-name-large').textContent = fullName;

    const diagnosisSummary = document.querySelector('.patient-diagnosis');
    if (diagnosisSummary) {
        diagnosisSummary.textContent = 'Loading diagnosis...';
    }

    const admissionDateTime = patient.admissionDateTime || patient.createdAt || '';
    let attendingPhysician = patient.attendingPhysician || 'Not assigned';

    if (
        patient.attendingRole &&
        String(patient.attendingRole).toLowerCase() === 'doctor' &&
        attendingPhysician !== 'Not assigned' &&
        !/^dr\./i.test(attendingPhysician)
    ) {
        attendingPhysician = `Dr. ${attendingPhysician}`;
    }

    // Update admission info to match admin patient file header
    const admissionValues = document.querySelectorAll('.admission-value');
    if (admissionValues.length >= 3) {
        admissionValues[0].textContent = formatDisplayDate(admissionDateTime);
        admissionValues[1].textContent = formatDisplayTime(admissionDateTime);
        admissionValues[2].textContent = attendingPhysician;
    }

    // Update personal information with database patient data
    const personalRows = document.querySelectorAll('#patientInfoTab .personal-row');
    if (personalRows.length >= 8) {
        personalRows[0].querySelector('.personal-value').textContent = patient.birthdate || 'Not available';
        personalRows[1].querySelector('.personal-value').textContent = patient.age ? `${patient.age} years old` : 'Not available';
        personalRows[2].querySelector('.personal-value').textContent = formatPersonalInfoValue(patient.sex);
        personalRows[3].querySelector('.personal-value').textContent = formatPersonalInfoValue(patient.civilStatus);
        personalRows[4].querySelector('.personal-value').textContent = formatPersonalInfoValue(patient.address);
        personalRows[5].querySelector('.personal-value').textContent = formatPersonalInfoValue(patient.religion);
        personalRows[6].querySelector('.personal-value').textContent = formatPersonalInfoValue(patient.hobbies);
        personalRows[7].querySelector('.personal-value').textContent = formatPersonalInfoValue(patient.previousOccupation);
    }

    // Update diagnosis history from database
    const diagnosisContainer = document.querySelector('#patientInfoTab .card-body .row.g-3');
    if (diagnosisContainer) {
        // Fetch diagnoses from database
        fetchPatientDiagnoses(patient.id, diagnosisContainer);
    }

    // Load prescriptions from database
    fetchPatientPrescriptions(patient.id);

    // Load medicine intake from database
    fetchPatientMedicationIntake(patient.id);

    // Load the most recent vitals from the database
    fetchPatientVitals(patient.id);

    // Load observation, medical history, and family history from the database
    renderPatientBackground(null);
    fetchPatientBackground(patient.id);

    // Load external medicine from the database
    fetchPatientExternalMedicine(patient.id);
}

// Sidebar navigation
document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        if (this.getAttribute('href') === '#') {
            e.preventDefault();
        }
    });
});

// Patient list item click
document.querySelectorAll('.patient-list-item').forEach(item => {
    item.addEventListener('click', function(e) {
        // Update active state
        document.querySelectorAll('.patient-list-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        
        // Check the radio button
        const radio = this.querySelector('.patient-radio');
        if (radio) {
            radio.checked = true;
        }
        
        updatePatientDetails(this.getAttribute('data-patient-id'));
    });
});

// Radio button click
document.querySelectorAll('.patient-radio').forEach(radio => {
    radio.addEventListener('click', function(e) {
        e.stopPropagation();
        const listItem = this.closest('.patient-list-item');
        if (listItem) {
            document.querySelectorAll('.patient-list-item').forEach(i => i.classList.remove('active'));
            listItem.classList.add('active');
            updatePatientDetails(listItem.getAttribute('data-patient-id'));
        }
    });
});

// Initialize page on load
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Patient File page loaded');
    initMedicineIntakeHistoryControls();
    
    // Load user information
    await loadUserInfo();
    
    // Load patients from database
    await loadPatientsFromDatabase();
    
    // Set today's date as default for date inputs
    const today = new Date().toISOString().split('T')[0];
    const diagnosisDateInput = document.getElementById('diagnosisDate');
    const prescriptionDateInput = document.getElementById('prescriptionDate');
    const vitalsDateInput = document.getElementById('vitalsDate');
    if (diagnosisDateInput) diagnosisDateInput.value = today;
    if (prescriptionDateInput) prescriptionDateInput.value = today;
    if (vitalsDateInput) vitalsDateInput.value = today;
});

// Search functionality
const searchPatientInput = document.getElementById('searchPatient');
if (searchPatientInput) {
    searchPatientInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        document.querySelectorAll('.patient-list-item').forEach(item => {
            const patientName = (item.getAttribute('data-patient-name') || '').toLowerCase();
            const patientId = (item.getAttribute('data-patient-id') || '').toLowerCase();
            if (patientName.includes(searchTerm) || patientId.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

// Add Diagnosis Function
async function addDiagnosis() {
    const date = document.getElementById('diagnosisDate').value;
    const title = document.getElementById('diagnosisTitle').value.trim();
    const notes = document.getElementById('diagnosisNotes').value.trim();

    if (!date || !title) {
        showDoctorSaveFeedback('Please fill in the date and diagnosis fields.', 'Missing Information', 'warning');
        return;
    }

    // Get current patient ID
    const currentPatient = getSelectedPatient();

    if (!currentPatient) {
        showDoctorSaveFeedback('Please select a patient first.', 'Select Patient', 'warning');
        return;
    }

    const shouldSave = await showDoctorSaveConfirm(
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
        formData.append('patient_id', currentPatient.id);
        formData.append('diagnosis', title);
        formData.append('notes', notes);
        formData.append('date', date);

        const response = await fetch('../php/save_diagnosis.php', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            const diagnosisContainer = document.querySelector('#patientInfoTab .card-body .row.g-3');
            if (diagnosisContainer) {
                await fetchPatientDiagnoses(currentPatient.id, diagnosisContainer);
            }

            const modal = bootstrap.Modal.getInstance(document.getElementById('addDiagnosisModal'));
            if (modal) {
                modal.hide();
            }
            document.getElementById('diagnosisForm').reset();
            showDoctorSaveFeedback('Diagnosis information was saved successfully.', 'Saved', 'success');
        } else {
            showDoctorSaveFeedback(data.message || 'Unable to save diagnosis information.', 'Save Failed', 'danger');
        }
    } catch (error) {
        console.error('Error saving diagnosis:', error);
        showDoctorSaveFeedback(error.message || 'Unable to save diagnosis information.', 'Save Failed', 'danger');
    }
}

async function addVitals() {
    const currentPatient = getSelectedPatient();
    if (!currentPatient) {
        showDoctorSaveFeedback('Please select a patient first.', 'Select Patient', 'warning');
        return;
    }

    const bloodPressure = document.getElementById('vitalsBP').value.trim();
    const pulseRate = document.getElementById('vitalsPulse').value.trim();
    const temperature = document.getElementById('vitalsTemp').value.trim();
    const weight = document.getElementById('vitalsWeight').value.trim();
    const height = document.getElementById('vitalsHeight').value.trim();
    const respiratoryRate = document.getElementById('vitalsRespiratory').value.trim();
    const oxygenSaturation = document.getElementById('vitalsO2').value.trim();
    const dateRecorded = document.getElementById('vitalsDate').value;

    if (!bloodPressure || !pulseRate || !temperature || !weight || !height || !respiratoryRate || !oxygenSaturation || !dateRecorded) {
        showDoctorSaveFeedback('Please fill in all vital fields before saving.', 'Missing Information', 'warning');
        return;
    }

    const shouldSave = await showDoctorSaveConfirm(
        'Are you sure you want to save this vitals information?',
        'Save Vitals',
        'primary',
        'Save Vitals'
    );

    if (!shouldSave) {
        return;
    }

    try {
        const formData = new FormData();
        formData.append('patient_id', currentPatient.id);
        formData.append('blood_pressure', bloodPressure);
        formData.append('pulse_rate', pulseRate);
        formData.append('temperature', temperature);
        formData.append('weight', weight);
        formData.append('height', height);
        formData.append('respiratory_rate', respiratoryRate);
        formData.append('oxygen_saturation', oxygenSaturation);
        formData.append('date_recorded', dateRecorded);

        const response = await fetch('../php/save_patient_vitals.php', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to save vitals');
        }

        await fetchPatientVitals(currentPatient.id);

        const modalElement = document.getElementById('addVitalsModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }

        document.getElementById('vitalsForm').reset();
        document.getElementById('vitalsDate').value = new Date().toISOString().split('T')[0];
        showDoctorSaveFeedback('Vitals information was saved successfully.', 'Saved', 'success');
    } catch (error) {
        console.error('Error saving vitals:', error);
        showDoctorSaveFeedback(error.message || 'Unable to save vitals information.', 'Save Failed', 'danger');
    }
}

// Add or update prescription in database
async function addPrescription() {
    const currentPatient = getSelectedPatient();
    if (!currentPatient) {
        showDoctorSaveFeedback('Please select a patient first.', 'Select Patient', 'warning');
        return;
    }

    const medicine = document.getElementById('prescriptionMedicine').value.trim();
    const dosage = document.getElementById('prescriptionDosage').value.trim();
    const frequency = document.getElementById('prescriptionFrequency').value.trim();
    const date = document.getElementById('prescriptionDate').value;
    const duration = document.getElementById('prescriptionDuration').value.trim();

    if (!medicine || !dosage || !frequency || !date || !duration) {
        showDoctorSaveFeedback('Please fill in all prescription fields before saving.', 'Missing Information', 'warning');
        return;
    }

    const isEditing = Boolean(editingPrescriptionId);
    const shouldSave = await showDoctorSaveConfirm(
        isEditing
            ? 'Are you sure you want to update this prescription information?'
            : 'Are you sure you want to save this prescription information?',
        isEditing ? 'Update Prescription' : 'Save Prescription',
        'primary',
        isEditing ? 'Update Prescription' : 'Save Prescription'
    );

    if (!shouldSave) {
        return;
    }

    try {
        const formData = new FormData();
        formData.append('patient_id', currentPatient.id);
        formData.append('medicine', medicine);
        formData.append('dosage', dosage);
        formData.append('frequency', frequency);
        formData.append('date', date);
        formData.append('duration', duration);

        if (isEditing) {
            formData.append('prescription_id', editingPrescriptionId);
        }

        const endpoint = isEditing ? '../php/update_prescription.php' : '../php/save_prescription.php';
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            cache: 'no-store'
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to save prescription');
        }

        await fetchPatientPrescriptions(currentPatient.id);

        const modalElement = document.getElementById('addPrescriptionModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }

        resetPrescriptionModal();
        showDoctorSaveFeedback(
            isEditing ? 'Prescription information was updated successfully.' : 'Prescription information was saved successfully.',
            'Saved',
            'success'
        );
    } catch (error) {
        console.error('Error saving prescription:', error);
        showDoctorSaveFeedback(error.message || 'Unable to save prescription information.', 'Save Failed', 'danger');
    }
}

// Delete Prescription Function
async function deletePrescription(button) {
    const currentPatient = getSelectedPatient();
    const row = button.closest('tr');
    const prescriptionId = row ? row.getAttribute('data-prescription-id') : '';

    if (!currentPatient || !prescriptionId) {
        alert('Unable to delete this prescription');
        return;
    }

    if (confirm('Are you sure you want to delete this prescription?')) {
        try {
            const formData = new FormData();
            formData.append('prescription_id', prescriptionId);

            const response = await fetch('../php/delete_prescription.php', {
                method: 'POST',
                body: formData,
                cache: 'no-store'
            });
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Failed to delete prescription');
            }

            await fetchPatientPrescriptions(currentPatient.id);
            alert('Prescription deleted successfully!');
        } catch (error) {
            console.error('Error deleting prescription:', error);
            alert('Error deleting prescription: ' + error.message);
        }
    }
}

// Edit Prescription Function
function editPrescription(button) {
    const row = button.closest('tr');
    if (!row) {
        return;
    }

    setPrescriptionModalForEdit(row);
    
    // Open modal
    const modal = new bootstrap.Modal(document.getElementById('addPrescriptionModal'));
    modal.show();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initMedicineIntakeHistoryControls();
    // Set today's date as default for date inputs
    const today = new Date().toISOString().split('T')[0];
    const diagnosisDateInput = document.getElementById('diagnosisDate');
    const prescriptionDateInput = document.getElementById('prescriptionDate');
    const vitalsDateInput = document.getElementById('vitalsDate');
    if (diagnosisDateInput) diagnosisDateInput.value = today;
    if (prescriptionDateInput) prescriptionDateInput.value = today;
    if (vitalsDateInput) vitalsDateInput.value = today;

    const prescriptionModalElement = document.getElementById('addPrescriptionModal');
    if (prescriptionModalElement) {
        prescriptionModalElement.addEventListener('hidden.bs.modal', resetPrescriptionModal);
    }
});

// Tab navigation
document.querySelectorAll('.tab-link').forEach((link, index) => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Update active tab
        document.querySelectorAll('.tab-item').forEach(item => item.classList.remove('active'));
        this.closest('.tab-item').classList.add('active');
        
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Show corresponding tab content
        const tabText = this.textContent.trim();
        if (tabText === 'Patient Info') {
            document.getElementById('patientInfoTab').classList.add('active');
        } else if (tabText === 'External Medicine') {
            document.getElementById('externalMedicineTab').classList.add('active');
        } else if (tabText === 'Prescription') {
            document.getElementById('prescriptionTab').classList.add('active');
        }
    });
    
});
