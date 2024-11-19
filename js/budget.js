import { auth, db } from "./firebase-config.js";
import { getUserProfile } from "./auth.js";

// Categories configuration
const CATEGORIES = {
  food: { name: "Food", icon: "fas fa-utensils" },
  transport: { name: "Transport", icon: "fas fa-car" },
  utilities: { name: "Utilities", icon: "fas fa-bolt" },
  entertainment: { name: "Entertainment", icon: "fas fa-film" },
  salary: { name: "Salary", icon: "fas fa-money-bill-wave" },
  investment: { name: "Investment", icon: "fas fa-chart-line" },
  savings: { name: "Savings", icon: "fas fa-piggy-bank" },
  rent: { name: "Rent", icon: "fas fa-home" },
  gifts: { name: "Gifts", icon: "fas fa-gift" },
  freelance: { name: "Freelance", icon: "fas fa-laptop-code" },
  courses: { name: "Courses", icon: "fas fa-book" },
  withdrawal: { name: "Withdrawal", icon: "fas fa-money-bill-alt" },
  bills: { name: "Bills", icon: "fas fa-file-invoice-dollar" },
  shopping: { name: "Shopping", icon: "fas fa-shopping-bag" },
  health: { name: "Health", icon: "fas fa-heartbeat" },
  education: { name: "Education", icon: "fas fa-graduation-cap" },
  other: { name: "Other", icon: "fas fa-box" },
};

// Add months array for labels
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Initialize Firebase and auth state
document.addEventListener("DOMContentLoaded", () => {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      await initializePage(user);
    } else {
      window.location.href = "/login.html";
    }
  });
});

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    minimumFractionDigits: 2,
  }).format(amount);
};

// Initialize page
async function initializePage(user) {
  try {
    const userProfile = await getUserProfile(user.uid);
    updateUserInfo(userProfile);
    initializeModal();
    initializePeriodControls();
    initializeChart();
    await loadBudgets();
  } catch (error) {
    console.error("Error initializing page:", error);
    Swal.fire({
      icon: "error",
      title: "Initialization Error",
      text: "Failed to initialize the budget page. Please try again.",
    });
  }
}

// Initialize modal
function initializeModal() {
  const modal = document.getElementById("budgetModal");
  const newBudgetBtn = document.getElementById("newBudgetBtn");
  const cancelBtn = document.getElementById("cancelBudget");
  const budgetForm = document.getElementById("budgetForm");
  const categorySelect = document.getElementById("category");

  // Populate categories
  categorySelect.innerHTML = Object.entries(CATEGORIES)
    .map(
      ([value, { name }]) => `
      <option value="${value}">${name}</option>
    `
    )
    .join("");

  // Set default period to current month
  const periodInput = document.getElementById("period");
  const today = new Date();
  periodInput.value = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;

  newBudgetBtn.addEventListener("click", () => {
    modal.classList.add("active");
  });

  cancelBtn.addEventListener("click", () => {
    modal.classList.remove("active");
    budgetForm.reset();
  });

  budgetForm.addEventListener("submit", handleBudgetSubmit);
}

// Handle budget form submission
async function handleBudgetSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const category = form.category.value;
  const amount = parseFloat(form.amount.value);
  const period = form.period.value;

  try {
    const user = auth.currentUser;
    const budgetRef = db.ref(`users/${user.uid}/budgets/${period}`);

    await budgetRef.child(category).set({
      amount,
      spent: 0,
    });

    document.getElementById("budgetModal").classList.remove("active");
    form.reset();
    await loadBudgets();

    Swal.fire({
      icon: "success",
      title: "Budget Created",
      text: "Your budget has been set successfully!",
    });
  } catch (error) {
    console.error("Error creating budget:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Failed to create budget. Please try again.",
    });
  }
}

// Initialize period controls
function initializePeriodControls() {
  const prevMonth = document.getElementById("prevMonth");
  const nextMonth = document.getElementById("nextMonth");
  const currentPeriod = document.getElementById("currentPeriod");

  let currentDate = new Date();

  function updatePeriodDisplay() {
    currentPeriod.textContent = currentDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    loadBudgets();
  }

  prevMonth.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    updatePeriodDisplay();
  });

  nextMonth.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    updatePeriodDisplay();
  });

  updatePeriodDisplay();
}

// Initialize chart
function initializeChart() {
  const ctx = document.getElementById("budgetChart")?.getContext("2d");
  if (!ctx) {
    console.error("Chart context not found");
    return;
  }

  window.budgetChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: [
            "#0fa958",
            "#63679f",
            "#dc3545",
            "#fd7e14",
            "#ffc107",
            "#20c997",
            "#0dcaf0",
            "#6610f2",
            "#6f42c1",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const value = context.raw || 0;
              return `${label}: ${formatCurrency(value)}`;
            },
          },
        },
      },
    },
  });
}

// Update chart
function updateChart(budgets) {
  if (!window.budgetChart) {
    console.error("Chart not initialized");
    return;
  }

  const labels = [];
  const data = [];

  Object.entries(budgets).forEach(([category, budget]) => {
    labels.push(CATEGORIES[category]?.name || category);
    data.push(budget.amount);
  });

  window.budgetChart.data.labels = labels;
  window.budgetChart.data.datasets[0].data = data;
  window.budgetChart.update();
}

// Load budgets with transaction data
async function loadBudgets() {
  try {
    const user = auth.currentUser;
    const currentPeriod = document.getElementById("currentPeriod")?.textContent;
    if (!currentPeriod) throw new Error("No period selected");

    const [month, year] = currentPeriod.split(" ");
    const period = `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, "0")}`;

    // Get budgets
    const budgetRef = db.ref(`users/${user.uid}/budgets/${period}`);
    const budgetSnapshot = await budgetRef.once("value");
    const budgets = budgetSnapshot.val() || {};

    // Get transactions for the period
    const transactionsRef = db.ref(`users/${user.uid}/transactions`);
    const transactionsSnapshot = await transactionsRef.once("value");
    const transactions = [];

    transactionsSnapshot.forEach((childSnapshot) => {
      const transaction = childSnapshot.val();
      const transactionDate = new Date(transaction.date);
      if (
        transactionDate.getFullYear().toString() === year &&
        MONTHS[transactionDate.getMonth()] === month &&
        transaction.type === 'expense' // Only count expenses
      ) {
        transactions.push(transaction);
      }
    });

    // Calculate spent amounts per category
    const spentByCategory = transactions.reduce((acc, transaction) => {
      const category = transaction.category;
      acc[category] = (acc[category] || 0) + Math.abs(transaction.amount);
      return acc;
    }, {});

    // Update budgets with spent amounts
    Object.keys(budgets).forEach((category) => {
      budgets[category].spent = spentByCategory[category] || 0;
    });

    // Calculate totals
    let totalBudget = 0;
    let totalSpent = 0;

    Object.values(budgets).forEach((budget) => {
      totalBudget += budget.amount || 0;
      totalSpent += budget.spent || 0;
    });

    // Update overview cards
    document.getElementById("totalBudget").textContent = formatCurrency(totalBudget);
    document.getElementById("totalSpent").textContent = formatCurrency(totalSpent);
    document.getElementById("totalRemaining").textContent = formatCurrency(
      totalBudget - totalSpent
    );

    // Update budget categories display with edit/delete buttons
    renderBudgetCategories(budgets, period);

    // Update chart if initialized
    if (window.budgetChart) {
      updateChart(budgets);
    }
  } catch (error) {
    console.error("Error loading budgets:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Failed to load budgets. Please try again.",
    });
  }
}

// Enhanced render function with edit/delete buttons
function renderBudgetCategories(budgets, period) {
  const container = document.getElementById("budgetCategories");
  container.innerHTML = "";

  Object.entries(budgets).forEach(([category, budget]) => {
    const percentage = (budget.spent / budget.amount) * 100;
    const progressClass =
      percentage >= 90 ? "danger" : percentage >= 75 ? "warning" : "safe";

    const categoryEl = document.createElement("div");
    categoryEl.className = "budget-category";
    categoryEl.innerHTML = `
      <div class="category-header">
        <div class="category-name">
          <div class="category-icon">
            <i class="${CATEGORIES[category]?.icon || "fas fa-box"}"></i>
          </div>
          ${CATEGORIES[category]?.name || category}
        </div>
        <div class="category-info">
          <div class="category-amounts">
            <span>Spent: ${formatCurrency(budget.spent || 0)}</span>
            <span>Budget: ${formatCurrency(budget.amount)}</span>
          </div>
          <div class="category-actions">
            <button class="edit-btn" onclick="editBudget('${category}', ${budget.amount}, '${period}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="delete-btn" onclick="deleteBudget('${category}', '${period}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${progressClass}" style="width: ${Math.min(
      percentage,
      100
    )}%"></div>
      </div>
    `;

    container.appendChild(categoryEl);
  });
}

// Add edit budget function
window.editBudget = async function(category, currentAmount, period) {
  const { value: newAmount } = await Swal.fire({
    title: `Edit Budget for ${CATEGORIES[category]?.name || category}`,
    input: 'number',
    inputLabel: 'New Budget Amount',
    inputValue: currentAmount,
    showCancelButton: true,
    inputValidator: (value) => {
      if (!value || value <= 0) {
        return 'Please enter a valid amount';
      }
    }
  });

  if (newAmount) {
    try {
      const user = auth.currentUser;
      const budgetRef = db.ref(`users/${user.uid}/budgets/${period}/${category}`);
      await budgetRef.update({ amount: parseFloat(newAmount) });
      
      await loadBudgets(); // Refresh the display
      
      Swal.fire({
        icon: 'success',
        title: 'Budget Updated',
        text: `Budget for ${CATEGORIES[category]?.name || category} has been updated successfully!`
      });
    } catch (error) {
      console.error("Error updating budget:", error);
      Swal.fire({
        icon: 'error',
        title: 'Update Error',
        text: 'Failed to update the budget. Please try again.'
      });
    }
  }
};

// Add delete budget function
window.deleteBudget = async function(category, period) {
  const result = await Swal.fire({
    title: `Delete Budget for ${CATEGORIES[category]?.name || category}?`,
    text: "This action cannot be undone!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc3545',
    confirmButtonText: 'Yes, delete it!'
  });

  if (result.isConfirmed) {
    try {
      const user = auth.currentUser;
      const budgetRef = db.ref(`users/${user.uid}/budgets/${period}/${category}`);
      await budgetRef.remove();
      
      await loadBudgets(); // Refresh the display
      
      Swal.fire({
        icon: 'success',
        title: 'Budget Deleted',
        text: `Budget for ${CATEGORIES[category]?.name || category} has been deleted successfully!`
      });
    } catch (error) {
      console.error("Error deleting budget:", error);
      Swal.fire({
        icon: 'error',
        title: 'Delete Error',
        text: 'Failed to delete the budget. Please try again.'
      });
    }
  }
};

// Update user info
function updateUserInfo(userProfile) {
  const userName = document.getElementById("userName");
  const userAvatar = document.getElementById("userAvatar");

  if (userName && userProfile.displayName) {
    userName.textContent = userProfile.displayName;
  }

  if (userAvatar && userProfile.photoURL) {
    userAvatar.src = userProfile.photoURL;
  } else if (userAvatar && userProfile.displayName) {
    userAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      userProfile.displayName
    )}&background=random`;
  }
}

// Sign out functionality
document.getElementById("signOutBtn")?.addEventListener("click", async () => {
  try {
    await auth.signOut();
    window.location.href = "/login.html";
  } catch (error) {
    console.error("Error signing out:", error);
    Swal.fire({
      icon: "error",
      title: "Sign Out Error",
      text: "Failed to sign out. Please try again.",
    });
  }
});
