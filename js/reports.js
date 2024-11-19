import { auth, db } from "./firebase-config.js";
import { getUserProfile } from "./auth.js";

// Initialize Firebase and auth state
document.addEventListener("DOMContentLoaded", () => {
  // Remove the event listeners from the bottom of the file
  const reportTypeSelect = document.getElementById("reportType");
  const periodTypeSelect = document.getElementById("periodType");

  if (reportTypeSelect) {
    reportTypeSelect.addEventListener("change", updateReport);
  }

  if (periodTypeSelect) {
    periodTypeSelect.addEventListener("change", updateReport);
  }

  // Initialize Firebase auth state
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      await initializePage(user);
    } else {
      window.location.href = "/login.html";
    }
  });
});

// Add currency formatter
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    minimumFractionDigits: 2,
  }).format(amount);
};

// Update summary cards with data
function updateSummary(data) {
  const totalIncomeElement = document.getElementById("totalIncome");
  const totalExpenseElement = document.getElementById("totalExpense");

  totalIncomeElement.textContent = formatCurrency(data.totalIncome || 0);
  totalExpenseElement.textContent = formatCurrency(data.totalExpense || 0);
}

// Update chart with new data
function updateChart(data, chart) {
  const reportType = document.getElementById("reportType").value;

  switch (reportType) {
    case "expense-income":
      chart.data.datasets[0].data = data.incomeData;
      chart.data.datasets[1].data = data.expenseData;
      break;
    case "category":
      chart.type = "pie";
      chart.data.labels = data.categories;
      chart.data.datasets = [
        {
          data: data.categoryAmounts,
          backgroundColor: generateColors(data.categories.length),
        },
      ];
      break;
    case "trends":
      chart.type = "line";
      chart.data.datasets = [
        {
          label: "Spending Trend",
          data: data.trendData,
          borderColor: "#0fa958",
          tension: 0.4,
        },
      ];
      break;
    case "accounts":
      chart.type = "bar";
      chart.data.labels = data.accountNames;
      chart.data.datasets = [
        {
          label: "Account Balance",
          data: data.accountBalances,
          backgroundColor: "#63679f",
        },
      ];
      break;
  }

  chart.update();
}

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

// Add updateUserInfo function
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

// Add signOut functionality
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

// Move event listeners inside initializePage
async function initializePage(user) {
  try {
    const userProfile = await getUserProfile(user.uid);
    updateUserInfo(userProfile);

    // Initialize chart
    const ctx = document.getElementById("reportChart")?.getContext("2d");
    if (!ctx) throw new Error("Chart context not found");

    window.reportChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ],
        datasets: [
          {
            label: "Income",
            data: Array(12).fill(0),
            borderColor: "#0fa958",
            tension: 0.4,
          },
          {
            label: "Expenses",
            data: Array(12).fill(0),
            borderColor: "#dc3545",
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || "";
                if (label) {
                  label += ": ";
                }
                label += formatCurrency(context.parsed.y);
                return label;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return formatCurrency(value);
              },
            },
          },
        },
      },
    });

    // Initialize period controls
    const currentPeriod = document.getElementById("currentPeriod");
    const prevPeriod = document.getElementById("prevPeriod");
    const nextPeriod = document.getElementById("nextPeriod");
    const monthSelect = document.getElementById("monthSelect");
    const reportTypeSelect = document.getElementById("reportType");

    if (monthSelect && reportTypeSelect) {
      let currentYear = new Date().getFullYear();
      let currentMonth = new Date().getMonth();

      // Populate months dropdown
      monthSelect.innerHTML = MONTHS.map(
        (month, index) =>
          `<option value="${index}" ${
            index === currentMonth ? "selected" : ""
          }>${month}</option>`
      ).join("");

      // Update period display
      function updatePeriodDisplay() {
        if (currentPeriod) {
          currentPeriod.textContent = `${MONTHS[currentMonth]} ${currentYear}`;
        }
      }

      updatePeriodDisplay();

      // Add event listeners
      reportTypeSelect.addEventListener("change", updateReport);
      monthSelect.addEventListener("change", (e) => {
        currentMonth = parseInt(e.target.value);
        updatePeriodDisplay();
        updateReport();
      });

      if (prevPeriod && nextPeriod) {
        prevPeriod.addEventListener("click", () => {
          if (currentMonth === 0) {
            currentMonth = 11;
            currentYear--;
          } else {
            currentMonth--;
          }
          monthSelect.value = currentMonth;
          updatePeriodDisplay();
          updateReport();
        });

        nextPeriod.addEventListener("click", () => {
          if (currentMonth === 11) {
            currentMonth = 0;
            currentYear++;
          } else {
            currentMonth++;
          }
          monthSelect.value = currentMonth;
          updatePeriodDisplay();
          updateReport();
        });
      }
    }

    // Initialize filters and load initial data
    await initializeFilters();
    await updateReport();
  } catch (error) {
    console.error("Error initializing page:", error);
    Swal.fire({
      icon: "error",
      title: "Initialization Error",
      text: "Failed to initialize the reports page. Please try again.",
    });
  }
}

// Update initializeFilters function
async function initializeFilters() {
  const accountsFilter = document.getElementById("accountsFilter");
  const tagsFilter = document.getElementById("tagsFilter");

  if (!accountsFilter || !tagsFilter) return;

  // Fetch accounts and tags from Firebase
  try {
    const user = auth.currentUser;
    const accountsSnapshot = await db
      .ref(`users/${user.uid}/accounts`)
      .once("value");
    const transactionsSnapshot = await db
      .ref(`users/${user.uid}/transactions`)
      .once("value");

    // Process accounts
    const accounts = [];
    accountsSnapshot.forEach((childSnapshot) => {
      accounts.push(childSnapshot.val().name);
    });

    // Process tags
    const tags = new Set();
    transactionsSnapshot.forEach((childSnapshot) => {
      const transaction = childSnapshot.val();
      if (transaction.tags) {
        transaction.tags.forEach((tag) => tags.add(tag));
      }
    });

    // Populate account options
    const accountsContent = accountsFilter.querySelector(".dropdown-content");
    accountsContent.innerHTML = accounts
      .map(
        (account) => `
        <div class="dropdown-item">
          <label>
            <input type="checkbox" value="${account}"> ${account}
          </label>
        </div>
      `
      )
      .join("");

    // Populate tag options
    const tagsContent = tagsFilter.querySelector(".dropdown-content");
    tagsContent.innerHTML = Array.from(tags)
      .map(
        (tag) => `
        <div class="dropdown-item">
          <label>
            <input type="checkbox" value="${tag}"> ${tag}
          </label>
        </div>
      `
      )
      .join("");

    // Toggle dropdown
    accountsFilter.querySelector("input").addEventListener("click", () => {
      accountsFilter.classList.toggle("active");
    });

    tagsFilter.querySelector("input").addEventListener("click", () => {
      tagsFilter.classList.toggle("active");
    });

    // Close dropdowns when clicking outside
    document.addEventListener("click", (e) => {
      if (!accountsFilter.contains(e.target)) {
        accountsFilter.classList.remove("active");
      }
      if (!tagsFilter.contains(e.target)) {
        tagsFilter.classList.remove("active");
      }
    });
  } catch (error) {
    console.error("Error initializing filters:", error);
    throw error;
  }
}

// Update fetchReportData function
async function fetchReportData(reportType, periodType, period) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const transactionsRef = db.ref(`users/${user.uid}/transactions`);
  const [month, year] = period.split(" ");

  try {
    const snapshot = await transactionsRef.once("value");
    const transactions = [];

    snapshot.forEach((childSnapshot) => {
      const transaction = childSnapshot.val();
      transaction.id = childSnapshot.key;

      // Filter transactions by month and year
      const transactionDate = new Date(transaction.date);
      if (
        transactionDate.getFullYear().toString() === year &&
        MONTHS[transactionDate.getMonth()] === month
      ) {
        transactions.push(transaction);
      }
    });

    // Process data based on report type
    let processedData;
    switch (reportType) {
      case "expense-income":
        processedData = processExpenseIncomeData(transactions);
        break;
      case "category":
        processedData = processCategoryData(transactions);
        break;
      case "trends":
        processedData = processTrendData(transactions);
        break;
      case "accounts":
        processedData = processAccountData(transactions);
        break;
      default:
        throw new Error("Invalid report type");
    }

    return processedData;
  } catch (error) {
    console.error("Error fetching report data:", error);
    throw error;
  }
}

// Process data for expense-income report
function processExpenseIncomeData(transactions) {
  const months = Array(12).fill(0);
  const incomeData = [...months];
  const expenseData = [...months];
  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach((transaction) => {
    const date = new Date(transaction.date);
    const month = date.getMonth();
    const amount = parseFloat(transaction.amount);

    if (transaction.type === "income") {
      incomeData[month] += amount;
      totalIncome += amount;
    } else {
      expenseData[month] += amount;
      totalExpense += amount;
    }
  });

  return {
    incomeData,
    expenseData,
    totalIncome,
    totalExpense,
  };
}

// Process data for category analysis
function processCategoryData(transactions) {
  const categoryMap = new Map();

  transactions.forEach((transaction) => {
    if (transaction.type === "expense") {
      const currentAmount = categoryMap.get(transaction.category) || 0;
      categoryMap.set(
        transaction.category,
        currentAmount + parseFloat(transaction.amount)
      );
    }
  });

  return {
    categories: Array.from(categoryMap.keys()),
    categoryAmounts: Array.from(categoryMap.values()),
    totalExpense: Array.from(categoryMap.values()).reduce((a, b) => a + b, 0),
  };
}

// Process data for spending trends
function processTrendData(transactions) {
  const trendData = Array(12).fill(0);

  transactions.forEach((transaction) => {
    if (transaction.type === "expense") {
      const date = new Date(transaction.date);
      const month = date.getMonth();
      trendData[month] += parseFloat(transaction.amount);
    }
  });

  return {
    trendData,
    totalExpense: trendData.reduce((a, b) => a + b, 0),
  };
}

// Process data for account balances
function processAccountData(transactions) {
  const accountBalances = new Map();

  transactions.forEach((transaction) => {
    const currentBalance = accountBalances.get(transaction.account) || 0;
    const amount = parseFloat(transaction.amount);
    accountBalances.set(
      transaction.account,
      transaction.type === "income"
        ? currentBalance + amount
        : currentBalance - amount
    );
  });

  return {
    accountNames: Array.from(accountBalances.keys()),
    accountBalances: Array.from(accountBalances.values()),
    totalBalance: Array.from(accountBalances.values()).reduce(
      (a, b) => a + b,
      0
    ),
  };
}

// Generate colors for pie chart
function generateColors(count) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(`hsl(${(i * 360) / count}, 70%, 50%)`);
  }
  return colors;
}

// Update the updateReport function
async function updateReport() {
  try {
    const reportType =
      document.getElementById("reportType")?.value || "expense-income";
    const period =
      document.getElementById("currentPeriod")?.textContent ||
      `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`;

    const data = await fetchReportData(reportType, "monthly", period);
    updateSummary(data);
    if (window.reportChart) {
      updateChart(data, window.reportChart);
    }
  } catch (error) {
    console.error("Error updating report:", error);
    Swal.fire({
      icon: "error",
      title: "Update Error",
      text: "Failed to update the report. Please try again.",
    });
  }
}

// Implement the rest of the required functions based on your Firebase structure
