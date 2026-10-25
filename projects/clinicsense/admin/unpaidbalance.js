// =====================
// STATE
// =====================
let balanceData       = [];
const pendingStatuses = ['Pending', 'Partial'];
const overdueStatus   = 'Overdue';
let activeFilterStatus = 'All';
let currentEditId      = null;
let patientRecords     = [];

const ADD_PATIENT_SELECT_ID   = 'patientNameSelect';
const EDIT_PATIENT_SELECT_ID  = 'editPatientNameSelect';
const ADD_PATIENT_TYPE_ID     = 'patientTypeSelect';
const EDIT_PATIENT_TYPE_ID    = 'editPatientTypeSelect';
const ADD_ADMISSION_GROUP_ID  = 'admissionDateGroup';
const EDIT_ADMISSION_GROUP_ID = 'editAdmissionDateGroup';
const ADD_ADMISSION_INPUT_ID  = 'admissionDate';
const EDIT_ADMISSION_INPUT_ID = 'editAdmissionDate';

const PatientTypes      = { INPATIENT: 'Inpatient', OUTPATIENT: 'Outpatient' };
const DefaultPatientType = PatientTypes.INPATIENT;
const typeSelectIgnore   = new Set();

const filterBtn          = document.getElementById('filterBtn');
const filterPopover      = document.getElementById('filterPopover');
const filterWrapper      = document.querySelector('.filter-wrapper');
const balanceSummaryEl   = document.getElementById('balanceSummary');
const filterLabelEl      = document.getElementById('currentFilterLabel');
const backBtn            = document.querySelector('.back-btn');
const pendingAmountEl    = document.getElementById('pendingAmount');
const overdueAmountEl    = document.getElementById('overdueAmount');
const totalOutstandingEl = document.getElementById('totalOutstanding');
const overdueCountEl     = document.getElementById('overdueCount');
const pendingCountEl     = document.getElementById('pendingCount');
const totalBillLabel     = document.querySelector('label[for="totalBill"]');
const totalBillHintEl    = document.getElementById('totalBillHint');
const balanceAfterPaymentEl = document.getElementById('balanceAfterPayment');
const totalBillInput     = document.getElementById('totalBill');
const paidAmountInput    = document.getElementById('paidAmount');

// =====================
// LOAD FROM DATABASE
// =====================
async function loadBalancesFromDB() {
    try {
        const response = await fetch('../php/get_unpaid_balance.php');
        const result   = await response.json();

        if (!result.success) {
            console.error('Failed to load balances:', result.message);
            return;
        }

        // Map unpaid bills from patientbill table
        const unpaidBills = (result.unpaidBills || []).map(bill => ({
            id:            bill.Bill_ID,
            patientId:     String(bill.Patient_ID),
            patientName:   bill.PatientName || 'Unknown Patient',
            patientType:   PatientTypes.INPATIENT,
            admissionDate: bill.AdmissionDate
                ? new Date(bill.AdmissionDate).toISOString().split('T')[0]
                : '',
            serviceType:   'Patient Bill',
            totalBill:     parseFloat(bill.Amount) || 0,
            paidAmount:    0,
            status:        'Pending',
            source:        'patientbill'
        }));

        // Map from balance table
        const balanceRecords = (result.balances || []).map(b => ({
            id:            b.Balance_ID,
            patientId:     '',
            patientName:   b.Name || 'Unknown',
            patientType:   PatientTypes.INPATIENT,
            admissionDate: b.DueDate
                ? new Date(b.DueDate).toISOString().split('T')[0]
                : '',
            serviceType:   'Outstanding Balance',
            totalBill:     parseFloat(b.Amount) || 0,
            paidAmount:    0,
            status:        'Overdue',
            source:        'balance'
        }));

        balanceData = [...unpaidBills, ...balanceRecords];

        refreshTable();

    } catch (error) {
        console.error('Error loading balances:', error);
    }
}

// =====================
// SAVE TO DATABASE
// =====================
async function saveBalanceToDB(data) {
    try {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => formData.append(key, value));

        const response = await fetch('../php/save_balance.php', {
            method: 'POST',
            body:   formData
        });
        return await response.json();
    } catch (error) {
        console.error('Error saving balance:', error);
        return { success: false, message: error.message };
    }
}

async function updateBalanceToDB(data) {
    try {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => formData.append(key, value));

        const response = await fetch('../php/update_balance.php', {
            method: 'POST',
            body:   formData
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating balance:', error);
        return { success: false, message: error.message };
    }
}

async function deleteBalanceFromDB(id, source) {
    try {
        const formData = new FormData();
        formData.append('id',     id);
        formData.append('source', source);

        const response = await fetch('../php/delete_balance.php', {
            method: 'POST',
            body:   formData
        });
        return await response.json();
    } catch (error) {
        console.error('Error deleting balance:', error);
        return { success: false, message: error.message };
    }
}

// =====================
// HELPERS
// =====================
function formatCurrency(amount) {
    return '₱' + Number(amount).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

function calculateBalance(totalBill, paidAmount) {
    return Math.max(totalBill - paidAmount, 0);
}

function getStatusClass(status) {
    const map = { Overdue: 'status-overdue', Pending: 'status-pending', Partial: 'status-partial' };
    return map[status] || 'status-pending';
}

function normalizeDateForInput(rawValue) {
    if (!rawValue) return '';
    const normalized = String(rawValue).trim();
    if (!normalized) return '';
    const datePart = normalized.split(' ')[0];
    const parsed   = new Date(datePart);
    return !isNaN(parsed) ? parsed.toISOString().split('T')[0] : datePart;
}

function determinePatientType(patient) {
    if (!patient) return DefaultPatientType;
    const hasAdmission = Boolean(
        patient.admissionDate || patient.admissionDateTime || patient.Admission_DateTime
    );
    return hasAdmission ? PatientTypes.INPATIENT : PatientTypes.OUTPATIENT;
}

function getPatientTypeFromRecord(patient) {
    return patient.patientType || determinePatientType(patient);
}

function getPatientTypeById(id) {
    if (!id) return null;
    const match = patientRecords.find(p => String(p.id) === String(id));
    return match ? getPatientTypeFromRecord(match) : null;
}

function getOutstandingForPatient(patientId) {
    if (!patientId) return 0;
    const record = balanceData.find(e => String(e.patientId) === String(patientId));
    return record ? calculateBalance(record.totalBill, record.paidAmount) : 0;
}

function getPatientsByType(type) {
    if (!type) return patientRecords;
    return patientRecords.filter(p => getPatientTypeFromRecord(p) === type);
}

function createPatientOption(patient) {
    const option       = document.createElement('option');
    option.value       = String(patient.id);
    const displayName  = patient.name || `${patient.lastName || ''}, ${patient.firstName || ''}`.trim();
    option.textContent = displayName || 'Unknown Patient';
    option.dataset.patientName     = option.textContent;
    option.dataset.patientId       = String(patient.id);
    option.dataset.patientType     = getPatientTypeFromRecord(patient);
    const admDate = normalizeDateForInput(
        patient.admissionDate || patient.admissionDateTime || patient.Admission_DateTime
    );
    if (admDate) option.dataset.admissionDate = admDate;
    return option;
}

function updateAddTotalBillContext(patient) {
    const outstanding    = patient?.id ? getOutstandingForPatient(patient.id) : 0;
    const hasOutstanding = outstanding > 0;
    if (totalBillLabel)  totalBillLabel.textContent  = hasOutstanding ? 'Balance (₱)' : 'Total bill (₱)';
    if (totalBillHintEl) totalBillHintEl.textContent = hasOutstanding
        ? `Current outstanding balance: ${formatCurrency(outstanding)}`
        : 'Enter the patient\'s total bill.';
    if (!hasOutstanding && totalBillInput) totalBillInput.value = '';
    updatePaymentPreview();
}

function ensurePatientOption(select, value, label, fallback = false, patientType = DefaultPatientType, admissionDate = '') {
    if (!value) return null;
    let option = Array.from(select.options).find(opt => opt.value === value);
    if (!option) { option = document.createElement('option'); select.appendChild(option); }
    option.value              = value;
    option.textContent        = label;
    option.dataset.patientName = label;
    option.dataset.patientId   = value;
    option.dataset.patientType = patientType;
    if (admissionDate) option.dataset.admissionDate = admissionDate;
    else delete option.dataset.admissionDate;
    if (fallback) option.dataset.legacy = 'true';
    else delete option.dataset.legacy;
    return option;
}

function updatePaymentPreview() {
    if (!totalBillInput || !balanceAfterPaymentEl) return;
    const total     = parseFloat(totalBillInput.value) || 0;
    const paid      = parseFloat(paidAmountInput?.value || 0) || 0;
    if (!total && !paid) { balanceAfterPaymentEl.textContent = ''; return; }
    const remaining = Math.max(total - paid, 0);
    balanceAfterPaymentEl.textContent = remaining > 0
        ? `Balance after payment: ${formatCurrency(remaining)}`
        : 'No balance remains once the payment is applied.';
}

function populatePatientDropdown(selectId, patientType = DefaultPatientType, selectedValue = '', fallbackLabel = '', fallbackType = DefaultPatientType, fallbackAdmissionDate = '') {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '';
    const placeholder       = document.createElement('option');
    placeholder.value       = '';
    placeholder.textContent = 'Select patient';
    select.appendChild(placeholder);
    getPatientsByType(patientType).forEach(p => select.appendChild(createPatientOption(p)));
    if (selectedValue) {
        const hasMatch = Array.from(select.options).some(opt => opt.value === selectedValue);
        if (!hasMatch && fallbackLabel) {
            const fallbackOpt = ensurePatientOption(select, selectedValue, fallbackLabel, true, fallbackType, fallbackAdmissionDate);
            if (fallbackOpt) fallbackOpt.selected = true;
        } else {
            select.value = selectedValue;
        }
    } else {
        select.value = '';
    }
}

function getPatientTypeSelectValue(selectId, fallback = DefaultPatientType) {
    return document.getElementById(selectId)?.value || fallback;
}

function getSelectedPatientDetails(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return null;
    const option = select.options[select.selectedIndex];
    if (!option || !option.value) return null;
    return {
        id:            option.dataset.patientId   || option.value,
        name:          option.dataset.patientName || option.textContent.trim(),
        patientType:   option.dataset.patientType || getPatientTypeSelectValue(selectId),
        admissionDate: option.dataset.admissionDate || '',
        isLegacy:      option.dataset.legacy === 'true'
    };
}

function setTypeSelectValue(typeSelectId, value) {
    const typeSelect = document.getElementById(typeSelectId);
    if (!typeSelect || !value) return;
    typeSelectIgnore.add(typeSelectId);
    typeSelect.value = value;
    setTimeout(() => typeSelectIgnore.delete(typeSelectId), 0);
}

function toggleAdmissionField(typeSelectId, groupId, inputId, forcedDate = '') {
    const typeSelect = document.getElementById(typeSelectId);
    const group      = document.getElementById(groupId);
    const input      = document.getElementById(inputId);
    if (!typeSelect || !group || !input) return;
    const shouldShow   = typeSelect.value === PatientTypes.INPATIENT;
    group.style.display = shouldShow ? '' : 'none';
    input.required      = shouldShow;
    if (shouldShow && forcedDate) input.value = forcedDate;
    else if (!shouldShow) input.value = '';
}

function handlePatientSelection(patientSelectId, typeSelectId, groupId, inputId) {
    const patient = getSelectedPatientDetails(patientSelectId);
    if (patient?.patientType) setTypeSelectValue(typeSelectId, patient.patientType);
    toggleAdmissionField(typeSelectId, groupId, inputId, patient?.admissionDate || '');
    if (patientSelectId === ADD_PATIENT_SELECT_ID) updateAddTotalBillContext(patient);
}

function attachPatientSelectHandler(selectId, typeSelectId, groupId, inputId) {
    document.getElementById(selectId)?.addEventListener('change', () =>
        handlePatientSelection(selectId, typeSelectId, groupId, inputId)
    );
}

function attachPatientTypeHandler(typeSelectId, patientSelectId, groupId, inputId) {
    document.getElementById(typeSelectId)?.addEventListener('change', () => {
        if (typeSelectIgnore.has(typeSelectId)) { typeSelectIgnore.delete(typeSelectId); return; }
        populatePatientDropdown(patientSelectId, getPatientTypeSelectValue(typeSelectId));
        toggleAdmissionField(typeSelectId, groupId, inputId);
    });
}

function resolveBalancePatientType(balance) {
    if (!balance) return DefaultPatientType;
    if (balance.patientType) return balance.patientType;
    if (balance.patientId) return getPatientTypeById(balance.patientId) || DefaultPatientType;
    return DefaultPatientType;
}

// =====================
// SUMMARY
// =====================
function updateSummary() {
    const totalOutstanding = balanceData.reduce((sum, item) =>
        sum + calculateBalance(item.totalBill, item.paidAmount), 0);
    const overdueTotal = balanceData
        .filter(item => item.status === overdueStatus)
        .reduce((sum, item) => sum + calculateBalance(item.totalBill, item.paidAmount), 0);
    const pendingTotal = balanceData
        .filter(item => pendingStatuses.includes(item.status))
        .reduce((sum, item) => sum + calculateBalance(item.totalBill, item.paidAmount), 0);
    const overdueCount = balanceData.filter(item => item.status === overdueStatus).length;
    const pendingCount = balanceData.filter(item => pendingStatuses.includes(item.status)).length;

    if (totalOutstandingEl) totalOutstandingEl.textContent = formatCurrency(totalOutstanding);
    if (overdueAmountEl)    overdueAmountEl.textContent    = formatCurrency(overdueTotal);
    if (pendingAmountEl)    pendingAmountEl.textContent    = formatCurrency(pendingTotal);
    if (overdueCountEl)     overdueCountEl.textContent     = `${overdueCount} patient${overdueCount === 1 ? '' : 's'}`;
    if (pendingCountEl)     pendingCountEl.textContent     = `${pendingCount} patient${pendingCount === 1 ? '' : 's'}`;
}

// =====================
// RENDER TABLE
// =====================
function renderBalanceTable(filterText = '') {
    const tbody      = document.getElementById('balanceTableBody');
    const emptyState = document.getElementById('noRecordsMessage');
    const normalized = filterText.trim().toLowerCase();

    const filtered = balanceData
        .filter(item => item.patientName.toLowerCase().includes(normalized))
        .filter(item => activeFilterStatus === 'All' || item.status === activeFilterStatus);

    const rows = filtered.map(balance => {
        const balanceAmount = calculateBalance(balance.totalBill, balance.paidAmount);
        const percentPaid   = balance.totalBill === 0
            ? 0
            : Math.min((balance.paidAmount / balance.totalBill) * 100, 100);
        return `
            <tr class="clickable-row" onclick="editBalance(${balance.id}, '${balance.source}')">
                <td class="patient-name-cell">${balance.patientName}</td>
                <td>${formatDate(balance.admissionDate)}</td>
                <td>${balance.serviceType}</td>
                <td>${formatCurrency(balance.totalBill)}</td>
                <td class="paid-cell">
                    <div class="paid-info">
                        <span>${formatCurrency(balance.paidAmount)}</span>
                        <div class="progress-wrapper">
                            <div class="progress-bar-custom" style="width: ${percentPaid}%;"></div>
                        </div>
                        <span class="progress-percent">${Math.round(percentPaid)}% paid</span>
                    </div>
                </td>
                <td class="balance-cell">${formatCurrency(balanceAmount)}</td>
                <td><span class="badge-pill ${getStatusClass(balance.status)}">${balance.status}</span></td>
            </tr>
        `;
    });

    if (tbody)      tbody.innerHTML          = rows.join('');
    if (emptyState) emptyState.style.display = rows.length === 0 ? 'block' : 'none';
    if (balanceSummaryEl) {
        balanceSummaryEl.textContent = rows.length === 0
            ? 'No records to show'
            : `Showing ${rows.length} ${rows.length === 1 ? 'record' : 'records'}`;
    }
}

// =====================
// ADD BALANCE
// =====================
async function addNewBalance() {
    const selectedPatient = getSelectedPatientDetails(ADD_PATIENT_SELECT_ID);
    if (!selectedPatient || !selectedPatient.id || selectedPatient.isLegacy) {
        alert('Please select a patient from the dropdown before saving.');
        return;
    }

    const patientId     = selectedPatient.id;
    const patientName   = selectedPatient.name;
    const patientType   = selectedPatient.patientType || DefaultPatientType;
    const admissionDate = document.getElementById('admissionDate').value;
    const serviceType   = document.getElementById('serviceType').value;
    const totalBill     = parseFloat(document.getElementById('totalBill').value);
    const paidAmount    = parseFloat(document.getElementById('paidAmount').value);
    const status        = document.getElementById('balanceStatus').value;

    if (!serviceType || isNaN(totalBill) || isNaN(paidAmount) || !status) {
        alert('Please fill in all fields to save a balance record.');
        return;
    }
    if (patientType === PatientTypes.INPATIENT && !admissionDate) {
        alert('Admission date is required for inpatients.');
        return;
    }
    if (paidAmount > totalBill) {
        alert('Paid amount cannot exceed total bill.');
        return;
    }

    const result = await saveBalanceToDB({
        patient_id:     patientId,
        patient_name:   patientName,
        admission_date: admissionDate,
        service_type:   serviceType,
        total_bill:     totalBill,
        paid_amount:    paidAmount,
        status
    });

    if (result.success) {
        closeModal('addBalanceModal');
        document.getElementById('addBalanceForm').reset();
        populatePatientDropdown(ADD_PATIENT_SELECT_ID, getPatientTypeSelectValue(ADD_PATIENT_TYPE_ID));
        handlePatientSelection(ADD_PATIENT_SELECT_ID, ADD_PATIENT_TYPE_ID, ADD_ADMISSION_GROUP_ID, ADD_ADMISSION_INPUT_ID);
        await loadBalancesFromDB();
        alert('Balance record added successfully.');
    } else {
        alert('Error saving balance: ' + result.message);
    }
}

const saveBalanceBtn = document.getElementById('saveBalanceBtn');
if (saveBalanceBtn) saveBalanceBtn.addEventListener('click', addNewBalance);

// =====================
// EDIT BALANCE
// =====================
function editBalance(id, source) {
    currentEditId    = id;
    const balance    = balanceData.find(item => item.id === id && item.source === source);
    if (!balance) return;

    const patientType          = resolveBalancePatientType(balance);
    const fallbackPatientValue = balance.patientId ? String(balance.patientId) : `legacy-${balance.id}`;
    const editTypeSelect       = document.getElementById(EDIT_PATIENT_TYPE_ID);
    if (editTypeSelect) editTypeSelect.value = patientType;

    const normalizedAdmDate = normalizeDateForInput(balance.admissionDate);
    populatePatientDropdown(EDIT_PATIENT_SELECT_ID, patientType, fallbackPatientValue, balance.patientName, patientType, normalizedAdmDate);
    toggleAdmissionField(EDIT_PATIENT_TYPE_ID, EDIT_ADMISSION_GROUP_ID, EDIT_ADMISSION_INPUT_ID, normalizedAdmDate);

    document.getElementById('editAdmissionDate').value  = normalizedAdmDate;
    document.getElementById('editServiceType').value    = balance.serviceType;
    document.getElementById('editTotalBill').value      = balance.totalBill;
    document.getElementById('editPaidAmount').value     = balance.paidAmount;
    document.getElementById('editBalanceStatus').value  = balance.status;

    // Store source for update/delete
    document.getElementById('editBalanceModal').dataset.source = balance.source;

    new bootstrap.Modal(document.getElementById('editBalanceModal')).show();
}

// =====================
// UPDATE BALANCE
// =====================
async function updateBalance() {
    const selectedPatient = getSelectedPatientDetails(EDIT_PATIENT_SELECT_ID);
    const patientName     = selectedPatient?.name?.trim();
    const admissionDate   = document.getElementById('editAdmissionDate').value;
    const serviceType     = document.getElementById('editServiceType').value;
    const totalBill       = parseFloat(document.getElementById('editTotalBill').value);
    const paidAmount      = parseFloat(document.getElementById('editPaidAmount').value);
    const status          = document.getElementById('editBalanceStatus').value;
    const source          = document.getElementById('editBalanceModal').dataset.source;

    if (!selectedPatient || !patientName || !serviceType || isNaN(totalBill) || isNaN(paidAmount) || !status) {
        alert('Please fill in all fields.');
        return;
    }
    if (paidAmount > totalBill) {
        alert('Paid amount cannot exceed total bill.');
        return;
    }

    const result = await updateBalanceToDB({
        id:             currentEditId,
        source,
        patient_name:   patientName,
        admission_date: admissionDate,
        service_type:   serviceType,
        total_bill:     totalBill,
        paid_amount:    paidAmount,
        status
    });

    if (result.success) {
        closeModal('editBalanceModal');
        await loadBalancesFromDB();
        alert('Balance record updated successfully.');
    } else {
        alert('Error updating balance: ' + result.message);
    }
}

const updateBalanceBtn = document.getElementById('updateBalanceBtn');
if (updateBalanceBtn) updateBalanceBtn.addEventListener('click', updateBalance);

// =====================
// DELETE BALANCE
// =====================
const deleteBalanceBtn = document.getElementById('deleteBalanceBtn');
if (deleteBalanceBtn) {
    deleteBalanceBtn.addEventListener('click', async function () {
        if (currentEditId === null) return;
        if (!confirm('This will permanently delete the selected balance. Continue?')) return;

        const source = document.getElementById('editBalanceModal').dataset.source;
        const result = await deleteBalanceFromDB(currentEditId, source);

        if (result.success) {
            closeModal('editBalanceModal');
            await loadBalancesFromDB();
            alert('Balance record deleted successfully.');
        } else {
            alert('Error deleting balance: ' + result.message);
        }
    });
}

// =====================
// MISC
// =====================
function closeModal(id) {
    const modal = bootstrap.Modal.getInstance(document.getElementById(id));
    if (modal) modal.hide();
}

function refreshTable() {
    updateSummary();
    const searchInput = document.getElementById('patientSearchInput');
    renderBalanceTable(searchInput ? searchInput.value : '');
}

function setFilterStatus(status) {
    activeFilterStatus = status;
    if (filterLabelEl) filterLabelEl.textContent = status;
    const searchInput = document.getElementById('patientSearchInput');
    renderBalanceTable(searchInput ? searchInput.value : '');
    if (filterPopover) filterPopover.classList.remove('show');
    if (filterBtn)     filterBtn.setAttribute('aria-expanded', 'false');
}

document.querySelectorAll('.dropdown-item[data-filter]').forEach(button => {
    button.addEventListener('click', function () {
        setFilterStatus(this.getAttribute('data-filter'));
    });
});

function setSummaryDate() {
    const today = new Date();
    document.getElementById('totalOutstandingDate').textContent =
        today.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

async function loadPatientList() {
    try {
        const response = await fetch('../php/get_doctor_patients.php');
        const payload  = await response.json();

        if (payload?.success && Array.isArray(payload.patients)) {
            patientRecords = payload.patients.map(patient => {
                const admDate    = normalizeDateForInput(
                    patient.admissionDate || patient.admissionDateTime || patient.Admission_DateTime
                );
                const patientType = determinePatientType({ ...patient, admissionDate: admDate });
                return { ...patient, patientType, admissionDate: admDate };
            });
        } else {
            patientRecords = [];
        }
    } catch (error) {
        console.error('Unable to load patients:', error);
        patientRecords = [];
    } finally {
        populatePatientDropdown(ADD_PATIENT_SELECT_ID,  getPatientTypeSelectValue(ADD_PATIENT_TYPE_ID));
        populatePatientDropdown(EDIT_PATIENT_SELECT_ID, getPatientTypeSelectValue(EDIT_PATIENT_TYPE_ID));
    }
}

function toggleFilterPopover(event) {
    event.stopPropagation();
    if (!filterPopover) return;
    const isShown = filterPopover.classList.toggle('show');
    if (filterBtn) filterBtn.setAttribute('aria-expanded', isShown.toString());
}

if (filterBtn) filterBtn.addEventListener('click', toggleFilterPopover);

document.addEventListener('click', (event) => {
    if (filterPopover?.classList.contains('show') && filterWrapper && !filterWrapper.contains(event.target)) {
        filterPopover.classList.remove('show');
        if (filterBtn) filterBtn.setAttribute('aria-expanded', 'false');
    }
});

if (backBtn) {
    backBtn.addEventListener('click', () => {
        if (window.history.length > 1) window.history.back();
        else window.location.href = 'admindashboard.html';
    });
}

if (totalBillInput)  totalBillInput.addEventListener('input',  updatePaymentPreview);
if (paidAmountInput) paidAmountInput.addEventListener('input', updatePaymentPreview);

document.getElementById('patientSearchInput')?.addEventListener('input', function () {
    renderBalanceTable(this.value);
});

// =====================
// INIT
// =====================
async function initialize() {
    attachPatientTypeHandler(ADD_PATIENT_TYPE_ID,  ADD_PATIENT_SELECT_ID,  ADD_ADMISSION_GROUP_ID,  ADD_ADMISSION_INPUT_ID);
    attachPatientTypeHandler(EDIT_PATIENT_TYPE_ID, EDIT_PATIENT_SELECT_ID, EDIT_ADMISSION_GROUP_ID, EDIT_ADMISSION_INPUT_ID);
    attachPatientSelectHandler(ADD_PATIENT_SELECT_ID,  ADD_PATIENT_TYPE_ID,  ADD_ADMISSION_GROUP_ID,  ADD_ADMISSION_INPUT_ID);
    attachPatientSelectHandler(EDIT_PATIENT_SELECT_ID, EDIT_PATIENT_TYPE_ID, EDIT_ADMISSION_GROUP_ID, EDIT_ADMISSION_INPUT_ID);

    await loadPatientList();
    await loadBalancesFromDB();

    handlePatientSelection(ADD_PATIENT_SELECT_ID,  ADD_PATIENT_TYPE_ID,  ADD_ADMISSION_GROUP_ID,  ADD_ADMISSION_INPUT_ID);
    handlePatientSelection(EDIT_PATIENT_SELECT_ID, EDIT_PATIENT_TYPE_ID, EDIT_ADMISSION_GROUP_ID, EDIT_ADMISSION_INPUT_ID);

    setSummaryDate();
}

document.addEventListener('DOMContentLoaded', initialize);