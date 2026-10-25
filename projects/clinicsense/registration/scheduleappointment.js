// Current step tracker
let currentStep = 1;
const totalSteps = 4;

// Guardian info loaded from session
let guardianInfo = {};

// Form data storage
const formData = {
    patient:     {},
    guardian:    {},
    appointment: {}
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    const fileInput       = document.getElementById('attachment');
    const fileNameDisplay = document.getElementById('fileName');

    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                fileNameDisplay.textContent = 'Selected: ' + e.target.files[0].name;
                fileNameDisplay.style.display = 'block';
            } else {
                fileNameDisplay.style.display = 'none';
            }
        });
    }

    loadAvailableSchedules();
    loadGuardianInfo();
    updateStepDisplay();
    // If coming from dashboard to view an appointment, preload and show Review & Confirm
    try {
        const stored = sessionStorage.getItem('viewAppointment');
        if (stored) {
            const a = JSON.parse(stored);
            // map appointment object to formData structure
            formData.patient = {
                firstName:  a.PatientFirstName || a.Patient_FName || a.FirstName || '',
                middleName: a.PatientMiddleName || a.Patient_MName || a.MiddleName || '',
                lastName:   a.PatientLastName || a.Patient_LName || a.LastName || '',
                age:        a.Age || a.Patient_Age || a.Age || '',
                sex:        a.Sex || a.sex || a.Gender || '' ,
                reason:     a.Reason || a.ReasonForAppointment || a.Reason_for_Appointment || a.Notes || '',
                diagnosis:  a.Diagnosis || a.ExistingDiagnosis || a.PastDiagnoses || '',
                attachment: a.Attachment || a.FileName || 'No file selected'
            };

            formData.guardian = {
                firstName:  a.GuardianFirstName || a.Guardian_FName || guardianInfo.firstname || '',
                middleName: a.GuardianMiddleName || a.Guardian_MName || guardianInfo.middlename || '',
                lastName:   a.GuardianLastName || a.Guardian_LName || guardianInfo.lastname || '',
                contact:    a.GuardianContact || a.Contact || guardianInfo.contact || '',
                relation:   a.GuardianRelation || a.Relation || a.guardian_relation || '',
                // guardian address removed — keep existing guardianInfo.address out of guardian payload
                address:    a.GuardianAddress || a.Guardian_Address || a.address || guardianInfo.address || '',
                income:     a.GuardianIncome || a.income || ''
            };

            formData.appointment = {
                date: a.AppointmentDate || a.Date || a.date || '',
                time: a.AppointmentTime || a.Time || a.time || '',
                type: a.Type || a.AppointmentType || a.type || '',
                notes: a.Notes || a.notes || ''
            };

            // render review & confirm (step 4)
            currentStep = 4;
            updateStepDisplay();
            populateReview();

            // hide edit/submit actions for view-only
            const actions = document.querySelectorAll('#step4 .d-flex, #step4 .disclaimer-section');
            actions.forEach(el => el.style.display = 'none');

            // remove the stored item so reloading doesn't keep it
            sessionStorage.removeItem('viewAppointment');
        }
    } catch (err) {
        console.error('Failed to load view appointment data', err);
    }
    // Make guardian relation editable when "Other" is selected
    const guardianRelationSelect = document.getElementById('guardianRelation');
    if (guardianRelationSelect) {
        guardianRelationSelect.addEventListener('change', function() {
            if (this.value === 'other') {
                // replace select with an input that keeps the same id so saveStepData works
                const inputHtml = '<input type="text" class="form-control" id="guardianRelation" placeholder="Specify relationship" required>';
                this.outerHTML = inputHtml;
                // focus the new input
                const newInput = document.getElementById('guardianRelation');
                if (newInput) newInput.focus();
            }
        });
    }
});

// Load guardian info and auto-fill read-only fields
async function loadGuardianInfo() {
    try {
        const response = await fetch('../php/get_user.php', { credentials: 'include' });
        const result   = await response.json();

        if (result.success) {
            guardianInfo = result.user;
            document.getElementById('guardianFirstName').value  = result.user.firstname  || '';
            document.getElementById('guardianMiddleName').value = result.user.middlename || '';
            document.getElementById('guardianLastName').value   = result.user.lastname   || '';
            document.getElementById('guardianContact').value    = result.user.contact    || '';
                const addrEl = document.getElementById('guardianAddress');
                if (addrEl) addrEl.value = result.user.address || '';
        } else {
            window.location.href = '../registration/Login1stpage.html';
        }
    } catch (error) {
        console.error('Error loading guardian info:', error);
    }
}

// Load available schedules from database
async function loadAvailableSchedules() {
    const select = document.getElementById('availableSchedule');

    try {
        const now   = new Date();
        const month = now.getMonth() + 1;
        const year  = now.getFullYear();

        // Fetch current month AND next month
        const [res1, res2] = await Promise.all([
            fetch(`../php/available_schedule.php?month=${month}&year=${year}&only_bookable=1`, { credentials: 'include' }),
            fetch(`../php/available_schedule.php?month=${month === 12 ? 1 : month + 1}&year=${month === 12 ? year + 1 : year}&only_bookable=1`, { credentials: 'include' })
        ]);

        const [data1, data2] = await Promise.all([res1.json(), res2.json()]);

        const schedules = [
            ...(data1.success ? data1.schedules : []),
            ...(data2.success ? data2.schedules : [])
        ];

        const available = schedules.filter(s => s.status === 'available' && isUpcomingSchedule(s.schedule_date, s.schedule_time));

        if (available.length === 0) {
            select.innerHTML = '<option value="">No available schedules at the moment</option>';
            return;
        }

        select.innerHTML = '<option value="">Select a schedule</option>';
        available.forEach(schedule => {
            const date      = new Date(schedule.schedule_date + 'T00:00:00');
            const formatted = date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const time      = formatTime(schedule.schedule_time);
            const option    = document.createElement('option');
            option.value    = JSON.stringify({ date: schedule.schedule_date, time: schedule.schedule_time });
            option.textContent = `${formatted} — ${time}`;
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Error loading schedules:', error);
        select.innerHTML = '<option value="">Failed to load schedules</option>';
    }
}

// Navigate to next step
function nextStep() {
    if (validateCurrentStep()) {
        if (currentStep < totalSteps) {
            saveStepData();
            currentStep++;
            updateStepDisplay();
            if (currentStep === 4) {
                populateReview();
            }
        }
    }
}

// Navigate to previous step
function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateStepDisplay();
    }
}

// Update step display
function updateStepDisplay() {
    document.querySelectorAll('.step').forEach((step, index) => {
        const stepNum = index + 1;
        if (stepNum === currentStep) {
            step.classList.add('active');
        } else if (stepNum < currentStep) {
            step.classList.add('completed');
            step.classList.remove('active');
        } else {
            step.classList.remove('active', 'completed');
        }
    });

    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById('step' + i);
        if (el) el.classList.add('d-none');
    }

    const el = document.getElementById('step' + currentStep);
    if (el) el.classList.remove('d-none');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Validate current step
function validateCurrentStep() {
    if (currentStep === 1) {
        const form = document.getElementById('appointmentForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return false;
        }
    } else if (currentStep === 2) {
        const form = document.getElementById('guardianForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return false;
        }
    } else if (currentStep === 3) {
        const form = document.getElementById('appointmentDetailsForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return false;
        }
        const scheduleSelect = document.getElementById('availableSchedule');
        if (!scheduleSelect.value) {
            alert('Please select an available schedule.');
            return false;
        }
    }
    return true;
}

// Save current step data
function saveStepData() {
    if (currentStep === 1) {
        formData.patient = {
            firstName:  document.getElementById('firstName').value,
            middleName: document.getElementById('middleName').value,
            lastName:   document.getElementById('lastName').value,
            age:        document.getElementById('age').value,
            sex:        document.getElementById('sex').value,
            reason:     document.getElementById('reason').value,
            diagnosis:  document.getElementById('diagnosis').value,
            // patient address input under Age/Sex
            address:    (document.getElementById('patientAddress') ? document.getElementById('patientAddress').value : formData.patient.address) || '',
            attachment: document.getElementById('attachment').files[0]?.name || 'No file selected'
        };
    } else if (currentStep === 2) {
        formData.guardian = {
            firstName:  guardianInfo.firstname  || '',
            middleName: guardianInfo.middlename || '',
            lastName:   guardianInfo.lastname   || '',
            contact:    guardianInfo.contact    || '',
            relation:   document.getElementById('guardianRelation').value,
            address:    (document.getElementById('guardianAddress') ? document.getElementById('guardianAddress').value : guardianInfo.address) || '',
            income:     document.getElementById('guardianIncome').value
        };
    } else if (currentStep === 3) {
        const scheduleValue  = document.getElementById('availableSchedule').value;
        const schedule       = scheduleValue ? JSON.parse(scheduleValue) : {};
        formData.appointment = {
            date:  schedule.date || '',
            time:  schedule.time || '',
            type:  document.getElementById('appointmentType').value,
            notes: document.getElementById('notes').value
        };
    }
}

// Populate review section
function populateReview() {
    const patientReview = document.getElementById('reviewPatient');
    if (patientReview) {
        patientReview.innerHTML = `
            <div class="review-item">
                <span class="review-label">Name:</span>
                <span class="review-value">${formData.patient.firstName} ${formData.patient.middleName || ''} ${formData.patient.lastName}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Address:</span>
                <span class="review-value">${formData.patient.address || 'Not provided'}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Age:</span>
                <span class="review-value">${formData.patient.age}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Sex:</span>
                <span class="review-value">${formData.patient.sex}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Reason:</span>
                <span class="review-value">${formData.patient.reason || 'Not provided'}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Diagnosis:</span>
                <span class="review-value">${formData.patient.diagnosis || 'None'}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Attachment:</span>
                <span class="review-value">${formData.patient.attachment}</span>
            </div>
        `;
    }

    const guardianReview = document.getElementById('reviewGuardian');
    if (guardianReview) {
        guardianReview.innerHTML = `
            <div class="review-item">
                <span class="review-label">Name:</span>
                <span class="review-value">${formData.guardian.firstName} ${formData.guardian.middleName || ''} ${formData.guardian.lastName}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Contact:</span>
                <span class="review-value">${formData.guardian.contact}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Relationship:</span>
                <span class="review-value">${formData.guardian.relation}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Address:</span>
                <span class="review-value">${formData.guardian.address || 'Not provided'}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Monthly Income:</span>
                <span class="review-value">${formData.guardian.income}</span>
            </div>
        `;
    }

    const appointmentReview = document.getElementById('reviewAppointment');
    if (appointmentReview) {
        const date          = new Date(formData.appointment.date + 'T00:00:00');
        const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        appointmentReview.innerHTML = `
            <div class="review-item">
                <span class="review-label">Date:</span>
                <span class="review-value">${formattedDate}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Time:</span>
                <span class="review-value">${formatTime(formData.appointment.time)}</span>
            </div>
            <div class="review-item">
                <span class="review-label">Type:</span>
                <span class="review-value">${formData.appointment.type}</span>
            </div>
        `;
    }

    const notesReview = document.getElementById('reviewNotes');
    if (notesReview) {
        notesReview.innerHTML = formData.appointment.notes?.trim()
            ? `<div class="notes-content">${formData.appointment.notes}</div>`
            : '<div class="notes-content text-muted">No additional notes provided.</div>';
    }
}

// Format time for display
function formatTime(time) {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour        = parseInt(hours);
    const ampm        = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

// Submit appointment
async function submitAppointment() {
    const policyAgreement = document.getElementById('policyAgreement');
    const incomeAgreement = document.getElementById('incomeAgreement');
    const consultationFee = document.getElementById('consultationFeeAgreement');
    const submitButton = document.querySelector('#step4 .btn-success');

    if (!policyAgreement.checked || !incomeAgreement.checked || !consultationFee.checked) {
        showResultPopup('Please acknowledge all agreements before submitting.', 'Validation', true);
        return;
    }

    saveStepData();

    const formDataToSend = new FormData();
    formDataToSend.append('firstName',        formData.patient.firstName);
    formDataToSend.append('middleName',       formData.patient.middleName);
    formDataToSend.append('lastName',         formData.patient.lastName);
    formDataToSend.append('patientAddress',   formData.patient.address || '');
    formDataToSend.append('age',              formData.patient.age);
    formDataToSend.append('sex',              formData.patient.sex);
    formDataToSend.append('reason',           formData.patient.reason);
    formDataToSend.append('diagnosis',        formData.patient.diagnosis);
    formDataToSend.append('guardianRelation', formData.guardian.relation);
    formDataToSend.append('guardianAddress',  formData.guardian.address);
    formDataToSend.append('income',           formData.guardian.income);
    formDataToSend.append('date',             formData.appointment.date);
    formDataToSend.append('time',             formData.appointment.time);
    formDataToSend.append('type',             formData.appointment.type);
    formDataToSend.append('notes',            formData.appointment.notes);

    if (submitButton) {
        submitButton.disabled = true;
    }

    try {
        const response = await fetch('../php/save_appointment.php', {
            method: 'POST',
            body:   formDataToSend,
            credentials: 'include'
        });

        const result = await response.json();

        if (result.success) {
            showResultPopup('Appointment scheduled successfully! Your appointment ID is: ' + result.appointmentId, 'Success', false);
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            if ((result.message || '').toLowerCase().includes('schedule')) {
                await loadAvailableSchedules();
                currentStep = 3;
                updateStepDisplay();
            }
            showResultPopup('Error: ' + result.message, 'Error', true);
        }
    } catch (error) {
        showResultPopup('Error saving appointment: ' + error.message, 'Error', true);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
}

// Reset form
function resetForm() {
    currentStep          = 1;
    formData.patient     = {};
    formData.guardian    = {};
    formData.appointment = {};
    document.querySelectorAll('form').forEach(form => form.reset());
    const fileNameDisplay = document.getElementById('fileName');
    if (fileNameDisplay) fileNameDisplay.style.display = 'none';
    updateStepDisplay();
}

function isUpcomingSchedule(dateStr, timeStr) {
    if (!dateStr || !timeStr) return false;
    const scheduleDateTime = new Date(`${dateStr}T${timeStr}`);
    return !Number.isNaN(scheduleDateTime.getTime()) && scheduleDateTime >= new Date();
}

// Utility: show modal popup for results (replaces alert())
function showResultPopup(message, title = 'Notice', isError = false) {
    const modalEl = document.getElementById('appointmentResultModal');
    if (!modalEl) {
        // fallback
        alert((title ? title + ': ' : '') + message);
        return;
    }
    const titleEl = document.getElementById('appointmentResultModalLabel');
    const bodyEl  = document.getElementById('appointmentResultModalBody');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = `<div class="${isError ? 'text-danger' : 'text-body'}">${message}</div>`;
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}