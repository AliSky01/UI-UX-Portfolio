let appointmentBookings = [];
let patientChartData = [];

// Pagination variables
let currentPage  = 1;
const itemsPerPage = 5;
let totalPages   = 1;

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function(character) {
        const replacements = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return replacements[character] || character;
    });
}

function buildPatientName(record) {
    return [
        record.PatientFirstName || record.FirstName,
        record.PatientMiddleName || record.MiddleName,
        record.PatientLastName || record.LastName
    ].filter(Boolean).join(' ').trim();
}

function getAppointmentDisplayName(appointment) {
    const patientName = buildPatientName(appointment);
    if (patientName) return patientName;
    return [
        appointment.GuardianFirstName,
        appointment.GuardianMiddleName,
        appointment.GuardianLastName
    ].filter(Boolean).join(' ').trim() || 'Unknown Patient';
}

function formatDisplayDate(dateValue) {
    if (!dateValue) return '--';
    const parsedDate = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return '--';
    return `${String(parsedDate.getMonth() + 1).padStart(2, '0')}/${String(parsedDate.getDate()).padStart(2, '0')}/${parsedDate.getFullYear()}`;
}

function getAppointmentStatusClass(status) {
    const normalizedStatus = String(status || '').toLowerCase().trim();
    if (normalizedStatus === 'confirmed') return 'status-confirmed';
    if (normalizedStatus === 'cancelled') return 'status-cancelled';
    if (normalizedStatus === 'pending') return 'status-pending';
    return '';
}

function formatAppointmentStatus(status) {
    const normalizedStatus = String(status || '').toLowerCase().trim();
    if (normalizedStatus === 'confirmed') return 'Confirmed';
    if (normalizedStatus === 'cancelled') return 'Cancelled';
    if (normalizedStatus === 'pending') return 'Pending';
    return status || '--';
}

function formatPatientSex(sex) {
    const normalizedSex = String(sex || '').trim();
    if (!normalizedSex) return '--';
    if (normalizedSex.length === 1) return normalizedSex.toUpperCase();
    return normalizedSex.charAt(0).toUpperCase() + normalizedSex.slice(1).toLowerCase();
}

// Load All Activities
async function loadUpcomingAppointments() {
    const container = document.getElementById('upcomingAppointments');
    if (!container) return;

    container.innerHTML = '<p class="text-muted text-center">Loading activities...</p>';

    try {
        const response = await fetch('../php/get_admin_dashboard_activities.php', {
            credentials: 'include'
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || `HTTP ${response.status}`);
        }

        const activities = Array.isArray(result.activities) ? result.activities : [];
        container.innerHTML = '';

        if (!activities.length) {
            container.innerHTML = '<p class="text-muted text-center">No recent activities found</p>';
            return;
        }

        activities.forEach(activity => {
            const activityItem = document.createElement('div');
            activityItem.className = 'appointment-item';

            let iconColor = '#0284c7';
            if (activity.type === 'diagnosis') iconColor = '#10b981';
            else if (activity.type === 'prescription') iconColor = '#f59e0b';
            else if (activity.type === 'medical-intake') iconColor = '#8b5cf6';

            activityItem.innerHTML = `
                <div class="appointment-details" style="display: flex; align-items: center; gap: 12px;">
                    <i class="bi ${escapeHtml(activity.icon || 'bi-activity')}" style="font-size: 20px; color: ${iconColor};"></i>
                    <div>
                        <p class="appointment-name">${escapeHtml(activity.name || 'Unknown Patient')}</p>
                        <p class="appointment-contact" style="font-size: 12px; color: #6c757d;">${escapeHtml(activity.description || 'Activity update')}</p>
                    </div>
                </div>
                <div class="appointment-datetime">
                    <p class="appointment-date">${escapeHtml(formatActivityDate(activity.timestamp))}</p>
                    <p class="appointment-time">${escapeHtml(activity.timeKnown ? formatActivityTime(activity.timestamp) : '--')}</p>
                </div>
            `;
            container.appendChild(activityItem);
        });
    } catch (error) {
        console.error('Error loading dashboard activities:', error);
        container.innerHTML = '<p class="text-danger text-center">Failed to load activities</p>';
    }
}

function formatActivityDate(timestamp) {
    const parsedDate = new Date(timestamp || '');
    if (Number.isNaN(parsedDate.getTime())) return '--';
    return parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatActivityTime(timestamp) {
    const parsedDate = new Date(timestamp || '');
    if (Number.isNaN(parsedDate.getTime())) return '--';
    return parsedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatTime(time) {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour        = parseInt(hours);
    const ampm        = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Load Staff Logs
async function loadStaffLogs() {
    const container = document.getElementById('staffLogins');
    container.innerHTML = '<p class="text-muted text-center">Loading...</p>';

    try {
        const response = await fetch('../php/get_staff_logs.php');
        const result   = await response.json();

        if (!result.success || result.logs.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No logs found</p>';
            return;
        }

        container.innerHTML = '';

        result.logs.forEach(staff => {
            const staffItem = document.createElement('div');
            staffItem.className = 'staff-login-item';

            const statusBadge = staff.is_online == 1
                ? '<span class="badge bg-success">Online</span>'
                : '<span class="badge bg-secondary">Offline</span>';

            const timeIn  = staff.login_time
                ? new Date(staff.login_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : '--';
            const timeOut = staff.logout_time
                ? new Date(staff.logout_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                : '--';

            staffItem.innerHTML = `
                <div class="staff-info">
                    <p class="staff-name">${staff.FirstName} ${staff.LastName}</p>
                    <p class="staff-role">${staff.Role}</p>
                </div>
                <div class="staff-details">
                    ${statusBadge}
                    <p class="staff-time">🟢 In: ${timeIn}</p>
                    <p class="staff-time">🔴 Out: ${timeOut}</p>
                </div>
            `;
            container.appendChild(staffItem);
        });

    } catch (error) {
        console.error('Error loading staff logs:', error);
        container.innerHTML = '<p class="text-danger text-center">Failed to load logs</p>';
    }
}

// Load Appointment Table
async function loadAppointmentBookingTable() {
    const tbody = document.getElementById('appointmentTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Loading appointments...</td></tr>';

    try {
        const response = await fetch('../php/get_admin_dashboard_appointments.php', {
            credentials: 'include'
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || `HTTP ${response.status}`);
        }

        appointmentBookings = Array.isArray(result.appointments) ? result.appointments : [];
    } catch (error) {
        console.error('Error loading dashboard appointments:', error);
        appointmentBookings = [];
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Failed to load appointments</td></tr>';
        return;
    }

    tbody.innerHTML = '';

    if (!appointmentBookings.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No appointments found</td></tr>';
        return;
    }

    appointmentBookings.forEach((appointment, index) => {
        const tr = document.createElement('tr');
        const statusClass = getAppointmentStatusClass(appointment.Status);
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${escapeHtml(getAppointmentDisplayName(appointment))}</td>
            <td>${escapeHtml(formatDisplayDate(appointment.AppointmentDate))}</td>
            <td>${escapeHtml(formatTime(appointment.AppointmentTime))}</td>
            <td>${escapeHtml(appointment.GuardianContact || '--')}</td>
            <td><span class="status-badge ${statusClass}">${escapeHtml(formatAppointmentStatus(appointment.Status))}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Load Patient Chart
async function loadPatientChartData() {
    const tbody = document.getElementById('patientTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Loading patients...</td></tr>';

    try {
        const response = await fetch('../php/get_admin_dashboard_patients.php', {
            credentials: 'include'
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || `HTTP ${response.status}`);
        }

        patientChartData = Array.isArray(result.patients) ? result.patients : [];
        totalPages  = Math.max(1, Math.ceil(patientChartData.length / itemsPerPage));
        currentPage = Math.min(currentPage, totalPages);
        loadPatientChart();
    } catch (error) {
        console.error('Error loading dashboard patients:', error);
        patientChartData = [];
        totalPages  = 1;
        currentPage = 1;
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Failed to load patients</td></tr>';
    }
}

function loadPatientChart() {
    const tbody = document.getElementById('patientTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!patientChartData.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No patients found</td></tr>';
        updatePaginationControls();
        return;
    }

    const startIndex    = (currentPage - 1) * itemsPerPage;
    const paginatedData = patientChartData.slice(startIndex, startIndex + itemsPerPage);

    paginatedData.forEach(patient => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(buildPatientName(patient) || 'Unknown Patient')}</td>
            <td>${escapeHtml(patient.Age || '--')}</td>
            <td>${escapeHtml(formatPatientSex(patient.Sex))}</td>
            <td>${escapeHtml(patient.Diagnosis || 'Not specified')}</td>
        `;
        tbody.appendChild(tr);
    });

    updatePaginationControls();
}

function updatePaginationControls() {
    const currentPageElement = document.getElementById('currentPage');
    totalPages = Math.max(1, Math.ceil(patientChartData.length / itemsPerPage));
    currentPageElement.textContent  = currentPage;
    currentPageElement.style.fontWeight = '500';
    currentPageElement.style.color      = '#475569';

    const pageNumbersContainer = document.getElementById('pageNumbers');
    pageNumbersContainer.innerHTML = '';

    for (let i = 2; i <= totalPages; i++) {
        const pageNumber       = document.createElement('span');
        pageNumber.textContent = i;
        pageNumber.style.marginLeft = '8px';
        pageNumber.style.cursor     = 'pointer';
        pageNumber.style.color      = '#475569';
        pageNumber.style.fontWeight = '500';
        pageNumber.addEventListener('click', () => {
            currentPage = i;
            loadPatientChart();
        });
        pageNumbersContainer.appendChild(pageNumber);
    }

    document.getElementById('prevPage').disabled = currentPage === 1 || patientChartData.length === 0;
    document.getElementById('nextPage').disabled = currentPage === totalPages || patientChartData.length === 0;
}

// Update Stats
async function updateStats() {
    try {
        const response = await fetch('../php/get_active_patient_count.php', {
            credentials: 'include'
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || `HTTP ${response.status}`);
        }

        document.getElementById('totalCensus').textContent = String(result.count ?? 0);
    } catch (error) {
        console.error('Error loading total census:', error);
        document.getElementById('totalCensus').textContent = '0';
    }

}

// Load Finance Stats
async function loadFinanceStats() {
    try {
        const response = await fetch('../php/get_finance_summary.php');
        const result   = await response.json();
        if (!result.success) return;

        const formatter = new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });

        const incomeEl = document.querySelector('.income-card .stat-value-large');
        const unpaidEl = document.querySelector('.unpaid-card .stat-value-large');
        if (incomeEl) incomeEl.textContent = formatter.format(result.income);
        if (unpaidEl) unpaidEl.textContent = formatter.format(result.unpaidBalance);

    } catch (error) {
        console.error('Error loading finance stats:', error);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    loadUpcomingAppointments();
    loadStaffLogs();
    loadAppointmentBookingTable();
    loadPatientChartData();
    updateStats();
    loadFinanceStats();

    document.getElementById('prevPage').addEventListener('click', function() {
        if (currentPage > 1) { currentPage--; loadPatientChart(); }
    });

    document.getElementById('nextPage').addEventListener('click', function() {
        if (currentPage < totalPages) { currentPage++; loadPatientChart(); }
    });

    document.getElementById('currentPage').addEventListener('click', function() {
        currentPage = 1;
        loadPatientChart();
    });

    const searchInput = document.querySelector('.search-input');
    searchInput.addEventListener('input', function(e) {
        console.log('Searching for:', e.target.value.toLowerCase());
    });

    const manageUserBtn = document.getElementById('manageUserBtn');
    if (manageUserBtn) {
        manageUserBtn.addEventListener('click', function() {
            window.location.href = 'manageuser.html';
        });
    }
});

// Refresh staff logs every minute
setInterval(function() {
    loadStaffLogs();
}, 60000);