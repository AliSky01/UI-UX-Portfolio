// Income Management System

// Sample income data
let incomeData = [
    {
        id: 1,
        date: '2025-05-15',
        description: 'Patient Payment - Carlos Estrada',
        category: 'Patient',
        amount: 25000
    },
    {
        id: 2,
        date: '2025-05-12',
        description: 'Insurance Reimbursement',
        category: 'Insurance',
        amount: 45000
    },
    {
        id: 3,
        date: '2025-05-10',
        description: 'Consultation Fee',
        category: 'Consultation',
        amount: 15000
    },
    {
        id: 4,
        date: '2025-05-08',
        description: 'Treatment Services',
        category: 'Service',
        amount: 30000
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

// Get category badge class
function getCategoryBadgeClass(category) {
    const categoryMap = {
        'Patient': 'category-patient',
        'Insurance': 'category-insurance',
        'Consultation': 'category-consultation',
        'Service': 'category-service',
        'Other': 'category-other'
    };
    return categoryMap[category] || 'category-other';
}

// Calculate total income
function calculateTotal() {
    const total = incomeData.reduce((sum, item) => sum + item.amount, 0);
    document.getElementById('totalIncome').textContent = formatCurrency(total);
}

// Render income table
function renderIncomeTable() {
    const tbody = document.getElementById('incomeTableBody');
    
    if (incomeData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No income records found</td></tr>';
        return;
    }

    tbody.innerHTML = incomeData.map(income => `
        <tr>
            <td>${formatDate(income.date)}</td>
            <td>${income.description}</td>
            <td><span class="badge ${getCategoryBadgeClass(income.category)}">${income.category}</span></td>
            <td class="amount-cell">${formatCurrency(income.amount)}</td>
            <td>
                <button class="btn-icon edit-btn" onclick="editIncome(${income.id})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn-icon delete-btn" onclick="deleteIncome(${income.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Add new income
document.getElementById('saveIncomeBtn').addEventListener('click', function() {
    const date = document.getElementById('incomeDate').value;
    const description = document.getElementById('incomeDescription').value;
    const category = document.getElementById('incomeCategory').value;
    const amount = parseFloat(document.getElementById('incomeAmount').value);

    if (!date || !description || !category || !amount) {
        alert('Please fill in all fields');
        return;
    }

    const newIncome = {
        id: incomeData.length > 0 ? Math.max(...incomeData.map(i => i.id)) + 1 : 1,
        date: date,
        description: description,
        category: category,
        amount: amount
    };

    incomeData.unshift(newIncome);
    renderIncomeTable();
    calculateTotal();

    // Close modal and reset form
    const modal = bootstrap.Modal.getInstance(document.getElementById('addIncomeModal'));
    modal.hide();
    document.getElementById('addIncomeForm').reset();

    alert('Income added successfully!');
});

// Edit income
let currentEditId = null;

function editIncome(id) {
    currentEditId = id;
    const income = incomeData.find(i => i.id === id);
    
    if (income) {
        document.getElementById('editIncomeDate').value = income.date;
        document.getElementById('editIncomeDescription').value = income.description;
        document.getElementById('editIncomeCategory').value = income.category;
        document.getElementById('editIncomeAmount').value = income.amount;

        const modal = new bootstrap.Modal(document.getElementById('editIncomeModal'));
        modal.show();
    }
}

// Update income
document.getElementById('updateIncomeBtn').addEventListener('click', function() {
    const date = document.getElementById('editIncomeDate').value;
    const description = document.getElementById('editIncomeDescription').value;
    const category = document.getElementById('editIncomeCategory').value;
    const amount = parseFloat(document.getElementById('editIncomeAmount').value);

    if (!date || !description || !category || !amount) {
        alert('Please fill in all fields');
        return;
    }

    const incomeIndex = incomeData.findIndex(i => i.id === currentEditId);
    if (incomeIndex !== -1) {
        incomeData[incomeIndex] = {
            id: currentEditId,
            date: date,
            description: description,
            category: category,
            amount: amount
        };

        renderIncomeTable();
        calculateTotal();

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editIncomeModal'));
        modal.hide();

        alert('Income updated successfully!');
    }
});

// Delete income
function deleteIncome(id) {
    if (confirm('Are you sure you want to delete this income record?')) {
        incomeData = incomeData.filter(i => i.id !== id);
        renderIncomeTable();
        calculateTotal();
        alert('Income deleted successfully!');
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
    renderIncomeTable();
    calculateTotal();
});
