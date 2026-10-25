const pharmacyRows = [];
const serviceRows = [];

const AUTO_FEES = {
  doctorVisit: 1000,
  roomPrivate: 1000,
  roomWard: 800,
  foodDaily: 350,
  miscMonthly: 2500
};

const doctorVisitRows = [];

function makeEmptyPharmacyRow() {
  return { medicine: '', quantity: 0, salePrice: 0 };
}

function getFieldValue(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDaysAdmitted() {
  const admissionValue = getFieldValue('admissionDate');
  const admission = toDateOnly(admissionValue);
  if (!admission) return 0;

  const patientType = getFieldValue('patientType') || 'Inpatient';
  if (patientType.toLowerCase() !== 'inpatient') return 0;

  const dischargeValue = getFieldValue('dischargeDate');
  const discharge = toDateOnly(dischargeValue);
  const end = discharge || new Date();
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  if (endDate < admission) return 0;
  const diffMs = endDate.getTime() - admission.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function getRoomRate() {
  const roomType = getFieldValue('roomType') || 'Private';
  return roomType.toLowerCase() === 'ward' ? AUTO_FEES.roomWard : AUTO_FEES.roomPrivate;
}

function getAutoServiceRows() {
  const days = getDaysAdmitted();
  if (!days) return [];

  const roomRate = getRoomRate();
  const miscDaily = AUTO_FEES.miscMonthly / 30;

  return [
    {
      description: 'Room fee',
      rate: roomRate,
      days,
      charge: roomRate * days
    },
    {
      description: 'Food fee',
      rate: AUTO_FEES.foodDaily,
      days,
      charge: AUTO_FEES.foodDaily * days
    },
    {
      description: 'Miscellaneous',
      rate: miscDaily,
      days,
      charge: miscDaily * days
    }
  ];
}

function php(value) {
  return 'PHP ' + asNumber(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parsePesoText(value) {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9.-]+/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

let billingStatusValue = '';
let isReadOnly = false;

// =====================
// LOAD FROM DB
// =====================
async function loadSavedBill() {
  const patientId = getFieldValue('patientId');
  if (!patientId) return;

  try {
    const response = await fetch(`../php/get_running_bill.php?patient_id=${patientId}`);
    const result = await response.json();
    if (!result.success) return;

    // Restore room type from patient data
    const roomTypeEl = document.getElementById('roomType');
    if (roomTypeEl && result.patient?.Room_type) {
      roomTypeEl.value = result.patient.Room_type;
    }

    // Restore doctor visits
    doctorVisitRows.length = 0;
    (result.doctorVisits || []).forEach(item => {
      doctorVisitRows.push({ date: item.Description || '' });
    });

    // Restore pharmacy items
    pharmacyRows.length = 0;
    (result.pharmacyItems || []).forEach(item => {
      pharmacyRows.push({
        medicine: item.Description || '',
        quantity: asNumber(item.Quantity),
        salePrice: asNumber(item.Rate)
      });
    });

  } catch (e) {
    console.error('Failed to load running bill:', e);
  }
}

// =====================
// SAVE TO DB
// =====================
async function saveRunningBill() {
  const patientId = getFieldValue('patientId');
  if (!patientId) return false;

  const cleanedDoctorVisits = doctorVisitRows
    .map(row => ({ date: (row?.date || '').trim() }))
    .filter(row => row.date);

  const cleanedPharmacyItems = pharmacyRows
    .map(row => ({
      medicine: (row?.medicine || '').trim(),
      quantity: asNumber(row?.quantity),
      salePrice: asNumber(row?.salePrice)
    }))
    .filter(row => row.medicine && row.quantity > 0 && row.salePrice > 0);

  const totalText = document.getElementById('sumTotal')?.textContent || '';
  const totalAmount = parsePesoText(totalText);

  const autoRows = getAutoServiceRows();

  const items = [
    ...autoRows.map(r => ({
      type: r.description === 'Room fee' ? 'room' : r.description === 'Food fee' ? 'food' : 'misc',
      description: r.description,
      rate: r.rate,
      days: r.days,
      quantity: 1,
      amount: r.charge
    })),
    ...cleanedDoctorVisits.map(() => ({
      type: 'doctor_visit',
      description: 'Doctor visit',
      rate: AUTO_FEES.doctorVisit,
      days: 0,
      quantity: 1,
      amount: AUTO_FEES.doctorVisit
    })),
    ...cleanedPharmacyItems.map(r => ({
      type: 'pharmacy',
      description: r.medicine,
      rate: r.salePrice,
      days: 0,
      quantity: r.quantity,
      amount: r.quantity * r.salePrice
    }))
  ];

  try {
    const response = await fetch('../php/save_running_bill.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, items, grand_total: totalAmount })
    });
    const result = await response.json();
    return result.success;
  } catch (e) {
    return false;
  }
}

function renderSummaryRow() {
  const nameEl = document.getElementById('rbPatientName');
  const monthEl = document.getElementById('rbMonth');
  const admissionEl = document.getElementById('rbAdmissionDate');
  const daysEl = document.getElementById('rbDays');
  const statusEl = document.getElementById('rbStatus');

  const admissionValue = getFieldValue('admissionDate');
  const admission = toDateOnly(admissionValue);
  const patientName = getFieldValue('patientName') || '—';
  const days = getDaysAdmitted();
  const monthLabel = admission
    ? admission.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';
  const admissionLabel = admission
    ? admission.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  const dischargeValue = getFieldValue('dischargeDate');
  const status = billingStatusValue || (dischargeValue ? 'Discharged' : 'Admitted');

  if (nameEl) nameEl.textContent = patientName;
  if (monthEl) monthEl.textContent = monthLabel;
  if (admissionEl) admissionEl.textContent = admissionLabel;
  if (daysEl) daysEl.textContent = `${days} day${days === 1 ? '' : 's'}`;
  if (statusEl) statusEl.textContent = status;

  const isPaid = String(status).trim().toLowerCase() === 'paid';
  const payBtn = document.getElementById('payInvoiceBtn');
  if (payBtn) {
    payBtn.textContent = isReadOnly ? 'Pay' : 'Save billing';
    payBtn.style.display = isPaid ? 'none' : 'inline-flex';
    if (isReadOnly) payBtn.removeAttribute('disabled');
  }

  const sectionsToHide = [
    document.getElementById('particularsBlock'),
    document.getElementById('doctorFeeBlock'),
    document.getElementById('pharmacyBlock')
  ];

  sectionsToHide.forEach((section) => {
    if (!section) return;
    section.style.display = isPaid ? 'none' : '';
  });

  const roomSelect = document.querySelector('.room-select');
  if (roomSelect) roomSelect.style.display = isPaid ? 'none' : '';
  const closeBtn = document.getElementById('closeRunningBillBtn');
  if (closeBtn) closeBtn.style.display = 'inline-flex';

  const totalLabel = document.querySelector('#runningBillSummary .total span');
  if (totalLabel) totalLabel.textContent = isPaid ? 'Total Bill' : 'Total running bill';
}

function renderRows() {
  const autoBody = document.getElementById('autoChargeRows');
  const doctorBody = document.getElementById('doctorVisitRows');
  const pharmacyBody = document.getElementById('pharmacyRows');
  if (!autoBody || !doctorBody || !pharmacyBody) return;

  const autoRows = getAutoServiceRows();

  autoBody.innerHTML = autoRows.map((r) => `
    <tr>
      <td>${r.description}</td>
      <td>₱${asNumber(r.rate).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/day</td>
      <td>${r.days}</td>
      <td>${php(r.charge)}</td>
    </tr>
  `).join('');

  doctorBody.innerHTML = doctorVisitRows.length
    ? doctorVisitRows.map((visit) => `
        <tr>
          <td>Doctor visit</td>
          <td>${visit.date}</td>
          <td>${php(AUTO_FEES.doctorVisit)}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="3" class="text-muted">No visits recorded</td></tr>';

  pharmacyBody.innerHTML = pharmacyRows.length
    ? pharmacyRows.map((r) => `
        <tr>
          <td>${r.medicine}</td>
          <td>${asNumber(r.quantity)}</td>
          <td>${php(r.salePrice)}</td>
          <td>${php(asNumber(r.quantity) * asNumber(r.salePrice))}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" class="text-muted">No pharmacy items</td></tr>';

  const roomRow = autoRows.find((r) => r.description === 'Room fee');
  const foodRow = autoRows.find((r) => r.description === 'Food fee');
  const miscRow = autoRows.find((r) => r.description === 'Miscellaneous');

  const roomTotal = roomRow ? roomRow.charge : 0;
  const foodTotal = foodRow ? foodRow.charge : 0;
  const miscTotal = miscRow ? miscRow.charge : 0;
  const pharmacy = pharmacyRows.reduce((s, r) => s + asNumber(r.quantity) * asNumber(r.salePrice), 0);
  const doctorFeeTotal = doctorVisitRows.length * AUTO_FEES.doctorVisit;
  const total = roomTotal + foodTotal + miscTotal + pharmacy + doctorFeeTotal;

  const sumRoom = document.getElementById('sumRoom');
  const sumFood = document.getElementById('sumFood');
  const sumMisc = document.getElementById('sumMisc');
  const sumPharmacy = document.getElementById('sumPharmacy');
  const sumDoctor = document.getElementById('sumDoctor');
  const sumTotal = document.getElementById('sumTotal');
  const daysEl = document.getElementById('daysAdmitted');
  const doctorCountEl = document.getElementById('doctorVisitCount');

  if (sumRoom) sumRoom.textContent = php(roomTotal);
  if (sumFood) sumFood.textContent = php(foodTotal);
  if (sumMisc) sumMisc.textContent = php(miscTotal);
  if (sumPharmacy) sumPharmacy.textContent = php(pharmacy);
  if (sumDoctor) sumDoctor.textContent = php(doctorFeeTotal);
  if (sumTotal) sumTotal.textContent = php(total);
  if (daysEl) daysEl.value = String(getDaysAdmitted());
  if (doctorCountEl) doctorCountEl.value = String(doctorVisitRows.length);

  renderSummaryRow();
}

function resetForm() {
  const fieldIds = [
    'patientId', 'patientName', 'patientType', 'admissionDate', 'dischargeDate', 'patientAge',
    'admissionNo', 'roomNo', 'classification', 'attendingDoctor',
    'hospitalizationPlan', 'patientAddress', 'subServiceType', 'diagnosis'
  ];

  fieldIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') {
      if (id === 'classification') el.value = 'Private';
      else if (id === 'hospitalizationPlan') el.value = 'Private Pay';
      else if (id === 'patientType') el.value = 'Inpatient';
      else el.value = '';
      return;
    }
    el.value = '';
  });

  doctorVisitRows.length = 0;
  const roomTypeEl = document.getElementById('roomType');
  if (roomTypeEl) roomTypeEl.value = 'Private';

  pharmacyRows.length = 0;
  renderRows();
}

function openPrintPreview() {
  window.print();
}

function handlePay() {
  const payModal = document.getElementById('payModal');
  if (!payModal) return;

  const admissionDateValue = getFieldValue('admissionDate');
  const dischargeDateValue = getFieldValue('dischargeDate');
  const formattedAdmissionDate = admissionDateValue
    ? new Date(admissionDateValue).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : '';
  const formattedDischargeDate = dischargeDateValue
    ? new Date(dischargeDateValue).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : '';

  const mapValue = (sourceId, targetId) => {
    const target = document.getElementById(targetId);
    if (target) target.value = getFieldValue(sourceId);
  };

  mapValue('patientName', 'payPatientName');
  mapValue('patientId', 'payPatientId');
  mapValue('patientType', 'payPatientType');
  mapValue('subServiceType', 'payServiceType');

  const payAdmissionDate = document.getElementById('payAdmissionDate');
  const payDischargeDate = document.getElementById('payDischargeDate');
  const payTotalBill = document.getElementById('payTotalBill');
  const payAmountToPay = document.getElementById('payAmountToPay');
  const payPaymentMethod = document.getElementById('payPaymentMethod');

  if (payAdmissionDate) payAdmissionDate.value = formattedAdmissionDate;
  if (payDischargeDate) payDischargeDate.value = formattedDischargeDate;
  const totalBillValue = document.getElementById('sumTotal')?.textContent || 'PHP 0.00';
  if (payTotalBill) payTotalBill.value = totalBillValue;
  if (payAmountToPay) payAmountToPay.value = totalBillValue;
  if (payPaymentMethod && !payPaymentMethod.value) payPaymentMethod.value = 'Cash';

  payModal.hidden = false;
}

async function handleSaveBilling() {
  if (isReadOnly) {
    handlePay();
    return;
  }

  const saved = await saveRunningBill();
  alert(saved ? 'Running bill saved.' : 'Unable to save running bill.');
}

function closePayModal() {
  const payModal = document.getElementById('payModal');
  if (payModal) payModal.hidden = true;
}

function buildInvoicePreview() {
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  const patientId = getFieldValue('patientId') || '-';
  const patientName = getFieldValue('patientName') || '-';
  const classification = getFieldValue('classification') || '-';
  const hospitalizationPlan = getFieldValue('hospitalizationPlan') || '-';
  const serviceType = getFieldValue('subServiceType') || '-';
  const diagnosis = getFieldValue('diagnosis') || '-';

  const admissionDate = getFieldValue('admissionDate');
  const dischargeDate = getFieldValue('dischargeDate');
  const formattedAdmission = admissionDate
    ? new Date(admissionDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '-';
  const formattedDischarge = dischargeDate
    ? new Date(dischargeDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '-';

  setText('previewPatientIdLine', `Patient ID: ${patientId}`);
  setText('previewAdmissionDateLine', `Admission Date: ${formattedAdmission}`);
  setText('previewDischargeDateLine', `Discharge Date: ${formattedDischarge}`);
  setText('previewRecipientName', patientName);
  setText('previewClassification', `Classification: ${classification}`);
  setText('previewHospitalizationPlan', `Hospitalization Plan: ${hospitalizationPlan}`);
  setText('previewServiceType', `Service Type: ${serviceType}`);
  setText('previewDiagnosis', `Diagnosis: ${diagnosis}`);

  const doctorVisitCount = doctorVisitRows.length;
  const doctorFeeTotal = doctorVisitCount * AUTO_FEES.doctorVisit;
  const autoRows = getAutoServiceRows();
  const rows = [
    ...autoRows.map((row) => ({
      type: 'Auto Charge',
      name: row.description || '-',
      qty: 1,
      amount: asNumber(row.charge)
    })),
    ...(doctorFeeTotal ? [{
      type: 'Doctor Fee',
      name: `Doctor visit (${doctorVisitCount})`,
      qty: doctorVisitCount,
      amount: doctorFeeTotal
    }] : []),
    ...pharmacyRows.map((row) => ({
      type: 'Pharmacy',
      name: row.medicine || '-',
      qty: asNumber(row.quantity),
      amount: asNumber(row.quantity) * asNumber(row.salePrice)
    }))
  ];

  const tbody = document.getElementById('invoicePreviewRows');
  if (tbody) {
    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td>${row.type}</td>
        <td>${row.name}</td>
        <td>${row.qty}</td>
        <td>-</td>
        <td>${php(row.amount)}</td>
      </tr>
    `).join('');
  }

  const totalFromPay = asNumber(getFieldValue('payAmountToPay'));
  const total = totalFromPay > 0 ? totalFromPay : rows.reduce((sum, row) => sum + row.amount, 0);
  setText('invoicePreviewTotal', php(total));
}

function openInvoicePreviewModal() {
  buildInvoicePreview();
  const previewModal = document.getElementById('invoicePreviewModal');
  if (previewModal) previewModal.hidden = false;
}

function closeInvoicePreviewModal() {
  const previewModal = document.getElementById('invoicePreviewModal');
  if (previewModal) previewModal.hidden = true;
}

function printInvoicePreview() {
  const printArea = document.getElementById('invoicePreviewPrintArea');
  if (!printArea) return;

  const printWindow = window.open('', '_blank', 'width=980,height=760');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Invoice Preview</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 24px; color: #0f172a; }
          .invoice-preview { border: 1px solid #dbe4f1; border-radius: 14px; padding: 16px; }
          .invoice-preview__header { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e1e8f2; padding-bottom: 12px; }
          .invoice-preview__logo { width: 78px; height: 78px; border-radius: 50%; border: 1px solid #d7e2f0; object-fit: cover; }
          .invoice-preview__meta { text-align: right; }
          .invoice-preview__meta h3 { margin: 0 0 6px; font-size: 40px; line-height: 1; }
          .invoice-preview__table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          .invoice-preview__table th, .invoice-preview__table td { border-bottom: 1px solid #e2e8f3; padding: 10px 8px; text-align: left; }
          .invoice-preview__total { margin-top: 14px; display: flex; justify-content: flex-end; gap: 16px; font-size: 32px; }
          .invoice-preview__total strong { color: #0b84d8; }
        </style>
      </head>
      <body>
        ${printArea.outerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}

function confirmPay() {
  closePayModal();
  openInvoicePreviewModal();
}

function handleTableInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  const section = target.dataset.section;
  const field = target.dataset.field;
  const index = Number(target.dataset.index);

  if (!section || !field || Number.isNaN(index)) return;

  const bucket = section === 'service' ? serviceRows : pharmacyRows;
  const row = bucket[index];
  if (!row) return;

  row[field] = target.type === 'number' ? asNumber(target.value) : target.value;
  renderRows();
}

function handleTableClick(event) {
  const target = event.target;
  const button = target instanceof HTMLElement ? target.closest('[data-remove]') : null;
  if (!button) return;

  const section = button.getAttribute('data-remove');
  const index = Number(button.getAttribute('data-index'));
  const bucket = section === 'service' ? serviceRows : pharmacyRows;
  if (!bucket || Number.isNaN(index)) return;

  bucket.splice(index, 1);
  if (section === 'service' && bucket.length === 0) {
    bucket.push({ description: '', charge: 0, payment: 0 });
  }
  if (section === 'pharmacy' && bucket.length === 0) {
    bucket.push({ medicine: '', quantity: 0, salePrice: 0 });
  }

  renderRows();
}

function fillFromQuery() {
  const params = new URLSearchParams(window.location.search);
  billingStatusValue = params.get('billingStatus') || '';
  isReadOnly = params.get('readonly') === '1';
  const map = {
    patientId: 'patientId',
    patientName: 'patientName',
    patientType: 'patientType',
    admissionDate: 'admissionDate',
    dischargeDate: 'dischargeDate',
    patientAge: 'patientAge',
    admissionNo: 'admissionNo',
    roomNo: 'roomNo',
    roomType: 'roomType',
    classification: 'classification',
    attendingDoctor: 'attendingDoctor',
    hospitalizationPlan: 'hospitalizationPlan',
    patientAddress: 'patientAddress',
    subServiceType: 'subServiceType',
    diagnosis: 'diagnosis'
  };

  Object.entries(map).forEach(([queryKey, fieldId]) => {
    const value = params.get(queryKey);
    if (value === null) return;
    const el = document.getElementById(fieldId);
    if (el) el.value = value;
  });
}

function applyReadOnlyMode() {
  if (!isReadOnly) return;

  document.querySelectorAll('input, select, textarea').forEach((el) => {
    el.setAttribute('disabled', 'disabled');
  });

  const editableIds = ['payAmountToPay', 'payPaymentMethod'];
  editableIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.removeAttribute('disabled');
  });

  const disabledButtons = ['addDoctorVisitBtn', 'addPharmacyBtn'];
  disabledButtons.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.setAttribute('disabled', 'disabled');
  });

  const addDoctorBtn = document.getElementById('addDoctorVisitBtn');
  if (addDoctorBtn) addDoctorBtn.style.display = 'none';
  const addPharmacyBtn = document.getElementById('addPharmacyBtn');
  if (addPharmacyBtn) addPharmacyBtn.style.display = 'none';

  const payBtn = document.getElementById('payInvoiceBtn');
  if (payBtn) payBtn.removeAttribute('disabled');
}

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', async () => {
  fillFromQuery();
  await loadSavedBill();
  const roomTypeEl = document.getElementById('roomType');
  if (roomTypeEl && !roomTypeEl.value) roomTypeEl.value = 'Private';
  renderRows();
  applyReadOnlyMode();

  document.getElementById('serviceRows')?.addEventListener('input', handleTableInput);

  document.getElementById('addPharmacyBtn')?.addEventListener('click', () => {
    const name = document.getElementById('pharmacyNameInput')?.value?.trim();
    const qty = asNumber(document.getElementById('pharmacyQtyInput')?.value);
    const price = asNumber(document.getElementById('pharmacyPriceInput')?.value);
    if (!name || qty <= 0 || price <= 0) return;
    pharmacyRows.push({ medicine: name, quantity: qty, salePrice: price });
    document.getElementById('pharmacyNameInput').value = '';
    document.getElementById('pharmacyQtyInput').value = '1';
    document.getElementById('pharmacyPriceInput').value = '';
    renderRows();
  });

  document.getElementById('addDoctorVisitBtn')?.addEventListener('click', () => {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    doctorVisitRows.push({ date: today });
    renderRows();
  });

  document.getElementById('patientType')?.addEventListener('change', renderRows);

  document.getElementById('closeRunningBillBtn')?.addEventListener('click', () => {
    if (window.parent && window.parent.bootstrap) {
      const modalEl = window.parent.document.getElementById('runningBillModal');
      if (modalEl) window.parent.bootstrap.Modal.getInstance(modalEl)?.hide();
    }
  });

  document.getElementById('payInvoiceBtn')?.addEventListener('click', handleSaveBilling);
  document.getElementById('closePayModalBtn')?.addEventListener('click', closePayModal);
  document.getElementById('cancelPayModalBtn')?.addEventListener('click', closePayModal);
  document.getElementById('confirmPayModalBtn')?.addEventListener('click', confirmPay);

  document.getElementById('payModal')?.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closePayModal === 'true') {
      closePayModal();
    }
  });

  document.addEventListener('keydown', (event) => {ss
    if (event.key === 'Escape') {
      closePayModal();
      closeInvoicePreviewModal();
    }
  });

  document.getElementById('printInvoiceBtn')?.addEventListener('click', printInvoicePreview);
  document.getElementById('downloadInvoiceBtn')?.addEventListener('click', printInvoicePreview);
  document.getElementById('closePreviewModalBtn')?.addEventListener('click', closeInvoicePreviewModal);

  document.getElementById('invoicePreviewModal')?.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closePreviewModal === 'true') {
      closeInvoicePreviewModal();
    }
  });
});