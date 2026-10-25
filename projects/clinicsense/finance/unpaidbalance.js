// Unpaid Balance Management System

// Sample balance data
let balanceData = [
    {
        id: 1,
        patientName: 'Carlos Estrada Alberto',
        admissionDate: '2025-01-10',
        serviceType: 'Treatment & Care',
        totalBill: 73500,
        paidAmount: 25000,
        status: 'Overdue'
    },
    {
        id: 2,
        patientName: 'Maria Santos Cruz',
        admissionDate: '2025-02-05',
        serviceType: 'Consultation',
        totalBill: 15000,
        paidAmount: 10000,
        status: 'Pending'
    },
    {
        id: 3,
        patientName: 'Juan Dela Cruz',
        admissionDate: '2025-03-12',
        serviceType: 'Emergency Care',
        totalBill: 30000,
        paidAmount: 15000,
        status: 'Pending'
    }
];

// Format currency
function formatCurrency(amount) {
    return '₱' + parseFloat(amount).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Get status badge class
function getStatusBadgeClass(status) {
    const statusMap = {
        'Pending': 'status-pending',
        'Overdue': 'status-overdue',
        'Paid': 'status-paid'
    };
    return statusMap[status] || 'status-pending';
}

// Calculate balance
function calculateBalance(totalBill, paidAmount) {
    return totalBill - paidAmount;
}

// Calculate total unpaid
function calculateTotal() {
    const total = balanceData.reduce((sum, item) => {
        return sum + calculateBalance(item.totalBill, item.paidAmount);
    }, 0);
    document.getElementById('totalUnpaid').textContent = formatCurrency(total);
}

// Render balance table
function renderBalanceTable() {
    const tbody = document.getElementById('balanceTableBody');
    
    if (balanceData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">No balance records found</td></tr>';
        return;
    }

    tbody.innerHTML = balanceData.map(balance => {
        const balanceAmount = calculateBalance(balance.totalBill, balance.paidAmount);
        return `
            <tr>
                <td class="patient-name-cell">${balance.patientName}</td>
                <td>${formatDate(balance.admissionDate)}</td>
                <td>${balance.serviceType}</td>
                <td>${formatCurrency(balance.totalBill)}</td>
                <td>${formatCurrency(balance.paidAmount)}</td>
                <td class="balance-cell">${formatCurrency(balanceAmount)}</td>
                <td><span class="badge ${getStatusBadgeClass(balance.status)}">${balance.status}</span></td>
                <td>
                    <button class="btn-icon edit-btn" onclick="editBalance(${balance.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-icon delete-btn" onclick="deleteBalance(${balance.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Add new balance
document.getElementById('saveBalanceBtn').addEventListener('click', function() {
    const patientName = document.getElementById('patientName').value;
    const admissionDate = document.getElementById('admissionDate').value;
    const serviceType = document.getElementById('serviceType').value;
    const totalBill = parseFloat(document.getElementById('totalBill').value);
    const paidAmount = parseFloat(document.getElementById('paidAmount').value);
    const status = document.getElementById('balanceStatus').value;

    if (!patientName || !admissionDate || !serviceType || !totalBill || !paidAmount || !status) {
        alert('Please fill in all fields');
        return;
    }

    if (paidAmount > totalBill) {
        alert('Paid amount cannot exceed total bill');
        return;
    }

    const newBalance = {
        id: balanceData.length > 0 ? Math.max(...balanceData.map(b => b.id)) + 1 : 1,
        patientName: patientName,
        admissionDate: admissionDate,
        serviceType: serviceType,
        totalBill: totalBill,
        paidAmount: paidAmount,
        status: status
    };

    balanceData.push(newBalance);
    renderBalanceTable();
    calculateTotal();

    // Close modal and reset form
    const modal = bootstrap.Modal.getInstance(document.getElementById('addBalanceModal'));
    modal.hide();
    document.getElementById('addBalanceForm').reset();

    alert('Balance record added successfully!');
});

// Edit balance
let currentEditId = null;

function editBalance(id) {
    currentEditId = id;
    const balance = balanceData.find(b => b.id === id);
    
    if (balance) {
        document.getElementById('editPatientName').value = balance.patientName;
        document.getElementById('editAdmissionDate').value = balance.admissionDate;
        document.getElementById('editServiceType').value = balance.serviceType;
        document.getElementById('editTotalBill').value = balance.totalBill;
        document.getElementById('editPaidAmount').value = balance.paidAmount;
        document.getElementById('editBalanceStatus').value = balance.status;

        const modal = new bootstrap.Modal(document.getElementById('editBalanceModal'));
        modal.show();
    }
}

// Update balance
document.getElementById('updateBalanceBtn').addEventListener('click', function() {
    const patientName = document.getElementById('editPatientName').value;
    const admissionDate = document.getElementById('editAdmissionDate').value;
    const serviceType = document.getElementById('editServiceType').value;
    const totalBill = parseFloat(document.getElementById('editTotalBill').value);
    const paidAmount = parseFloat(document.getElementById('editPaidAmount').value);
    const status = document.getElementById('editBalanceStatus').value;

    if (!patientName || !admissionDate || !serviceType || !totalBill || !paidAmount || !status) {
        alert('Please fill in all fields');
        return;
    }

    if (paidAmount > totalBill) {
        alert('Paid amount cannot exceed total bill');
        return;
    }

    const balanceIndex = balanceData.findIndex(b => b.id === currentEditId);
    if (balanceIndex !== -1) {
        balanceData[balanceIndex] = {
            id: currentEditId,
            patientName: patientName,
            admissionDate: admissionDate,
            serviceType: serviceType,
            totalBill: totalBill,
            paidAmount: paidAmount,
            status: status
        };

        renderBalanceTable();
        calculateTotal();

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editBalanceModal'));
        modal.hide();

        alert('Balance record updated successfully!');
    }
});

// Delete balance
function deleteBalance(id) {
    if (confirm('Are you sure you want to delete this balance record?')) {
        balanceData = balanceData.filter(b => b.id !== id);
        renderBalanceTable();
        calculateTotal();
        alert('Balance record deleted successfully!');
    }
}

// Set current date
function setCurrentDate() {
    const today = new Date();
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    const formattedDate = today.toLocaleDateString('en-US', options);
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        dateElement.textContent = formattedDate;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    setCurrentDate();
    renderBalanceTable();
    calculateTotal();
});
