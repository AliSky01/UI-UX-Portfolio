// =====================
// STATE
// =====================
const today        = new Date();
let currentMonth   = today.getMonth();
let currentYear    = today.getFullYear();
let selectedDate   = null;

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', function () {
    generateCalendar(currentMonth, currentYear);
    bindNavButtons();
    bindSetScheduleBtn();
    bindSaveDateScheduleBtn();
    bindRemoveDateScheduleBtn();
    bindSaveDefaultScheduleBtn();
    bindSearchAndFilter();
    loadAppointmentsTable();
});

// =====================
// CALENDAR GENERATION
// =====================
function generateCalendar(month, year) {
    const monthNames = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
                        'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

    document.getElementById('calendarMonthYear').textContent = `${monthNames[month]} ${year}`;

    const firstDay     = new Date(year, month, 1).getDay();
    const daysInMonth  = new Date(year, month + 1, 0).getDate();
    const container    = document.getElementById('calendarDaysContainer');
    container.innerHTML = '';

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        container.appendChild(empty);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';

        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            cell.classList.add('today');
        }

        const dayNumber = document.createElement('div');
        dayNumber.className  = 'day-number';
        dayNumber.textContent = day;
        cell.appendChild(dayNumber);

        cell.setAttribute('data-day',   day);
        cell.setAttribute('data-month', month);
        cell.setAttribute('data-year',  year);

        cell.addEventListener('click', function (e) {
            if (e.target.classList.contains('event') || e.target.closest('.event')) return;
            openDateScheduleModal(day, month, year);
        });

        container.appendChild(cell);
    }

    // Load schedules and appointments for this month
    loadMonthSchedules(month, year);
    loadMonthAppointments(month, year);
}

// =====================
// NAV BUTTONS
// =====================
function bindNavButtons() {
    document.getElementById('prevMonth').addEventListener('click', function () {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        generateCalendar(currentMonth, currentYear);
    });

    document.getElementById('nextMonth').addEventListener('click', function () {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        generateCalendar(currentMonth, currentYear);
    });
}

// =====================
// LOAD SCHEDULES FROM DB → HIGHLIGHT CALENDAR
// =====================
async function loadMonthSchedules(month, year) {
    try {
        const response = await fetch(`../php/available_schedule.php?month=${month + 1}&year=${year}`);
        const result   = await response.json();

        if (!result.success) return;

        const schedules = result.schedules;

        document.querySelectorAll('.calendar-day:not(.empty)').forEach(cell => {
            const day         = parseInt(cell.getAttribute('data-day'));
            const dateString  = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // Remove old schedule info
            cell.classList.remove('available-day', 'unavailable-day');
            const old = cell.querySelector('.schedule-info');
            if (old) old.remove();

            // Find matching schedule
            const match = schedules.find(s => s.schedule_date === dateString);

            if (match && match.status === 'available') {
                cell.classList.add('available-day');

                const info = document.createElement('div');
                info.className   = 'schedule-info';
                info.textContent = formatTime24to12(match.schedule_time);
                cell.appendChild(info);
            }
        });

    } catch (error) {
        console.error('Error loading schedules:', error);
    }
}

// =====================
// LOAD APPOINTMENTS FROM DB → SHOW ON CALENDAR
// =====================
async function loadMonthAppointments(month, year) {
    try {
        const response = await fetch(`../php/get_appointments.php?month=${month + 1}&year=${year}`);
        const result   = await response.json();

        if (!result.success) return;

        document.querySelectorAll('.calendar-day:not(.empty)').forEach(cell => {
            const day        = parseInt(cell.getAttribute('data-day'));
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // Remove old appointment events
            cell.querySelectorAll('.appointment-event').forEach(e => e.remove());

            const dayAppointments = result.appointments.filter(a => a.AppointmentDate === dateString);
            dayAppointments.forEach(apt => {
                const event       = document.createElement('div');
                event.className   = 'appointment-event';
                event.textContent = `${apt.GuardianFirstName} ${apt.GuardianLastName}`;
                event.title       = `${apt.GuardianFirstName} ${apt.GuardianLastName} - ${formatTime24to12(apt.AppointmentTime)}`;
                cell.appendChild(event);
            });
        });

    } catch (error) {
        console.error('Error loading appointments:', error);
    }
}

// =====================
// LOAD APPOINTMENTS TABLE
// =====================
async function loadAppointmentsTable() {
    try {
        const response = await fetch('../php/get_appointments.php');
        const result   = await response.json();

        if (!result.success) return;

        const tbody = document.querySelector('tbody');
        tbody.innerHTML = '';

        result.appointments.forEach((apt, index) => {
            const date = new Date(apt.AppointmentDate + 'T00:00:00');
            const formattedDate = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;

            let statusClass = '';
            if (apt.Status === 'confirmed')  statusClass = 'status-confirmed';
            else if (apt.Status === 'pending')    statusClass = 'status-pending';
            else if (apt.Status === 'cancelled')  statusClass = 'status-cancelled';
            else if (apt.Status === 'complete')   statusClass = 'status-complete';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td><a href="#" class="patient-name-link">${apt.GuardianFirstName} ${apt.GuardianLastName}</a></td>
                <td>${apt.GuardianRelation}</td>
                <td>${apt.Symptoms || '-'}</td>
                <td>${formattedDate}</td>
                <td>${formatTime24to12(apt.AppointmentTime)}</td>
                <td>${apt.GuardianContact || '-'}</td>
                <td><span class="badge ${statusClass}">${apt.Status}</span></td>
                <td>
                    <div class="dropdown">
                        <button class="btn btn-action-menu" type="button" data-bs-toggle="dropdown">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="#">View Details</a></li>
                            <li><a class="dropdown-item text-danger" href="#" onclick="cancelAppointment(${apt.AppointmentID})">Cancel</a></li>
                        </ul>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error loading appointments table:', error);
    }
}

// =====================
// CANCEL APPOINTMENT
// =====================
async function cancelAppointment(appointmentId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;

    try {
        const response = await fetch('../php/update_appointment_status.php', {
            method: 'POST',
            body:   new URLSearchParams({ appointment_id: appointmentId, status: 'cancelled' })
        });
        const result = await response.json();

        if (result.success) {
            alert('Appointment cancelled successfully!');
            loadAppointmentsTable();
            loadMonthAppointments(currentMonth, currentYear);
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Error cancelling appointment:', error);
    }
}

// =====================
// DATE SCHEDULE MODAL
// =====================
function openDateScheduleModal(day, month, year) {
    selectedDate = {
        day:        day,
        month:      month,
        year:       year,
        dateString: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    document.getElementById('dateScheduleDateText').textContent = `${monthNames[month]} ${day}, ${year}`;

    // Check if schedule already exists
    checkExistingSchedule(selectedDate.dateString);

    const modal = new bootstrap.Modal(document.getElementById('dateScheduleModal'));
    modal.show();
}

async function checkExistingSchedule(dateString) {
    const [year, month] = dateString.split('-').map(Number);
    const removeBtn = document.getElementById('removeDateScheduleBtn');

    try {
        const response = await fetch(`../php/available_schedule.php?month=${month}&year=${year}`);
        const result   = await response.json();

        if (!result.success) return;

        const match = result.schedules.find(s => s.schedule_date === dateString);

        if (match) {
            removeBtn.style.display = 'inline-block';

            // Pre-fill time from saved schedule
            const [h, m] = match.schedule_time.split(':').map(Number);
            const period  = h >= 12 ? 'PM' : 'AM';
            const hour12  = h % 12 || 12;

            document.getElementById('dateScheduleFromHour').value   = hour12;
            document.getElementById('dateScheduleFromMinute').value = String(m).padStart(2, '0');
            document.querySelector(`input[name="dateScheduleFromPeriod"][value="${period}"]`).checked = true;
        } else {
            removeBtn.style.display = 'none';
            // Reset defaults
            document.getElementById('dateScheduleEnabled').checked       = true;
            document.getElementById('dateScheduleFromHour').value        = 9;
            document.getElementById('dateScheduleFromMinute').value      = '00';
            document.querySelector('input[name="dateScheduleFromPeriod"][value="AM"]').checked = true;
            document.getElementById('dateScheduleToHour').value          = 1;
            document.getElementById('dateScheduleToMinute').value        = '00';
            document.querySelector('input[name="dateScheduleToPeriod"][value="PM"]').checked   = true;
        }
    } catch (error) {
        console.error('Error checking schedule:', error);
    }
}

function bindSaveDateScheduleBtn() {
    document.getElementById('saveDateScheduleBtn').addEventListener('click', async function () {
        if (!selectedDate) return;

        const fromHour   = parseInt(document.getElementById('dateScheduleFromHour').value) || 9;
        const fromMinute = parseInt(document.getElementById('dateScheduleFromMinute').value) || 0;
        const fromPeriod = document.querySelector('input[name="dateScheduleFromPeriod"]:checked').value;

        // Convert to 24hr
        let hour24 = fromHour;
        if (fromPeriod === 'PM' && fromHour !== 12) hour24 = fromHour + 12;
        if (fromPeriod === 'AM' && fromHour === 12) hour24 = 0;

        const scheduleTime = `${String(hour24).padStart(2, '0')}:${String(fromMinute).padStart(2, '0')}:00`;

        try {
            const response = await fetch('../php/available_schedule.php', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    schedule_date: selectedDate.dateString,
                    schedule_time: scheduleTime
                })
            });
            const result = await response.json();

            if (result.success) {
                alert(`Schedule saved for ${document.getElementById('dateScheduleDateText').textContent}!`);
                bootstrap.Modal.getInstance(document.getElementById('dateScheduleModal')).hide();
                loadMonthSchedules(currentMonth, currentYear);
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error('Error saving schedule:', error);
        }
    });
}

function bindRemoveDateScheduleBtn() {
    document.getElementById('removeDateScheduleBtn').addEventListener('click', async function () {
        if (!selectedDate) return;
        if (!confirm(`Remove schedule for ${document.getElementById('dateScheduleDateText').textContent}?`)) return;

        try {
            const response = await fetch('../php/delete_schedule.php', {
                method: 'POST',
                body:   new URLSearchParams({ schedule_date: selectedDate.dateString })
            });
            const result = await response.json();

            if (result.success) {
                alert('Schedule removed!');
                bootstrap.Modal.getInstance(document.getElementById('dateScheduleModal')).hide();
                loadMonthSchedules(currentMonth, currentYear);
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error('Error removing schedule:', error);
        }
    });
}

// =====================
// DEFAULT WEEKLY SCHEDULE MODAL
// =====================
function bindSetScheduleBtn() {
    document.getElementById('setScheduleBtn').addEventListener('click', function () {
        selectedDate = null;
        const modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
        modal.show();
    });
}

function bindSaveDefaultScheduleBtn() {
    document.querySelector('#scheduleModal .btn-save-schedule').addEventListener('click', async function () {
        const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
        const dayIndexMap = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
        const schedules = [];

        // Generate dates for next 4 weeks for each checked day
        days.forEach(day => {
            const checkbox = document.getElementById(day);
            if (!checkbox || !checkbox.checked) return;

            const fromHour   = parseInt(document.getElementById(`${day}-from-hour`).value) || 9;
            const fromMinute = parseInt(document.getElementById(`${day}-from-minute`).value) || 0;
            const fromPeriod = document.querySelector(`input[name="${day}-from-period"]:checked`).value;

            let hour24 = fromHour;
            if (fromPeriod === 'PM' && fromHour !== 12) hour24 = fromHour + 12;
            if (fromPeriod === 'AM' && fromHour === 12) hour24 = 0;

            const scheduleTime = `${String(hour24).padStart(2, '0')}:${String(fromMinute).padStart(2, '0')}:00`;

            // Find next 8 occurrences of this weekday
            const targetDay = dayIndexMap[day];
            const date      = new Date();

            for (let i = 0; i < 8; i++) {
                const d = new Date(date);
                d.setDate(date.getDate() + ((targetDay - date.getDay() + 7) % 7) + (i * 7));
                const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                schedules.push({ schedule_date: dateString, schedule_time: scheduleTime });
            }
        });

        // Save each schedule to database
        let saved = 0;
        for (const schedule of schedules) {
            try {
                const response = await fetch('../php/available_schedule.php', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(schedule)
                });
                const result = await response.json();
                if (result.success) saved++;
            } catch (error) {
                console.error('Error saving schedule:', error);
            }
        }

        alert(`${saved} schedule slots saved successfully!`);
        bootstrap.Modal.getInstance(document.getElementById('scheduleModal')).hide();
        loadMonthSchedules(currentMonth, currentYear);
    });
}

// =====================
// SEARCH AND FILTER
// =====================
function bindSearchAndFilter() {
    const searchInput  = document.getElementById('searchInput');
    const searchBtn    = document.getElementById('searchBtn');
    const statusFilter = document.getElementById('statusFilter');

    function filterTable() {
        const searchTerm     = searchInput.value.toLowerCase();
        const selectedStatus = statusFilter.value.toLowerCase();

        document.querySelectorAll('tbody tr').forEach(row => {
            const nameCell   = row.querySelector('td:nth-child(2)');
            const statusBadge = row.querySelector('.badge');
            if (!nameCell || !statusBadge) return;

            const name   = nameCell.textContent.toLowerCase();
            const status = statusBadge.textContent.toLowerCase();

            const matchesSearch = name.includes(searchTerm);
            const matchesStatus = selectedStatus === 'all' || status.includes(selectedStatus.replace('_', ' '));

            row.style.display = matchesSearch && matchesStatus ? '' : 'none';
        });
    }

    searchBtn.addEventListener('click', filterTable);
    searchInput.addEventListener('keyup', e => { if (e.key === 'Enter') filterTable(); });
    statusFilter.addEventListener('change', filterTable);
}

// =====================
// HELPERS
// =====================
function formatTime24to12(time) {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const period      = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
}