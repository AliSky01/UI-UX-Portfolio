// Format currency
function formatCurrency(amount) {
    return '₱' + parseFloat(amount).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Add Income
function addIncome() {
    const patientName = document.getElementById('incomePatientName').value;
    const payerName = document.getElementById('incomePayerName').value;
    const wardCard = document.getElementById('incomeWardCard').value;
    const amount = document.getElementById('incomeAmount').value;
    const paidDate = document.getElementById('incomePaidDate').value;

    if (!patientName || !payerName || !wardCard || !amount || !paidDate) {
        alert('Please fill in all fields');
        return;
    }

    const tableBody = document.getElementById('incomeTableBody');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>${patientName}</td>
        <td>${payerName}</td>
        <td>${wardCard}</td>
        <td>${formatCurrency(amount)}</td>
        <td>${formatDate(paidDate)}</td>
        <td><button class="btn btn-status btn-paid">PAID</button></td>
    `;
    tableBody.appendChild(newRow);

    // Update total income
    updateTotals();

    // Reset form
    document.getElementById('incomeForm').reset();

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('addIncomeModal'));
    modal.hide();
}

// Add Unpaid Balance
function addUnpaid() {
    const name = document.getElementById('unpaidName').value;
    const amount = document.getElementById('unpaidAmount').value;
    const dueDate = document.getElementById('unpaidDueDate').value;

    if (!name || !amount || !dueDate) {
        alert('Please fill in all fields');
        return;
    }

    const tableBody = document.getElementById('unpaidTableBody');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>${name}</td>
        <td>${formatCurrency(amount)}</td>
        <td>${formatDate(dueDate)}</td>
        <td><button class="btn btn-delete" onclick="deleteRow(this)"><i class="bi bi-trash"></i></button></td>
    `;
    tableBody.appendChild(newRow);

    // Update totals
    updateTotals();

    // Reset form
    document.getElementById('unpaidForm').reset();

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('addUnpaidModal'));
    modal.hide();
}

// Add Expense
function addExpense() {
    const category = document.getElementById('expenseCategory').value;
    const amount = document.getElementById('expenseAmount').value;
    const date = document.getElementById('expenseDate').value;

    if (!category || !amount || !date) {
        alert('Please fill in all fields');
        return;
    }

    const tableBody = document.getElementById('expensesTableBody');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>${category}</td>
        <td>${formatCurrency(amount)}</td>
        <td>${formatDate(date)}</td>
        <td><button class="btn btn-delete" onclick="deleteRow(this)"><i class="bi bi-trash"></i></button></td>
    `;
    tableBody.appendChild(newRow);

    // Update totals
    updateTotals();

    // Reset form
    document.getElementById('expenseForm').reset();

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('addExpenseModal'));
    modal.hide();
}

// Delete Row
function deleteRow(button) {
    if (confirm('Are you sure you want to delete this entry?')) {
        const row = button.closest('tr');
        row.remove();
        updateTotals();
    }
}

// Update Totals
function updateTotals() {
    // Calculate total income
    let totalIncome = 0;
    const incomeRows = document.querySelectorAll('#incomeTableBody tr');
    incomeRows.forEach(row => {
        const amountText = row.cells[3].textContent.replace('₱', '').replace(',', '');
        totalIncome += parseFloat(amountText);
    });

    // Calculate total expenses
    let totalExpenses = 0;
    const expenseRows = document.querySelectorAll('#expensesTableBody tr');
    expenseRows.forEach(row => {
        const amountText = row.cells[1].textContent.replace('₱', '').replace(',', '');
        totalExpenses += parseFloat(amountText);
    });

    // Calculate total unpaid
    let totalUnpaid = 0;
    const unpaidRows = document.querySelectorAll('#unpaidTableBody tr');
    unpaidRows.forEach(row => {
        const amountText = row.cells[1].textContent.replace('₱', '').replace(',', '');
        totalUnpaid += parseFloat(amountText);
    });

    // Calculate remaining/loss
    const remaining = totalIncome - totalExpenses - totalUnpaid;

    // Update the summary cards
    document.querySelector('.income-card .card-amount').textContent = formatCurrency(totalIncome);
    document.querySelector('.expenses-card .card-amount').textContent = formatCurrency(totalExpenses);
    document.querySelector('.loss-card .card-amount').textContent = formatCurrency(remaining);
}

// Search functionality
const searchInput = document.querySelector('.search-input');
if (searchInput) {
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        // Search in all tables
        document.querySelectorAll('.finance-table tbody tr').forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

// Sidebar navigation active state
document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        // Only prevent default for links with href="#"
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
    updateTotals();
});
