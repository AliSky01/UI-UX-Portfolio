(function () {
    const incomes = [];

    const expenses = [];

    const balances = [
        {
            id: 1,
            patientId: '1',
            patientName: 'Carlos Estrada Alberto',
            admissionDate: '2025-01-10',
            serviceType: 'Treatment & Care',
            totalBill: 73500,
            paidAmount: 25000,
            status: 'Overdue'
        },
        {
            id: 2,
            patientId: '2',
            patientName: 'Maria Santos Cruz',
            admissionDate: '2025-02-05',
            serviceType: 'Consultation',
            totalBill: 15000,
            paidAmount: 10000,
            status: 'Pending'
        },
        {
            id: 3,
            patientId: '3',
            patientName: 'Jose Reyes Manalo',
            admissionDate: '2026-03-01',
            serviceType: 'Psychiatric Care',
            totalBill: 20000,
            paidAmount: 5000,
            status: 'Partial'
        }
    ];

    function sumAmounts(records, field = 'amount') {
        return records.reduce((sum, entry) => sum + (entry[field] ?? 0), 0);
    }

    function sumBalances(list) {
        return list.reduce((sum, entry) => {
            const balance = Math.max((entry.totalBill || 0) - (entry.paidAmount || 0), 0);
            return sum + balance;
        }, 0);
    }

    window.financeData = window.financeData || {};
    const existing = window.financeData;
    window.financeData = {
        incomes: existing.incomes || incomes,
        expenses: existing.expenses || expenses,
        balances: existing.balances || balances,
        getIncomeTotal: () => sumAmounts(window.financeData.incomes),
        getExpenseTotal: () => sumAmounts(window.financeData.expenses),
        getBalanceTotal: () => sumBalances(window.financeData.balances)
    };
})();
