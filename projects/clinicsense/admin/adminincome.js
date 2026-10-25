// =====================
// STATE
// =====================
let incomes = []; // Loaded from DB

const categoryClassMap = {
    Patient:      'patient',
    Insurance:    'insurance',
    Consultation: 'consultation',
    Service:      'service',
    Donation:     'donation'
};

const formatter = new Intl.NumberFormat('en-PH', {
    style:                 'currency',
    currency:              'PHP',
    minimumFractionDigits: 2
});

const today    = new Date();
const todayIso = today.toISOString().split('T')[0];
let selectedDate         = todayIso;
let currentCalendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const filterState = { searchTerm: '', category: '' };
const monthNames  = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
];

let calendarDatesEl;
let calendarMonthLabel;
let transactionListEl;
let transactionDateLabel;
let transactionTotalAmount;
let searchInputEl;
let filterBtn;
let filterPopover;
let categoryFilterEl;
let applyFilterBtn;
let clearFilterBtn;
let saveIncomeBtn;
let addIncomeForm;
let addIncomeModalInstance;
let filterWrapper;
let backBtn;

// =====================
// LOAD FROM DATABASE
// =====================
async function loadIncomesFromDB() {
    try {
        const response = await fetch('../php/get_income_records.php');
        const result   = await response.json();

        if (!result.success) {
            console.error('Failed to load incomes:', result.message);
            incomes = [];
            renderCalendar();
            renderTransactions();
            updateSummary();
            return;
        }

        // Map DB records to format the existing code expects
        incomes = result.records.map(r => ({
            date:        r.Date,
            description: r.PatientName || r.Payer_Name || 'Patient Payment',
            category:    r.IncomeCategory || (r.BankCard === 'Consultation' ? 'Consultation' : 'Patient'),
            amount:      parseFloat(r.Amount),
            status:      r.Status,
            payerName:   r.Payer_Name,
            method:      r.BankCard || 'Cash'
        }));

        // Update summary stats from DB response
        const totalEl = document.getElementById('totalIncome');
        if (totalEl) totalEl.textContent = formatter.format(
            incomes.reduce((sum, r) => sum + r.amount, 0)
        );

        const thisMonthTotalEl = document.getElementById('thisMonthTotal');
        const thisMonthCountEl = document.getElementById('thisMonthCount');
        const lastMonthTotalEl = document.getElementById('lastMonthTotal');
        const lastMonthCountEl = document.getElementById('lastMonthCount');

        if (thisMonthTotalEl) thisMonthTotalEl.textContent = formatter.format(result.thisMonthTotal ?? 0);
        if (thisMonthCountEl) thisMonthCountEl.textContent = `${result.thisMonthCount ?? 0} transaction${result.thisMonthCount === 1 ? '' : 's'}`;
        if (lastMonthTotalEl) lastMonthTotalEl.textContent = formatter.format(result.lastMonthTotal ?? 0);
        if (lastMonthCountEl) lastMonthCountEl.textContent = `${result.lastMonthCount ?? 0} transaction${result.lastMonthCount === 1 ? '' : 's'}`;

        renderCalendar();
        renderTransactions();
        updateSummary();

    } catch (error) {
        console.error('Error loading incomes from DB:', error);
        incomes = [];
        renderCalendar();
        renderTransactions();
        updateSummary();
    }
}

// =====================
// SAVE INCOME TO DATABASE
// =====================
async function saveIncomeToDB(patientId, date, payerName, bankCard, amount, status) {
    try {
        const formData = new FormData();
        formData.append('patient_id',  patientId);
        formData.append('date',        date);
        formData.append('payer_name',  payerName);
        formData.append('bank_card',   bankCard);
        formData.append('amount',      amount);
        formData.append('status',      status);

        const response = await fetch('../php/save_patient_bill.php', {
            method: 'POST',
            body:   formData
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error saving income:', error);
        return { success: false, message: error.message };
    }
}

// =====================
// HELPERS
// =====================
const groupByDate = () => {
    return incomes.reduce((acc, entry) => {
        if (!acc[entry.date]) acc[entry.date] = [];
        acc[entry.date].push(entry);
        return acc;
    }, {});
};

const getRecordsForCurrentMonth = () => {
    return incomes.filter(entry => {
        const date = new Date(entry.date);
        return (
            date.getFullYear() === currentCalendarMonth.getFullYear() &&
            date.getMonth()    === currentCalendarMonth.getMonth()
        );
    });
};

const getCategoryClass  = (category) => `category-badge ${categoryClassMap[category] || ''}`;

const formatDisplayDate = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

// =====================
// RENDER CALENDAR
// =====================
const renderCalendar = () => {
    if (!calendarDatesEl || !calendarMonthLabel) return;

    const grouped    = groupByDate();
    const year       = currentCalendarMonth.getFullYear();
    const month      = currentCalendarMonth.getMonth();
    const firstDay   = new Date(year, month, 1);
    const lastDay    = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const fragment   = document.createDocumentFragment();

    for (let i = 0; i < startOffset; i++) {
        const placeholder = document.createElement('span');
        placeholder.className = 'calendar-date empty';
        placeholder.setAttribute('aria-hidden', 'true');
        fragment.appendChild(placeholder);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const button  = document.createElement('button');
        button.type        = 'button';
        button.className   = 'calendar-date';
        button.textContent = day;
        button.dataset.date = isoDate;

        if (isoDate === selectedDate) button.classList.add('selected');
        if (isoDate === todayIso)     button.classList.add('today');
        if (grouped[isoDate])         button.classList.add('has-record');

        button.addEventListener('click', () => {
            selectedDate             = isoDate;
            filterState.searchTerm   = searchInputEl?.value ?? '';
            renderCalendar();
            renderTransactions();
            updateSummary();
        });
        fragment.appendChild(button);
    }

    calendarDatesEl.innerHTML = '';
    calendarDatesEl.appendChild(fragment);
    calendarMonthLabel.textContent = `${monthNames[month]} ${year}`;
};

// =====================
// RENDER TRANSACTIONS
// =====================
const renderTransactions = () => {
    if (!transactionListEl || !transactionDateLabel || !transactionTotalAmount) return;

    const grouped = groupByDate();
    let rows = [];

    if (filterState.category === 'all-income') {
        rows = getRecordsForCurrentMonth();
    } else {
        rows = grouped[selectedDate] ? [...grouped[selectedDate]] : [];
    }

    const normalizedTerm = filterState.searchTerm.trim().toLowerCase();
    const filteredRows   = rows.filter(entry => {
        const matchesSearch = !normalizedTerm ||
            entry.description.toLowerCase().includes(normalizedTerm) ||
            entry.category.toLowerCase().includes(normalizedTerm);
        const matchesCategory = !filterState.category ||
            filterState.category === 'all-income' ||
            entry.category === filterState.category;
        return matchesSearch && matchesCategory;
    });

    const total      = filteredRows.reduce((sum, entry) => sum + entry.amount, 0);
    const monthLabel = `${monthNames[currentCalendarMonth.getMonth()]} ${currentCalendarMonth.getFullYear()}`;

    transactionDateLabel.textContent = filterState.category === 'all-income'
        ? `All income — ${monthLabel}`
        : formatDisplayDate(selectedDate);
    transactionTotalAmount.textContent = `Total: ${formatter.format(total)}`;

    if (filteredRows.length === 0) {
        const noRecordsLabel = filterState.category === 'all-income'
            ? monthLabel
            : formatDisplayDate(selectedDate);
        transactionListEl.innerHTML = `<p class="helper-text">No transactions found for ${noRecordsLabel}.</p>`;
        return;
    }

    transactionListEl.innerHTML = '';
    filteredRows.forEach(entry => {
        const row       = document.createElement('div');
        row.className   = 'transaction-row';
        row.innerHTML   = `
            <div>
                <p class="transaction-title">${entry.description}</p>
                <div class="transaction-meta">
                    <span class="${getCategoryClass(entry.category)}">${entry.category}</span>
                    ${entry.payerName ? `<span class="transaction-payer">Payer: ${entry.payerName}</span>` : ''}
                    ${entry.method    ? `<span class="transaction-method">${entry.method}</span>`          : ''}
                </div>
            </div>
            <div class="transaction-amount">${formatter.format(entry.amount)}</div>
        `;
        transactionListEl.appendChild(row);
    });
};

// =====================
// UPDATE SUMMARY
// =====================
const updateSummary = () => {
    const totalEl = document.getElementById('totalIncome');
    if (totalEl) totalEl.textContent = formatter.format(
        incomes.reduce((sum, entry) => sum + entry.amount, 0)
    );

    const monthLabel = `${monthNames[currentCalendarMonth.getMonth()]} ${currentCalendarMonth.getFullYear()}`;
    const summaryDateEl = document.getElementById('summaryDate');
    if (summaryDateEl) summaryDateEl.textContent = filterState.category === 'all-income'
        ? monthLabel
        : formatDisplayDate(selectedDate);

    const thisMonthRecords = incomes.filter(entry => {
        const date = new Date(entry.date);
        return (
            date.getFullYear() === currentCalendarMonth.getFullYear() &&
            date.getMonth()    === currentCalendarMonth.getMonth()
        );
    });
    const thisMonthTotal = thisMonthRecords.reduce((sum, e) => sum + e.amount, 0);
    const thisMonthTotalEl = document.getElementById('thisMonthTotal');
    const thisMonthCountEl = document.getElementById('thisMonthCount');
    if (thisMonthTotalEl) thisMonthTotalEl.textContent = formatter.format(thisMonthTotal);
    if (thisMonthCountEl) thisMonthCountEl.textContent = `${thisMonthRecords.length} transaction${thisMonthRecords.length === 1 ? '' : 's'}`;

    const previousMonth    = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() - 1, 1);
    const lastMonthRecords = incomes.filter(entry => {
        const date = new Date(entry.date);
        return date.getFullYear() === previousMonth.getFullYear() &&
               date.getMonth()    === previousMonth.getMonth();
    });
    const lastMonthTotal = lastMonthRecords.reduce((sum, e) => sum + e.amount, 0);
    const lastMonthTotalEl = document.getElementById('lastMonthTotal');
    const lastMonthCountEl = document.getElementById('lastMonthCount');
    if (lastMonthTotalEl) lastMonthTotalEl.textContent = formatter.format(lastMonthTotal);
    if (lastMonthCountEl) lastMonthCountEl.textContent = `${lastMonthRecords.length} transaction${lastMonthRecords.length === 1 ? '' : 's'}`;
};

// =====================
// CHANGE MONTH
// =====================
const changeMonth = (delta) => {
    currentCalendarMonth = new Date(
        currentCalendarMonth.getFullYear(),
        currentCalendarMonth.getMonth() + delta,
        1
    );

    // Reset selected date to first of new month
    selectedDate = `${currentCalendarMonth.getFullYear()}-${String(currentCalendarMonth.getMonth() + 1).padStart(2, '0')}-01`;

    // Reload from DB for new month
    loadIncomesFromDB();
};

// =====================
// FILTER POPOVER
// =====================
const toggleFilterPopover = () => {
    if (!filterPopover || !filterBtn) return;
    filterPopover.classList.toggle('show');
    filterBtn.setAttribute('aria-expanded', filterPopover.classList.contains('show'));
};

const hideFilterPopover = () => {
    if (!filterPopover || !filterBtn) return;
    filterPopover.classList.remove('show');
    filterBtn.setAttribute('aria-expanded', 'false');
};

const applyFilter = () => {
    if (!categoryFilterEl) return;
    filterState.category = categoryFilterEl.value;
    filterBtn.classList.toggle('active', Boolean(filterState.category));
    renderTransactions();
    hideFilterPopover();
};

const clearFilter = () => {
    if (!categoryFilterEl) return;
    categoryFilterEl.value = '';
    filterState.category   = '';
    filterBtn.classList.remove('active');
    renderTransactions();
    hideFilterPopover();
};

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
    calendarDatesEl        = document.getElementById('calendarDates');
    calendarMonthLabel     = document.getElementById('calendarMonthLabel');
    transactionListEl      = document.getElementById('transactionList');
    transactionDateLabel   = document.getElementById('transactionDateLabel');
    transactionTotalAmount = document.getElementById('transactionTotalAmount');
    searchInputEl          = document.getElementById('searchInput');
    filterBtn              = document.getElementById('filterBtn');
    filterPopover          = document.getElementById('filterPopover');
    categoryFilterEl       = document.getElementById('categoryFilter');
    applyFilterBtn         = document.getElementById('applyFilterBtn');
    clearFilterBtn         = document.getElementById('clearFilterBtn');
    saveIncomeBtn          = document.getElementById('saveIncomeBtn');
    addIncomeForm          = document.getElementById('addIncomeForm');
    backBtn                = document.querySelector('.back-btn');
    filterWrapper          = document.querySelector('.filter-wrapper');

    const modalElement     = document.getElementById('addIncomeModal');
    addIncomeModalInstance = new bootstrap.Modal(modalElement);

    // Load from DB on init
    renderCalendar();
    renderTransactions();
    updateSummary();
    loadIncomesFromDB();

    searchInputEl.addEventListener('input', () => {
        filterState.searchTerm = searchInputEl.value;
        renderTransactions();
    });

    filterBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleFilterPopover();
    });

    document.addEventListener('click', (event) => {
        if (filterWrapper && !filterWrapper.contains(event.target)) {
            hideFilterPopover();
        }
    });

    applyFilterBtn.addEventListener('click', applyFilter);
    clearFilterBtn.addEventListener('click', clearFilter);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hideFilterPopover();
    });

    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));

    backBtn?.addEventListener('click', () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = 'admindashboard.html';
        }
    });

    // Save income to DB
    saveIncomeBtn.addEventListener('click', async () => {
        const dateValue   = document.getElementById('incomeDate').value;
        const description = document.getElementById('incomeDescription').value.trim();
        const category    = document.getElementById('incomeCategory').value;
        const amountValue = parseFloat(document.getElementById('incomeAmount').value);

        if (!dateValue || !description || !category || Number.isNaN(amountValue) || amountValue <= 0) {
            alert('Please complete all fields with valid values.');
            return;
        }

        const normalized = new Date(dateValue);
        const isoDate    = normalized.toISOString().split('T')[0];

        // Save to DB — using description as payer name, category as bank card
        const result = await saveIncomeToDB(
            '',          // patient_id — empty for manual income
            isoDate,
            description, // payer name
            category,    // bank card / payment method
            amountValue,
            'paid'
        );

        if (result.success) {
            addIncomeForm.reset();
            selectedDate         = isoDate;
            currentCalendarMonth = new Date(normalized.getFullYear(), normalized.getMonth(), 1);
            filterState.searchTerm = '';
            searchInputEl.value    = '';

            if (filterState.category) {
                filterState.category   = '';
                categoryFilterEl.value = '';
                filterBtn.classList.remove('active');
            }

            addIncomeModalInstance.hide();
            loadIncomesFromDB(); // Reload from DB
        } else {
            alert('Error saving income: ' + result.message);
        }
    });
});