// Expense Management System

// Sample expense data
let expenseData = [
    {
        id: 1,
        date: '2025-05-14',
        description: 'Medical Supplies Purchase',
        category: 'Supplies',
        amount: 25000
    },
    {
        id: 2,
        date: '2025-05-11',
        description: 'Staff Salaries',
        category: 'Salary',
        amount: 30000
    },
    {
        id: 3,
        date: '2025-05-09',
        description: 'Utilities Payment',
        category: 'Utilities',
        amount: 7000
    },
    {
        id: 4,
        date: '2025-05-07',
        description: 'Equipment Maintenance',
        category: 'Maintenance',
        amount: 10000
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
        'Supplies': 'category-supplies',
        'Salary': 'category-salary',
        'Utilities': 'category-utilities',
        'Maintenance': 'category-maintenance',
        'Rent': 'category-rent',
        'Other': 'category-other'
    };
    return categoryMap[category] || 'category-other';
}

// Calculate total expenses
function calculateTotal() {
    const total = expenseData.reduce((sum, item) => sum + item.amount, 0);
    document.getElementById('totalExpenses').textContent = formatCurrency(total);
}

// Render expenses table
function renderExpensesTable() {
    const tbody = document.getElementById('expensesTableBody');
    
    if (expenseData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No expense records found</td></tr>';
        return;
    }

    tbody.innerHTML = expenseData.map(expense => `
        <tr>
            <td>${formatDate(expense.date)}</td>
            <td>${expense.description}</td>
            <td><span class="badge ${getCategoryBadgeClass(expense.category)}">${expense.category}</span></td>
            <td class="amount-cell">${formatCurrency(expense.amount)}</td>
            <td>
                <button class="btn-icon edit-btn" onclick="editExpense(${expense.id})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn-icon delete-btn" onclick="deleteExpense(${expense.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Add new expense
document.getElementById('saveExpenseBtn').addEventListener('click', function() {
    const date = document.getElementById('expenseDate').value;
    const description = document.getElementById('expenseDescription').value;
    const category = document.getElementById('expenseCategory').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);

    if (!date || !description || !category || !amount) {
        alert('Please fill in all fields');
        return;
    }

    const newExpense = {
        id: expenseData.length > 0 ? Math.max(...expenseData.map(e => e.id)) + 1 : 1,
        date: date,
        description: description,
        category: category,
        amount: amount
    };

    expenseData.unshift(newExpense);
    renderExpensesTable();
    calculateTotal();

    // Close modal and reset form
    const modal = bootstrap.Modal.getInstance(document.getElementById('addExpenseModal'));
    modal.hide();
    document.getElementById('addExpenseForm').reset();

    alert('Expense added successfully!');
});

// Edit expense
let currentEditId = null;

function editExpense(id) {
    currentEditId = id;
    const expense = expenseData.find(e => e.id === id);
    
    if (expense) {
        document.getElementById('editExpenseDate').value = expense.date;
        document.getElementById('editExpenseDescription').value = expense.description;
        document.getElementById('editExpenseCategory').value = expense.category;
        document.getElementById('editExpenseAmount').value = expense.amount;

        const modal = new bootstrap.Modal(document.getElementById('editExpenseModal'));
        modal.show();
    }
}

// Update expense
document.getElementById('updateExpenseBtn').addEventListener('click', function() {
    const date = document.getElementById('editExpenseDate').value;
    const description = document.getElementById('editExpenseDescription').value;
    const category = document.getElementById('editExpenseCategory').value;
    const amount = parseFloat(document.getElementById('editExpenseAmount').value);

    if (!date || !description || !category || !amount) {
        alert('Please fill in all fields');
        return;
    }

    const expenseIndex = expenseData.findIndex(e => e.id === currentEditId);
    if (expenseIndex !== -1) {
        expenseData[expenseIndex] = {
            id: currentEditId,
            date: date,
            description: description,
            category: category,
            amount: amount
        };

        renderExpensesTable();
        calculateTotal();

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('editExpenseModal'));
        modal.hide();

        alert('Expense updated successfully!');
    }
});

// Delete expense
function deleteExpense(id) {
    if (confirm('Are you sure you want to delete this expense record?')) {
        expenseData = expenseData.filter(e => e.id !== id);
        renderExpensesTable();
        calculateTotal();
        alert('Expense deleted successfully!');
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
    renderExpensesTable();
    calculateTotal();
});
