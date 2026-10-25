// =====================
// STATE
// =====================
let allPatients = [];
let currentPatientId = null;
let currentBills = [];
let currentPatientDetails = null;

function safeGetItem(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        return false;
    }
}

function getSavedRunningBill(patientId) {
    if (!patientId) return null;
    return safeGetItem(`runningBill:${patientId}`, null);
}

function renderNotifications() {
    const stored = (safeGetItem('notifications', []) || []).map((n, idx) => ({
        ...n,
        read: n.read || false,
        __idx: idx
    }));

    const panel = document.getElementById('notificationPanel');
    const list = document.getElementById('notificationList');
    const badge = document.getElementById('notificationCount');
    if (!panel || !list || !badge) return;

    const unreadCount = stored.filter(n => !n.read).length;
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';

    list.innerHTML = '';
    if (stored.length === 0) {
        list.innerHTML = '<p class="notification-empty">No notifications</p>';
        return;
    }

    stored.slice().reverse().forEach(item => {
        const data = item.data || {};
        const name = `${data.firstName || data.patientName || data.name || 'Patient'}`.trim();
        const description = data.message || data.description || 'Update available';

        const notificationEl = document.createElement('div');
        notificationEl.className = 'notification-item';
        if (!item.read) notificationEl.classList.add('unread');

        notificationEl.innerHTML = `
            <div class="notification-body">
                <div class="notification-line">
                    <span class="notification-name">${name}</span>
                    <span class="notification-text">${description}</span>
                </div>
            </div>
        `;

        notificationEl.addEventListener('click', function() {
            const updated = stored.map((n, idx) => {
                if (idx === item.__idx) {
                    return { ...n, read: true };
                }
                return n;
            }).map(({ __idx, ...rest }) => rest);

            safeSetItem('notifications', updated);
            renderNotifications();
        });

        list.appendChild(notificationEl);
    });
}

function toggleNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    if (!panel) return;
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
}

// =====================
// HELPERS
// =====================
function formatCurrency(amount) {
    if (!amount || amount === 0) return '-';
    return '₱ ' + parseFloat(amount).toLocaleString('en-PH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

function applySavedRunningBillTotals(bills) {
    if (!currentPatientId) return;
    const saved = getSavedRunningBill(currentPatientId);
    if (!saved || !Number.isFinite(Number(saved.totalAmount))) return;

    const totalAmount = Number(saved.totalAmount);
    const latestUnpaidIndex = (Array.isArray(bills) ? bills : []).findIndex((bill) => {
        const status = String(bill?.Status || '').trim().toLowerCase();
        return status !== 'paid';
    });

    const balanceAmountEl = document.querySelector('.balance-amount');
    if (balanceAmountEl) {
        balanceAmountEl.textContent = `₱ ${totalAmount.toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    if (latestUnpaidIndex >= 0) {
        if (currentBills[latestUnpaidIndex]) {
            currentBills[latestUnpaidIndex].Amount = totalAmount;
        }
        const row = document.querySelector(`tr.payment-row[data-bill-index="${latestUnpaidIndex}"]`);
        const amountCell = row?.querySelector('.running-bill-cell');
        if (amountCell) amountCell.textContent = formatCurrency(totalAmount);
    }
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMonth(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date)) return '—';
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatTime(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date)) return '—';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getUnpaidDueCount(bills = []) {
    return (Array.isArray(bills) ? bills : []).filter((bill) => {
        const status = String(bill?.Status || '').trim().toLowerCase();
        return status !== 'paid';
    }).length;
}

function toISODate(dateInput) {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getAdminExpensesPath() {
    const path = window.location.pathname.replace(/\\/g, '/');
    return path.includes('/finance/') ? '../admin/adminexpenses.html' : 'adminexpenses.html';
}

// =====================
// LOAD PATIENT LIST
// =====================
async function loadPatientList() {
    try {
        const response = await fetch('../php/get_billing_patients.php');
        const result   = await response.json();

        if (!result.success) return;

        allPatients = result.patients;
        renderPatientList(allPatients);

        // Auto-select first patient
        if (allPatients.length > 0) {
            selectPatient(allPatients[0].Patient_ID);
        }

    } catch (error) {
        console.error('Error loading patient list:', error);
    }
}

function renderPatientList(patients) {
    const listEl = document.querySelector('.patient-list');
    if (!listEl) return;

    if (patients.length === 0) {
        listEl.innerHTML = '<p class="text-muted text-center py-3">No patients found</p>';
        return;
    }

    listEl.innerHTML = patients.map((p, index) => {
        const fullName = `${p.LastName}, ${p.FirstName}`;
        return `
            <div class="patient-item" data-patient-id="${p.Patient_ID}">
                <input type="radio" name="patient" id="patient${p.Patient_ID}" ${index === 0 ? 'checked' : ''}>
                <label for="patient${p.Patient_ID}">${fullName}</label>
            </div>
        `;
    }).join('');

    // Attach click handlers
    listEl.querySelectorAll('.patient-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.getAttribute('data-patient-id');
            selectPatient(id);
        });
    });
}

// =====================
// SELECT PATIENT
// =====================
async function selectPatient(patientId) {
    currentPatientId = patientId;

    // Update active state in sidebar
    document.querySelectorAll('.patient-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-patient-id') == patientId);
    });
    const radio = document.querySelector(`#patient${patientId}`);
    if (radio) radio.checked = true;

    await loadBillingDetails(patientId);
}

// =====================
// LOAD BILLING DETAILS
// =====================
async function loadBillingDetails(patientId) {
    try {
        const response = await fetch(`../php/get_billing_details.php?patient_id=${patientId}`);
        const result   = await response.json();

        if (!result.success) {
            console.error('Failed to load billing details:', result.message);
            return;
        }

        renderPatientHeader(result.patient, result.unpaidBalance);
        renderPaymentTable(result.bills);
        applySavedRunningBillTotals(result.bills);

        const unpaidCount = getUnpaidDueCount(result.bills);
        const dueBadge = document.getElementById('outstandingDueBadge');
        if (dueBadge) {
            dueBadge.textContent = `${unpaidCount} unpaid due`;
        }

    } catch (error) {
        console.error('Error loading billing details:', error);
    }
}

// =====================
// RENDER PATIENT HEADER
// =====================
function renderPatientHeader(patient, unpaidBalance) {
    currentPatientDetails = patient || null;

    const fullName = [patient.FirstName, patient.MiddleName, patient.LastName]
        .filter(Boolean).join(' ');

    const nameEl = document.querySelector('.patient-name-main');
    if (nameEl) nameEl.textContent = fullName;

    const diagnosisEl = document.querySelector('.patient-diagnosis-text');
    if (diagnosisEl) diagnosisEl.textContent = patient.Diagnosis || '—';

    const infoRows = document.querySelectorAll('.info-row');
    if (infoRows[0]) infoRows[0].querySelector('.info-value').textContent = formatDate(patient.Admission_DateTime);
    if (infoRows[1]) infoRows[1].querySelector('.info-value').textContent = formatTime(patient.Admission_DateTime);
    if (infoRows[2]) infoRows[2].querySelector('.info-value').textContent = patient.Diagnosed_by || '—';

    // Balance card content
    const balanceLabelEl = document.querySelector('.balance-label');
    if (balanceLabelEl) {
        balanceLabelEl.textContent = 'OUTSTANDING BALANCE';
    }

    const balanceAmountEl = document.querySelector('.balance-amount');
    if (balanceAmountEl) {
        balanceAmountEl.textContent = `₱ ${parseFloat(unpaidBalance).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    const balanceDateEl = document.querySelector('.balance-date');
    if (balanceDateEl) {
        const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        balanceDateEl.textContent = `As of ${today}`;
    }
}

function openRecordPaymentPopup() {
    const frame = document.getElementById('patientFormPopupFrame');
    const modalElement = document.getElementById('patientFormPopupModal');
    if (!frame || !modalElement || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
        return;
    }

    const params = new URLSearchParams();
    const patientName = document.querySelector('.patient-name-main')?.textContent?.trim() || '';
    const diagnosis = document.querySelector('.patient-diagnosis-text')?.textContent?.trim() || '';
    const admissionIso = toISODate(currentPatientDetails?.Admission_DateTime);

    if (currentPatientId) params.set('patientId', String(currentPatientId));
    params.set('readonly', '1');
    if (patientName) params.set('patientName', patientName);
    if (currentPatientDetails?.PatientType) params.set('patientType', currentPatientDetails.PatientType);
    if (admissionIso) params.set('admissionDate', admissionIso);
    if (diagnosis) {
        params.set('subServiceType', diagnosis);
        params.set('diagnosis', diagnosis);
    }
    if (currentPatientDetails?.Diagnosed_by) params.set('attendingDoctor', currentPatientDetails.Diagnosed_by);

    const adminExpensesPath = getAdminExpensesPath();
    frame.src = `${adminExpensesPath}${params.toString() ? `?${params.toString()}` : ''}`;

    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    modal.show();

    if (!modalElement.dataset.cleanupBound) {
        modalElement.addEventListener('hidden.bs.modal', () => {
            frame.src = 'about:blank';
        });
        modalElement.dataset.cleanupBound = 'true';
    }
}

function openRunningBillModal(billIndex = null) {
    const frame = document.getElementById('runningBillFrame');
    const modalElement = document.getElementById('runningBillModal');
    if (!frame || !modalElement || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
        return;
    }

    const params = new URLSearchParams();
    const patientName = document.querySelector('.patient-name-main')?.textContent?.trim() || '';
    const diagnosis = document.querySelector('.patient-diagnosis-text')?.textContent?.trim() || '';
    const admissionIso = toISODate(currentPatientDetails?.Admission_DateTime);
    let statusValue = '';

    if (currentPatientId) params.set('patientId', String(currentPatientId));
    if (patientName) params.set('patientName', patientName);
    if (currentPatientDetails?.PatientType) params.set('patientType', currentPatientDetails.PatientType);
    if (admissionIso) params.set('admissionDate', admissionIso);
    if (diagnosis) {
        params.set('subServiceType', diagnosis);
        params.set('diagnosis', diagnosis);
    }
    if (currentPatientDetails?.Diagnosed_by) params.set('attendingDoctor', currentPatientDetails.Diagnosed_by);

    if (billIndex !== null && currentBills[billIndex]) {
        statusValue = String(currentBills[billIndex]?.Status || '').trim();
        if (statusValue) params.set('billingStatus', statusValue);
    }

    const titleEl = modalElement.querySelector('.modal-title');
    const statusLower = statusValue.toLowerCase();
    const titleText = statusLower && statusLower !== 'paid' ? 'Patient Running Bill' : 'Total bill';
    if (titleEl) titleEl.textContent = titleText;

    const adminExpensesPath = getAdminExpensesPath();
    frame.src = `${adminExpensesPath}${params.toString() ? `?${params.toString()}` : ''}`;

    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    modal.show();

    if (!modalElement.dataset.cleanupBound) {
        modalElement.addEventListener('hidden.bs.modal', () => {
            frame.src = 'about:blank';
        });
        modalElement.dataset.cleanupBound = 'true';
    }
}

// =====================
// RENDER PAYMENT TABLE
// =====================
function renderPaymentTable(bills) {
    const tbody = document.getElementById('paymentTableBody');
    if (!tbody) return;
    currentBills = Array.isArray(bills) ? bills : [];

    if (currentBills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No payment records found</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    currentBills.forEach((bill, index) => {
        const status      = bill.Status ? bill.Status.charAt(0).toUpperCase() + bill.Status.slice(1) : 'Unpaid';
        const statusClass = status === 'Paid' ? 'badge-paid' : 'badge-unpaid';

        const row = document.createElement('tr');
        row.className = 'payment-row';
        row.setAttribute('data-bill-index', String(index));
        row.innerHTML = `
            <td>${formatMonth(bill.Date)}</td>
            <td>${formatDate(bill.Date)}</td>
            <td class="running-bill-cell">${formatCurrency(bill.Amount)}</td>
            <td><span class="badge ${statusClass}" data-bill-index="${index}">${status}</span></td>
            <td><button type="button" class="btn btn-link btn-sm running-bill-btn" data-bill-index="${index}">Running Bill</button></td>
        `;
        tbody.appendChild(row);
    });
}

// =====================
// TOGGLE BILLING DETAILS
// =====================
function toggleBillingDetails(button) {
    const row        = button.closest('tr');
    const detailsRow = row.nextElementSibling;

    if (detailsRow && detailsRow.classList.contains('billing-details-row')) {
        const isShowing = detailsRow.classList.contains('show');

        document.querySelectorAll('.billing-details-row.show').forEach(dr => {
            if (dr !== detailsRow) dr.classList.remove('show');
        });
        document.querySelectorAll('.btn-expand i').forEach(icon => {
            if (icon !== button.querySelector('i')) {
                icon.classList.replace('bi-chevron-up', 'bi-chevron-down');
            }
        });

        if (isShowing) {
            detailsRow.classList.remove('show');
            button.querySelector('i').classList.replace('bi-chevron-up', 'bi-chevron-down');
        } else {
            detailsRow.classList.add('show');
            button.querySelector('i').classList.replace('bi-chevron-down', 'bi-chevron-up');
        }
    }
}

// =====================
// ADD PAYMENT (saves to DB)
// =====================
async function addPayment() {
    const date          = document.getElementById('paymentDate').value;
    const payerName     = document.getElementById('payerName').value.trim();
    const paymentMethod = document.getElementById('paymentMethod').value;
    const checkNumber   = document.getElementById('checkNumber').value.trim();
    const amount        = document.getElementById('paymentAmount').value;
    const status        = document.getElementById('paymentStatus').value;

    if (!date || !payerName || !paymentMethod || !amount || !status) {
        alert('Please fill in all required fields');
        return;
    }

    let methodText = paymentMethod;
    if (paymentMethod === 'Check' && checkNumber) {
        methodText = `Check (${checkNumber})`;
    }

    const formData = new FormData();
    formData.append('patient_id',  currentPatientId);
    formData.append('date',        date);
    formData.append('payer_name',  payerName);
    formData.append('bank_card',   methodText);
    formData.append('amount',      amount);
    formData.append('status',      status.toLowerCase());

    try {
        const response = await fetch('../php/save_patient_bill.php', {
            method: 'POST',
            body:   formData
        });
        const result = await response.json();

        if (result.success) {
            document.getElementById('paymentForm').reset();
            bootstrap.Modal.getInstance(document.getElementById('addPaymentModal')).hide();
            await loadBillingDetails(currentPatientId); // Reload from DB
            alert('Payment added successfully!');
        } else {
            alert('Error saving payment: ' + result.message);
        }
    } catch (error) {
        alert('Error saving payment: ' + error.message);
    }
}

// =====================
// SEARCH PATIENTS
// =====================
document.getElementById('searchPatient')?.addEventListener('input', function () {
    const term = this.value.toLowerCase();
    document.querySelectorAll('.patient-item').forEach(item => {
        const name = item.querySelector('label').textContent.toLowerCase();
        item.style.display = name.includes(term) ? 'flex' : 'none';
    });
});

// =====================
// PAYMENT TABLE CLICK
// =====================
document.getElementById('paymentTableBody')?.addEventListener('click', (event) => {
    const runningBillCell = event.target.closest('.running-bill-cell');
    if (runningBillCell) {
        const row = event.target.closest('tr.payment-row[data-bill-index]');
        const index = row ? Number(row.getAttribute('data-bill-index')) : null;
        openRunningBillModal(Number.isNaN(index) ? null : index);
        return;
    }
    const runningBillBtn = event.target.closest('.running-bill-btn');
    if (runningBillBtn) {
        const index = Number(runningBillBtn.getAttribute('data-bill-index'));
        openRunningBillModal(Number.isNaN(index) ? null : index);
        return;
    }
    const row = event.target.closest('tr.payment-row[data-bill-index]');
    if (!row) return;
});


// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('notificationBell')?.addEventListener('click', function(e) {
        e.stopPropagation();
        renderNotifications();
        toggleNotificationPanel();
    });

    document.getElementById('clearNotifications')?.addEventListener('click', function(e) {
        e.preventDefault();
        safeSetItem('notifications', []);
        renderNotifications();
    });

    document.addEventListener('click', function(e) {
        const panel = document.getElementById('notificationPanel');
        const bell = document.getElementById('notificationBell');
        if (!panel || !bell) return;
        if (!panel.contains(e.target) && !bell.contains(e.target)) {
            panel.style.display = 'none';
        }
    });

    renderNotifications();

    await loadPatientList();

    // Auto-select patient from URL if coming from adminfinances
    const params    = new URLSearchParams(window.location.search);
    const patientId = params.get('patient_id');
    if (patientId) {
        selectPatient(patientId);
    }

    document.getElementById('recordPaymentBtn')?.addEventListener('click', openRecordPaymentPopup);
});