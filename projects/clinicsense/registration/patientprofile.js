const state = {
    patients: [],
    selectedPatientId: null
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeText(value, fallback = 'Not recorded') {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : fallback;
}

function formatDisplayDate(value) {
    if (!value) {
        return 'Not recorded';
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return String(value);
    }

    return parsedDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatDisplayTime(value) {
    if (!value) {
        return 'Not recorded';
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return String(value);
    }

    return parsedDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).replace('12:00 PM', '12:00 NN');
}

function formatCurrencyPhp(amount) {
    const numericValue = Number(amount);
    if (Number.isNaN(numericValue)) {
        return 'Php 0.00';
    }
    return 'Php ' + numericValue.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function getSavedRunningBill(patientId) {
    if (!patientId) {
        return null;
    }
    try {
        const stored = localStorage.getItem(`runningBill:${patientId}`);
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        return null;
    }
}

function getDaysBetween(startValue, endValue) {
    if (!startValue) {
        return 0;
    }
    const start = new Date(startValue);
    if (Number.isNaN(start.getTime())) {
        return 0;
    }
    const end = endValue ? new Date(endValue) : new Date();
    if (Number.isNaN(end.getTime())) {
        return 0;
    }
    const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (endDate < startDate) {
        return 0;
    }
    const diffMs = endDate.getTime() - startDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function buildRunningBillDetailHtml(bill, patient, saved) {
    const status = String(bill?.Status || 'Unpaid').toLowerCase();
    const totalAmount = bill?.Amount ? Number(bill.Amount) : 0;
    const totalLabel = status === 'paid' ? 'Total Bill' : 'Total running bill';

    if (!saved) {
        return `
            <div class="bill-summary-card">
                <div class="bill-summary-line">
                    <span>${totalLabel}</span>
                    <strong>${formatCurrencyPhp(totalAmount)}</strong>
                </div>
            </div>
        `;
    }

    const roomType = String(saved.roomType || 'Private').toLowerCase();
    const roomRate = roomType === 'ward' ? 800 : 1000;
    const foodRate = 350;
    const miscDaily = 2500 / 30;
    const days = getDaysBetween(patient?.admissionDateTime, bill?.Date);
    const roomTotal = roomRate * days;
    const foodTotal = foodRate * days;
    const miscTotal = miscDaily * days;

    const doctorVisits = Array.isArray(saved.doctorVisits) ? saved.doctorVisits.length : 0;
    const doctorTotal = doctorVisits * 1000;

    const pharmacyTotal = Array.isArray(saved.pharmacyItems)
        ? saved.pharmacyItems.reduce((sum, item) => {
            const qty = Number(item?.quantity) || 0;
            const price = Number(item?.salePrice) || 0;
            return sum + qty * price;
        }, 0)
        : 0;

    const computedTotal = roomTotal + foodTotal + miscTotal + doctorTotal + pharmacyTotal;
    const displayTotal = Number.isFinite(saved.totalAmount) && saved.totalAmount > 0
        ? saved.totalAmount
        : computedTotal;

    return `
        <div class="bill-summary-card bill-summary-card--breakdown">
            <div class="bill-summary-list">
                <div class="bill-summary-item"><span>Room fee</span><strong>${formatCurrencyPhp(roomTotal)}</strong></div>
                <div class="bill-summary-item"><span>Food fee</span><strong>${formatCurrencyPhp(foodTotal)}</strong></div>
                <div class="bill-summary-item"><span>Miscellaneous</span><strong>${formatCurrencyPhp(miscTotal)}</strong></div>
                <div class="bill-summary-item"><span>Doctor's fee</span><strong>${formatCurrencyPhp(doctorTotal)}</strong></div>
                <div class="bill-summary-item"><span>Pharmacy</span><strong>${formatCurrencyPhp(pharmacyTotal)}</strong></div>
            </div>
            <div class="bill-summary-divider"></div>
            <div class="bill-summary-line">
                <span>${totalLabel}</span>
                <strong>${formatCurrencyPhp(displayTotal)}</strong>
            </div>
        </div>
    `;
}

function formatMonthLabel(value) {
    if (!value) {
        return 'Not recorded';
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
        return String(value);
    }

    return parsedDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });
}

function setTextContent(id, value, fallback = 'Not recorded') {
    const element = document.getElementById(id);
    if (!element) {
        return;
    }

    element.textContent = normalizeText(value, fallback);
}

function getSelectedPatient() {
    return state.patients.find(patient => String(patient.id) === String(state.selectedPatientId)) || null;
}

function showPageStatus(message, isError = false) {
    const statusCard = document.getElementById('pageStatusCard');
    const statusMessage = document.getElementById('pageStatusMessage');
    const patientContent = document.getElementById('patientContent');

    if (statusCard) {
        statusCard.hidden = false;
        statusCard.classList.toggle('status-error-card', isError);
    }

    if (statusMessage) {
        statusMessage.textContent = message;
    }

    if (patientContent) {
        patientContent.hidden = true;
    }
}

function hidePageStatus() {
    const statusCard = document.getElementById('pageStatusCard');
    if (statusCard) {
        statusCard.hidden = true;
        statusCard.classList.remove('status-error-card');
    }
}

function populatePatientSelector() {
    const switcherCard = document.getElementById('patientSwitcherCard');
    const selector = document.getElementById('patientSelector');

    if (!switcherCard || !selector) {
        return;
    }

    if (state.patients.length <= 1) {
        switcherCard.hidden = true;
        selector.innerHTML = '';
        return;
    }

    selector.innerHTML = state.patients.map(patient => `
        <option value="${escapeHtml(patient.id)}">${escapeHtml(patient.fullName || 'Patient')}</option>
    `).join('');
    selector.value = String(state.selectedPatientId ?? state.patients[0].id);
    switcherCard.hidden = false;
}

function renderPatientHeader(patient) {
    const nameElement = document.getElementById('patientNameLarge');
    const primaryName = [patient.firstName, patient.middleName].filter(Boolean).join(' ').trim();
    const secondaryName = patient.lastName || '';

    if (nameElement) {
        if (secondaryName) {
            nameElement.innerHTML = `
                <span class="name-line">${escapeHtml(primaryName || patient.fullName || 'Patient')}</span>
                <span class="name-line">${escapeHtml(secondaryName)}</span>
            `;
        } else {
            nameElement.innerHTML = `<span class="name-line">${escapeHtml(patient.fullName || 'Patient')}</span>`;
        }
    }

    setTextContent('patientDiagnosisSummary', patient.primaryDiagnosis || 'No diagnosis recorded', 'No diagnosis recorded');
    setTextContent('admissionDateValue', formatDisplayDate(patient.admissionDateTime), 'Not recorded');
    setTextContent('admissionTimeValue', formatDisplayTime(patient.admissionDateTime), 'Not recorded');
    setTextContent('attendingPhysicianValue', patient.attendingPhysician || 'Doctor on record', 'Doctor on record');
}

function renderPersonalInfo(patient) {
    setTextContent('personalBirthdate', formatDisplayDate(patient.birthdate), 'Not specified');
    setTextContent('personalAge', patient.age ? `${patient.age} years old` : 'Not specified', 'Not specified');
    setTextContent('personalSex', patient.sex, 'Not specified');
    setTextContent('personalCivilStatus', patient.civilStatus, 'Not specified');
    setTextContent('personalAddress', patient.address, 'Not specified');
    setTextContent('personalReligion', patient.religion, 'Not specified');
    setTextContent('personalHobbies', patient.hobbies, 'Not specified');
    setTextContent('personalPreviousOccupation', patient.previousOccupation, 'Not specified');
}

function renderDiagnoses(diagnoses) {
    const container = document.getElementById('diagnosesContainer');
    if (!container) {
        return;
    }

    if (!Array.isArray(diagnoses) || diagnoses.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="info-empty">No diagnoses recorded for this patient.</p></div>';
        return;
    }

    container.innerHTML = diagnoses.map(diagnosis => `
        <div class="col-md-6">
            <div class="diagnosis-card">
                <div class="diagnosis-date">${escapeHtml(diagnosis.dateLabel || 'Not recorded')}</div>
                <h6 class="diagnosis-title">${escapeHtml(diagnosis.diagnosis || 'Not specified')}</h6>
                <p class="diagnosis-doctor">${escapeHtml(diagnosis.doctor || 'Doctor on record')}</p>
                ${diagnosis.notes ? `<p class="diagnosis-notes">${escapeHtml(diagnosis.notes)}</p>` : ''}
            </div>
        </div>
    `).join('');
}

function renderVitals(vitals) {
    setTextContent('vitalBP', vitals?.bloodPressure, 'Not recorded');
    setTextContent('vitalPulse', vitals?.pulseRate, 'Not recorded');
    setTextContent('vitalTemp', vitals?.temperature, 'Not recorded');
    setTextContent('vitalWeight', vitals?.weight, 'Not recorded');
    setTextContent('vitalHeight', vitals?.height, 'Not recorded');
    setTextContent('vitalRespiratory', vitals?.respiratoryRate, 'Not recorded');
    setTextContent('vitalO2', vitals?.oxygenSaturation, 'Not recorded');
    setTextContent('vitalLastUpdated', vitals?.lastUpdatedLabel, 'Not recorded');
}

function renderBackground(background) {
    const mentalStatusList = document.getElementById('mentalStatusList');
    const observations = background?.observations || [];
    const medicalHistory = background?.medicalHistory || null;
    const familyHistory = background?.familyHistory || null;

    if (mentalStatusList) {
        if (!Array.isArray(observations) || observations.length === 0) {
            mentalStatusList.innerHTML = '<li class="mental-status-empty">No observations recorded.</li>';
        } else {
            mentalStatusList.innerHTML = observations.map(entry => `
                <li class="mental-status-entry">
                    <span class="mental-status-text">${escapeHtml(entry.observation || 'No observation details')}</span>
                    <span class="mental-status-date">${escapeHtml(entry.observationDateLabel || 'Not recorded')}</span>
                </li>
            `).join('');
        }
    }

    setTextContent('chronicConditionValue', medicalHistory?.chronicCondition, 'Not specified');
    setTextContent('psychiatricConditionValue', medicalHistory?.psychiatricCondition, 'None reported');
    setTextContent('foodAllergyValue', medicalHistory?.foodAllergy, 'None reported');
    setTextContent('medicalAllergyValue', medicalHistory?.medicalAllergy, 'None reported');

    setTextContent('familyPsychPaternal', familyHistory?.paternalPsych, 'None reported');
    setTextContent('familyPsychMaternal', familyHistory?.maternalPsych, 'None reported');
    setTextContent('familyMedicalPaternal', familyHistory?.paternalMed, 'None reported');
    setTextContent('familyMedicalMaternal', familyHistory?.maternalMed, 'None reported');
}

function renderMedicationIntake(entries) {
    const container = document.getElementById('medicineIntakeList');
    if (!container) {
        return;
    }

    if (!Array.isArray(entries) || entries.length === 0) {
        container.innerHTML = '<p class="info-empty">No medicine intake entries recorded for this patient.</p>';
        return;
    }

    container.innerHTML = entries.map(entry => `
        <div class="medicine-intake-card">
            <h6 class="medicine-name">${escapeHtml(entry.medicine || 'Unnamed medicine')}</h6>
            <p class="medicine-nurse">${escapeHtml(entry.administeredByName || 'Staff on record')}</p>
            <p class="medicine-date">${escapeHtml(entry.dateAdministeredLabel || 'Not recorded')}</p>
            <p class="medicine-date">Dosage: ${escapeHtml(entry.dosage || 'Not recorded')}</p>
        </div>
    `).join('');
}

function renderPrescriptions(entries) {
    const tableBody = document.getElementById('prescriptionTableBody');
    if (!tableBody) {
        return;
    }

    if (!Array.isArray(entries) || entries.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="table-empty-cell">No prescriptions recorded for this patient.</td></tr>';
        return;
    }

    tableBody.innerHTML = entries.map(entry => `
        <tr>
            <td>${escapeHtml(entry.prescribedByName || 'Doctor on record')}</td>
            <td>${escapeHtml(entry.medicine || 'Unnamed prescription')}</td>
            <td>${escapeHtml(entry.dosage || 'N/A')}</td>
            <td>${escapeHtml(entry.frequency || 'N/A')}</td>
            <td>${escapeHtml(entry.dateLabel || 'Not recorded')}</td>
            <td>${escapeHtml(entry.duration || 'Not specified')}</td>
        </tr>
    `).join('');
}

function renderTableRows(tableBodyId, rows, columns, emptyMessage) {
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) {
        return;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${columns}" class="table-empty-cell">${escapeHtml(emptyMessage)}</td></tr>`;
        return;
    }

    tableBody.innerHTML = rows.join('');
}

function renderExternalMedicine(entries) {
    renderTableRows(
        'externalMedicineTableBody',
        (entries || []).map((entry, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(entry.dateLabel || 'Not recorded')}</td>
                <td>${escapeHtml(entry.medicine || 'N/A')}</td>
                <td>${escapeHtml(entry.quantity || 'N/A')}</td>
                <td>${escapeHtml(entry.receivedBy || '')}</td>
                <td>${escapeHtml(entry.sentBy || '')}</td>
            </tr>
        `),
        6,
        'No external medicine entries available.'
    );
}

function renderBelongings(entries) {
    renderTableRows(
        'belongingsTableBody',
        (entries || []).map((entry, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(entry.dateLabel || 'Not recorded')}</td>
                <td>${escapeHtml(entry.item || 'N/A')}</td>
                <td>${escapeHtml(entry.quantity || 'N/A')}</td>
                <td>${escapeHtml(entry.receivedBy || '')}</td>
                <td>${escapeHtml(entry.sentBy || '')}</td>
            </tr>
        `),
        6,
        'No belongings records available.'
    );
}

function renderBillingBalance(unpaidBalance) {
    const label = document.getElementById('guardianBalanceLabel');
    const amount = document.getElementById('guardianBalanceAmount');
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    if (label) {
        label.textContent = `Balance as of ${today}:`;
    }
    if (amount) {
        amount.textContent = formatCurrencyPhp(unpaidBalance ?? 0);
    }
}

function renderBillingTable(bills) {
    const tableBody = document.getElementById('guardianBillingTableBody');
    if (!tableBody) {
        return;
    }

    if (!Array.isArray(bills) || bills.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">No payment records found</td></tr>';
        return;
    }

    const patient = getSelectedPatient();
    const savedRunningBill = getSavedRunningBill(state.selectedPatientId);

    tableBody.innerHTML = bills.map((bill, index) => {
        const status = escapeHtml((bill.Status || 'Unpaid').toString());
        const statusClass = status.toLowerCase() === 'paid' ? 'status-paid' : 'status-unpaid';
        const total = bill.Amount ? formatCurrencyPhp(bill.Amount) : 'Php 0.00';
        const dueDate = formatDisplayDate(bill.Date);
        const monthLabel = formatMonthLabel(bill.Date);
        const detailHtml = buildRunningBillDetailHtml(bill, patient, savedRunningBill);

        return `
            <tr class="bill-row" data-bill-index="${index}">
                <td>${escapeHtml(monthLabel)}</td>
                <td>${escapeHtml(dueDate)}</td>
                <td>${total}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
            </tr>
            <tr class="bill-detail-row" data-bill-detail="${index}" hidden>
                <td colspan="4" class="bill-detail-cell">
                    ${detailHtml}
                </td>
            </tr>
        `;
    }).join('');
}

async function fetchPatientBilling(patientId) {
    const tableBody = document.getElementById('guardianBillingTableBody');
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Loading billing records...</td></tr>';
    }

    try {
        const response = await fetch(`../php/get_billing_details.php?patient_id=${encodeURIComponent(patientId)}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.success) {
            renderBillingBalance(0);
            renderBillingTable([]);
            return;
        }

        renderBillingBalance(data.unpaidBalance ?? 0);
        renderBillingTable(data.bills || []);
    } catch (error) {
        console.error('Error loading guardian billing details:', error);
        renderBillingBalance(0);
        renderBillingTable([]);
    }
}

function renderVisitors(entries) {
    renderTableRows(
        'visitorsTableBody',
        (entries || []).map(entry => `
            <tr>
                <td>${escapeHtml(entry.time || 'Not recorded')}</td>
                <td>${escapeHtml(entry.dateLabel || 'Not recorded')}</td>
                <td>${escapeHtml(entry.name || 'N/A')}</td>
                <td>${escapeHtml(entry.relationship || 'N/A')}</td>
            </tr>
        `),
        4,
        'No visitor records available.'
    );
}

function renderPatient(patient) {
    const patientContent = document.getElementById('patientContent');
    if (!patient) {
        showPageStatus('No admitted patient record is linked to this account.');
        return;
    }

    state.selectedPatientId = patient.id;
    if (patientContent) {
        patientContent.hidden = false;
    }

    const selector = document.getElementById('patientSelector');
    if (selector) {
        selector.value = String(patient.id);
    }

    hidePageStatus();
    renderPatientHeader(patient);
    renderPersonalInfo(patient);
    renderDiagnoses(patient.diagnoses || []);
    renderVitals(patient.vitals || null);
    renderBackground(patient.background || null);
    renderMedicationIntake(patient.medicationIntake || []);
    renderPrescriptions(patient.prescriptions || []);
    renderExternalMedicine(patient.externalMedicine || []);
    renderBelongings(patient.belongings || []);
    renderVisitors(patient.visitors || []);
}

async function loadUserInfo() {
    try {
        const response = await fetch('../php/get_user.php', { cache: 'no-store' });
        const data = await response.json();

        if (data.success && data.user) {
            const fullName = [data.user.firstname, data.user.lastname].filter(Boolean).join(' ').trim();
            setTextContent('headerName', fullName || 'Guardian', 'Guardian');
        }
    } catch (error) {
        console.error('Error loading guardian info:', error);
    }
}

async function loadPatientFile() {
    showPageStatus('Loading patient file...');

    try {
        const response = await fetch('../php/get_guardian_patient_file.php', {
            cache: 'no-store',
            credentials: 'include'
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
            showPageStatus(data.message || 'Unable to load the patient file right now.', true);
            return;
        }

        state.patients = Array.isArray(data.patients) ? data.patients : [];

        if (state.patients.length === 0) {
            showPageStatus('No admitted patient record is linked to this account.');
            return;
        }

        state.selectedPatientId = state.patients[0].id;
        populatePatientSelector();
        renderPatient(state.patients[0]);
        await fetchPatientBilling(state.selectedPatientId);
    } catch (error) {
        console.error('Error loading guardian patient file:', error);
        showPageStatus('Unable to load the patient file right now.', true);
    }
}

function bindEvents() {
    document.getElementById('backBtn')?.addEventListener('click', function () {
        window.history.back();
    });

    document.getElementById('patientSelector')?.addEventListener('change', async function (event) {
        const patient = state.patients.find(item => String(item.id) === String(event.target.value));
        renderPatient(patient || null);
        if (patient) {
            await fetchPatientBilling(patient.id);
        }
    });

    document.querySelectorAll('.tab-link').forEach(link => {
        link.addEventListener('click', function (event) {
            event.preventDefault();

            document.querySelectorAll('.tab-item').forEach(item => item.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            this.closest('.tab-item')?.classList.add('active');
            const targetId = this.getAttribute('data-tab-target');
            if (targetId) {
                document.getElementById(targetId)?.classList.add('active');
            }
        });
    });

    document.getElementById('guardianBillingTableBody')?.addEventListener('click', function (event) {
        const row = event.target.closest('tr.bill-row');
        if (!row) {
            return;
        }

        const index = row.getAttribute('data-bill-index');
        if (index === null) {
            return;
        }

        const detailRow = document.querySelector(`tr.bill-detail-row[data-bill-detail="${index}"]`);
        if (!detailRow) {
            return;
        }

        document.querySelectorAll('tr.bill-detail-row').forEach((item) => {
            if (item !== detailRow) {
                item.setAttribute('hidden', '');
            }
        });

        if (detailRow.hasAttribute('hidden')) {
            detailRow.removeAttribute('hidden');
        } else {
            detailRow.setAttribute('hidden', '');
        }
    });

    document.addEventListener('click', function (event) {
        const userMenuWrapper = document.querySelector('.user-menu-wrapper');
        const dropdown = document.getElementById('userDropdown');

        if (userMenuWrapper && dropdown && !userMenuWrapper.contains(event.target)) {
            dropdown.classList.remove('active');
        }
    });
}

function toggleUserMenu(event) {
    event.preventDefault();
    document.getElementById('userDropdown')?.classList.toggle('active');
}

window.toggleUserMenu = toggleUserMenu;

document.addEventListener('DOMContentLoaded', async function () {
    bindEvents();

    if (typeof initLogout === 'function') {
        initLogout();
    }

    if (typeof attachLogoutLinkHandlers === 'function') {
        attachLogoutLinkHandlers();
    }

    await loadUserInfo();
    await loadPatientFile();
});