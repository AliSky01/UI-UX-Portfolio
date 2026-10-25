const currencyFormatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const financeMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const now = new Date();
let financeCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
let patientBillingSearch = '';
let patientBillingStatusFilter = 'All';

const getIncomesList = () => window.financeData?.incomes ?? [];

const sumAmounts = (records) => records.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);

const getMonthRecords = (year, month) => {
    return getIncomesList().filter((entry) => {
        const date = new Date(entry.date);
        return date.getFullYear() === year && date.getMonth() === month;
    });
};

const formatMonthLabel = (date) => `${financeMonthNames[date.getMonth()]} ${date.getFullYear()}`;

const getIncomeTotal = (data) => (data?.incomes ?? []).reduce((sum, entry) => sum + (entry.amount || 0), 0);
const getExpenseTotal = (data) => (data?.expenses ?? []).reduce((sum, entry) => sum + (entry.amount || 0), 0);
const getBalanceTotal = (data) => {
    return (data?.balances ?? []).reduce((sum, entry) => {
        const balance = Math.max((entry.totalBill || 0) - (entry.paidAmount || 0), 0);
        return sum + balance;
    }, 0);
};

const formatDate = (iso) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const buildExpensesUrl = (entry = {}) => {
    const params = new URLSearchParams();
    const patientId = String(entry.patientId ?? '').trim();
    const patientName = String(entry.patientName ?? '').trim();
    const admissionDate = String(entry.admissionDate ?? '').trim();
    const subServiceType = String(entry.serviceType ?? '').trim();
    const diagnosis = String(entry.diagnosis ?? entry.serviceType ?? '').trim();

    if (patientId) params.set('patientId', patientId);
    if (patientName) params.set('patientName', patientName);
    if (admissionDate) params.set('admissionDate', admissionDate);
    if (subServiceType) params.set('subServiceType', subServiceType);
    if (diagnosis) params.set('diagnosis', diagnosis);

    return params.toString() ? `billing.html?${params.toString()}` : 'billing.html';
};

const sortByDateDesc = (records, field) => {
    return [...(records ?? [])].sort((a, b) => {
        const dateA = new Date(a?.[field]);
        const dateB = new Date(b?.[field]);
        return dateB - dateA;
    });
};

const normalizeBillingStatus = (status) => {
    const value = String(status ?? 'PAID').trim().toLowerCase();
    if (value === 'partial' || value === 'pending') return 'Pending';
    if (value === 'overdue') return 'Overdue';
    if (value === 'paid') return 'Paid';
    return String(status ?? 'Paid');
};

const getPaidPercent = (totalBill, paidAmount) => {
    const total = Number(totalBill) || 0;
    const paid = Number(paidAmount) || 0;
    if (total <= 0) return 0;
    return Math.max(0, Math.min((paid / total) * 100, 100));
};

const getBillingSearchValue = (entry) => {
    return [entry.patientId, entry.patientName, entry.id]
        .filter(Boolean).join(' ').toLowerCase();
};

const getFilteredPatientBillingRecords = (data) => {
    const records = sortByDateDesc(data?.balances, 'admissionDate');
    const search = patientBillingSearch.trim().toLowerCase();

    return records.filter((entry) => {
        const status = normalizeBillingStatus(entry.status);
        const matchesStatus = patientBillingStatusFilter === 'All' || status === patientBillingStatusFilter;
        const matchesSearch = !search || getBillingSearchValue(entry).includes(search);
        return matchesStatus && matchesSearch;
    });
};

const renderIncomeRows = (data) => {
    const tbody = document.getElementById('incomeTableBody');
    if (!tbody) return;
    const rows = sortByDateDesc(data?.incomes, 'date').map((entry) => `
        <tr>
            <td>${entry.patientName ?? entry.description ?? '—'}</td>
            <td>${entry.payerName ?? '—'}</td>
            <td>${entry.paymentMethod ?? entry.category ?? '—'}</td>
            <td>${currencyFormatter.format(entry.amount ?? 0)}</td>
            <td>${formatDate(entry.date)}</td>
            <td><span class="btn btn-status btn-paid rounded-pill btn-sm px-3">${entry.status ?? 'PAID'}</span></td>
        </tr>
    `).join('');
    tbody.innerHTML = rows;
};

const renderPatientBillingRows = (data) => {
    const tbody = document.getElementById('patientBillingTableBody');
    if (!tbody) return;
    const rows = getFilteredPatientBillingRecords(data).map((entry) => {
        const status = normalizeBillingStatus(entry.status);
        const statusClass = `billing-status-${status.toLowerCase()}`;
        const paidPercent = getPaidPercent(entry.totalBill, entry.paidAmount);
        const expensesUrl = buildExpensesUrl(entry);

        return `
        <tr>
            <td>${entry.patientId ? `<a class="billing-patient-link" href="${expensesUrl}">${entry.patientId}</a>` : '—'}</td>
            <td>${entry.patientName ? `<a class="billing-patient-link" href="${expensesUrl}">${entry.patientName}</a>` : '—'}</td>
            <td>${formatDate(entry.admissionDate)}</td>
            <td>
                <div class="billing-total-cell">
                    <div class="billing-total-amount">${currencyFormatter.format(entry.totalBill ?? 0)}</div>
                    <div class="billing-progress-track" aria-hidden="true">
                        <div class="billing-progress-fill" style="width: ${paidPercent}%"></div>
                    </div>
                    <div class="billing-progress-label">${Math.round(paidPercent)}% paid</div>
                </div>
            </td>
            <td><span class="billing-status-badge ${statusClass}">${status}</span></td>
        </tr>
    `;
    }).join('');
    tbody.innerHTML = rows;
};

const renderUnpaidRows = (data) => {
    const tbody = document.getElementById('unpaidTableBody');
    if (!tbody) return;
    const rows = sortByDateDesc(data?.balances, 'admissionDate').map((entry) => {
        const balance = Math.max((entry.totalBill || 0) - (entry.paidAmount || 0), 0);
        return `
            <tr>
                <td>${entry.patientName ?? '—'}</td>
                <td>${currencyFormatter.format(balance)}</td>
                <td>${formatDate(entry.admissionDate)}</td>
                <td><button class="btn btn-delete btn-sm"><i class="bi bi-trash"></i></button></td>
            </tr>
        `;
    }).join('');
    tbody.innerHTML = rows;
};

const renderExpenseRows = (data) => {
    const tbody = document.getElementById('expensesTableBody');
    if (!tbody) return;
    const rows = sortByDateDesc(data?.expenses, 'date').map((entry) => `
        <tr>
            <td>${entry.category}</td>
            <td>${currencyFormatter.format(entry.amount ?? 0)}</td>
            <td>${formatDate(entry.date)}</td>
            <td><button class="btn btn-delete btn-sm"><i class="bi bi-trash"></i></button></td>
        </tr>
    `).join('');
    tbody.innerHTML = rows;
};

const updateMonthStats = () => {
    const thisYear = financeCurrentMonth.getFullYear();
    const thisMonth = financeCurrentMonth.getMonth();
    const thisMonthRecords = getMonthRecords(thisYear, thisMonth);
    const prevMonthDate = new Date(thisYear, thisMonth - 1, 1);
    const lastMonthRecords = getMonthRecords(prevMonthDate.getFullYear(), prevMonthDate.getMonth());

    const label = formatMonthLabel(financeCurrentMonth);
    document.querySelectorAll('[data-finance-month-label]').forEach((el) => {
        el.textContent = label;
    });

    const thisTotalEl = document.getElementById('financeThisMonthTotal');
    if (thisTotalEl) thisTotalEl.textContent = currencyFormatter.format(sumAmounts(thisMonthRecords));

    const lastTotalEl = document.getElementById('financeLastMonthTotal');
    if (lastTotalEl) lastTotalEl.textContent = currencyFormatter.format(sumAmounts(lastMonthRecords));

    const thisCountEl = document.getElementById('financeThisMonthCount');
    if (thisCountEl) {
        const count = thisMonthRecords.length;
        thisCountEl.textContent = `${count} transaction${count === 1 ? '' : 's'}`;
    }

    const lastCountEl = document.getElementById('financeLastMonthCount');
    if (lastCountEl) {
        const count = lastMonthRecords.length;
        lastCountEl.textContent = `${count} transaction${count === 1 ? '' : 's'}`;
    }

    const noteEl = document.getElementById('financeMonthSubLabel');
    if (noteEl) {
        const count = thisMonthRecords.length;
        noteEl.textContent = count
            ? `${count} transaction${count === 1 ? '' : 's'} recorded for ${label}.`
            : `No transactions recorded for ${label} yet.`;
    }
};

const changeFinanceMonth = (delta) => {
    financeCurrentMonth = new Date(
        financeCurrentMonth.getFullYear(),
        financeCurrentMonth.getMonth() + delta,
        1
    );
    updateMonthStats();
};

async function fetchFinanceSummary() {
    try {
        const response = await fetch('../php/get_finance_summary.php');
        const result   = await response.json();
        if (!result.success) return;

        const incomeEl = document.getElementById('incomeCardAmount');
        const unpaidEl = document.getElementById('unpaidCardAmount');
        if (incomeEl) incomeEl.textContent = currencyFormatter.format(result.income);
        if (unpaidEl) unpaidEl.textContent = currencyFormatter.format(result.unpaidBalance);

    } catch (error) {
        console.error('Error fetching finance summary:', error);
    }
}

async function fetchPatientBilling(search = '', status = 'All') {
    try {
        const query = new URLSearchParams();
        query.set('search', search);
        query.set('status', status);
        query.set('patientType', 'All');

        const response = await fetch(`../php/get_patient_billing.php?${query.toString()}`);
        const result   = await response.json();
        if (!result.success) return;

        const tbody = document.getElementById('patientBillingTableBody');
        if (!tbody) return;

        if (result.bills.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No registered patients found</td></tr>';
            return;
        }

        tbody.innerHTML = result.bills.map(bill => {
            const status      = bill.BillingStatus ? String(bill.BillingStatus) : 'Paid';
            const statusClass = `billing-status-${status.toLowerCase()}`;
            const admDate     = bill.AdmissionDate ? new Date(bill.AdmissionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
            const isAppointment = String(bill.RecordSource ?? '') === 'appointment';
            const billingUrl  = `billing.html?patient_id=${bill.Patient_ID}`;
            const patientIdCell = isAppointment
                ? `${bill.Patient_ID ?? '—'}`
                : `<a class="billing-patient-link" href="${billingUrl}">${bill.Patient_ID ?? '—'}</a>`;
            const patientNameCell = isAppointment
                ? `${bill.PatientName ?? '—'}`
                : `<a class="billing-patient-link" href="${billingUrl}">${bill.PatientName ?? '—'}</a>`;

            return `
                <tr>
                    <td>${patientIdCell}</td>
                    <td>${patientNameCell}</td>
                    <td>${admDate}</td>
                    <td>${currencyFormatter.format(Number(bill.TotalBill ?? 0))}</td>
                    <td><span class="billing-status-badge ${statusClass}">${status}</span></td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error fetching patient billing:', error);
    }
}

const renderConsultationRows = (records = []) => {
    const tbody = document.getElementById('consultationTableBody');
    if (!tbody) return;

    if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">No consultation fees found</td></tr>';
        return;
    }

    tbody.innerHTML = records.map((record) => {
        const status = String(record.Status ?? 'Paid');
        const statusClass = `billing-status-${status.toLowerCase()}`;

        return `
            <tr>
                <td>${record.PatientName ?? '—'}</td>
                <td>${record.DoctorName ?? '—'}</td>
                <td>${formatDate(record.Date)}</td>
                <td>${currencyFormatter.format(Number(record.Fee ?? 0))}</td>
                <td><span class="billing-status-badge ${statusClass}">${status}</span></td>
            </tr>
        `;
    }).join('');
};

async function fetchConsultationFees(search = '') {
    try {
        const query = new URLSearchParams();
        query.set('search', search);

        const response = await fetch(`../php/get_consultation_fees.php?${query.toString()}`);
        const result = await response.json();
        if (!result.success) return;

        renderConsultationRows(result.records ?? []);
    } catch (error) {
        console.error('Error fetching consultation fees:', error);
    }
}

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
    const label = formatMonthLabel(financeCurrentMonth);
    document.querySelectorAll('[data-finance-month-label]').forEach(el => {
        el.textContent = label;
    });

    fetchFinanceSummary();
    fetchPatientBilling('', patientBillingStatusFilter);
    fetchConsultationFees();

    const searchInput = document.getElementById('patientBillingSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            fetchPatientBilling(this.value, patientBillingStatusFilter, patientBillingTypeFilter);
        });
    }

    const consultationSearchInput = document.getElementById('consultationSearch');
    if (consultationSearchInput) {
        consultationSearchInput.addEventListener('input', function () {
            fetchConsultationFees(this.value);
        });
    }

    document.querySelectorAll('#patientBillingFilters .billing-filter-btn').forEach(button => {
        button.addEventListener('click', function () {
            patientBillingStatusFilter = this.dataset.status || 'All';
            document.querySelectorAll('#patientBillingFilters .billing-filter-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            fetchPatientBilling(document.getElementById('patientBillingSearch')?.value ?? '', patientBillingStatusFilter);
        });
    });

    // Patient links now navigate directly to billing.html via their href.
});