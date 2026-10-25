// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    loadTodayLogs();
    populateMonthYearSelectors();
    loadMonthlySummary();
    setTodayDate();

    document.getElementById('logoutBtn').addEventListener('click', async function(e) {
        e.preventDefault();
        await fetch('../php/logout.php', { method: 'POST' });
        window.location.href = '../registration/Login1stpage.html';
    });
});

// Tab switching functionality
function initializeTabs() {
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

            this.classList.add('active');

            const filter = this.getAttribute('data-filter');
            if (filter === 'today') {
                document.getElementById('todaySection').classList.add('active');
                loadTodayLogs();
            } else if (filter === 'previous') {
                document.getElementById('previousSection').classList.add('active');
                loadPreviousLogs();
            } else if (filter === 'monthly') {
                document.getElementById('monthlySection').classList.add('active');
                loadMonthlySummary();
            }
        });
    });
}

// Set today's date display
function setTodayDate() {
    const today   = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('todayDate').textContent = today.toLocaleDateString('en-US', options);
}

// Load today's logs
async function loadTodayLogs() {
    const container = document.getElementById('todayLogs');
    container.innerHTML = '<p class="text-center text-muted">Loading...</p>';

    try {
        const response = await fetch('../php/get_staffs_logs_full.php?filter=today');
        const result   = await response.json();

        if (!result.success || result.logs.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#64748b;padding:40px;">No activity recorded for today.</p>';
            return;
        }

        let logs = result.logs;

        // Apply status filter
        const statusFilter = document.getElementById('statusFilter').value;
        if (statusFilter === 'logged-in')  logs = logs.filter(l => l.logout_time === null);
        if (statusFilter === 'logged-out') logs = logs.filter(l => l.logout_time !== null);

        if (logs.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#64748b;padding:40px;">No records found for the selected filter.</p>';
            return;
        }

        container.innerHTML = '';
        logs.forEach(log => container.appendChild(createLogItem(log)));

    } catch (error) {
        console.error('Error loading today logs:', error);
        container.innerHTML = '<p class="text-danger text-center">Failed to load logs.</p>';
    }
}

// Apply filters
function applyFilters() {
    const activeSection = document.querySelector('.content-section.active');
    if (activeSection.id === 'todaySection') {
        loadTodayLogs();
    } else if (activeSection.id === 'previousSection') {
        filterByDateRange();
    }
}

// Load previous logs
function loadPreviousLogs() {
    document.getElementById('startDate').value            = '';
    document.getElementById('endDate').value              = '';
    document.getElementById('previousStatusFilter').value = 'all';
    filterByDateRange();
}

// Filter by date range
async function filterByDateRange() {
    const startDateInput = document.getElementById('startDate').value;
    const endDateInput   = document.getElementById('endDate').value;
    const container      = document.getElementById('previousLogs');
    container.innerHTML  = '<p class="text-center text-muted">Loading...</p>';

    if (startDateInput && endDateInput && startDateInput > endDateInput) {
        alert('Please select a valid date range.');
        return;
    }

    let url = '../php/get_staffs_logs_full.php?filter=previous';
    if (startDateInput && endDateInput) {
        url += `&start=${startDateInput}&end=${endDateInput}`;
    }

    try {
        const response = await fetch(url);
        const result   = await response.json();

        if (!result.success || result.logs.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#64748b;padding:40px;">No records found.</p>';
            return;
        }

        let logs = result.logs;

        // Apply status filter
        const statusFilter = document.getElementById('previousStatusFilter').value;
        if (statusFilter === 'logged-in')  logs = logs.filter(l => l.logout_time === null);
        if (statusFilter === 'logged-out') logs = logs.filter(l => l.logout_time !== null);

        if (logs.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#64748b;padding:40px;">No records found for the selected filter.</p>';
            return;
        }

        // Group by date
        const logsByDate = {};
        logs.forEach(log => {
            const dateKey = new Date(log.login_time).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            if (!logsByDate[dateKey]) logsByDate[dateKey] = [];
            logsByDate[dateKey].push(log);
        });

        container.innerHTML = '';
        Object.keys(logsByDate).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
            const dayGroup  = document.createElement('div');
            dayGroup.className = 'day-group';

            const dayHeader = document.createElement('div');
            dayHeader.className   = 'day-group-header';
            dayHeader.textContent = date;
            dayGroup.appendChild(dayHeader);

            logsByDate[date].forEach(log => dayGroup.appendChild(createLogItem(log)));
            container.appendChild(dayGroup);
        });

    } catch (error) {
        console.error('Error loading previous logs:', error);
        container.innerHTML = '<p class="text-danger text-center">Failed to load logs.</p>';
    }
}

// Load monthly summary
async function loadMonthlySummary() {
    const container = document.getElementById('monthlySummary');
    container.innerHTML = '<p class="text-center text-muted">Loading...</p>';

    const month = parseInt(document.getElementById('monthSelect').value) + 1;
    const year  = document.getElementById('yearSelect').value;

    try {
        const response = await fetch(`../php/get_staffs_logs_full.php?filter=monthly&month=${month}&year=${year}`);
        const result   = await response.json();

        if (!result.success || result.logs.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:#64748b;padding:40px;">No records found for the selected month.</p>';
            return;
        }

        const logs        = result.logs;
        const loginCount  = logs.filter(l => l.login_time).length;
        const logoutCount = logs.filter(l => l.logout_time).length;
        const uniqueStaff = new Set(logs.map(l => `${l.FirstName} ${l.LastName}`)).size;

        const monthNames = ['January','February','March','April','May','June',
                            'July','August','September','October','November','December'];
        const monthName  = monthNames[month - 1];

        container.innerHTML = '';

        const summaryCard = document.createElement('div');
        summaryCard.className = 'summary-card';
        summaryCard.innerHTML = `
            <div class="summary-card-header">
                <div class="summary-month">${monthName} ${year}</div>
            </div>
            <div class="summary-stats">
                <div class="summary-stat-item">
                    <div class="summary-stat-label">Total Logins</div>
                    <div class="summary-stat-value">${loginCount}</div>
                </div>
                <div class="summary-stat-item">
                    <div class="summary-stat-label">Total Logouts</div>
                    <div class="summary-stat-value">${logoutCount}</div>
                </div>
                <div class="summary-stat-item">
                    <div class="summary-stat-label">Active Staff</div>
                    <div class="summary-stat-value">${uniqueStaff}</div>
                </div>
            </div>
        `;
        container.appendChild(summaryCard);

        // Group by staff
        const staffGroups = {};
        logs.forEach(log => {
            const key = `${log.FirstName} ${log.LastName}`;
            if (!staffGroups[key]) staffGroups[key] = { name: key, role: log.Role, logs: [] };
            staffGroups[key].logs.push(log);
        });

        Object.values(staffGroups).forEach(staff => {
            const staffCard     = document.createElement('div');
            staffCard.className = 'summary-card';
            staffCard.style.marginTop = '16px';

            const staffLogins  = staff.logs.filter(l => l.login_time).length;
            const staffLogouts = staff.logs.filter(l => l.logout_time).length;

            staffCard.innerHTML = `
                <div style="margin-bottom: 12px;">
                    <div style="font-weight:600;color:#1e293b;margin-bottom:4px;">${staff.name}</div>
                    <div style="font-size:13px;color:#64748b;">${staff.role}</div>
                </div>
                <div class="summary-stats">
                    <div class="summary-stat-item">
                        <div class="summary-stat-label">Logins</div>
                        <div class="summary-stat-value" style="font-size:20px;">${staffLogins}</div>
                    </div>
                    <div class="summary-stat-item">
                        <div class="summary-stat-label">Logouts</div>
                        <div class="summary-stat-value" style="font-size:20px;">${staffLogouts}</div>
                    </div>
                </div>
            `;
            container.appendChild(staffCard);
        });

    } catch (error) {
        console.error('Error loading monthly summary:', error);
        container.innerHTML = '<p class="text-danger text-center">Failed to load summary.</p>';
    }
}

// Populate month and year selectors
function populateMonthYearSelectors() {
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect  = document.getElementById('yearSelect');

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];

    monthNames.forEach((month, index) => {
        const option       = document.createElement('option');
        option.value       = index;
        option.textContent = month;
        if (index === new Date().getMonth()) option.selected = true;
        monthSelect.appendChild(option);
    });

    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= currentYear - 2; i--) {
        const option       = document.createElement('option');
        option.value       = i;
        option.textContent = i;
        if (i === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }
}

// Create log item element
function createLogItem(log) {
    const logItem     = document.createElement('div');
    logItem.className = 'staff-log-item';

    const loginTime  = log.login_time
        ? new Date(log.login_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '--';

    const logoutTime = log.logout_time
        ? new Date(log.logout_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '--';

    const isOnline   = log.logout_time === null;
    const statusClass = isOnline ? 'logged-in' : 'logged-out';
    const statusText  = isOnline ? 'Logged in' : 'Logged out';

    logItem.innerHTML = `
        <div class="login-status ${statusClass}"></div>
        <div class="staff-info">
            <p class="staff-status-text">${statusText}</p>
            <p class="staff-name">${log.FirstName} ${log.LastName}</p>
            <p class="staff-role">${log.Role}</p>
        </div>
        <div style="text-align: right;">
            <div class="staff-time">🟢 In: ${loginTime}</div>
            <div class="staff-time">🔴 Out: ${logoutTime}</div>
        </div>
    `;

    return logItem;
}