// Patient data
const patientData = {
    2: {
        name: 'Carlos Estrada Alberto',
        diagnosis: 'Schizoaffective Disorder',
        admissionDate: 'Jan 10, 2025',
        admissionTime: '10:31 AM',
        attendingPhysician: 'Dr. Aba Estrellas',
        status: 'IDLE',
        balance: 48500.00,
        balanceDate: 'May 16, 2025',
        payments: [
            { 
                date: 'May 16, 2025', 
                payer: 'Rossy Alberto', 
                method: '-', 
                amount: 48500, 
                status: 'Unpaid',
                breakdown: null
            },
            { 
                date: 'April 16, 2025', 
                payer: 'Rossy Alberto', 
                method: 'Cash', 
                amount: 48500, 
                status: 'Paid',
                breakdown: {
                    room: 'Private',
                    price: 1500,
                    days: 30,
                    drVisit: 5,
                    drVisitCharge: 600,
                    facilityCharge: 2000
                }
            },
            { 
                date: 'March 16, 2025', 
                payer: 'Rossy Alberto', 
                method: 'Check (800)', 
                amount: 50900, 
                status: 'Paid',
                breakdown: {
                    room: 'Private',
                    price: 1500,
                    days: 31,
                    drVisit: 7,
                    drVisitCharge: 600,
                    facilityCharge: 2000
                }
            },
            { 
                date: 'Feb 16, 2025', 
                payer: 'Rossy Alberto', 
                method: 'Cash', 
                amount: 50900, 
                status: 'Paid',
                breakdown: {
                    room: 'Private',
                    price: 1500,
                    days: 31,
                    drVisit: 7,
                    drVisitCharge: 600,
                    facilityCharge: 2000
                }
            },
            { 
                date: 'Jan 16, 2025', 
                payer: 'Rossy Alberto', 
                method: 'Cash', 
                amount: 50900, 
                status: 'Paid',
                breakdown: {
                    room: 'Private',
                    price: 1500,
                    days: 31,
                    drVisit: 7,
                    drVisitCharge: 600,
                    facilityCharge: 2000
                }
            }
        ]
    },
    1: {
        name: 'Alula Z Ataad',
        diagnosis: 'Bipolar Disorder',
        admissionDate: 'Feb 15, 2025',
        admissionTime: '09:00 AM',
        attendingPhysician: 'Dr. Maria Santos',
        status: 'ACTIVE',
        balance: 35000.00,
        balanceDate: 'May 16, 2025',
        payments: [
            { 
                date: 'May 10, 2025', 
                payer: 'Juan Ataad', 
                method: 'Cash', 
                amount: 35000, 
                status: 'Paid',
                breakdown: {
                    room: 'Shared',
                    price: 1000,
                    days: 28,
                    drVisit: 6,
                    drVisitCharge: 500,
                    facilityCharge: 1500
                }
            }
        ]
    },
    3: {
        name: 'Lilia B Barrios',
        diagnosis: 'Major Depressive Disorder',
        admissionDate: 'Jan 20, 2025',
        admissionTime: '11:15 AM',
        attendingPhysician: 'Dr. Juan Cruz',
        status: 'STABLE',
        balance: 42000.00,
        balanceDate: 'May 16, 2025',
        payments: [
            { 
                date: 'May 5, 2025', 
                payer: 'Pedro Barrios', 
                method: 'Check (1205)', 
                amount: 42000, 
                status: 'Unpaid',
                breakdown: null
            }
        ]
    }
};

// Format currency
function formatCurrency(amount) {
    if (!amount || amount === 0) return '-';
    return '₱ ' + parseFloat(amount).toLocaleString('en-PH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

// Toggle billing details
function toggleBillingDetails(button) {
    const row = button.closest('tr');
    const detailsRow = row.nextElementSibling;
    
    if (detailsRow && detailsRow.classList.contains('billing-details-row')) {
        const isShowing = detailsRow.classList.contains('show');
        
        // Hide all other detail rows first
        document.querySelectorAll('.billing-details-row.show').forEach(dr => {
            if (dr !== detailsRow) {
                dr.classList.remove('show');
            }
        });
        
        // Reset all other chevron icons
        document.querySelectorAll('.btn-expand i').forEach(icon => {
            if (icon !== button.querySelector('i')) {
                icon.classList.remove('bi-chevron-up');
                icon.classList.add('bi-chevron-down');
            }
        });
        
        if (isShowing) {
            // Hide the details
            detailsRow.classList.remove('show');
            button.querySelector('i').classList.remove('bi-chevron-up');
            button.querySelector('i').classList.add('bi-chevron-down');
        } else {
            // Show the details
            detailsRow.classList.add('show');
            button.querySelector('i').classList.remove('bi-chevron-down');
            button.querySelector('i').classList.add('bi-chevron-up');
        }
    }
}

// Load patient details
function loadPatientDetails(patientId) {
    const patient = patientData[patientId];
    
    if (!patient) {
        console.log('Patient not found');
        return;
    }

    // Update status badge
    const statusBadge = document.querySelector('.status-badge-header');
    statusBadge.textContent = patient.status;
    
    // Update status badge color
    if (patient.status === 'IDLE') {
        statusBadge.style.backgroundColor = '#5bc0de';
    } else if (patient.status === 'ACTIVE') {
        statusBadge.style.backgroundColor = '#28a745';
    } else if (patient.status === 'STABLE') {
        statusBadge.style.backgroundColor = '#ffc107';
        statusBadge.style.color = '#000000';
    }

    // Update patient name
    document.querySelector('.patient-name-main').textContent = patient.name;
    
    // Update diagnosis
    document.querySelector('.patient-diagnosis-text').textContent = patient.diagnosis;
    
    // Update admission info
    const infoRows = document.querySelectorAll('.info-row');
    infoRows[0].querySelector('.info-value').textContent = patient.admissionDate;
    infoRows[1].querySelector('.info-value').textContent = patient.admissionTime;
    infoRows[2].querySelector('.info-value').textContent = patient.attendingPhysician;

    // Update balance
    document.querySelector('.balance-label').textContent = `Balance as of ${patient.balanceDate}:`;
    document.querySelector('.balance-amount').textContent = `Php ${patient.balance.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

    // Update payment table
    const paymentTableBody = document.getElementById('paymentTableBody');
    paymentTableBody.innerHTML = '';
    
    patient.payments.forEach((payment, index) => {
        const statusClass = payment.status === 'Paid' ? 'badge-paid' : 'badge-unpaid';
        const chevronClass = 'bi-chevron-down';
        
        const row = document.createElement('tr');
        row.className = 'payment-row';
        row.innerHTML = `
            <td>${payment.date}</td>
            <td>${payment.payer}</td>
            <td>${payment.method}</td>
            <td>${formatCurrency(payment.amount)}</td>
            <td><span class="badge ${statusClass}" data-payment-index="${index}">${payment.status}</span></td>
            <td><button class="btn-expand" onclick="toggleBillingDetails(this)"><i class="bi ${chevronClass}"></i></button></td>
        `;
        paymentTableBody.appendChild(row);
        
        // Add billing details row for payments with breakdown data (hidden by default)
        if (payment.status === 'Paid' && payment.breakdown) {
            const breakdown = payment.breakdown;
            const detailsRow = document.createElement('tr');
            detailsRow.className = 'billing-details-row';
            detailsRow.innerHTML = `
                <td colspan="6">
                    <div class="billing-breakdown-wrapper">
                        <table class="table billing-breakdown-table">
                            <thead>
                                <tr>
                                    <th>ROOM</th>
                                    <th>PRICE</th>
                                    <th>NO. OF DAYS</th>
                                    <th>DR. VISIT</th>
                                    <th>DR. VISIT CHARGE</th>
                                    <th>FACILITY CHARGE</th>
                                    <th>TOTAL</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${breakdown.room}</td>
                                    <td>${formatCurrency(breakdown.price)}</td>
                                    <td>${breakdown.days}</td>
                                    <td>${breakdown.drVisit}</td>
                                    <td>${formatCurrency(breakdown.drVisitCharge)}</td>
                                    <td>${formatCurrency(breakdown.facilityCharge)}</td>
                                    <td>${formatCurrency(payment.amount)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </td>
            `;
            paymentTableBody.appendChild(detailsRow);
        }
    });
    
    // Add click event listeners to paid status badges
    document.querySelectorAll('.badge-paid').forEach(badge => {
        badge.addEventListener('click', function(e) {
            e.stopPropagation();
            const paymentIndex = parseInt(this.getAttribute('data-payment-index'));
            const payment = patient.payments[paymentIndex];
            
            if (payment && payment.breakdown) {
                const row = this.closest('tr');
                const detailsRow = row.nextElementSibling;
                
                if (detailsRow && detailsRow.classList.contains('billing-details-row')) {
                    // Toggle the visibility
                    const isShowing = detailsRow.classList.contains('show');
                    
                    // Hide all other detail rows first
                    document.querySelectorAll('.billing-details-row.show').forEach(dr => {
                        dr.classList.remove('show');
                    });
                    
                    // Reset all chevron icons
                    document.querySelectorAll('.btn-expand i').forEach(icon => {
                        icon.classList.remove('bi-chevron-up');
                        icon.classList.add('bi-chevron-down');
                    });
                    
                    if (!isShowing) {
                        // Show this detail row
                        detailsRow.classList.add('show');
                        // Update the corresponding chevron
                        const expandBtn = row.querySelector('.btn-expand i');
                        if (expandBtn) {
                            expandBtn.classList.remove('bi-chevron-down');
                            expandBtn.classList.add('bi-chevron-up');
                        }
                    }
                }
            }
        });
    });
}

// Add payment
function addPayment() {
    const date = document.getElementById('paymentDate').value;
    const payerName = document.getElementById('payerName').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const checkNumber = document.getElementById('checkNumber').value;
    const amount = document.getElementById('paymentAmount').value;
    const status = document.getElementById('paymentStatus').value;

    if (!date || !payerName || !paymentMethod || !amount || !status) {
        alert('Please fill in all required fields');
        return;
    }

    // Format payment method
    let methodText = paymentMethod;
    if (paymentMethod === 'Check' && checkNumber) {
        methodText = `Check (${checkNumber})`;
    }

    // Format date
    const dateObj = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const formattedDate = `${months[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;

    const statusClass = status === 'Paid' ? 'badge-paid' : 'badge-unpaid';

    // Add row to table
    const tableBody = document.getElementById('paymentTableBody');
    const newRow = document.createElement('tr');
    newRow.className = 'payment-row';
    newRow.innerHTML = `
        <td>${formattedDate}</td>
        <td>${payerName}</td>
        <td>${methodText}</td>
        <td>${formatCurrency(amount)}</td>
        <td><span class="badge ${statusClass}" data-payment-index="new">${status}</span></td>
        <td><button class="btn-expand" onclick="toggleBillingDetails(this)"><i class="bi bi-chevron-down"></i></button></td>
    `;
    tableBody.insertBefore(newRow, tableBody.firstChild);
    
    // If paid, add a sample breakdown row
    if (status === 'Paid') {
        const detailsRow = document.createElement('tr');
        detailsRow.className = 'billing-details-row';
        detailsRow.innerHTML = `
            <td colspan="6">
                <div class="billing-breakdown-wrapper">
                    <table class="table billing-breakdown-table">
                        <thead>
                            <tr>
                                <th>ROOM</th>
                                <th>PRICE</th>
                                <th>NO. OF DAYS</th>
                                <th>DR. VISIT</th>
                                <th>DR. VISIT CHARGE</th>
                                <th>FACILITY CHARGE</th>
                                <th>TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Private</td>
                                <td>₱ 1,500</td>
                                <td>30</td>
                                <td>5</td>
                                <td>₱ 600</td>
                                <td>₱ 2,000</td>
                                <td>${formatCurrency(amount)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </td>
        `;
        tableBody.insertBefore(detailsRow, newRow.nextSibling);
        
        // Add click event to the new badge
        const badge = newRow.querySelector('.badge-paid');
        if (badge) {
            badge.addEventListener('click', function(e) {
                e.stopPropagation();
                const row = this.closest('tr');
                const detailsRow = row.nextElementSibling;
                
                if (detailsRow && detailsRow.classList.contains('billing-details-row')) {
                    const isShowing = detailsRow.classList.contains('show');
                    
                    // Hide all other detail rows first
                    document.querySelectorAll('.billing-details-row.show').forEach(dr => {
                        dr.classList.remove('show');
                    });
                    
                    // Reset all chevron icons
                    document.querySelectorAll('.btn-expand i').forEach(icon => {
                        icon.classList.remove('bi-chevron-up');
                        icon.classList.add('bi-chevron-down');
                    });
                    
                    if (!isShowing) {
                        detailsRow.classList.add('show');
                        const expandBtn = row.querySelector('.btn-expand i');
                        if (expandBtn) {
                            expandBtn.classList.remove('bi-chevron-down');
                            expandBtn.classList.add('bi-chevron-up');
                        }
                    }
                }
            });
        }
    }

    // Update balance
    const currentBalance = parseFloat(document.querySelector('.balance-amount').textContent.replace('Php ', '').replace(/,/g, ''));
    const newBalance = currentBalance + parseFloat(amount);
    document.querySelector('.balance-amount').textContent = `Php ${newBalance.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;

    // Reset form
    document.getElementById('paymentForm').reset();

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('addPaymentModal'));
    modal.hide();

    // Show success message
    alert('Payment added successfully!');
}

// Patient selection
document.querySelectorAll('.patient-item').forEach(item => {
    item.addEventListener('click', function() {
        // Remove active class from all items
        document.querySelectorAll('.patient-item').forEach(i => i.classList.remove('active'));
        
        // Add active class to clicked item
        this.classList.add('active');
        
        // Check the radio button
        this.querySelector('input[type="radio"]').checked = true;
        
        // Load patient details
        const patientId = this.getAttribute('data-patient-id');
        loadPatientDetails(patientId);
    });
});

// Search functionality
document.getElementById('searchPatient').addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    
    document.querySelectorAll('.patient-item').forEach(item => {
        const patientName = item.querySelector('label').textContent.toLowerCase();
        if (patientName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
});


// Sidebar navigation active state
document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        if (this.getAttribute('href') === '#') {
            e.preventDefault();
        }
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.classList.remove('active');
        });
        this.closest('.nav-item').classList.add('active');
    });
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Load default patient (Carlos Alberto - ID 2)
    loadPatientDetails(2);
});
