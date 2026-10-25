(function () {
    function badge(label, kind) {
        return '<span class="badge badge-' + kind + '">' + label + "</span>";
    }

    function fill(id, html) {
        const node = document.getElementById(id);
        if (node && !node.children.length) node.innerHTML = html;
    }

    function setText(id, value) {
        const node = document.getElementById(id);
        if (node && (node.textContent === "—" || node.textContent === "0" || node.textContent === "Loading…" || node.textContent === "0 results" || node.textContent === "0 rows" || node.textContent === "0 sessions")) {
            node.textContent = value;
        }
    }

    function lineChart(canvasId, labels, values, label) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === "undefined" || canvas.dataset.ready) return;
        canvas.dataset.ready = "1";
        new Chart(canvas, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    borderColor: "#167f77",
                    backgroundColor: "rgba(22, 127, 119, 0.15)",
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        setText("statItems", "1,284");
        setText("statRedemptions", "326");
        setText("statInventory", "86");
        setText("inventoryTrend", "4 items low");
        setText("statParticipants", "214");
        setText("statPoints", "18,450");
        setText("lastUpdated", "Updated today");
        setText("rangeTotal", "186");
        setText("rangeSessions", "42 sessions");
        setText("rangePoints", "1,860");
        setText("rangeAvg", "4.4");
        setText("historyCount", "6 rows");
        setText("resultCount", "4 results");
        setText("pageInfo", "Showing 1–4 of 4");
        setText("statSkus", "6");
        setText("statUnits", "86");
        setText("statLow", "2");
        setText("statOut", "0");
        setText("statActive", "214");
        setText("statNew", "18");
        setText("statRedeems", "326");

        const threshold = document.getElementById("redemptionThreshold");
        if (threshold && !threshold.value) threshold.value = "50";
        const kioskOpen = document.getElementById("kioskOpen");
        if (kioskOpen) kioskOpen.checked = true;
        const autoPrint = document.getElementById("autoPrint");
        if (autoPrint) autoPrint.checked = true;
        const timeout = document.getElementById("sessionTimeout");
        if (timeout && !timeout.value) timeout.value = "90";
        const lowStock = document.getElementById("lowStockAlert");
        if (lowStock && !lowStock.value) lowStock.value = "5";

        fill("activityBody", [
            ["Oct 25, 2026", "Collection", "3 plastic bottles", "+30", "RC-1042", badge("Completed", "success")],
            ["Oct 25, 2026", "Redemption", "Chicken rice", "-50", "RC-1038", badge("Dispensed", "success")],
            ["Oct 24, 2026", "Collection", "2 aluminum cans", "+20", "RC-1031", badge("Completed", "success")],
            ["Oct 24, 2026", "Redemption", "Vegetable meal", "-50", "RC-1026", badge("Dispensed", "info")]
        ].map((row) => "<tr>" + row.map((cell) => "<td>" + cell + "</td>").join("") + "</tr>").join(""));

        fill("historyBody", [
            ["C-204", "Oct 25, 2026, 9:12 AM", "Plastic bottle", "3", "30", "RC-1042"],
            ["C-203", "Oct 25, 2026, 8:40 AM", "Aluminum can", "2", "20", "RC-1040"],
            ["C-198", "Oct 24, 2026, 4:18 PM", "Plastic bottle", "1", "10", "RC-1031"],
            ["C-191", "Oct 24, 2026, 11:05 AM", "Glass bottle", "2", "20", "RC-1022"]
        ].map((row) => "<tr>" + row.map((cell) => "<td>" + cell + "</td>").join("") + "</tr>").join(""));

        fill("tableBody", [
            ["RC-1038", "Chicken rice", "50", "Oct 25, 2026, 10:02 AM", badge("Dispensed", "success")],
            ["RC-1026", "Vegetable meal", "50", "Oct 24, 2026, 3:44 PM", badge("Dispensed", "success")],
            ["RC-1014", "Chicken rice", "50", "Oct 23, 2026, 1:16 PM", badge("Ready", "info")],
            ["RC-1002", "Fruit cup", "40", "Oct 22, 2026, 9:28 AM", badge("Dispensed", "success")]
        ].map((row) => "<tr>" + row.map((cell) => "<td>" + cell + "</td>").join("") + "</tr>").join(""));

        fill("inventoryBody", [
            ["Chicken rice", "MEAL-01", "A1", "₱45", badge("In stock", "success"), "Oct 25, 2026", ""],
            ["Vegetable meal", "MEAL-02", "A2", "₱40", badge("Low", "warning"), "Oct 25, 2026", ""],
            ["Fruit cup", "MEAL-03", "B1", "₱30", badge("In stock", "success"), "Oct 24, 2026", ""],
            ["Bottled water", "DRINK-01", "B2", "₱15", badge("Low", "warning"), "Oct 24, 2026", ""]
        ].map((row) => "<tr>" + row.map((cell) => "<td>" + cell + "</td>").join("") + "</tr>").join(""));

        fill("logBody", [
            ["Oct 25, 2026", "Chicken rice", "-1", "Redeemed"],
            ["Oct 25, 2026", "Vegetable meal", "+12", "Restocked"],
            ["Oct 24, 2026", "Fruit cup", "-1", "Redeemed"]
        ].map((row) => "<tr>" + row.map((cell) => "<td>" + cell + "</td>").join("") + "</tr>").join(""));

        fill("summaryBody", [
            ["Oct 19–25", "214", "18", "186", "42"],
            ["Oct 12–18", "196", "15", "164", "38"],
            ["Oct 5–11", "181", "12", "151", "33"]
        ].map((row) => "<tr>" + row.map((cell) => "<td>" + cell + "</td>").join("") + "</tr>").join(""));

        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        lineChart("itemsChart", days, [22, 28, 19, 31, 26, 18, 24], "Items");
        lineChart("collectionChart", days, [22, 28, 19, 31, 26, 18, 24], "Items");
        lineChart("participantsChart", days, [18, 21, 16, 24, 22, 14, 19], "Participants");
        lineChart("activityChart", days, [22, 18, 25, 20, 28, 16, 21], "Activity");

        const typeCanvas = document.getElementById("typeChart");
        if (typeCanvas && typeof Chart !== "undefined" && !typeCanvas.dataset.ready) {
            typeCanvas.dataset.ready = "1";
            new Chart(typeCanvas, {
                type: "doughnut",
                data: {
                    labels: ["Plastic", "Aluminum", "Glass"],
                    datasets: [{ data: [92, 58, 36], backgroundColor: ["#167f77", "#2fa04e", "#d97706"] }]
                },
                options: { plugins: { legend: { position: "bottom" } } }
            });
        }
    });
})();
