let patientsFromDB = [];
let editingPrescriptionId = null;
let currentUserDisplayName = 'Nurse On Duty';
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
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function setDateInputValue(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.value = new Date().toISOString().split('T')[0];
    }
}

function setTimeInputValue(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        input.value = `${hours}:${minutes}`;
    }
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

function formatRoleLabel(role) {
    if (!role) {
        return '';
    }

    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

function getPatientById(patientId) {
    const normalizedId = String(patientId || '');
    return patientsFromDB.find(patient => String(patient.id) === normalizedId) || null;
}

function getSelectedPatient() {
    const activeItem = document.querySelector('.patient-list-item.active');
    if (!activeItem) {
        return null;
    }

    return getPatientById(activeItem.getAttribute('data-patient-id'));
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

function populateMedicineIntakePrescriptionOptions(prescriptions, emptyLabel = 'No prescribed medicines available') {
    const prescriptionSelect = document.getElementById('medicineIntakePrescription');
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

function renderPatientVitals(vitals) {
    const fields = {
        vitalBP: vitals?.blood_pressure || 'Not recorded',
        vitalPulse: vitals?.pulse_rate || 'Not recorded',
        vitalTemp: vitals?.temperature || 'Not recorded',
        vitalWeight: vitals?.weight || 'Not recorded',
        vitalHeight: vitals?.height || 'Not recorded',
        vitalRespiratory: vitals?.respiratory_rate || 'Not recorded',
        vitalO2: vitals?.oxygen_saturation || 'Not recorded',
        vitalLastUpdated: vitals?.date || 'Not recorded'
    };

    Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
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

function resetPatientDetails() {
    const patientName = document.querySelector('.patient-name-large');
    const patientDiagnosis = document.querySelector('.patient-diagnosis');
    const admissionValues = document.querySelectorAll('.admission-value');
    const personalRows = document.querySelectorAll('#patientInfoTab .personal-grid .personal-row');
    const diagnosisList = document.getElementById('diagnosisList');
    const medicineIntakeList = document.getElementById('medicineIntakeList');
    const prescriptionList = document.getElementById('prescriptionList');
    const externalMedicineTableBody = document.getElementById('externalMedicineTableBody');
    const mentalStatusList = document.querySelector('.mental-status-list');
    const medicalSubsections = document.querySelectorAll('.medical-subsection');
    const familyCards = document.querySelectorAll('.family-card');

    if (patientName) {
        patientName.textContent = 'Select a patient';
    }

    if (patientDiagnosis) {
        patientDiagnosis.textContent = 'No diagnosis recorded';
    }

    admissionValues.forEach(value => {
        value.textContent = 'Not recorded';
    });

    personalRows.forEach(row => {
        const value = row.querySelector('.personal-value');
        if (value) {
            value.textContent = '-';
        }
    });

    if (diagnosisList) {
        diagnosisList.innerHTML = '<p style="padding: 20px; color: #999;">Select a patient to view diagnoses.</p>';
    }

    if (medicineIntakeList) {
        medicineIntakeList.innerHTML = '<p style="padding: 20px; color: #999;">No medicine intake entries recorded yet.</p>';
    }

    currentMedicationIntakeEntries = [];
    selectedMedicationDateKey = null;
    medicationCalendarMonth = null;
    medicationCalendarYear = null;
    setMedicineIntakeHistoryVisibility(false);
    renderMedicationIntakeCalendar();
    renderMedicationIntakeHistoryByDate();

    currentPatientPrescriptions = [];
    populateMedicineIntakePrescriptionOptions([], 'Select a patient first');

    if (prescriptionList) {
        prescriptionList.innerHTML = '<p style="padding: 20px; color: #999;">Select a patient to view prescriptions.</p>';
    }

    if (externalMedicineTableBody) {
        externalMedicineTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">Select a patient to view external medicine entries.</td></tr>';
    }

    renderPatientVitals(null);

    renderPatientBackground(null);
}

function populatePatientList() {
    const patientList = document.getElementById('patientList');
    if (!patientList) {
        return;
    }

    if (!patientsFromDB.length) {
        patientList.innerHTML = '<li class="patient-list-item empty-state">No patients found.</li>';
        resetPatientDetails();
        return;
    }

    patientList.innerHTML = '';

    patientsFromDB.forEach((patient, index) => {
        const item = document.createElement('li');
        item.className = `patient-list-item${index === 0 ? ' active' : ''}`;
        item.setAttribute('data-patient-id', patient.id);
        item.setAttribute('data-patient-name', patient.name);
        item.innerHTML = `
            <input type="radio" name="patientRadio" class="patient-radio" ${index === 0 ? 'checked' : ''}>
            <span class="patient-item-name">${escapeHtml(patient.name)}</span>
        `;

        item.addEventListener('click', function() {
            selectPatientById(patient.id);
        });

        const radio = item.querySelector('.patient-radio');
        if (radio) {
            radio.addEventListener('click', function(event) {
                event.stopPropagation();
                selectPatientById(patient.id);
            });
        }

        patientList.appendChild(item);
    });
}

function selectPatientById(patientId) {
    const normalizedId = String(patientId || '');

    document.querySelectorAll('.patient-list-item').forEach(item => {
        const isActive = item.getAttribute('data-patient-id') === normalizedId;
        item.classList.toggle('active', isActive);

        const radio = item.querySelector('.patient-radio');
        if (radio) {
            radio.checked = isActive;
        }
    });

    updatePatientDetails(normalizedId);
}

async function loadPatientsFromDatabase() {
    const patientList = document.getElementById('patientList');

    try {
        const response = await fetch('../php/get_doctor_patients.php?status=admitted', {
            cache: 'no-store'
        });
        const data = await response.json();

        if (data.success && Array.isArray(data.patients)) {
            patientsFromDB = data.patients;
            populatePatientList();

            if (patientsFromDB.length > 0) {
                selectPatientById(patientsFromDB[0].id);
            }
        } else {
            patientsFromDB = [];
            if (patientList) {
                patientList.innerHTML = `<li class="patient-list-item empty-state">${escapeHtml(data.message || 'No patients found.')}</li>`;
            }
            resetPatientDetails();
        }
    } catch (error) {
        console.error('Error loading patients from database:', error);
        patientsFromDB = [];
        if (patientList) {
            patientList.innerHTML = '<li class="patient-list-item empty-state">Unable to load patients.</li>';
        }
        resetPatientDetails();
    }
}

async function loadUserInfo() {
    const headerName = document.getElementById('patientFileHeaderName');

    try {
        const response = await fetch('../php/get_user.php', {
            cache: 'no-store'
        });
        const data = await response.json();

        if (!data.success || !data.user) {
            throw new Error(data.message || 'Unable to load user info');
        }

        const firstName = data.user.firstname || '';
        const lastName = data.user.lastname || '';
        const roleLabel = formatRoleLabel(data.user.role);
        const fullName = `${firstName} ${lastName}`.trim() || 'Nurse';

        currentUserDisplayName = `${roleLabel ? `${roleLabel} ` : ''}${fullName}`.trim();

        if (headerName) {
            headerName.innerHTML = `<strong>${escapeHtml(fullName)}</strong>`;
        }
    } catch (error) {
        console.error('Error loading user information:', error);
        currentUserDisplayName = 'Nurse On Duty';

        if (headerName) {
            headerName.innerHTML = '<strong>Nurse</strong>';
        }
    }
}

async function fetchPatientDiagnoses(patientId) {
    const diagnosisList = document.getElementById('diagnosisList');
    const diagnosisSummary = document.querySelector('.patient-diagnosis');
    if (!diagnosisList) {
        return;
    }

    try {
        const response = await fetch(`../php/get_patient_diagnoses.php?patient_id=${encodeURIComponent(patientId)}`, {
            cache: 'no-store'
        });
        const data = await response.json();

        if (data.success && Array.isArray(data.diagnoses) && data.diagnoses.length > 0) {
            const diagnosisTitles = Array.from(new Set(
                data.diagnoses
                    .map(diagnosis => String(diagnosis.diagnosis || '').trim())
                    .filter(Boolean)
            ));

            if (diagnosisSummary) {
                diagnosisSummary.textContent = diagnosisTitles.length
                    ? diagnosisTitles.join(', ')
                    : 'Diagnosis recorded';
            }

            diagnosisList.innerHTML = data.diagnoses.map(diagnosis => `
                <div class="col-md-6">
                    <div class="diagnosis-card">
                        <div class="diagnosis-date">${escapeHtml(diagnosis.date)}</div>
                        <h6 class="diagnosis-title">${escapeHtml(diagnosis.diagnosis)}</h6>
                        <p class="diagnosis-doctor">${escapeHtml(diagnosis.doctor)}</p>
                        ${diagnosis.notes ? `<p class="diagnosis-notes">${escapeHtml(diagnosis.notes)}</p>` : ''}
                    </div>
                </div>
            `).join('');
            return;
        }

        if (diagnosisSummary) {
            diagnosisSummary.textContent = 'No diagnosis recorded';
        }

        diagnosisList.innerHTML = '<p style="padding: 20px; color: #999;">No diagnoses recorded yet.</p>';
    } catch (error) {
        console.error('Error fetching diagnoses:', error);
        if (diagnosisSummary) {
            diagnosisSummary.textContent = 'No diagnosis recorded';
        }
        diagnosisList.innerHTML = '<p style="padding: 20px; color: #c00;">Error loading diagnoses.</p>';
    }
}

async function fetchPatientPrescriptions(patientId) {
    const prescriptionList = document.getElementById('prescriptionList');
    if (!prescriptionList) {
        return;
    }

    prescriptionList.innerHTML = '<p style="padding: 20px; color: #999;">Loading prescriptions...</p>';

    try {
        const response = await fetch(`../php/get_patient_prescriptions.php?patient_id=${encodeURIComponent(patientId)}&_=${Date.now()}`, {
            cache: 'no-store'
        });
        const data = await response.json();

        if (data.success && Array.isArray(data.prescriptions) && data.prescriptions.length > 0) {
            currentPatientPrescriptions = data.prescriptions;
            if (String(getSelectedPatient()?.id || '') === String(patientId)) {
                populateMedicineIntakePrescriptionOptions(data.prescriptions);
            }

            renderPrescriptionCards(data.prescriptions);
            return;
        }

        currentPatientPrescriptions = [];
        if (String(getSelectedPatient()?.id || '') === String(patientId)) {
            populateMedicineIntakePrescriptionOptions([], 'No prescribed medicines available');
        }

        renderPrescriptionCards([]);
    } catch (error) {
        console.error('Error fetching prescriptions:', error);
        currentPatientPrescriptions = [];
        if (String(getSelectedPatient()?.id || '') === String(patientId)) {
            populateMedicineIntakePrescriptionOptions([], 'Unable to load prescribed medicines');
        }
        prescriptionList.innerHTML = '<p style="padding: 20px; color: #c00;">Error loading prescriptions.</p>';
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
        const response = await fetch(`../php/get_patient_vitals.php?patient_id=${encodeURIComponent(patientId)}`, {
            cache: 'no-store'
        });
        const data = await response.json();

        if (data.success) {
            renderPatientVitals(data.vitals);
            return;
        }

        renderPatientVitals(null);
    } catch (error) {
        console.error('Error fetching vitals:', error);
        renderPatientVitals(null);
    }
}

async function fetchPatientExternalMedicine(patientId) {
    const externalMedicineTableBody = document.getElementById('externalMedicineTableBody');
    if (!externalMedicineTableBody) {
        return;
    }

    externalMedicineTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">Loading external medicine entries...</td></tr>';

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
            externalMedicineTableBody.innerHTML = data.records.map((record, index) => `
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

        externalMedicineTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No external medicine entries available.</td></tr>';
    } catch (error) {
        console.error('Error fetching external medicine:', error);
        externalMedicineTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #c00;">Error loading external medicine entries.</td></tr>';
    }
}

function updatePatientDetails(patientId) {
    const patient = getPatientById(patientId);
    if (!patient) {
        resetPatientDetails();
        return;
    }

    const fullName = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ');
    const patientName = document.querySelector('.patient-name-large');
    const patientDiagnosis = document.querySelector('.patient-diagnosis');
    const admissionValues = document.querySelectorAll('.admission-value');
    const personalRows = document.querySelectorAll('#patientInfoTab .personal-grid .personal-row');
    if (patientName) {
        patientName.textContent = fullName || patient.name;
    }

    if (patientDiagnosis) {
        patientDiagnosis.textContent = 'Loading diagnosis...';
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

    if (admissionValues.length >= 3) {
        admissionValues[0].textContent = formatDisplayDate(admissionDateTime);
        admissionValues[1].textContent = formatDisplayTime(admissionDateTime);
        admissionValues[2].textContent = attendingPhysician;
    }

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

    renderPatientBackground(null);

    fetchPatientDiagnoses(patient.id);
    fetchPatientMedicationIntake(patient.id);
    fetchPatientPrescriptions(patient.id);
    fetchPatientVitals(patient.id);
    fetchPatientExternalMedicine(patient.id);
    fetchPatientBackground(patient.id);
}

function getPrescriptionSubmitButton() {
    return document.querySelector('#addPrescriptionModal .btn-primary');
}

function resetPrescriptionModal() {
    editingPrescriptionId = null;

    const form = document.getElementById('prescriptionForm');
    if (form) {
        form.reset();
    }

    setDateInputValue('prescriptionDate');

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

let nurseSaveConfirmResolver = null;
let nurseSaveConfirmModalInstance = null;
let nurseSaveFeedbackModalInstance = null;

function getNurseSaveModalConfig(variant) {
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

function getNurseSaveConfirmModal() {
    const modalElement = document.getElementById('nurseSaveConfirmModal');
    if (!modalElement) {
        return null;
    }

    if (!nurseSaveConfirmModalInstance) {
        nurseSaveConfirmModalInstance = bootstrap.Modal.getOrCreateInstance(modalElement, {
            backdrop: 'static',
            keyboard: false
        });

        modalElement.addEventListener('hidden.bs.modal', () => {
            if (typeof nurseSaveConfirmResolver === 'function') {
                const resolve = nurseSaveConfirmResolver;
                nurseSaveConfirmResolver = null;
                resolve(false);
            }
        });
    }

    return nurseSaveConfirmModalInstance;
}

function getNurseSaveFeedbackModal() {
    const modalElement = document.getElementById('nurseSaveFeedbackModal');
    if (!modalElement) {
        return null;
    }

    if (!nurseSaveFeedbackModalInstance) {
        nurseSaveFeedbackModalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
    }

    return nurseSaveFeedbackModalInstance;
}

function showNurseSaveFeedback(message, title = 'Notice', variant = 'success') {
    const modal = getNurseSaveFeedbackModal();
    if (!modal) {
        return;
    }

    const config = getNurseSaveModalConfig(variant);
    const badge = document.getElementById('nurseSaveFeedbackBadge');
    const button = document.getElementById('nurseSaveFeedbackButton');

    document.getElementById('nurseSaveFeedbackTitle').textContent = title;
    document.getElementById('nurseSaveFeedbackMessage').textContent = message;

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

function showNurseSaveConfirm(message, title = 'Confirm Save', variant = 'primary', confirmLabel = 'Save') {
    const modal = getNurseSaveConfirmModal();
    if (!modal) {
        return Promise.resolve(false);
    }

    if (typeof nurseSaveConfirmResolver === 'function') {
        nurseSaveConfirmResolver(false);
        nurseSaveConfirmResolver = null;
    }

    const config = getNurseSaveModalConfig(variant);
    const badge = document.getElementById('nurseSaveConfirmBadge');
    const confirmButton = document.getElementById('nurseSaveConfirmButton');

    document.getElementById('nurseSaveConfirmTitle').textContent = title;
    document.getElementById('nurseSaveConfirmMessage').textContent = message;

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
        nurseSaveConfirmResolver = resolve;
    });
}

function resolveNurseSaveConfirm(result) {
    const modal = getNurseSaveConfirmModal();
    if (modal) {
        modal.hide();
    }

    if (typeof nurseSaveConfirmResolver === 'function') {
        const resolve = nurseSaveConfirmResolver;
        nurseSaveConfirmResolver = null;
        resolve(result);
    }
}

async function addDiagnosis() {
    const selectedPatient = getSelectedPatient();
    const date = document.getElementById('diagnosisDate').value;
    const title = document.getElementById('diagnosisTitle').value.trim();
    const notes = document.getElementById('diagnosisNotes').value.trim();

    if (!selectedPatient) {
        alert('Please select a patient first.');
        return;
    }

    if (!date || !title) {
        alert('Please fill in all required fields.');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('patient_id', selectedPatient.id);
        formData.append('diagnosis', title);
        formData.append('notes', notes);
        formData.append('date', date);

        const response = await fetch('../php/save_diagnosis.php', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to save diagnosis');
        }

        const diagnosisText = document.querySelector('.patient-diagnosis');
        if (diagnosisText) {
            diagnosisText.textContent = title;
        }

        await fetchPatientDiagnoses(selectedPatient.id);

        const modalElement = document.getElementById('addDiagnosisModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }

        document.getElementById('diagnosisForm').reset();
        setDateInputValue('diagnosisDate');
        alert('Diagnosis saved successfully!');
    } catch (error) {
        console.error('Error saving diagnosis:', error);
        alert(`Error saving diagnosis: ${error.message}`);
    }
}

async function addPrescription() {
    const selectedPatient = getSelectedPatient();
    if (!selectedPatient) {
        alert('Please select a patient first.');
        return;
    }

    const medicine = document.getElementById('prescriptionMedicine').value.trim();
    const dosage = document.getElementById('prescriptionDosage').value.trim();
    const frequency = document.getElementById('prescriptionFrequency').value.trim();
    const date = document.getElementById('prescriptionDate').value;
    const duration = document.getElementById('prescriptionDuration').value.trim();

    if (!medicine || !dosage || !frequency || !date || !duration) {
        alert('Please fill in all fields.');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('patient_id', selectedPatient.id);
        formData.append('medicine', medicine);
        formData.append('dosage', dosage);
        formData.append('frequency', frequency);
        formData.append('date', date);
        formData.append('duration', duration);

        const isEditing = Boolean(editingPrescriptionId);
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

        await fetchPatientPrescriptions(selectedPatient.id);

        const modalElement = document.getElementById('addPrescriptionModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }

        resetPrescriptionModal();
        alert(isEditing ? 'Prescription updated successfully!' : 'Prescription saved successfully!');
    } catch (error) {
        console.error('Error saving prescription:', error);
        alert(`Error saving prescription: ${error.message}`);
    }
}

async function deletePrescription(button) {
    const selectedPatient = getSelectedPatient();
    const row = button.closest('tr');
    const prescriptionId = row ? row.getAttribute('data-prescription-id') : '';

    if (!selectedPatient || !prescriptionId) {
        alert('Unable to delete this prescription.');
        return;
    }

    if (!confirm('Are you sure you want to delete this prescription?')) {
        return;
    }

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

        await fetchPatientPrescriptions(selectedPatient.id);
        alert('Prescription deleted successfully!');
    } catch (error) {
        console.error('Error deleting prescription:', error);
        alert(`Error deleting prescription: ${error.message}`);
    }
}

function editPrescription(button) {
    const row = button.closest('tr');
    if (!row) {
        return;
    }

    setPrescriptionModalForEdit(row);
    const modal = new bootstrap.Modal(document.getElementById('addPrescriptionModal'));
    modal.show();
}

async function addVitals() {
    const selectedPatient = getSelectedPatient();
    if (!selectedPatient) {
        showNurseSaveFeedback('Please select a patient first.', 'Select Patient', 'warning');
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
        showNurseSaveFeedback('Please fill in all vital fields before saving.', 'Missing Information', 'warning');
        return;
    }

    const shouldSave = await showNurseSaveConfirm(
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
        formData.append('patient_id', selectedPatient.id);
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

        await fetchPatientVitals(selectedPatient.id);

        const modalElement = document.getElementById('addVitalsModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }

        document.getElementById('vitalsForm').reset();
        setDateInputValue('vitalsDate');
        showNurseSaveFeedback('Vitals information was saved successfully.', 'Saved', 'success');
    } catch (error) {
        console.error('Error saving vitals:', error);
        showNurseSaveFeedback(error.message || 'Unable to save vitals information.', 'Save Failed', 'danger');
    }
}

async function saveMedicineIntake() {
    const selectedPatient = getSelectedPatient();
    const prescriptionSelect = document.getElementById('medicineIntakePrescription');
    const medicineDate = document.getElementById('medicineIntakeDate').value;
    const medicineTime = document.getElementById('medicineIntakeTime').value;
    const selectedOption = prescriptionSelect ? prescriptionSelect.options[prescriptionSelect.selectedIndex] : null;
    const medicineName = selectedOption?.dataset.medicine || '';
    const dosage = selectedOption?.dataset.dosage || '';
    const frequency = selectedOption?.dataset.frequency || '';
    const duration = selectedOption?.dataset.duration || '';

    if (!selectedPatient) {
        showNurseSaveFeedback('Please select a patient first.', 'Select Patient', 'warning');
        return;
    }

    if (!medicineName || !medicineDate || !medicineTime) {
        showNurseSaveFeedback('Please complete the prescribed medicine, date, and time fields.', 'Missing Information', 'warning');
        return;
    }

    const shouldSave = await showNurseSaveConfirm(
        'Are you sure you want to save this medicine intake information?',
        'Save Medicine Intake',
        'primary',
        'Save Intake'
    );

    if (!shouldSave) {
        return;
    }

    const dateAdministered = `${medicineDate} ${medicineTime.length === 5 ? `${medicineTime}:00` : medicineTime}`;
    const formData = new FormData();
    formData.append('patient_id', selectedPatient.id);
    formData.append('medicine', medicineName);
    formData.append('dosage', dosage);
    formData.append('frequency', frequency);
    formData.append('duration', duration);
    formData.append('date', medicineDate);
    formData.append('time', medicineTime);
    formData.append('date_administered', dateAdministered);

    const intakeList = document.getElementById('medicineIntakeList');
    if (!intakeList) {
        return;
    }

    try {
        const response = await fetch('../php/save_medication_intake.php', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to save medicine intake');
        }

        await fetchPatientMedicationIntake(selectedPatient.id);

        document.getElementById('medicineIntakeForm').reset();
        populateMedicineIntakePrescriptionOptions(currentPatientPrescriptions);
        setDateInputValue('medicineIntakeDate');
        setTimeInputValue('medicineIntakeTime');

        const modal = bootstrap.Modal.getInstance(document.getElementById('medicineIntakeModal'));
        if (modal) {
            modal.hide();
        }

        showNurseSaveFeedback('Medicine intake information was saved successfully.', 'Saved', 'success');
    } catch (error) {
        console.error('Error saving medicine intake:', error);
        showNurseSaveFeedback(error.message || 'Unable to save medicine intake information.', 'Save Failed', 'danger');
    }
}

function setupSearch() {
    const searchInput = document.getElementById('searchPatient');
    if (!searchInput) {
        return;
    }

    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();

        document.querySelectorAll('.patient-list-item[data-patient-id]').forEach(item => {
            const patientName = (item.getAttribute('data-patient-name') || '').toLowerCase();
            const patientId = (item.getAttribute('data-patient-id') || '').toLowerCase();
            const isMatch = !searchTerm || patientName.includes(searchTerm) || patientId.includes(searchTerm);

            item.style.display = isMatch ? 'flex' : 'none';
        });
    });
}

function setupTabs() {
    document.querySelectorAll('.tab-link').forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();

            document.querySelectorAll('.tab-item').forEach(item => item.classList.remove('active'));
            this.closest('.tab-item').classList.add('active');

            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            const tabText = this.textContent.trim();
            if (tabText === 'Patient Info') {
                document.getElementById('patientInfoTab').classList.add('active');
            } else if (tabText === 'Prescription') {
                document.getElementById('prescriptionTab').classList.add('active');
            } else if (tabText === 'External Medicine') {
                document.getElementById('externalMedicineTab').classList.add('active');
            }
        });
    });
}

function setupSidebarNav() {
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
        link.addEventListener('click', function(event) {
            if (this.getAttribute('href') === '#') {
                event.preventDefault();
            }
        });
    });
}

function setupMedicineIntakeModal() {
    const addMedicineButton = document.getElementById('addMedicineIntakeBtn');
    if (addMedicineButton) {
        addMedicineButton.addEventListener('click', async function() {
            const selectedPatient = getSelectedPatient();
            if (!selectedPatient) {
                showNurseSaveFeedback('Please select a patient first.', 'Select Patient', 'warning');
                return;
            }

            await fetchPatientPrescriptions(selectedPatient.id);

            if (!currentPatientPrescriptions.length) {
                showNurseSaveFeedback('No prescribed medicines are available for this patient yet.', 'No Prescriptions', 'warning');
                return;
            }

            document.getElementById('medicineIntakeForm').reset();
            populateMedicineIntakePrescriptionOptions(currentPatientPrescriptions);
            setDateInputValue('medicineIntakeDate');
            setTimeInputValue('medicineIntakeTime');

            const modal = new bootstrap.Modal(document.getElementById('medicineIntakeModal'));
            modal.show();
        });
    }

    populateMedicineIntakePrescriptionOptions([], 'Select a patient first');
    setDateInputValue('medicineIntakeDate');
    setTimeInputValue('medicineIntakeTime');
}

function setupDefaults() {
    setDateInputValue('diagnosisDate');
    setDateInputValue('prescriptionDate');
    setDateInputValue('vitalsDate');

    const prescriptionModalElement = document.getElementById('addPrescriptionModal');
    if (prescriptionModalElement) {
        prescriptionModalElement.addEventListener('hidden.bs.modal', resetPrescriptionModal);
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    initMedicineIntakeHistoryControls();
    setupSidebarNav();
    setupTabs();
    setupSearch();
    setupMedicineIntakeModal();
    setupDefaults();
    resetPatientDetails();

    await loadUserInfo();
    await loadPatientsFromDatabase();
});
