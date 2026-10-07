// Bodim Split - Main Logic, Analytics & State Management

// Default State
let state = {
  currentUser: "You",
  members: ["You", "Kasun", "Nuwan"],
  activeCategory: "All",
  expenses: [
    {
      id: "demo-1",
      title: "Lunch Rice & Curry",
      amount: 1500,
      paidBy: "You",
      splitBetween: ["You", "Kasun", "Nuwan"],
      category: "Food",
      date: new Date().toISOString()
    },
    {
      id: "demo-2",
      title: "Electricity Bill",
      amount: 4500,
      paidBy: "Kasun",
      splitBetween: ["You", "Kasun", "Nuwan"],
      category: "Utilities",
      date: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: "demo-3",
      title: "Drinking Water Cans",
      amount: 900,
      paidBy: "Nuwan",
      splitBetween: ["You", "Kasun", "Nuwan"],
      category: "Utilities",
      date: new Date(Date.now() - 172800000).toISOString()
    }
  ]
};

// Category Metadata
const categoryColors = {
  Food: "#f59e0b",
  Utilities: "#06b6d4",
  Rent: "#8b5cf6",
  Groceries: "#10b981",
  Transport: "#3b82f6",
  Other: "#64748b"
};

const categoryIcons = {
  Food: "🍛",
  Utilities: "💡",
  Rent: "🏠",
  Groceries: "🛒",
  Transport: "🚌",
  Other: "📦"
};

// Chart Instances
let quickChartInstance = null;
let categoryChartInstance = null;
let payersChartInstance = null;

// Load & Save State
function loadState() {
  const saved = localStorage.getItem("bodim_split_data");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state.members = parsed.members || state.members;
      state.expenses = parsed.expenses || state.expenses;
      state.currentUser = parsed.currentUser || state.currentUser;
    } catch (e) {
      console.error("Error loading local storage data", e);
    }
  }
}

function saveState() {
  localStorage.setItem("bodim_split_data", JSON.stringify(state));
  renderAll();
}

function formatRs(amount) {
  return "Rs. " + Number(amount).toLocaleString("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

// Tab Switching
function switchTab(tabName) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  if (tabName === "dashboard") {
    document.getElementById("viewDashboard").classList.add("active");
    document.querySelectorAll(".nav-item")[0].classList.add("active");
    renderCharts();
  } else if (tabName === "expenses") {
    document.getElementById("viewExpenses").classList.add("active");
    document.querySelectorAll(".nav-item")[1].classList.add("active");
  } else if (tabName === "analytics") {
    document.getElementById("viewAnalytics").classList.add("active");
    document.querySelectorAll(".nav-item")[2].classList.add("active");
    renderCharts();
  } else if (tabName === "settlement") {
    document.getElementById("viewSettlement").classList.add("active");
    document.querySelectorAll(".nav-item")[3].classList.add("active");
  } else if (tabName === "members") {
    document.getElementById("viewMembers").classList.add("active");
    document.querySelectorAll(".nav-item")[4].classList.add("active");
  }
}

// Category Filter
function filterExpensesByCategory(cat) {
  state.activeCategory = cat;
  document.querySelectorAll(".pill").forEach(p => {
    if (p.innerText.includes(cat) || (cat === "All" && p.innerText === "All")) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });
  renderExpenses();
}

// Calculate Debt Settlements (Who owes whom)
function calculateSettlements() {
  const balances = {};
  state.members.forEach(m => (balances[m] = 0));

  state.expenses.forEach(exp => {
    const paidBy = exp.paidBy;
    const splitCount = exp.splitBetween.length;
    if (splitCount === 0) return;

    const perPerson = exp.amount / splitCount;

    balances[paidBy] = (balances[paidBy] || 0) + exp.amount;

    exp.splitBetween.forEach(person => {
      balances[person] = (balances[person] || 0) - perPerson;
    });
  });

  const debtors = [];
  const creditors = [];

  for (const person in balances) {
    const net = Math.round(balances[person] * 100) / 100;
    if (net < -0.01) {
      debtors.push({ name: person, amount: -net });
    } else if (net > 0.01) {
      creditors.push({ name: person, amount: net });
    }
  }

  const settlements = [];
  let d = 0, c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];

    const settledAmount = Math.min(debtor.amount, creditor.amount);

    settlements.push({
      from: debtor.name,
      to: creditor.name,
      amount: settledAmount
    });

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    if (debtor.amount < 0.01) d++;
    if (creditor.amount < 0.01) c++;
  }

  return { balances, settlements };
}

// Render All
function renderAll() {
  renderSummary();
  renderExpenses();
  renderSettlements();
  renderMembers();
  populateExpenseForm();
  renderCharts();
}

// 1. Summary
function renderSummary() {
  const total = state.expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  document.getElementById("totalSpendText").innerText = formatRs(total);

  const { balances } = calculateSettlements();
  const myBalance = balances[state.currentUser] || 0;

  const youOwedEl = document.getElementById("youOwedText");
  const youOweEl = document.getElementById("youOweText");

  if (myBalance > 0) {
    youOwedEl.innerText = formatRs(myBalance);
    youOweEl.innerText = "Rs. 0";
  } else if (myBalance < 0) {
    youOwedEl.innerText = "Rs. 0";
    youOweEl.innerText = formatRs(Math.abs(myBalance));
  } else {
    youOwedEl.innerText = "Rs. 0";
    youOweEl.innerText = "Rs. 0";
  }
}

// 2. Expenses
function renderExpenses() {
  const recentContainer = document.getElementById("recentExpensesList");
  const allContainer = document.getElementById("allExpensesList");

  const filtered = state.activeCategory === "All"
    ? state.expenses
    : state.expenses.filter(e => e.category === state.activeCategory);

  const makeCard = (exp) => {
    const dateFormatted = new Date(exp.date).toLocaleDateString("en-GB", {
      month: "short",
      day: "numeric"
    });
    const icon = categoryIcons[exp.category] || "📦";

    return `
      <div class="expense-card">
        <div class="expense-left">
          <div class="category-icon">${icon}</div>
          <div class="expense-details">
            <h4>${escapeHtml(exp.title)}</h4>
            <div class="expense-meta">Paid by <strong>${escapeHtml(exp.paidBy)}</strong> • ${dateFormatted}</div>
          </div>
        </div>
        <div class="expense-right">
          <div class="expense-amount">${formatRs(exp.amount)}</div>
          <button class="delete-btn" onclick="deleteExpense('${exp.id}')" title="Delete">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  };

  const sortedAll = [...state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  recentContainer.innerHTML = sortedAll.length === 0
    ? `<div class="empty-state">වියදම් කිසිවක් නැත. "+" ඔබන්න!</div>`
    : sortedAll.slice(0, 3).map(makeCard).join("");

  const sortedFiltered = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
  allContainer.innerHTML = sortedFiltered.length === 0
    ? `<div class="empty-state">මෙම category එකට අදාළ වියදම් නැත.</div>`
    : sortedFiltered.map(makeCard).join("");
}

// 3. Settlements
function renderSettlements() {
  const { settlements } = calculateSettlements();
  const quickList = document.getElementById("quickSettlementList");
  const fullList = document.getElementById("fullSettlementList");

  if (settlements.length === 0) {
    const allSettledHtml = `<div class="empty-state">සියලුම බිල් බෙදී අවසන්! කිසිවෙක් කිසිවෙකුට ණය නැත. ✨</div>`;
    quickList.innerHTML = allSettledHtml;
    fullList.innerHTML = allSettledHtml;
    return;
  }

  const makeItem = (s) => `
    <div class="settlement-card">
      <div class="settlement-text">
        <strong>${escapeHtml(s.from)}</strong> owes <strong>${escapeHtml(s.to)}</strong>
      </div>
      <div class="settlement-right">
        <div class="settlement-amount">${formatRs(s.amount)}</div>
        <button class="btn-settle-mini" onclick="settleDebt('${escapeHtml(s.from)}', '${escapeHtml(s.to)}', ${s.amount})">
          <i class="fa-solid fa-check"></i> Settle
        </button>
      </div>
    </div>
  `;

  quickList.innerHTML = settlements.slice(0, 3).map(makeItem).join("");
  fullList.innerHTML = settlements.map(makeItem).join("");
}

// Settle Debt Action
function settleDebt(from, to, amount) {
  if (confirm(`Confirm settlement: ${from} paid ${formatRs(amount)} to ${to}?`)) {
    const settlementExpense = {
      id: "settle-" + Date.now(),
      title: `Settlement: ${from} ➔ ${to}`,
      amount: amount,
      category: "Other",
      paidBy: from,
      splitBetween: [to],
      date: new Date().toISOString()
    };
    state.expenses.unshift(settlementExpense);
    saveState();
  }
}

// 4. WhatsApp Share
function shareToWhatsApp() {
  const { settlements } = calculateSettlements();
  const total = state.expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

  let message = `🏠 *Bodim Split - Monthly Expenses Summary*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💰 *Total Expenses:* ${formatRs(total)}\n\n`;

  if (settlements.length === 0) {
    message += `✨ All bills are completely settled! No debts.\n`;
  } else {
    message += `🤝 *Settlement Details (කවුද කාටද දෙන්න ඕනේ):*\n`;
    settlements.forEach(s => {
      message += `• *${s.from}* owes *${s.to}*: ${formatRs(s.amount)}\n`;
    });
  }

  message += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `_Generated via Bodim Split App_ 📱`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

// 5. Members
function renderMembers() {
  const container = document.getElementById("membersList");
  container.innerHTML = state.members
    .map(m => `
      <div class="member-chip">
        <i class="fa-solid fa-user"></i>
        <span>${escapeHtml(m)}</span>
        ${m !== "You" ? `<button onclick="deleteMember('${escapeHtml(m)}')" style="background:none; border:none; color:#ef4444; cursor:pointer; margin-left:4px;">&times;</button>` : ""}
      </div>
    `)
    .join("");
}

// 6. Charts with Chart.js
function renderCharts() {
  if (typeof Chart === "undefined") return;

  // Category Spend Totals
  const catTotals = {};
  state.expenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount);
  });

  const catLabels = Object.keys(catTotals);
  const catData = Object.values(catTotals);
  const catBackgrounds = catLabels.map(l => categoryColors[l] || "#64748b");

  // A. Quick Chart (Home View)
  const quickCanvas = document.getElementById("quickChart");
  if (quickCanvas) {
    if (quickChartInstance) quickChartInstance.destroy();
    quickChartInstance = new Chart(quickCanvas, {
      type: "doughnut",
      data: {
        labels: catLabels,
        datasets: [{
          data: catData,
          backgroundColor: catBackgrounds,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }

  // B. Full Category Chart (Analytics View)
  const catCanvas = document.getElementById("categoryChart");
  if (catCanvas) {
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(catCanvas, {
      type: "doughnut",
      data: {
        labels: catLabels,
        datasets: [{
          data: catData,
          backgroundColor: catBackgrounds,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { boxWidth: 12, font: { size: 12 } } }
        }
      }
    });
  }

  // C. Who Paid the Most? (Bar Chart)
  const payerTotals = {};
  state.members.forEach(m => (payerTotals[m] = 0));
  state.expenses.forEach(e => {
    payerTotals[e.paidBy] = (payerTotals[e.paidBy] || 0) + Number(e.amount);
  });

  const payersCanvas = document.getElementById("payersChart");
  if (payersCanvas) {
    if (payersChartInstance) payersChartInstance.destroy();
    payersChartInstance = new Chart(payersCanvas, {
      type: "bar",
      data: {
        labels: Object.keys(payerTotals),
        datasets: [{
          label: "Total Paid (Rs.)",
          data: Object.values(payerTotals),
          backgroundColor: "#10b981",
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: "#e2e8f0" } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}

// Helpers
function escapeHtml(text) {
  const div = document.createElement("div");
  div.innerText = text;
  return div.innerHTML;
}

function deleteExpense(id) {
  if (confirm("Are you sure you want to delete this expense?")) {
    state.expenses = state.expenses.filter(e => e.id !== id);
    saveState();
  }
}

function deleteMember(name) {
  if (confirm(`Remove "${name}" from roommates?`)) {
    state.members = state.members.filter(m => m !== name);
    saveState();
  }
}

// Modal Listeners
const modal = document.getElementById("expenseModal");
document.getElementById("openAddModalBtn").addEventListener("click", () => {
  modal.classList.add("active");
});
document.getElementById("closeModalBtn").addEventListener("click", () => {
  modal.classList.remove("active");
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.remove("active");
});

// Add Member Form
document.getElementById("addMemberForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("newMemberName");
  const name = input.value.trim();

  if (name && !state.members.includes(name)) {
    state.members.push(name);
    input.value = "";
    saveState();
  }
});

// Add Expense Form
document.getElementById("expenseForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("expenseTitle").value.trim();
  const amount = parseFloat(document.getElementById("expenseAmount").value);
  const category = document.getElementById("expenseCategory").value;
  const paidBy = document.getElementById("expensePaidBy").value;

  const checkedBoxes = Array.from(document.querySelectorAll("input[name='splitMember']:checked"));
  const splitBetween = checkedBoxes.map(cb => cb.value);

  if (splitBetween.length === 0) {
    alert("Please select at least one person to split with!");
    return;
  }

  const newExpense = {
    id: "exp-" + Date.now(),
    title,
    amount,
    category,
    paidBy,
    splitBetween,
    date: new Date().toISOString()
  };

  state.expenses.unshift(newExpense);
  saveState();

  document.getElementById("expenseForm").reset();
  modal.classList.remove("active");
});

function populateExpenseForm() {
  const paidBySelect = document.getElementById("expensePaidBy");
  paidBySelect.innerHTML = state.members
    .map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`)
    .join("");

  const checkboxes = document.getElementById("splitCheckboxes");
  checkboxes.innerHTML = state.members
    .map(m => `
      <label class="checkbox-label">
        <input type="checkbox" name="splitMember" value="${escapeHtml(m)}" checked>
        <span>${escapeHtml(m)}</span>
      </label>
    `)
    .join("");
}

// PWA Install Prompt Listener
let deferredPrompt;
const installBtn = document.getElementById("installBtn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = "block";
});

installBtn.addEventListener("click", async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install: ${outcome}`);
    deferredPrompt = null;
    installBtn.style.display = "none";
  }
});

// Service Worker Registration for PWA Offline Support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(err => {
      console.log("Service Worker registration failed: ", err);
    });
  });
}

// Initialize on Load
loadState();
renderAll();
