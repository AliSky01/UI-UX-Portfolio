(function() {
    'use strict';

    const state = {
        patients: [],
        patientStatusFilter: 'admitted',
        patientSearchTerm: '',
        selectedPatientId: null,
        selectedDiagnosisForAction: null,
        currentPatientPrescriptions: [],
        currentMedicationIntakeEntries: [],
        selectedMedicationDateKey: null,
        medicationCalendarMonth: null,
        medicationCalendarYear: null,
        doctors: [],
        forAdmissionAppointments: [],
        selectedAdmissionAppointmentId: null
    };

    let adminPatientActionConfirmResolver = null;

    function getAdminPatientActionConfig(variant) {
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
                buttonClass: 'btn btn-danger'
            }
        };

        return variants[variant] || variants.primary;
    }

    function showAdminPatientActionFeedback(message, title = 'Notice', variant = 'success') {
        const modal = document.getElementById('adminPatientActionFeedbackModal');
        if (!modal) {
            return;
        }

        const config = getAdminPatientActionConfig(variant);
        const titleEl = document.getElementById('adminPatientActionFeedbackTitle');
        const messageEl = document.getElementById('adminPatientActionFeedbackMessage');
        const badgeEl = document.getElementById('adminPatientActionFeedbackBadge');
        const buttonEl = document.getElementById('adminPatientActionFeedbackButton');

        if (titleEl) {
            titleEl.textContent = title;
        }

        if (messageEl) {
            messageEl.textContent = message;
        }

        if (badgeEl) {
            badgeEl.className = config.badgeClass;
            badgeEl.innerHTML = `<i class="${config.iconClass}"></i>`;
        }

        if (buttonEl) {
            buttonEl.className = config.buttonClass;
            buttonEl.textContent = 'OK';
        }

        modal.style.display = 'flex';
    }

    function closeAdminPatientActionFeedbackModal() {
        const modal = document.getElementById('adminPatientActionFeedbackModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    function showAdminPatientActionConfirm(message, title = 'Confirm Save', variant = 'primary', confirmLabel = 'Save') {
        const modal = document.getElementById('adminPatientActionConfirmModal');
        if (!modal) {
            return Promise.resolve(false);
        }

        if (typeof adminPatientActionConfirmResolver === 'function') {
            adminPatientActionConfirmResolver(false);
            adminPatientActionConfirmResolver = null;
        }

        const config = getAdminPatientActionConfig(variant);
        const titleEl = document.getElementById('adminPatientActionConfirmTitle');
        const messageEl = document.getElementById('adminPatientActionConfirmMessage');
        const badgeEl = document.getElementById('adminPatientActionConfirmBadge');
        const buttonEl = document.getElementById('adminPatientActionConfirmButton');

        if (titleEl) {
            titleEl.textContent = title;
        }

        if (messageEl) {
            messageEl.textContent = message;
        }

        if (badgeEl) {
            badgeEl.className = config.badgeClass;
            badgeEl.innerHTML = `<i class="${config.iconClass}"></i>`;
        }

        if (buttonEl) {
            buttonEl.className = config.buttonClass;
            buttonEl.textContent = confirmLabel;
        }

        modal.style.display = 'flex';

        return new Promise(resolve => {
            adminPatientActionConfirmResolver = resolve;
        });
    }

    function resolveAdminPatientActionConfirm(result) {
        const modal = document.getElementById('adminPatientActionConfirmModal');
        if (modal) {
            modal.style.display = 'none';
        }

        if (typeof adminPatientActionConfirmResolver === 'function') {
            const resolve = adminPatientActionConfirmResolver;
            adminPatientActionConfirmResolver = null;
            resolve(result);
        }
    }

    window.closeAdminPatientActionFeedbackModal = closeAdminPatientActionFeedbackModal;
    window.resolveAdminPatientActionConfirm = resolveAdminPatientActionConfirm;
    window.showAdminPatientActionFeedback = showAdminPatientActionFeedback;
    window.showAdminPatientActionConfirm = showAdminPatientActionConfirm;

    function updatePsychiatricRecordValue(conditionText) {
        const medicalSubsections = document.querySelectorAll('.medical-subsection');
        const conditionRows = medicalSubsections[0]?.querySelectorAll('.personal-row') || [];
        if (conditionRows.length >= 2) {
            const psychiatricValue = conditionRows[1].querySelector('.personal-value');
            if (psychiatricValue) {
                psychiatricValue.textContent = conditionText || 'Not specified';
            }
        }
    }

    function closeDiagnosisDetailsModalInternal() {
        const modal = document.getElementById('diagnosisDetailsModal');
        if (modal) {
            modal.style.display = 'none';
        }
        state.selectedDiagnosisForAction = null;
    }

    function openDiagnosisDetailsModalFromRow(row) {
        if (!row) {
            return;
        }

        const payload = {
            id: row.getAttribute('data-diagnosis-id') || '',
            title: row.getAttribute('data-diagnosis-title') || row.querySelector('.diagnosis-title')?.textContent?.trim() || 'Untitled diagnosis',
            doctor: row.getAttribute('data-diagnosis-doctor') || row.querySelector('.diagnosis-doctor')?.textContent?.trim() || 'Doctor on record',
            date: row.getAttribute('data-diagnosis-date') || row.querySelector('.diagnosis-date')?.textContent?.trim() || 'Not recorded',
            symptoms: row.getAttribute('data-diagnosis-symptoms') || '',
            notes: row.getAttribute('data-diagnosis-notes') || '',
            rowElement: row
        };

        state.selectedDiagnosisForAction = payload;

        const titleEl = document.getElementById('diagnosisDetailsTitle');
        const doctorEl = document.getElementById('diagnosisDetailsDoctor');
        const dateEl = document.getElementById('diagnosisDetailsDate');
        const symptomsEl = document.getElementById('diagnosisDetailsSymptoms');
        const notesEl = document.getElementById('diagnosisDetailsNotes');
        const modal = document.getElementById('diagnosisDetailsModal');

        if (titleEl) titleEl.textContent = payload.title;
        if (doctorEl) doctorEl.textContent = payload.doctor;
        if (dateEl) dateEl.textContent = payload.date;
        if (symptomsEl) symptomsEl.textContent = payload.symptoms || 'No symptoms recorded';
        if (notesEl) notesEl.textContent = payload.notes || 'No notes recorded';
        if (modal) modal.style.display = 'flex';
    }

    function setupDiagnosisRowClickHandler() {
        const diagnosisContainer = document.getElementById('diagnosisContainer');
        if (!diagnosisContainer || diagnosisContainer.dataset.detailsHandlerBound === '1') {
            return;
        }

        diagnosisContainer.addEventListener('click', function(event) {
            const row = event.target.closest('.diagnosis-row');
            if (!row || !diagnosisContainer.contains(row)) {
                return;
            }
            openDiagnosisDetailsModalFromRow(row);
        });

        diagnosisContainer.dataset.detailsHandlerBound = '1';
    }

    const medicationCalendarMonthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

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

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function titleCase(value) {
        const text = String(value ?? '').trim();
        if (!text) {
            return 'Not specified';
        }

        return text
            .toLowerCase()
            .split(' ')
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    function buildFullName(firstName, middleName, lastName) {
        return [firstName, middleName, lastName]
            .map(part => String(part ?? '').trim())
            .filter(Boolean)
            .join(' ');
    }

    function normalizeName(value) {
        return String(value ?? '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    function formatAppointmentTime(timeValue) {
        if (!timeValue) {
            return 'N/A';
        }

        const [hoursText, minutesText] = String(timeValue).split(':');
        const hours = parseInt(hoursText, 10);
        if (Number.isNaN(hours) || typeof minutesText === 'undefined') {
            return String(timeValue);
        }

        const suffix = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours % 12 || 12;
        return `${displayHour}:${minutesText} ${suffix}`;
    }

    function getDoctorDisplayName(doctor) {
        const rawName = buildFullName(doctor?.firstName, '', doctor?.lastName) || 'Doctor on record';
        return /^dr\./i.test(rawName) ? rawName : `Dr. ${rawName}`;
    }

    function getNewPatientForm() {
        return document.getElementById('newPatientForm');
    }

    function getNewPatientField(fieldId) {
        const form = getNewPatientForm();
        if (!form) {
            return document.getElementById(fieldId);
        }

        return form.querySelector(`#${fieldId}`);
    }

    function getNewPatientFieldValue(fieldId) {
        return getNewPatientField(fieldId)?.value?.trim?.() || '';
    }

    function setNewPatientFieldValue(fieldId, value) {
        const field = getNewPatientField(fieldId);
        if (!field) {
            return;
        }

        const nextValue = value ?? '';
        if (field.tagName === 'SELECT') {
            const hasOption = Array.from(field.options).some(option => option.value === nextValue);
            if (nextValue && !hasOption) {
                const option = document.createElement('option');
                option.value = nextValue;
                option.textContent = nextValue;
                field.appendChild(option);
            }
        }

        field.value = nextValue;
    }

    function getNewPatientSections() {
        return Array.from(document.querySelectorAll('#newPatientModal .patient-form-section'));
    }

    function setNewPatientSectionsVisible(isVisible) {
        getNewPatientSections().forEach(section => {
            section.style.display = isVisible ? '' : 'none';
            section.classList.toggle('visible', isVisible);
        });
    }

    function clearNewPatientObservationsList() {
        const list = getNewPatientField('mentalStatusList');
        if (list) {
            list.innerHTML = '';
            list.classList.add('hidden');
        }

        const group = getNewPatientField('mentalStatusListGroup');
        if (group) {
            group.classList.add('hidden');
        }

        const input = getNewPatientField('mentalStatusInput');
        if (input) {
            input.value = '';
        }
    }

    function removeDynamicNewPatientRows() {
        const form = getNewPatientForm();
        if (!form) {
            return;
        }

        form.querySelectorAll('.dynamic-allergy-row, .dynamic-condition-row').forEach(row => {
            row.remove();
        });
    }

    function resetNewPatientFormFields() {
        getNewPatientSections().forEach(section => {
            section.querySelectorAll('input, textarea, select').forEach(field => {
                if (field.type === 'radio' || field.type === 'checkbox') {
                    field.checked = !!field.defaultChecked;
                    return;
                }

                field.value = '';
            });
        });

        removeDynamicNewPatientRows();
        clearNewPatientObservationsList();

        const selectedInfo = document.getElementById('selectedPatientInfo');
        if (selectedInfo) {
            selectedInfo.innerHTML = '';
            selectedInfo.style.display = 'none';
        }

        const psychiatricRadio = document.querySelector('#newPatientModal input[name="psychiatric-side"][value="paternal"]');
        if (psychiatricRadio) {
            psychiatricRadio.checked = true;
        }

        const medicalRadio = document.querySelector('#newPatientModal input[name="medical-side"][value="paternal"]');
        if (medicalRadio) {
            medicalRadio.checked = true;
        }
    }

    function getNewPatientObservationsList() {
        const list = getNewPatientField('mentalStatusList');
        if (!list) {
            return [];
        }

        return Array.from(list.querySelectorAll('.observation-list-item span'))
            .map(item => item.textContent.trim())
            .filter(Boolean);
    }

    function collectDynamicInputValues(containerId, primaryInputId, rowClassName) {
        const values = [];
        const primaryInput = getNewPatientField(primaryInputId);
        if (primaryInput && primaryInput.value.trim()) {
            values.push(primaryInput.value.trim());
        }

        const container = getNewPatientField(containerId);
        if (!container) {
            return values;
        }

        container.querySelectorAll(`.${rowClassName} input`).forEach(input => {
            const value = input.value.trim();
            if (value) {
                values.push(value);
            }
        });

        return values;
    }

    function getSelectedAdmissionAppointment() {
        return state.forAdmissionAppointments.find(appointment => {
            return String(appointment.AppointmentID || appointment.Appointment_ID) === String(state.selectedAdmissionAppointmentId);
        }) || null;
    }

    function buildAppointmentIdentityKey(appointment) {
        return [
            String(appointment?.GuardianID || appointment?.Guardian_ID || ''),
            String(appointment?.PatientFirstName || '').trim().toLowerCase(),
            String(appointment?.PatientLastName || '').trim().toLowerCase()
        ].join('|');
    }

    function buildPatientIdentityKey(patient) {
        return [
            String(patient?.guardianId || ''),
            String(patient?.firstName || '').trim().toLowerCase(),
            String(patient?.lastName || '').trim().toLowerCase()
        ].join('|');
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

    function formatMedicationDateTime(dateValue) {
        if (!dateValue) {
            return { dateLabel: 'Not recorded', timeLabel: 'Not recorded' };
        }

        const parsedDate = new Date(dateValue);
        if (Number.isNaN(parsedDate.getTime())) {
            return {
                dateLabel: String(dateValue),
                timeLabel: 'Not recorded'
            };
        }

        return {
            dateLabel: parsedDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }),
            timeLabel: parsedDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).replace('12:00 PM', '12:00 NN')
        };
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

    function renderMedicationIntakeCalendar() {
        const daysContainer = document.getElementById('miCalDays');
        const monthLabel = document.getElementById('miCalMonthLabel');
        const legend = document.getElementById('miCalLegend');

        if (!daysContainer || !monthLabel) {
            return;
        }

        const recordDateKeys = state.currentMedicationIntakeEntries
            .map(entry => getMedicationDateKey(entry.Date_Administered))
            .filter(Boolean);
        const recordDates = new Set(recordDateKeys);

        if (legend) {
            legend.classList.toggle('no-records', recordDates.size === 0);
        }

        if (state.medicationCalendarMonth === null || state.medicationCalendarYear === null) {
            const baseDate = state.selectedMedicationDateKey
                ? new Date(state.selectedMedicationDateKey)
                : (state.currentMedicationIntakeEntries[0]?.Date_Administered
                    ? new Date(state.currentMedicationIntakeEntries[0].Date_Administered)
                    : new Date());

            state.medicationCalendarMonth = baseDate.getMonth();
            state.medicationCalendarYear = baseDate.getFullYear();
        }

        const firstDay = new Date(state.medicationCalendarYear, state.medicationCalendarMonth, 1).getDay();
        const daysInMonth = new Date(state.medicationCalendarYear, state.medicationCalendarMonth + 1, 0).getDate();
        const prevMonthDays = new Date(state.medicationCalendarYear, state.medicationCalendarMonth, 0).getDate();

        monthLabel.textContent = `${medicationCalendarMonthNames[state.medicationCalendarMonth]} ${state.medicationCalendarYear}`;
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
                state.medicationCalendarYear,
                String(state.medicationCalendarMonth + 1).padStart(2, '0'),
                String(day).padStart(2, '0')
            ].join('-');

            if (recordDates.has(dateKey)) {
                span.classList.add('has-record');
                if (state.selectedMedicationDateKey === dateKey) {
                    span.classList.add('selected');
                }

                span.addEventListener('click', function() {
                    state.selectedMedicationDateKey = dateKey;
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
        const intakeHistoryActiveDate = document.getElementById('medicineIntakeHistoryActiveDate');
        const intakeHistoryList = document.getElementById('medicineIntakeHistoryList');

        if (!intakeHistoryActiveDate || !intakeHistoryList) {
            return;
        }

        if (!state.currentMedicationIntakeEntries.length) {
            intakeHistoryActiveDate.textContent = 'No medicine intake history available';
            intakeHistoryList.innerHTML = '<p style="padding: 12px 0; color: #999;">No medicine intake history available.</p>';
            return;
        }

        const dateKeys = state.currentMedicationIntakeEntries
            .map(entry => getMedicationDateKey(entry.Date_Administered))
            .filter(Boolean);
        const availableDateKeys = Array.from(new Set(dateKeys));

        if (!state.selectedMedicationDateKey || !availableDateKeys.includes(state.selectedMedicationDateKey)) {
            state.selectedMedicationDateKey = availableDateKeys[0] || null;
        }

        const filteredEntries = state.currentMedicationIntakeEntries.filter(entry => {
            return getMedicationDateKey(entry.Date_Administered) === state.selectedMedicationDateKey;
        });

        intakeHistoryActiveDate.textContent = formatDateKeyLabel(state.selectedMedicationDateKey);

        if (!filteredEntries.length) {
            intakeHistoryList.innerHTML = '<div class="mi-history-empty">No intake records for this date.</div>';
            return;
        }

        intakeHistoryList.innerHTML = filteredEntries.map(entry => {
            const dateTime = formatMedicationDateTime(entry.Date_Administered);
            return `
                <div class="medicine-intake-history-card">
                    <div class="mi-history-header">
                        <div class="mi-history-meta">
                            <span class="mi-history-date">${escapeHtml(dateTime.timeLabel)}</span>
                            <span class="mi-history-dot">•</span>
                            <span class="mi-history-nurse">${escapeHtml(entry.AdministeredByName || 'Staff on record')}</span>
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

    async function fetchJson(url, options = {}) {
        const response = await fetch(url, {
            cache: 'no-store',
            credentials: 'include',
            ...options
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || `HTTP ${response.status}`);
        }

        return data;
    }

    function getPatientById(patientId) {
        const normalizedId = String(patientId || '');
        return state.patients.find(patient => String(patient.id) === normalizedId) || null;
    }

    function getSelectedPatient() {
        return getPatientById(state.selectedPatientId);
    }

    function getPatientStatus(patient) {
        return String(patient?.status || '').trim().toLowerCase();
    }

    function isPatientDischarged(patient) {
        return getPatientStatus(patient) === 'discharged';
    }

    function getPatientMutationControls() {
        return [
            'addDiagnosisBtn',
            'editPersonalBtn',
            'editVitalsBtn',
            'editMentalStatusBtn',
            'addMedicineIntakeBtn',
            'addPrescriptionBtn',
            'addExternalMedicineBtn',
            'addBelongingsBtn',
            'addVisitorsBtn',
            'diagnosisDetailsMoveBtn'
        ]
            .map(id => document.getElementById(id))
            .filter(Boolean);
    }

    function closeReadOnlyMutationModals() {
        [
            'diagnosisModal',
            'prescriptionModal',
            'externalMedicineModal',
            'belongingsModal',
            'visitorsModal',
            'medicineIntakeModal',
            'editPersonalModal',
            'editVitalsModal',
            'editMentalStatusModal'
        ].forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'none';
            }
        });
    }

    function setPatientMutationControlsState(patient) {
        const isReadOnly = isPatientDischarged(patient);

        document.body.classList.toggle('patient-readonly-discharged', isReadOnly);

        getPatientMutationControls().forEach(control => {
            if (isReadOnly) {
                control.style.setProperty('display', 'none', 'important');
            } else {
                control.style.removeProperty('display');
            }

            if ('disabled' in control) {
                control.disabled = isReadOnly;
            }
        });

        if (isReadOnly) {
            closeReadOnlyMutationModals();
        }
    }

    function ensureSelectedPatientCanBeModified(actionLabel = 'modify this patient record') {
        const selectedPatient = getSelectedPatient();
        if (!selectedPatient) {
            showAdminPatientActionFeedback('Please select a patient first.', 'Select Patient', 'warning');
            return false;
        }

        if (isPatientDischarged(selectedPatient)) {
            showAdminPatientActionFeedback(`This patient is discharged and can no longer be updated. Unable to ${actionLabel}.`, 'Read Only Record', 'warning');
            return false;
        }

        return true;
    }

    function wrapExistingPatientAction(functionName, actionLabel) {
        const original = window[functionName];
        if (typeof original !== 'function' || original.__dischargedGuardWrapped === true) {
            return;
        }

        const wrapped = function(...args) {
            if (!ensureSelectedPatientCanBeModified(actionLabel)) {
                return;
            }

            return original.apply(this, args);
        };

        wrapped.__dischargedGuardWrapped = true;
        window[functionName] = wrapped;
    }

    function setDischargeDateTimeVisibility(patient) {
        const dischargeDateRow = document.getElementById('dischargeDateRow');
        const dischargeTimeRow = document.getElementById('dischargeTimeRow');
        const dischargeDateValue = document.getElementById('dischargeDateValue');
        const dischargeTimeValue = document.getElementById('dischargeTimeValue');
        const patientStatus = String(patient?.status || '').trim().toLowerCase();
        const isDischarged = patientStatus === 'discharged';
        const dischargeDateTime = patient?.dischargeDateTime || '';

        if (dischargeDateValue) {
            dischargeDateValue.textContent = isDischarged ? formatDisplayDate(dischargeDateTime) : 'Not recorded';
        }

        if (dischargeTimeValue) {
            dischargeTimeValue.textContent = isDischarged ? formatDisplayTime(dischargeDateTime) : 'Not recorded';
        }

        if (dischargeDateRow) {
            dischargeDateRow.style.display = isDischarged ? 'flex' : 'none';
        }

        if (dischargeTimeRow) {
            dischargeTimeRow.style.display = isDischarged ? 'flex' : 'none';
        }
    }

    function getVisiblePatients() {
        const selectedStatus = String(state.patientStatusFilter || 'admitted').trim().toLowerCase();
        const searchTerm = normalizeName(state.patientSearchTerm || '');

        return state.patients.filter(patient => {
            const patientStatus = String(patient?.status || '').trim().toLowerCase();
            if (patientStatus !== selectedStatus) {
                return false;
            }

            if (!searchTerm) {
                return true;
            }

            const searchableContent = [
                String(patient?.id || ''),
                String(patient?.name || ''),
                buildFullName(patient?.firstName, patient?.middleName, patient?.lastName)
            ].map(normalizeName).join(' ');

            return searchableContent.includes(searchTerm);
        });
    }

    function syncVisiblePatientSelection(preferredPatientId = state.selectedPatientId, preferredPatientName = null) {
        const visiblePatients = getVisiblePatients();

        if (!visiblePatients.length) {
            state.selectedPatientId = null;
            renderPatientList();
            resetPatientDetails();
            return;
        }

        const preferredById = preferredPatientId
            ? visiblePatients.find(patient => String(patient.id) === String(preferredPatientId))
            : null;
        const preferredByName = !preferredById && preferredPatientName
            ? visiblePatients.find(patient => normalizeName(buildFullName(patient.firstName, patient.middleName, patient.lastName)) === normalizeName(preferredPatientName) || normalizeName(patient.name) === normalizeName(preferredPatientName))
            : null;
        const currentVisible = !preferredById && !preferredByName && state.selectedPatientId
            ? visiblePatients.find(patient => String(patient.id) === String(state.selectedPatientId))
            : null;
        const targetPatient = preferredById || preferredByName || currentVisible || visiblePatients[0];

        renderPatientList(targetPatient.id);

        if (String(targetPatient.id) !== String(state.selectedPatientId)) {
            selectPatient(targetPatient.id);
            return;
        }

        state.selectedPatientId = String(targetPatient.id);
    }

    function setupPatientFilterControls() {
        const statusFilter = document.getElementById('patientStatusFilter');
        const searchInput = document.getElementById('searchPatient');

        if (statusFilter && !statusFilter.dataset.bound) {
            statusFilter.value = state.patientStatusFilter;
            statusFilter.addEventListener('change', function() {
                state.patientStatusFilter = this.value || 'admitted';
                syncVisiblePatientSelection();
            });
            statusFilter.dataset.bound = '1';
        }

        if (searchInput && !searchInput.dataset.bound) {
            searchInput.addEventListener('input', function() {
                state.patientSearchTerm = this.value || '';
                syncVisiblePatientSelection();
            });
            searchInput.dataset.bound = '1';
        }
    }

    function getDischargeButton() {
        return document.getElementById('dischargePatientBtn');
    }

    function setDischargeButtonState(patient, options = {}) {
        const button = getDischargeButton();
        if (!button) {
            return;
        }

        const label = button.querySelector('.discharge-btn-label');
        const patientStatus = String(patient?.status || '').trim().toLowerCase();
        const isVisible = Boolean(patient) && patientStatus !== 'discharged';
        const isBusy = Boolean(options.isBusy);

        button.style.display = isVisible ? 'inline-flex' : 'none';
        button.disabled = !isVisible || isBusy;
        button.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
        button.setAttribute('aria-busy', isBusy ? 'true' : 'false');

        if (label) {
            label.textContent = isBusy ? 'Discharging...' : 'Discharge';
        }
    }

    async function dischargeSelectedPatient() {
        const patient = getSelectedPatient();
        if (!patient) {
            showAdminPatientActionFeedback('Select a patient first.', 'Select Patient', 'warning');
            return;
        }

        if (String(patient.status || '').trim().toLowerCase() === 'discharged') {
            showAdminPatientActionFeedback('This patient is already discharged.', 'Already Discharged', 'warning');
            return;
        }

        const patientName = buildFullName(patient.firstName, patient.middleName, patient.lastName) || patient.name || 'this patient';
        const confirmed = await showAdminPatientActionConfirm(
            `Are you sure you want to discharge ${patientName}?`,
            'Confirm Discharge',
            'danger',
            'Discharge'
        );
        if (!confirmed) {
            return;
        }

        setDischargeButtonState(patient, { isBusy: true });

        try {
            await fetchJson('../php/discharge_patient.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    patient_id: patient.id
                })
            });

            showAdminPatientActionFeedback(`${patientName} was discharged successfully.`, 'Patient Discharged', 'success');
            await loadPatients();
        } catch (error) {
            console.error('Failed to discharge patient:', error);
            showAdminPatientActionFeedback(error.message || 'Failed to discharge patient.', 'Discharge Failed', 'danger');
            setDischargeButtonState(patient);
        }
    }

    function setupDischargeButton() {
        const button = getDischargeButton();
        if (!button || button.dataset.bound === '1') {
            return;
        }

        button.addEventListener('click', function() {
            void dischargeSelectedPatient();
        });
        button.dataset.bound = '1';
        setDischargeButtonState(null);
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

    function resetMedicineIntakeModalOptions() {
        const emptyLabel = state.selectedPatientId ? 'No prescribed medicines available' : 'Select a patient first';
        populateMedicineIntakePrescriptionOptions(state.currentPatientPrescriptions, emptyLabel);
        setDateInputValue('medicineIntakeDate');
        setTimeInputValue('medicineIntakeTime');
    }

    function getHeaderNameElement() {
        return document.getElementById('patientFileHeaderName') || document.querySelector('.user-greeting strong');
    }

    function setHistoryToggleVisibility(toggleId, panelId, hasHistory) {
        const toggle = document.getElementById(toggleId);
        if (toggle) {
            toggle.classList.toggle('has-history', !!hasHistory);
        }

        if (!hasHistory && panelId) {
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.style.display = 'none';
            }
        }
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
        toggle.addEventListener('click', function() {
            const isOpen = panel.style.display === 'block';
            panel.style.display = isOpen ? 'none' : 'block';
        });

        if (prevBtn && !prevBtn.dataset.bound) {
            prevBtn.dataset.bound = '1';
            prevBtn.addEventListener('click', function() {
                state.medicationCalendarMonth -= 1;
                if (state.medicationCalendarMonth < 0) {
                    state.medicationCalendarMonth = 11;
                    state.medicationCalendarYear -= 1;
                }
                renderMedicationIntakeCalendar();
            });
        }

        if (nextBtn && !nextBtn.dataset.bound) {
            nextBtn.dataset.bound = '1';
            nextBtn.addEventListener('click', function() {
                state.medicationCalendarMonth += 1;
                if (state.medicationCalendarMonth > 11) {
                    state.medicationCalendarMonth = 0;
                    state.medicationCalendarYear += 1;
                }
                renderMedicationIntakeCalendar();
            });
        }

        renderMedicationIntakeCalendar();
        renderMedicationIntakeHistoryByDate();
    }

    function syncMentalHistoryToggle() {
        const mentalItems = document.querySelectorAll('.mental-status-list li');
        const hasMeaningfulMentalHistory = Array.from(mentalItems).some(item => {
            const text = (item.textContent || '').trim();
            return text && text.toLowerCase() !== 'no mental status observations recorded.';
        });

        setHistoryToggleVisibility('mentalHistoryToggle', 'mentalHistoryPanel', hasMeaningfulMentalHistory);
    }

    function setHeaderUserName(fullName) {
        const headerName = getHeaderNameElement();
        if (headerName) {
            headerName.textContent = fullName || 'Admin';
        }
    }

    function resetSupplementarySections() {
        const mentalStatusList = document.querySelector('.mental-status-list');
        if (mentalStatusList) {
            mentalStatusList.innerHTML = '<li>No mental status observations recorded.</li>';
        }

        const updateLabel = document.getElementById('mentalStatusUpdateDate');
        if (updateLabel) {
            updateLabel.textContent = 'Updated: Not recorded';
        }

        syncMentalHistoryToggle();

        const medicalSubsections = document.querySelectorAll('.medical-subsection');
        if (medicalSubsections.length >= 2) {
            const conditionValues = medicalSubsections[0].querySelectorAll('.personal-row .personal-value');
            if (conditionValues.length >= 2) {
                conditionValues[0].textContent = 'Not specified';
                conditionValues[1].textContent = 'Not specified';
            } else {
                const chronicCondition = medicalSubsections[0].querySelector('.personal-value');
                if (chronicCondition) {
                    chronicCondition.textContent = 'Not specified';
                }
            }

            const allergyRows = medicalSubsections[1].querySelectorAll('.personal-row .personal-value');
            allergyRows.forEach(value => {
                value.textContent = 'None reported';
            });
        }

        document.querySelectorAll('.family-card .family-value').forEach(value => {
            value.textContent = 'None reported';
        });
    }

    function resetPatientDetails() {
        const patientName = document.querySelector('.patient-name-large');
        const patientDiagnosis = document.querySelector('.patient-diagnosis');
        const admissionDateValue = document.getElementById('admissionDateValue');
        const admissionTimeValue = document.getElementById('admissionTimeValue');
        const attendingPhysicianValue = document.getElementById('attendingPhysicianValue');
        const personalValues = document.querySelectorAll('#patientInfoTab .personal-grid .personal-value');
        const roomTypeValue = document.getElementById('patientRoomTypeValue');

        if (patientName) {
            patientName.textContent = 'Select a patient';
        }

        if (patientDiagnosis) {
            patientDiagnosis.textContent = 'No diagnosis recorded';
        }

        if (admissionDateValue) {
            admissionDateValue.textContent = 'Not recorded';
        }

        if (admissionTimeValue) {
            admissionTimeValue.textContent = 'Not recorded';
        }

        if (attendingPhysicianValue) {
            attendingPhysicianValue.textContent = 'Not recorded';
        }

        personalValues.forEach(value => {
            value.textContent = 'Not recorded';
        });

        if (roomTypeValue) {
            roomTypeValue.textContent = 'Not specified';
        }

        const diagnosisContainer = document.getElementById('diagnosisContainer');
        if (diagnosisContainer) {
            diagnosisContainer.innerHTML = '<p style="padding: 20px; color: #999;">Select a patient to view diagnoses.</p>';
        }

        const medicineIntakeList = document.getElementById('medicineIntakeList');
        if (medicineIntakeList) {
            medicineIntakeList.innerHTML = '<p style="padding: 20px; color: #999;">Select a patient to view medicine intake records.</p>';
        }

        const prescriptionList = document.getElementById('prescriptionList');
        if (prescriptionList) {
            prescriptionList.innerHTML = '<p style="padding: 20px; color: #999;">Select a patient to view prescriptions.</p>';
        }

        const externalMedicineTableBody = document.getElementById('externalMedicineTableBody');
        if (externalMedicineTableBody) {
            externalMedicineTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">Select a patient to view external medicine entries.</td></tr>';
        }

        const belongingsTableBody = document.getElementById('belongingsTableBody');
        if (belongingsTableBody) {
            belongingsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">Select a patient to view belongings records.</td></tr>';
        }

        const visitorsTableBody = document.getElementById('visitorsTableBody');
        if (visitorsTableBody) {
            visitorsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #999;">Select a patient to view visitors.</td></tr>';
        }

        const vitalFields = ['vitalBP', 'vitalPulse', 'vitalTemp', 'vitalWeight', 'vitalHeight', 'vitalRespiratory', 'vitalO2', 'vitalLastUpdated'];
        vitalFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element && element.tagName !== 'INPUT') {
                element.textContent = 'Not recorded';
            }
        });

        const intakeHistoryActiveDate = document.getElementById('medicineIntakeHistoryActiveDate');
        if (intakeHistoryActiveDate) {
            intakeHistoryActiveDate.textContent = 'No medicine intake history available';
        }

        state.currentMedicationIntakeEntries = [];
        state.selectedMedicationDateKey = null;
        state.medicationCalendarMonth = null;
        state.medicationCalendarYear = null;

        state.currentPatientPrescriptions = [];
        populateMedicineIntakePrescriptionOptions([], 'Select a patient first');
        setDischargeButtonState(null);
        setDischargeDateTimeVisibility(null);
        setPatientMutationControlsState(null);

        const intakeHistoryList = document.getElementById('medicineIntakeHistoryList');
        if (intakeHistoryList) {
            intakeHistoryList.innerHTML = '<p style="padding: 12px 0; color: #999;">No medicine intake history available.</p>';
        }

        renderMedicationIntakeCalendar();

        setHistoryToggleVisibility('medicineIntakeHistoryToggle', 'medicineIntakeHistoryPanel', false);
        setHistoryToggleVisibility('vitalsHistoryToggle', 'vitalsHistoryPanel', false);
        setHistoryToggleVisibility('mentalHistoryToggle', 'mentalHistoryPanel', false);

        resetSupplementarySections();
    }

    function renderPatientList(activePatientId = state.selectedPatientId) {
        const patientList = document.getElementById('patientList');
        if (!patientList) {
            return;
        }

        const visiblePatients = getVisiblePatients();
        if (!visiblePatients.length) {
            const emptyMessage = state.patientSearchTerm
                ? 'No matching patients found.'
                : `No ${state.patientStatusFilter} patients found.`;
            patientList.innerHTML = `<li class="patient-list-item empty-state">${escapeHtml(emptyMessage)}</li>`;
            return;
        }

        patientList.innerHTML = '';

        visiblePatients.forEach((patient, index) => {
            const item = document.createElement('li');
            const isActive = String(patient.id) === String(activePatientId || '') || (!activePatientId && index === 0);
            item.className = `patient-list-item${isActive ? ' active' : ''}`;
            item.setAttribute('data-patient-id', patient.id);
            item.setAttribute('data-patient-name', patient.name);
            item.setAttribute('data-patient', patient.name);
            item.innerHTML = `
                <input type="radio" name="patientRadio" class="patient-radio" ${isActive ? 'checked' : ''}>
                <span class="patient-item-name">${escapeHtml(patient.name)}</span>
            `;

            item.addEventListener('click', function() {
                selectPatient(patient.id);
            });

            const radio = item.querySelector('.patient-radio');
            if (radio) {
                radio.addEventListener('click', function(event) {
                    event.stopPropagation();
                    selectPatient(patient.id);
                });
            }

            patientList.appendChild(item);
        });
    }

    function selectPatient(patientId) {
        state.selectedPatientId = String(patientId || '');

        document.querySelectorAll('.patient-list-item[data-patient-id]').forEach(item => {
            const isActive = item.getAttribute('data-patient-id') === state.selectedPatientId;
            item.classList.toggle('active', isActive);
            const radio = item.querySelector('.patient-radio');
            if (radio) {
                radio.checked = isActive;
            }
        });

        const patient = getSelectedPatient();
        if (!patient) {
            resetPatientDetails();
            return;
        }

        try {
            localStorage.setItem('currentPatientContext', JSON.stringify({
                id: String(patient.id || ''),
                name: String(patient.name || '')
            }));
        } catch (error) {
            // Ignore storage errors and continue rendering patient details.
        }

        renderPatientOverview(patient);
        void loadPatientSections(patient.id);
    }

    function renderPatientOverview(patient) {
        const fullName = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ').trim() || patient.name;
        const patientName = document.querySelector('.patient-name-large');
        const patientDiagnosis = document.querySelector('.patient-diagnosis');
        const admissionDateValue = document.getElementById('admissionDateValue');
        const admissionTimeValue = document.getElementById('admissionTimeValue');
        const attendingPhysicianValue = document.getElementById('attendingPhysicianValue');
        const personalValues = document.querySelectorAll('#patientInfoTab .personal-grid .personal-value');
        const roomTypeValue = document.getElementById('patientRoomTypeValue');
        const admissionDateTime = patient.admissionDateTime || patient.createdAt || '';
        let attendingPhysician = patient.attendingPhysician || 'Not assigned';

        if (patient.attendingRole && String(patient.attendingRole).toLowerCase() === 'doctor' && attendingPhysician !== 'Not assigned' && !/^dr\./i.test(attendingPhysician)) {
            attendingPhysician = `Dr. ${attendingPhysician}`;
        }

        if (patientName) {
            patientName.textContent = fullName;
        }

        if (patientDiagnosis) {
            patientDiagnosis.textContent = 'Loading diagnosis...';
        }

        if (admissionDateValue) {
            admissionDateValue.textContent = formatDisplayDate(admissionDateTime);
        }

        if (admissionTimeValue) {
            admissionTimeValue.textContent = formatDisplayTime(admissionDateTime);
        }

        if (attendingPhysicianValue) {
            attendingPhysicianValue.textContent = attendingPhysician;
        }

        if (personalValues.length >= 10) {
            const personalData = [
                formatDisplayDate(patient.birthdate),
                patient.age ? `${escapeHtml(patient.age)} years old` : 'Not recorded',
                titleCase(patient.sex),
                patient.civilStatus || 'Not specified',
                patient.address || 'Not specified',
                patient.emergencyContact || 'Not specified',
                patient.guardian || 'Not specified',
                patient.religion || 'Not specified',
                patient.hobbies || 'Not specified',
                patient.previousOccupation || 'Not specified'
            ];

            personalValues.forEach((value, index) => {
                value.textContent = personalData[index] || 'Not specified';
            });
        }

        if (roomTypeValue) {
            roomTypeValue.textContent = patient.roomType ? titleCase(patient.roomType) : 'Not specified';
        }

        setDischargeDateTimeVisibility(patient);
        setDischargeButtonState(patient);
        setPatientMutationControlsState(patient);
        resetSupplementarySections();
    }

    function renderDiagnoses(diagnoses) {
        const diagnosisContainer = document.getElementById('diagnosisContainer');
        const diagnosisSummary = document.querySelector('.patient-diagnosis');

        if (!diagnosisContainer) {
            return;
        }

        if (!diagnoses.length) {
            diagnosisContainer.innerHTML = '<p style="padding: 20px; color: #999;">No diagnoses recorded yet.</p>';
            if (diagnosisSummary) {
                diagnosisSummary.textContent = 'No diagnosis recorded';
            }
            return;
        }

        const sortedDiagnoses = [...diagnoses].sort((a, b) => {
            const aTime = new Date(a.date || 0).getTime();
            const bTime = new Date(b.date || 0).getTime();
            return bTime - aTime;
        });

        if (diagnosisSummary) {
            const allDiagnosisTitles = sortedDiagnoses
                .map(item => String(item.diagnosis || '').trim())
                .filter(Boolean);
            const uniqueDiagnosisTitles = Array.from(new Set(allDiagnosisTitles));
            diagnosisSummary.textContent = uniqueDiagnosisTitles.length
                ? uniqueDiagnosisTitles.join(', ')
                : 'Diagnosis recorded';
        }

        diagnosisContainer.innerHTML = sortedDiagnoses.map((diagnosis, index) => {
            const doctor = diagnosis.doctor || 'Doctor on record';
            const symptoms = String(diagnosis.symptoms || '').trim();
            const initials = doctor
                .replace(/^dr\.?\s*/i, '')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(namePart => namePart.charAt(0).toUpperCase())
                .join('') || 'DR';

            const parsedDate = new Date(diagnosis.date || '');
            const dateLabel = Number.isNaN(parsedDate.getTime())
                ? (diagnosis.date || 'Not recorded')
                : parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            return `
                <div class="diagnosis-row" data-diagnosis-id="${escapeHtml(diagnosis.id || '')}" data-diagnosis-title="${escapeHtml(diagnosis.diagnosis || 'Untitled diagnosis')}" data-diagnosis-doctor="${escapeHtml(doctor)}" data-diagnosis-date="${escapeHtml(dateLabel)}" data-diagnosis-symptoms="${escapeHtml(symptoms)}" data-diagnosis-notes="${escapeHtml(diagnosis.notes || '')}">
                    <div class="diagnosis-left">
                        <span class="diagnosis-dot ${index < 2 ? 'is-active' : 'is-muted'}"></span>
                        <h6 class="diagnosis-title">${escapeHtml(diagnosis.diagnosis || 'Untitled diagnosis')}</h6>
                    </div>
                    <div class="diagnosis-right">
                        <span class="diagnosis-avatar">${escapeHtml(initials)}</span>
                        <span class="diagnosis-doctor">${escapeHtml(doctor)}</span>
                        <span class="diagnosis-date">${escapeHtml(dateLabel)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderVitals(vitals) {
        const hasVitalsHistory = !!(vitals && Object.values(vitals).some(value => {
            const text = String(value ?? '').trim().toLowerCase();
            return text && text !== 'not recorded' && text !== 'null' && text !== 'undefined';
        }));

        setHistoryToggleVisibility('vitalsHistoryToggle', 'vitalsHistoryPanel', hasVitalsHistory);

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

        Object.entries(fields).forEach(([fieldId, value]) => {
            const element = document.getElementById(fieldId);
            if (element && element.tagName !== 'INPUT') {
                element.textContent = value;
            }
        });
    }

    function renderPatientBackground(background) {
        const observations = Array.isArray(background?.observations) ? background.observations : [];
        const medicalHistory = background?.medicalHistory || null;
        const familyHistory = background?.familyHistory || null;

        const mentalStatusList = document.querySelector('.mental-status-list');
        if (mentalStatusList) {
            if (!observations.length) {
                mentalStatusList.innerHTML = '<li>No mental status observations recorded.</li>';
            } else {
                mentalStatusList.innerHTML = observations.map(item => {
                    const observationText = item.observation || 'Observation recorded';
                    const className = /paranoid ideation/i.test(observationText) ? ' class="mental-status-note"' : '';
                    return `<li${className}>${escapeHtml(observationText)}</li>`;
                }).join('');
            }
        }

        const mentalUpdateLabel = document.getElementById('mentalStatusUpdateDate');
        if (mentalUpdateLabel) {
            mentalUpdateLabel.textContent = observations.length
                ? `Updated: ${observations[0].observationDateLabel || 'Not recorded'}`
                : 'Updated: Not recorded';
        }

        const mentalHistoryList = document.getElementById('mentalHistoryList');
        if (mentalHistoryList) {
            if (!observations.length) {
                mentalHistoryList.innerHTML = '<p style="padding: 12px 0; color: #999;">No observation history available.</p>';
            } else {
                mentalHistoryList.innerHTML = observations.map(item => `
                    <div class="mental-history-entry">
                        <div class="mental-history-date">${escapeHtml(item.observationDateLabel || 'Not recorded')}</div>
                        <div class="mental-history-value">${escapeHtml(item.observation || 'Observation recorded')}</div>
                    </div>
                `).join('');
            }
        }

        const medicalSubsections = document.querySelectorAll('.medical-subsection');
        if (medicalSubsections.length >= 2) {
            const conditionValues = medicalSubsections[0].querySelectorAll('.personal-row .personal-value');
            if (conditionValues.length >= 1) {
                conditionValues[0].textContent = medicalHistory?.chronicCondition || 'Not specified';
            }

            // Render psychiatric conditions as separate boxes
            const psychiatricConditionsList = document.getElementById('psychiatricConditionsList');
            if (psychiatricConditionsList) {
                psychiatricConditionsList.innerHTML = '';
                
                let psychiatricConditions = [];
                if (medicalHistory?.psychiatricCondition) {
                    // Try to parse as JSON array
                    try {
                        const parsed = JSON.parse(medicalHistory.psychiatricCondition);
                        if (Array.isArray(parsed)) {
                            psychiatricConditions = parsed;
                        } else {
                            psychiatricConditions = [medicalHistory.psychiatricCondition];
                        }
                    } catch (e) {
                        // Not JSON, treat as single string
                        psychiatricConditions = [medicalHistory.psychiatricCondition];
                    }
                }
                
                if (psychiatricConditions.length === 0) {
                    psychiatricConditionsList.innerHTML = '<span class="personal-value" style="margin: 0;">Not specified</span>';
                } else {
                    psychiatricConditions.forEach(condition => {
                        if (condition && condition.trim()) {
                            const item = document.createElement('div');
                            item.className = 'psych-condition-item';
                            const conditionText = escapeHtml(condition);
                            item.innerHTML = `<span class="condition-text">${conditionText}</span>`;
                            psychiatricConditionsList.appendChild(item);
                        }
                    });
                }
            }

            const allergyValues = medicalSubsections[1].querySelectorAll('.personal-row .personal-value');
            if (allergyValues.length >= 2) {
                allergyValues[0].textContent = medicalHistory?.foodAllergy || 'None reported';
                allergyValues[1].textContent = medicalHistory?.medicalAllergy || 'None reported';
            }
        }

        const familyCards = document.querySelectorAll('.family-card');
        if (familyCards.length >= 2) {
            const psychiatricValues = familyCards[0].querySelectorAll('.family-value');
            if (psychiatricValues.length >= 2) {
                psychiatricValues[0].textContent = familyHistory?.paternalPsych || 'None reported';
                psychiatricValues[1].textContent = familyHistory?.maternalPsych || 'None reported';
            } else if (psychiatricValues.length === 1) {
                const paternal = familyHistory?.paternalPsych || 'None reported';
                const maternal = familyHistory?.maternalPsych ? ` | Maternal: ${familyHistory.maternalPsych}` : '';
                psychiatricValues[0].textContent = `${paternal}${maternal}`;
            }

            const medicalValues = familyCards[1].querySelectorAll('.family-value');
            if (medicalValues.length >= 2) {
                medicalValues[0].textContent = familyHistory?.paternalMed || 'None reported';
                medicalValues[1].textContent = familyHistory?.maternalMed || 'None reported';
            }
        }

        setHistoryToggleVisibility('mentalHistoryToggle', 'mentalHistoryPanel', observations.length > 0);
        syncMentalHistoryToggle();
    }

    function renderMedicationIntake(entries) {
        const medicineIntakeList = document.getElementById('medicineIntakeList');

        if (!medicineIntakeList) {
            return;
        }

        const sortedEntries = [...entries].sort((a, b) => {
            const aTime = new Date(a.Date_Administered || 0).getTime();
            const bTime = new Date(b.Date_Administered || 0).getTime();
            return bTime - aTime;
        });

        state.currentMedicationIntakeEntries = sortedEntries;
        state.selectedMedicationDateKey = getMedicationDateKey(sortedEntries[0]?.Date_Administered);
        state.medicationCalendarMonth = null;
        state.medicationCalendarYear = null;

        if (!entries.length) {
            medicineIntakeList.innerHTML = '<p style="padding: 20px; color: #999;">No medicine intake records available.</p>';
            renderMedicationIntakeCalendar();
            renderMedicationIntakeHistoryByDate();
            setHistoryToggleVisibility('medicineIntakeHistoryToggle', 'medicineIntakeHistoryPanel', false);
            return;
        }

        setHistoryToggleVisibility('medicineIntakeHistoryToggle', 'medicineIntakeHistoryPanel', true);

        let previousDateLabel = '';
        medicineIntakeList.innerHTML = sortedEntries.map((entry, index) => {
            const dateTime = formatMedicationDateTime(entry.Date_Administered);
            const showDateLabel = dateTime.dateLabel !== previousDateLabel;
            previousDateLabel = dateTime.dateLabel;
            const dosage = entry.Dosage || 'Not recorded';
            const nurseName = entry.AdministeredByName || 'Staff on record';

            return `
                ${showDateLabel ? `<div class="intake-date">${escapeHtml(dateTime.dateLabel)}</div>` : ''}
                <div class="medicine-intake-card">
                    <div class="medicine-intake-top">
                        <span class="intake-time">${escapeHtml(dateTime.timeLabel)}</span>
                        <span class="intake-dot">•</span>
                        <span class="intake-nurse">${escapeHtml(nurseName)}</span>
                        ${index === 0 ? '<span class="intake-latest">Latest</span>' : ''}
                    </div>
                    <div class="medicine-intake-cols">
                        <div class="intake-col">
                            <div class="intake-label">Medicine</div>
                            <div class="intake-value">${escapeHtml(entry.Medicine || 'Unnamed medicine')}</div>
                        </div>
                        <div class="intake-col">
                            <div class="intake-label">Dosage</div>
                            <div class="intake-value">${escapeHtml(dosage)}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        renderMedicationIntakeCalendar();
        renderMedicationIntakeHistoryByDate();
    }

    function renderPrescriptions(prescriptions) {
        const prescriptionList = document.getElementById('prescriptionList');
        if (!prescriptionList) {
            return;
        }

        const statusSelect = document.querySelector('.prescription-status-select');
        const badgeLabel = statusSelect ? statusSelect.value : 'Active';
        const badgeClass = badgeLabel.toLowerCase() === 'discontinued' ? 'inactive' : 'active';

        if (!prescriptions.length) {
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
                        <div class="prescription-value">${escapeHtml((prescription.Dosage || 'N/A') + ' — ' + (prescription.Frequency || 'N/A'))}</div>
                    </div>
                    <div>
                        <div class="prescription-label">Start date & duration</div>
                        <div class="prescription-value">${escapeHtml(formatDisplayDate(prescription.Date || ''))}${prescription.Duration ? ` — ${escapeHtml(prescription.Duration)}` : ''}</div>
                    </div>
                    <div>
                        <div class="prescription-label">Prescribing doctor</div>
                        <div class="prescription-value">${escapeHtml(prescription.PrescribedByName || 'Doctor on record')}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async function fetchPatientPrescriptions(patientId) {
        const normalizedId = encodeURIComponent(patientId);
        const data = await fetchJson(`../php/get_patient_prescriptions.php?patient_id=${normalizedId}&_=${Date.now()}`);
        const prescriptions = Array.isArray(data.prescriptions) ? data.prescriptions : [];

        if (String(state.selectedPatientId) === String(patientId)) {
            state.currentPatientPrescriptions = prescriptions;
            populateMedicineIntakePrescriptionOptions(
                prescriptions,
                prescriptions.length ? 'No prescribed medicines available' : 'No prescribed medicines available'
            );
        }

        renderPrescriptions(prescriptions);
        return prescriptions;
    }

    function renderExternalMedicine(records) {
        const tableBody = document.getElementById('externalMedicineTableBody');
        if (!tableBody) {
            return;
        }

        if (!records.length) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No external medicine entries available.</td></tr>';
            return;
        }

        tableBody.innerHTML = records.map((record, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(formatDisplayDate(record.med_date || ''))}</td>
                <td>${escapeHtml(record.medicine || 'N/A')}</td>
                <td>${escapeHtml(record.quantity || 'N/A')}</td>
                <td>${escapeHtml(record.received_by || '')}</td>
                <td>${escapeHtml(record.sent_by || '')}</td>
            </tr>
        `).join('');
    }

    function renderBelongings(records) {
        const tableBody = document.getElementById('belongingsTableBody');
        if (!tableBody) {
            return;
        }

        if (!records.length) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No belongings records available.</td></tr>';
            return;
        }

        tableBody.innerHTML = records.map((record, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(formatDisplayDate(record.belongings_date || ''))}</td>
                <td>${escapeHtml(record.item || 'N/A')}</td>
                <td>${escapeHtml(record.quantity || 'N/A')}</td>
                <td>${escapeHtml(record.received_by || '')}</td>
                <td>${escapeHtml(record.sent_by || '')}</td>
            </tr>
        `).join('');
    }

    function renderVisitors(records) {
        const tableBody = document.getElementById('visitorsTableBody');
        if (!tableBody) {
            return;
        }

        if (!records.length) {
            tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #999;">No visitors recorded for this patient.</td></tr>';
            return;
        }

        tableBody.innerHTML = records.map(record => `
            <tr>
                <td>${escapeHtml(record.visit_time || 'N/A')}</td>
                <td>${escapeHtml(formatDisplayDate(record.visit_date || ''))}</td>
                <td>${escapeHtml(record.visitor_name || 'N/A')}</td>
                <td>${escapeHtml(record.relationship || 'N/A')}</td>
            </tr>
        `).join('');
    }

    function populateDoctorOptions() {
        const select = getNewPatientField('attendingPhysician');
        if (!select) {
            return;
        }

        const previousValue = select.value;
        select.innerHTML = '<option value="">Select Attending Physician</option>';

        state.doctors.forEach(doctor => {
            const option = document.createElement('option');
            option.value = String(doctor.id);
            option.textContent = getDoctorDisplayName(doctor);
            select.appendChild(option);
        });

        if (previousValue && Array.from(select.options).some(option => option.value === previousValue)) {
            select.value = previousValue;
        }
    }

    async function loadDoctorOptions() {
        try {
            const data = await fetchJson('../php/get_staff.php');
            const staffs = Array.isArray(data.staffs) ? data.staffs : [];
            state.doctors = staffs
                .filter(staff => String(staff.Role || '').toLowerCase() === 'doctor')
                .map(staff => ({
                    id: staff.Staff_ID,
                    firstName: staff.FirstName || '',
                    lastName: staff.LastName || ''
                }));
        } catch (error) {
            console.error('Failed to load doctors:', error);
            state.doctors = [];
        }

        populateDoctorOptions();
    }

    function renderSelectedAdmissionInfo(appointment) {
        const selectedInfo = document.getElementById('selectedPatientInfo');
        if (!selectedInfo) {
            return;
        }

        if (!appointment) {
            selectedInfo.innerHTML = '';
            selectedInfo.style.display = 'none';
            return;
        }

        const patientName = buildFullName(
            appointment.PatientFirstName,
            appointment.PatientMiddleName,
            appointment.PatientLastName
        ) || 'Unnamed patient';

        selectedInfo.innerHTML = `
            <div class="selected-patient-badge">
                <i class="bi bi-check-circle-fill"></i>
                <strong>Selected:</strong> ${escapeHtml(patientName)}
            </div>
        `;
        selectedInfo.style.display = 'block';
    }

    function populateNewPatientFromAppointment(appointment) {
        resetNewPatientFormFields();
        setNewPatientSectionsVisible(true);

        setNewPatientFieldValue('dob', '');
        setNewPatientFieldValue('age', appointment.Age ? String(appointment.Age) : '');
        setNewPatientFieldValue('sex', titleCase(appointment.Sex || ''));
        setNewPatientFieldValue('civilStatus', '');
        setNewPatientFieldValue('religion', '');
        setNewPatientFieldValue('address', appointment.GuardianAddress || '');
        setNewPatientFieldValue('roomType', '');
        setNewPatientFieldValue('emergencyContact', appointment.GuardianContact || '');
        setNewPatientFieldValue('guardianName', buildFullName(
            appointment.GuardianFirstName,
            appointment.GuardianMiddleName,
            appointment.GuardianLastName
        ));
        setNewPatientFieldValue('hobbies', '');
        setNewPatientFieldValue('previousOccupation', '');
        setNewPatientFieldValue('diagnosis', '');
        setNewPatientFieldValue('attendingPhysician', '');

        renderSelectedAdmissionInfo(appointment);
    }

    function selectAdmissionAppointment(appointmentId) {
        state.selectedAdmissionAppointmentId = String(appointmentId || '');

        document.querySelectorAll('#appointmentList .appointment-selection-card').forEach(card => {
            const isSelected = card.getAttribute('data-appointment-id') === state.selectedAdmissionAppointmentId;
            card.classList.toggle('selected', isSelected);

            const radio = card.querySelector('.appointment-radio');
            if (radio) {
                radio.checked = isSelected;
            }
        });

        populateNewPatientFromAppointment(getSelectedAdmissionAppointment());
    }

    function renderForAdmissionAppointments() {
        const appointmentList = document.getElementById('appointmentList');
        if (!appointmentList) {
            return;
        }

        const existingPatientKeys = new Set(state.patients.map(buildPatientIdentityKey));
        const appointments = state.forAdmissionAppointments.filter(appointment => {
            return !existingPatientKeys.has(buildAppointmentIdentityKey(appointment));
        });

        if (!appointments.length) {
            appointmentList.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">No for admission appointments available.</p>';
            return;
        }

        appointmentList.innerHTML = '';

        appointments.forEach(appointment => {
            const appointmentId = String(appointment.AppointmentID || appointment.Appointment_ID || '');
            const card = document.createElement('div');
            card.className = 'appointment-selection-card';
            card.setAttribute('data-appointment-id', appointmentId);

            const patientName = buildFullName(
                appointment.PatientFirstName,
                appointment.PatientMiddleName,
                appointment.PatientLastName
            ) || 'Unnamed patient';

            card.innerHTML = `
                <div class="appointment-card-content">
                    <div class="appointment-card-header">
                        <input type="radio" name="appointmentRadio" class="appointment-radio" id="appointment-${escapeHtml(appointmentId)}">
                        <label for="appointment-${escapeHtml(appointmentId)}" class="appointment-card-label">
                            <div class="appointment-name">${escapeHtml(patientName)}</div>
                            <div class="appointment-details">
                                <span class="appointment-date-time">
                                    <i class="bi bi-calendar3"></i> ${escapeHtml(formatDisplayDate(appointment.AppointmentDate || ''))}
                                </span>
                                <span class="appointment-date-time">
                                    <i class="bi bi-clock"></i> ${escapeHtml(formatAppointmentTime(appointment.AppointmentTime || ''))}
                                </span>
                            </div>
                            ${appointment.GuardianContact ? `<div class="appointment-contact"><i class="bi bi-telephone"></i> ${escapeHtml(appointment.GuardianContact)}</div>` : ''}
                        </label>
                    </div>
                </div>
            `;

            card.addEventListener('click', function() {
                selectAdmissionAppointment(appointmentId);
            });

            appointmentList.appendChild(card);
        });
    }

    async function loadForAdmissionAppointments() {
        try {
            const data = await fetchJson(`../php/get_appointments.php?status=${encodeURIComponent('for admission')}&_=${Date.now()}`);
            state.forAdmissionAppointments = Array.isArray(data.appointments) ? data.appointments : [];
        } catch (error) {
            console.error('Failed to load for admission appointments:', error);
            state.forAdmissionAppointments = [];
        }

        renderForAdmissionAppointments();
    }

    async function loadPatientSections(patientId) {
        const normalizedId = encodeURIComponent(patientId);

        await Promise.all([
            fetchJson(`../php/get_patient_diagnoses.php?patient_id=${normalizedId}`)
                .then(data => renderDiagnoses(Array.isArray(data.diagnoses) ? data.diagnoses : []))
                .catch(error => {
                    console.error('Failed to load diagnoses:', error);
                    renderDiagnoses([]);
                }),
            fetchJson(`../php/get_patient_vitals.php?patient_id=${normalizedId}`)
                .then(data => renderVitals(data.vitals || null))
                .catch(error => {
                    console.error('Failed to load vitals:', error);
                    renderVitals(null);
                }),
            fetchJson(`../php/get_patient_background.php?patient_id=${normalizedId}&_=${Date.now()}`)
                .then(data => renderPatientBackground(data))
                .catch(error => {
                    console.error('Failed to load patient background:', error);
                    renderPatientBackground(null);
                }),
            fetchJson(`../php/get_medication_intake.php?patient_id=${normalizedId}&_=${Date.now()}`)
                .then(data => renderMedicationIntake(Array.isArray(data.medicationIntake) ? data.medicationIntake : []))
                .catch(error => {
                    console.error('Failed to load medicine intake:', error);
                    renderMedicationIntake([]);
                }),
            fetchPatientPrescriptions(patientId)
                .catch(error => {
                    console.error('Failed to load prescriptions:', error);
                    if (String(state.selectedPatientId) === String(patientId)) {
                        state.currentPatientPrescriptions = [];
                        populateMedicineIntakePrescriptionOptions([], 'Unable to load prescribed medicines');
                    }
                    renderPrescriptions([]);
                }),
            fetchJson(`../php/patient_external_meds.php?patient_id=${normalizedId}&_=${Date.now()}`)
                .then(data => renderExternalMedicine(Array.isArray(data.records) ? data.records : []))
                .catch(error => {
                    console.error('Failed to load external medicine:', error);
                    renderExternalMedicine([]);
                }),
            fetchJson(`../php/patient_belongings.php?patient_id=${normalizedId}&_=${Date.now()}`)
                .then(data => renderBelongings(Array.isArray(data.records) ? data.records : []))
                .catch(error => {
                    console.error('Failed to load belongings:', error);
                    renderBelongings([]);
                }),
            fetchJson(`../php/patient_visitors.php?patient_id=${normalizedId}&_=${Date.now()}`)
                .then(data => renderVisitors(Array.isArray(data.records) ? data.records : []))
                .catch(error => {
                    console.error('Failed to load visitors:', error);
                    renderVisitors([]);
                })
        ]);

        syncMentalHistoryToggle();
    }

    async function loadUserInfo() {
        try {
            const data = await fetchJson('../php/get_user.php');
            if (data.user) {
                const fullName = [data.user.firstname, data.user.lastname].filter(Boolean).join(' ').trim();
                setHeaderUserName(fullName || 'Admin');
                return;
            }
        } catch (error) {
            console.error('Failed to load admin user info:', error);
        }

        setHeaderUserName('Admin');
    }

    async function loadPatients(preferredPatientId = state.selectedPatientId, preferredPatientName = null) {
        const patientList = document.getElementById('patientList');

        try {
            const data = await fetchJson('../php/get_doctor_patients.php');
            state.patients = Array.isArray(data.patients) ? data.patients : [];
            syncVisiblePatientSelection(preferredPatientId, preferredPatientName);
        } catch (error) {
            console.error('Failed to load patients:', error);
            state.patients = [];

            if (patientList) {
                patientList.innerHTML = '<li class="patient-list-item empty-state">Unable to load patients.</li>';
            }

            resetPatientDetails();
        }
    }

    function setupMedicineIntakeSubmission() {
        const form = document.getElementById('medicineIntakeForm');
        if (!form) {
            return;
        }

        // Capture submit before the legacy inline script handler so DB-backed saving always wins.
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            void window.saveMedicineIntake();
        }, true);
    }

    function setupExternalMedicineSubmission() {
        const form = document.getElementById('externalMedicineForm');
        if (!form) {
            return;
        }

        form.addEventListener('submit', function(event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            void window.saveExternalMedicine();
        }, true);
    }

    function setupBelongingsSubmission() {
        const form = document.getElementById('belongingsForm');
        if (!form) {
            return;
        }

        form.addEventListener('submit', function(event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            void window.saveBelongings();
        }, true);
    }

    function setupVisitorsSubmission() {
        const form = document.getElementById('visitorsForm');
        if (!form) {
            return;
        }

        form.addEventListener('submit', function(event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            void window.saveVisitors();
        }, true);
    }

    function setupPrescriptionSubmission() {
        const form = document.getElementById('prescriptionForm');
        if (!form) {
            return;
        }

        // Capture submit before the legacy inline script handler so DB-backed saving always wins.
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            void window.savePrescription();
        }, true);
    }

    function setupDiagnosisSubmission() {
        const form = document.getElementById('diagnosisForm');
        if (!form) {
            return;
        }

        form.addEventListener('submit', function(event) {
            event.preventDefault();
            event.stopImmediatePropagation();
            void window.saveDiagnosis();
        }, true);
    }

    document.addEventListener('DOMContentLoaded', async function() {
        const urlParams = new URLSearchParams(window.location.search);
        const preferredPatientId = urlParams.get('patientId');
        const preferredPatientName = urlParams.get('patientName');

        wrapExistingPatientAction('openEditPersonalModal', 'open the Personal editor');
        wrapExistingPatientAction('saveEditPersonal', 'save Personal changes');
        wrapExistingPatientAction('openEditVitalsModal', 'open the Vitals editor');
        wrapExistingPatientAction('saveEditVitals', 'save Vitals changes');
        wrapExistingPatientAction('openEditMentalStatusModal', 'open the Mental Status editor');
        wrapExistingPatientAction('saveEditMentalStatus', 'save Mental Status changes');

        initMedicineIntakeHistoryControls();
        setupPatientFilterControls();
        setupDischargeButton();
        setupDiagnosisRowClickHandler();
        resetPatientDetails();
        resetMedicineIntakeModalOptions();
        setupDiagnosisSubmission();
        setupExternalMedicineSubmission();
        setupBelongingsSubmission();
        setupVisitorsSubmission();
        setupPrescriptionSubmission();
        setupMedicineIntakeSubmission();
        await loadUserInfo();
        await loadDoctorOptions();
        await loadPatients(preferredPatientId || null, preferredPatientName || null);
    });

    window.openDiagnosisModal = function() {
        if (!ensureSelectedPatientCanBeModified('open the Diagnosis form')) {
            return;
        }

        const modal = document.getElementById('diagnosisModal');
        if (modal) {
            modal.style.display = 'flex';
        }

        const dateInput = document.getElementById('diagnosisDate');
        if (dateInput) {
            dateInput.valueAsDate = new Date();
        }
    };

    window.closeDiagnosisModal = function() {
        const modal = document.getElementById('diagnosisModal');
        if (modal) {
            modal.style.display = 'none';
        }

        const form = document.getElementById('diagnosisForm');
        if (form) {
            form.reset();
        }
    };

    window.closeDiagnosisDetailsModal = function() {
        closeDiagnosisDetailsModalInternal();
    };

    function collectDiagnosisSymptomsFromModal() {
        return Array.from(document.querySelectorAll('#diagnosisSymptomChipList .diagnosis-chip-text'))
            .map(item => item.textContent.trim())
            .filter(Boolean);
    }

    function collectDiagnosisMedicinesFromModal() {
        const rows = Array.from(document.querySelectorAll('#diagnosisMedicineList .diagnosis-medicine-row'));
        return rows
            .map(row => ({
                medicine: row.querySelector('.diagnosis-medicine-name')?.value?.trim() || '',
                dosage: row.querySelector('.diagnosis-medicine-dosage')?.value?.trim() || '',
                frequency: row.querySelector('.diagnosis-medicine-frequency')?.value?.trim() || '',
                duration: row.querySelector('.diagnosis-medicine-duration')?.value?.trim() || ''
            }))
            .filter(item => item.medicine);
    }

    async function saveDiagnosisMedicinesAsPrescriptions(patientId, diagnosisDate, medicines) {
        if (!patientId || !Array.isArray(medicines) || medicines.length === 0) {
            return;
        }

        await Promise.allSettled(medicines.map(async (item) => {
            const formData = new FormData();
            formData.append('patient_id', String(patientId));
            formData.append('medicine', item.medicine);
            formData.append('dosage', item.dosage || 'As prescribed');
            formData.append('frequency', item.frequency || 'Once daily');
            formData.append('duration', item.duration || '');
            formData.append('date', diagnosisDate || new Date().toISOString().split('T')[0]);

            const response = await fetch('../php/save_prescription.php', {
                method: 'POST',
                body: formData,
                cache: 'no-store',
                credentials: 'include'
            });

            let payload = null;
            try {
                payload = await response.json();
            } catch (error) {
                throw new Error('Failed to parse prescription save response');
            }

            if (!response.ok || !payload?.success) {
                throw new Error(payload?.message || 'Failed to save prescription entry');
            }
        }));
    }

    window.saveDiagnosis = async function() {
        if (!ensureSelectedPatientCanBeModified('save diagnosis changes')) {
            return;
        }

        const diagnosisDate = document.getElementById('diagnosisDate')?.value || '';
        const diagnosisTitle = document.getElementById('diagnosisTitle')?.value?.trim() || '';
        const diagnosisNotes = document.getElementById('diagnosisNotes')?.value?.trim() || '';
        const diagnosisSymptoms = collectDiagnosisSymptomsFromModal();
        const diagnosisMedicines = collectDiagnosisMedicinesFromModal();
        const patientId = String(state.selectedPatientId || '').trim();

        if (!patientId) {
            showAdminPatientActionFeedback('Please select a patient first.', 'Select Patient', 'warning');
            return;
        }

        if (!diagnosisDate || !diagnosisTitle) {
            showAdminPatientActionFeedback('Please fill in the diagnosis date and title fields.', 'Missing Information', 'warning');
            return;
        }

        const shouldSave = await showAdminPatientActionConfirm(
            'Are you sure you want to save this diagnosis information?',
            'Save Diagnosis',
            'primary',
            'Save Diagnosis'
        );

        if (!shouldSave) {
            return;
        }

        try {
            const formData = new FormData();
            formData.append('patient_id', patientId);
            formData.append('diagnosis', diagnosisTitle);
            formData.append('notes', diagnosisNotes);
            formData.append('symptoms', diagnosisSymptoms.join(', '));
            formData.append('date', diagnosisDate);

            const response = await fetch('../php/save_diagnosis.php', {
                method: 'POST',
                body: formData,
                cache: 'no-store',
                credentials: 'include'
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to save diagnosis');
            }

            if (diagnosisMedicines.length > 0) {
                await saveDiagnosisMedicinesAsPrescriptions(patientId, diagnosisDate, diagnosisMedicines);
            }

            await loadPatientSections(patientId);
            window.closeDiagnosisModal();
            showAdminPatientActionFeedback(data.message || 'Diagnosis information was saved successfully.', 'Saved', 'success');
        } catch (error) {
            console.error('Failed to save diagnosis:', error);
            showAdminPatientActionFeedback(error.message || 'Unknown error while saving diagnosis.', 'Save Failed', 'danger');
        }
    };

    window.moveDiagnosisToPsychiatricRecord = async function() {
        if (!ensureSelectedPatientCanBeModified('move the diagnosis to Psychiatric Record')) {
            return;
        }

        const selectedDiagnosis = state.selectedDiagnosisForAction;
        if (!selectedDiagnosis) {
            alert('No diagnosis selected.');
            return;
        }

        const diagnosisTitle = selectedDiagnosis.title || 'Not specified';
        updatePsychiatricRecordValue(diagnosisTitle);

        // First, save the diagnosis as a psychiatric condition in the database
        if (state.selectedPatientId) {
            try {
                const formData = new FormData();
                formData.append('patient_id', state.selectedPatientId);
                formData.append('psychiatric_condition', diagnosisTitle);

                const savePsychResponse = await fetch('../php/save_psychiatric_condition.php', {
                    method: 'POST',
                    body: formData,
                    cache: 'no-store',
                    credentials: 'include'
                });

                const saveResult = await savePsychResponse.json();
                if (!savePsychResponse.ok || !saveResult.success) {
                    throw new Error(saveResult.message || 'Failed to save psychiatric condition');
                }
            } catch (error) {
                console.error('Failed to save psychiatric condition:', error);
                alert(`Failed to save psychiatric condition: ${error.message}`);
                closeDiagnosisDetailsModalInternal();
                return;
            }
        }

        const diagnosisId = String(selectedDiagnosis.id || '').trim();
        if (diagnosisId) {
            try {
                const formData = new FormData();
                formData.append('diagnosis_id', diagnosisId);

                const response = await fetch('../php/delete_diagnosis.php', {
                    method: 'POST',
                    body: formData,
                    cache: 'no-store',
                    credentials: 'include'
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'Failed to remove diagnosis');
                }
            } catch (error) {
                console.error('Failed to remove diagnosis after moving:', error);
                alert(`Moved to Psychiatric Record, but failed to remove diagnosis: ${error.message}`);
                closeDiagnosisDetailsModalInternal();
                return;
            }
        } else if (selectedDiagnosis.rowElement && selectedDiagnosis.rowElement.remove) {
            selectedDiagnosis.rowElement.remove();
        }

        if (state.selectedPatientId) {
            await loadPatientSections(state.selectedPatientId);
        }

        closeDiagnosisDetailsModalInternal();
    };

    window.removePsychiatricCondition = async function(conditionText) {
        if (!ensureSelectedPatientCanBeModified('remove a psychiatric condition')) {
            return;
        }

        if (!state.selectedPatientId) {
            alert('No patient selected.');
            return;
        }

        if (!confirm(`Remove "${conditionText}" from psychiatric conditions?`)) {
            return;
        }

        try {
            const formData = new FormData();
            formData.append('patient_id', state.selectedPatientId);
            formData.append('condition_to_remove', conditionText);

            const response = await fetch('../php/remove_psychiatric_condition.php', {
                method: 'POST',
                body: formData,
                cache: 'no-store',
                credentials: 'include'
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to remove condition');
            }

            // Reload patient data to refresh display
            await loadPatientSections(state.selectedPatientId);
        } catch (error) {
            console.error('Failed to remove psychiatric condition:', error);
            alert(`Failed to remove condition: ${error.message}`);
        }
    };

    window.openNewPatientModal = async function() {
        const modal = document.getElementById('newPatientModal');
        if (!modal) {
            return;
        }

        resetNewPatientFormFields();
        setNewPatientSectionsVisible(false);
        state.selectedAdmissionAppointmentId = null;

        await Promise.all([
            loadDoctorOptions(),
            loadForAdmissionAppointments()
        ]);

        modal.style.display = 'flex';
    };

    window.closeNewPatientModal = function() {
        const modal = document.getElementById('newPatientModal');
        if (modal) {
            modal.style.display = 'none';
        }

        state.selectedAdmissionAppointmentId = null;
        resetNewPatientFormFields();
        setNewPatientSectionsVisible(false);
        renderSelectedAdmissionInfo(null);
    };

    window.saveNewPatient = async function() {
        const appointment = getSelectedAdmissionAppointment();
        if (!appointment) {
            alert('Please select a for admission appointment first.');
            return;
        }

        const staffId = getNewPatientFieldValue('attendingPhysician');
        if (!staffId) {
            alert('Please select an attending physician.');
            return;
        }

        const roomType = getNewPatientFieldValue('roomType');
        if (!roomType) {
            alert('Please select a room type.');
            return;
        }

        const chronicConditions = collectDynamicInputValues('chronicConditionContainer', 'chronicCondition', 'dynamic-condition-row');
        const foodAllergies = collectDynamicInputValues('foodAllergyContainer', 'foodAllergy', 'dynamic-allergy-row');
        const medicalAllergies = collectDynamicInputValues('medicalAllergyContainer', 'medicalAllergy', 'dynamic-allergy-row');

        const payload = {
            appointmentId: appointment.AppointmentID || appointment.Appointment_ID,
            staffId: parseInt(staffId, 10),
            birthdate: getNewPatientFieldValue('dob'),
            age: getNewPatientFieldValue('age'),
            sex: getNewPatientFieldValue('sex'),
            civilStatus: getNewPatientFieldValue('civilStatus'),
            religion: getNewPatientFieldValue('religion'),
            address: getNewPatientFieldValue('address'),
            roomType,
            emergencyContact: getNewPatientFieldValue('emergencyContact'),
            guardianName: getNewPatientFieldValue('guardianName'),
            hobbies: getNewPatientFieldValue('hobbies'),
            previousOccupation: getNewPatientFieldValue('previousOccupation'),
            diagnosis: getNewPatientFieldValue('diagnosis'),
            observations: getNewPatientObservationsList(),
            chronicCondition: chronicConditions.join(', '),
            psychiatricCondition: getNewPatientFieldValue('psychiatricCondition'),
            foodAllergy: foodAllergies.join(', '),
            medicalAllergy: medicalAllergies.join(', '),
            paternalPsych: getNewPatientFieldValue('psychiatricPaternal'),
            maternalPsych: getNewPatientFieldValue('psychiatricMaternal'),
            paternalMed: getNewPatientFieldValue('medicalPaternal'),
            maternalMed: getNewPatientFieldValue('medicalMaternal'),
            vitals: {
                bloodPressure: getNewPatientFieldValue('vitalBP'),
                pulseRate: getNewPatientFieldValue('vitalPulse'),
                temperature: getNewPatientFieldValue('vitalTemp'),
                weight: getNewPatientFieldValue('vitalWeight'),
                height: getNewPatientFieldValue('vitalHeight'),
                respiratoryRate: getNewPatientFieldValue('vitalRespiratory'),
                oxygenSaturation: getNewPatientFieldValue('vitalO2')
            }
        };

        try {
            const response = await fetch('../php/save_patient_record.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }

            await loadPatients(data.patientId || null);
            await loadForAdmissionAppointments();
            window.closeNewPatientModal();
            alert(data.message || 'Patient record saved successfully.');
        } catch (error) {
            console.error('Failed to save new patient:', error);
            alert(error.message || 'Unable to save the patient record.');
        }
    };

    window.openMedicineIntakeModal = async function() {
        if (!ensureSelectedPatientCanBeModified('open the Medicine Intake form')) {
            return;
        }

        const selectedPatient = getSelectedPatient();
        if (!selectedPatient) {
            showAdminPatientActionFeedback('Please select a patient first.', 'Select Patient', 'warning');
            return;
        }

        try {
            const prescriptions = await fetchPatientPrescriptions(selectedPatient.id);
            if (!prescriptions.length) {
                showAdminPatientActionFeedback('No prescribed medicines are available for this patient yet.', 'No Prescriptions', 'warning');
                return;
            }

            const form = document.getElementById('medicineIntakeForm');
            if (form) {
                form.reset();
            }

            resetMedicineIntakeModalOptions();

            const modal = document.getElementById('medicineIntakeModal');
            if (modal) {
                modal.style.display = 'flex';
            }
        } catch (error) {
            console.error('Failed to prepare medicine intake modal:', error);
            showAdminPatientActionFeedback(`Unable to load prescribed medicines: ${error.message}`, 'Load Failed', 'danger');
        }
    };

    window.closeMedicineIntakeModal = function() {
        const modal = document.getElementById('medicineIntakeModal');
        if (modal) {
            modal.style.display = 'none';
        }

        const form = document.getElementById('medicineIntakeForm');
        if (form) {
            form.reset();
        }

        resetMedicineIntakeModalOptions();
    };

    window.openExternalMedicineModal = function() {
        if (!ensureSelectedPatientCanBeModified('open the External Medicine form')) {
            return;
        }

        const selectedPatient = getSelectedPatient();
        if (!selectedPatient) {
            showAdminPatientActionFeedback('Please select a patient first.', 'Select Patient', 'warning');
            return;
        }

        const form = document.getElementById('externalMedicineForm');
        if (form) {
            form.reset();
        }

        setDateInputValue('medicineDate');

        const modal = document.getElementById('externalMedicineModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    };

    window.closeExternalMedicineModal = function() {
        const modal = document.getElementById('externalMedicineModal');
        if (modal) {
            modal.style.display = 'none';
        }

        const form = document.getElementById('externalMedicineForm');
        if (form) {
            form.reset();
        }
    };

    window.saveExternalMedicine = async function() {
        if (!ensureSelectedPatientCanBeModified('save external medicine')) {
            return;
        }

        const selectedPatient = getSelectedPatient();
        const date = document.getElementById('medicineDate')?.value || '';
        const medicine = document.getElementById('medicineDosage')?.value?.trim() || '';
        const quantity = document.getElementById('medicineQuantity')?.value?.trim() || '';
        const receivedBy = document.getElementById('medicineReceivedBy')?.value?.trim() || '';
        const sentBy = document.getElementById('medicineSentBy')?.value?.trim() || '';

        if (!selectedPatient) {
            showAdminPatientActionFeedback('Please select a patient first.', 'Select Patient', 'warning');
            return;
        }

        if (!date || !medicine || !quantity) {
            showAdminPatientActionFeedback('Please fill in the date, medicine, and quantity fields.', 'Missing Information', 'warning');
            return;
        }

        const shouldSave = await showAdminPatientActionConfirm(
            'Are you sure you want to save this external medicine information?',
            'Save External Medicine',
            'primary',
            'Save External Medicine'
        );

        if (!shouldSave) {
            return;
        }

        try {
            const data = await fetchJson('../php/patient_external_meds.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    patient_id: selectedPatient.id,
                    date,
                    medicine,
                    quantity,
                    received_by: receivedBy,
                    sent_by: sentBy
                })
            });

            renderExternalMedicine(Array.isArray(data.records) ? data.records : []);
            await loadPatientSections(selectedPatient.id);
            window.closeExternalMedicineModal();
            showAdminPatientActionFeedback(data.message || 'External medicine information was saved successfully.', 'Saved', 'success');
        } catch (error) {
            console.error('Error saving external medicine:', error);
            showAdminPatientActionFeedback(`Unable to save external medicine: ${error.message}`, 'Save Failed', 'danger');
        }
    };

    window.openBelongingsModal = function() {
        if (!ensureSelectedPatientCanBeModified('open the Belongings form')) {
            return;
        }

        const selectedPatient = getSelectedPatient();
        if (!selectedPatient) {
            showAdminPatientActionFeedback('Please select a patient first.', 'Select Patient', 'warning');
            return;
        }

        const form = document.getElementById('belongingsForm');
        if (form) {
            form.reset();
        }

        setDateInputValue('belongingsDate');

        const modal = document.getElementById('belongingsModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    };

    window.closeBelongingsModal = function() {
        const modal = document.getElementById('belongingsModal');
        if (modal) {
            modal.style.display = 'none';
        }

        const form = document.getElementById('belongingsForm');
        if (form) {
            form.reset();
        }
    };

    window.saveBelongings = async function() {
        if (!ensureSelectedPatientCanBeModified('save belongings')) {
            return;
        }

        const selectedPatient = getSelectedPatient();
        const date = document.getElementById('belongingsDate')?.value || '';
        const item = document.getElementById('belongingsItem')?.value?.trim() || '';
        const quantity = document.getElementById('belongingsQuantity')?.value?.trim() || '';
        const receivedBy = document.getElementById('belongingsReceivedBy')?.value?.trim() || '';
        const sentBy = document.getElementById('belongingsSentBy')?.value?.trim() || '';

        if (!selectedPatient) {
            showAdminPatientActionFeedback('Please select a patient first.', 'Select Patient', 'warning');
            return;
        }

        if (!date || !item || !quantity) {
            showAdminPatientActionFeedback('Please fill in the date, item, and quantity fields.', 'Missing Information', 'warning');
            return;
        }

        const shouldSave = await showAdminPatientActionConfirm(
            'Are you sure you want to save this belongings information?',
            'Save Belongings',
            'primary',
            'Save Belongings'
        );

        if (!shouldSave) {
            return;
        }

        try {
            const data = await fetchJson('../php/patient_belongings.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    patient_id: selectedPatient.id,
                    date,
                    item,
                    quantity,
                    received_by: receivedBy,
                    sent_by: sentBy
                })
            });

            renderBelongings(Array.isArray(data.records) ? data.records : []);
            await loadPatientSections(selectedPatient.id);
            window.closeBelongingsModal();
            showAdminPatientActionFeedback(data.message || 'Belongings information was saved successfully.', 'Saved', 'success');
        } catch (error) {
            console.error('Error saving belongings:', error);
            showAdminPatientActionFeedback(`Unable to save belongings: ${error.message}`, 'Save Failed', 'danger');
        }
    };

    window.openVisitorsModal = function() {
        if (!ensureSelectedPatientCanBeModified('open the Visitors form')) {
            return;
        }

        const selectedPatient = getSelectedPatient();
        if (!selectedPatient) {
            showAdminPatientActionFeedback('Please select a patient first.', 'Select Patient', 'warning');
            return;
        }

        const form = document.getElementById('visitorsForm');
        if (form) {
            form.reset();
        }

        setDateInputValue('visitorDate');
        setTimeInputValue('visitorTimeFrom');

        const timeToInput = document.getElementById('visitorTimeTo');
        if (timeToInput) {
            const now = new Date();
            now.setHours(now.getHours() + 1);
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            timeToInput.value = `${hours}:${minutes}`;
        }

        const modal = document.getElementById('visitorsModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    };

    window.closeVisitorsModal = function() {
        const modal = document.getElementById('visitorsModal');
        if (modal) {
            modal.style.display = 'none';
        }

        const form = document.getElementById('visitorsForm');
        if (form) {
            form.reset();
        }
    };

    window.saveVisitors = async function() {
        if (!ensureSelectedPatientCanBeModified('save visitor details')) {
            return;
        }

        const selectedPatient = getSelectedPatient();
        const date = document.getElementById('visitorDate')?.value || '';
        const timeFrom = document.getElementById('visitorTimeFrom')?.value || '';
        const timeTo = document.getElementById('visitorTimeTo')?.value || '';
        const name = document.getElementById('visitorName')?.value?.trim() || '';
        const relationship = document.getElementById('visitorRelationship')?.value?.trim() || '';

        if (!selectedPatient) {
            showAdminPatientActionFeedback('Please select a patient first.', 'Select Patient', 'warning');
            return;
        }

        if (!date || !timeFrom || !timeTo || !name || !relationship) {
            showAdminPatientActionFeedback('Please fill in the date, time, visitor name, and relationship fields.', 'Missing Information', 'warning');
            return;
        }

        if (timeFrom >= timeTo) {
            showAdminPatientActionFeedback('Time To must be later than Time From.', 'Invalid Time Range', 'warning');
            return;
        }

        const shouldSave = await showAdminPatientActionConfirm(
            'Are you sure you want to save this visitor information?',
            'Save Visitor',
            'primary',
            'Save Visitor'
        );

        if (!shouldSave) {
            return;
        }

        try {
            const data = await fetchJson('../php/patient_visitors.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    patient_id: selectedPatient.id,
                    date,
                    time_from: timeFrom,
                    time_to: timeTo,
                    name,
                    relationship
                })
            });

            renderVisitors(Array.isArray(data.records) ? data.records : []);
            await loadPatientSections(selectedPatient.id);
            window.closeVisitorsModal();
            showAdminPatientActionFeedback(data.message || 'Visitor information was saved successfully.', 'Saved', 'success');
        } catch (error) {
            console.error('Error saving visitor:', error);
            showAdminPatientActionFeedback(`Unable to save visitor: ${error.message}`, 'Save Failed', 'danger');
        }
    };

    window.openPrescriptionModal = function() {
        if (!ensureSelectedPatientCanBeModified('open the Prescription form')) {
            return;
        }

        const selectedPatient = getSelectedPatient();
        if (!selectedPatient) {
            showAdminPatientActionFeedback('Please select a patient first.', 'Select Patient', 'warning');
            return;
        }

        const form = document.getElementById('prescriptionForm');
        if (form) {
            form.reset();
        }

        setDateInputValue('prescriptionDate');

        const modal = document.getElementById('prescriptionModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    };

    window.closePrescriptionModal = function() {
        const modal = document.getElementById('prescriptionModal');
        if (modal) {
            modal.style.display = 'none';
        }

        const form = document.getElementById('prescriptionForm');
        if (form) {
            form.reset();
        }
    };

    window.savePrescription = async function() {
        if (!ensureSelectedPatientCanBeModified('save prescriptions')) {
            return;
        }

        const selectedPatient = getSelectedPatient();
        const medicine = document.getElementById('prescriptionMedicine')?.value?.trim() || '';
        const dosage = document.getElementById('prescriptionDosage')?.value?.trim() || '';
        const frequency = document.getElementById('prescriptionFrequency')?.value?.trim() || '';
        const date = document.getElementById('prescriptionDate')?.value || '';
        const duration = document.getElementById('prescriptionDuration')?.value?.trim() || '';

        if (!selectedPatient) {
            showAdminPatientActionFeedback('Please select a patient first.', 'Select Patient', 'warning');
            return;
        }

        if (!medicine || !dosage || !frequency || !date || !duration) {
            showAdminPatientActionFeedback('Please fill in the medicine, dosage, frequency, date, and duration fields.', 'Missing Information', 'warning');
            return;
        }

        const shouldSave = await showAdminPatientActionConfirm(
            'Are you sure you want to save this prescription information?',
            'Save Prescription',
            'primary',
            'Save Prescription'
        );

        if (!shouldSave) {
            return;
        }

        const formData = new FormData();
        formData.append('patient_id', selectedPatient.id);
        formData.append('medicine', medicine);
        formData.append('dosage', dosage);
        formData.append('frequency', frequency);
        formData.append('duration', duration);
        formData.append('date', date);

        try {
            const response = await fetch('../php/save_prescription.php', {
                method: 'POST',
                body: formData,
                cache: 'no-store',
                credentials: 'include'
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to save prescription');
            }

            await loadPatientSections(selectedPatient.id);
            window.closePrescriptionModal();
            showAdminPatientActionFeedback(data.message || 'Prescription information was saved successfully.', 'Saved', 'success');
        } catch (error) {
            console.error('Error saving prescription:', error);
            showAdminPatientActionFeedback(`Unable to save prescription: ${error.message}`, 'Save Failed', 'danger');
        }
    };

    window.saveMedicineIntake = async function() {
        if (!ensureSelectedPatientCanBeModified('save medicine intake')) {
            return;
        }

        const selectedPatient = getSelectedPatient();
        const prescriptionSelect = document.getElementById('medicineIntakePrescription');
        const selectedOption = prescriptionSelect ? prescriptionSelect.options[prescriptionSelect.selectedIndex] : null;
        const medicineDate = document.getElementById('medicineIntakeDate')?.value || '';
        const medicineTime = document.getElementById('medicineIntakeTime')?.value || '';
        const medicineName = selectedOption?.dataset.medicine || '';
        const dosage = selectedOption?.dataset.dosage || '';
        const frequency = selectedOption?.dataset.frequency || '';
        const duration = selectedOption?.dataset.duration || '';

        if (!selectedPatient) {
            showAdminPatientActionFeedback('Please select a patient first.', 'Select Patient', 'warning');
            return;
        }

        if (!selectedOption || !selectedOption.value || !medicineName || !medicineDate || !medicineTime) {
            showAdminPatientActionFeedback('Please select a prescribed medicine, date, and time.', 'Missing Information', 'warning');
            return;
        }

        const shouldSave = await showAdminPatientActionConfirm(
            'Are you sure you want to save this medicine intake information?',
            'Save Medicine Intake',
            'primary',
            'Save Medicine Intake'
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

        try {
            const response = await fetch('../php/save_medication_intake.php', {
                method: 'POST',
                body: formData,
                cache: 'no-store',
                credentials: 'include'
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to save medicine intake');
            }

            await loadPatientSections(selectedPatient.id);
            window.closeMedicineIntakeModal();
            showAdminPatientActionFeedback('Medicine intake information was saved successfully.', 'Saved', 'success');
        } catch (error) {
            console.error('Error saving medicine intake:', error);
            showAdminPatientActionFeedback(`Error saving medicine intake: ${error.message}`, 'Save Failed', 'danger');
        }
    };
})();