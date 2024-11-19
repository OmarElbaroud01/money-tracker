import { TransactionManager } from "./transactions.js";
import { getUserProfile } from "./auth.js";

let transactionManager = null;
let currentPage = 1;
const ITEMS_PER_PAGE = 20;
let totalPages = 1;

// Categories configuration
const CATEGORIES = {
  food: { name: "Food", icon: "fas fa-utensils" },
  transport: { name: "Transport", icon: "fas fa-car" },
  utilities: { name: "Utilities", icon: "fas fa-bolt" },
  entertainment: { name: "Entertainment", icon: "fas fa-film" },
  salary: { name: "Salary", icon: "fas fa-money-check-alt" },
  investment: { name: "Investment", icon: "fas fa-chart-line" },
  savings: { name: "Savings", icon: "fas fa-piggy-bank" },
  rent: { name: "Rent", icon: "fas fa-home" },
  gifts: { name: "Gifts", icon: "fas fa-gift" },
  freelance: { name: "Freelance", icon: "fas fa-laptop" },
  courses: { name: "Courses", icon: "fas fa-graduation-cap" },
  withdrawal: { name: "Withdrawal", icon: "fas fa-money-bill-wave" },
  bills: { name: "Bills", icon: "fas fa-file-invoice-dollar" },
  other: { name: "Other", icon: "fas fa-box" },
};

// Initialize the page
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    await initializePage(user);
  } else {
    window.location.href = "/login.html";
  }
});

async function initializePage(user) {
  try {
    const userProfile = await getUserProfile(user.uid);
    transactionManager = new TransactionManager(user.uid);

    // Update user info in the sidebar
    updateUserInfo(userProfile);

    // Initialize filters
    initializeFilters();

    // Load initial data
    await loadTransactions();

    // Setup real-time updates
    transactionManager.subscribeToTransactions(async (transactions) => {
      await updateTransactionStats();
      await loadTransactions(); // Reload the table
    });
  } catch (error) {
    console.error("Failed to initialize transactions page:", error);
    alert("Failed to load transactions. Please try again.");
  }
}

// Helper functions for formatting
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount) {
  const formattedAmount = new Intl.NumberFormat("en-MA", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  return `${amount < 0 ? "-" : "+"} ${formattedAmount} MAD`;
}

function getCategoryIcon(category) {
  return CATEGORIES[category]?.icon
    ? `<i class="${CATEGORIES[category].icon}"></i>`
    : '<i class="fas fa-box"></i>';
}

// Add these helper functions
function updateUserInfo(userProfile) {
  const userName = document.getElementById("userName");
  const userAvatar = document.querySelector(".user-avatar");

  if (userName) {
    userName.textContent = userProfile?.name || "User";
  }

  if (userAvatar) {
    userAvatar.src =
      userProfile?.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        userProfile?.name || "User"
      )}&background=random`;
    userAvatar.alt = `${userProfile?.name || "User"}'s avatar`;
  }
}

function initializeFilters() {
  const filterForm = document.querySelector(".transaction-filters");
  if (!filterForm) return;

  // Populate category filter
  const categoryFilter = document.getElementById("categoryFilter");
  if (categoryFilter) {
    categoryFilter.innerHTML = `
            <option value="">All Categories</option>
            ${Object.entries(CATEGORIES)
              .map(
                ([value, { name }]) =>
                  `<option value="${value}">${name}</option>`
              )
              .join("")}
        `;
  }

  // Set default date range (last 30 days)
  const startDate = document.getElementById("startDate");
  const endDate = document.getElementById("endDate");

  if (startDate && endDate) {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    startDate.value = thirtyDaysAgo.toISOString().split("T")[0];
    endDate.value = today.toISOString().split("T")[0];
  }

  // Add filter event listener
  const applyFilters = document.getElementById("applyFilters");
  if (applyFilters) {
    applyFilters.addEventListener("click", () => {
      currentPage = 1;
      loadTransactions();
    });
  }
}

async function loadTransactions() {
  try {
    const filters = getFilters();
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    const [transactions, totalCount] = await Promise.all([
      transactionManager.getFilteredTransactions({
        ...filters,
        limit: ITEMS_PER_PAGE,
        offset,
      }),
      transactionManager.getTotalTransactionsCount(filters),
    ]);

    renderTransactionsTable(transactions);
    await updateTransactionStats();
    updatePagination(totalCount);
  } catch (error) {
    console.error("Failed to load transactions:", error);
    alert("Failed to load transactions. Please try again.");
  }
}

async function updateTransactionStats() {
  try {
    const filters = getFilters();
    const stats = await transactionManager.getTransactionStats(
      filters.startDate,
      filters.endDate
    );

    // Update stats display
    document.getElementById("totalIncome").textContent = formatCurrency(
      stats.totalIncome
    );
    document.getElementById("totalExpenses").textContent = formatCurrency(
      stats.totalExpenses
    );
    document.getElementById("netBalance").textContent = formatCurrency(
      stats.totalIncome - stats.totalExpenses
    );
  } catch (error) {
    console.error("Failed to update transaction stats:", error);
  }
}

async function deleteTransaction(transactionId) {
  try {
    // Create a custom confirmation dialog
    const result = await Swal.fire({
      title: 'Delete Transaction',
      text: 'Are you sure you want to delete this transaction? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    // Show loading state
    Swal.fire({
      title: 'Deleting...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const success = await transactionManager.deleteTransaction(transactionId);
    
    if (success) {
      // Refresh the transactions table and stats
      await Promise.all([
        loadTransactions(),
        updateTransactionStats()
      ]);
      
      // Show success message
      await Swal.fire({
        title: 'Deleted!',
        text: 'Transaction has been deleted successfully.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      await Swal.fire({
        title: 'Not Found',
        text: 'Transaction not found. The list will be refreshed.',
        icon: 'info'
      });
      await loadTransactions();
    }
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    await Swal.fire({
      title: 'Error!',
      text: 'Failed to delete transaction. Please try again.',
      icon: 'error'
    });
  }
}

function getFilters() {
  return {
    startDate: document.getElementById("startDate")?.value,
    endDate: document.getElementById("endDate")?.value,
    type: document.getElementById("typeFilter")?.value,
    category: document.getElementById("categoryFilter")?.value,
  };
}

function renderTransactionsTable(transactions) {
  const tbody = document.getElementById("transactionsTableBody");
  if (!tbody) return;

  tbody.innerHTML = transactions
    .map(
      (transaction) => `
        <tr class="${transaction.type}">
            <td>${formatDate(transaction.date)}</td>
            <td>
                <span class="category-icon">${getCategoryIcon(
                  transaction.category
                )}</span>
                ${
                  CATEGORIES[transaction.category]?.name || transaction.category
                }
            </td>
            <td>${transaction.note || "-"}</td>
            <td class="amount ${transaction.type}">
                ${formatCurrency(transaction.amount)}
            </td>
            <td>
                <span class="type-badge ${transaction.type}">
                    ${
                      transaction.type.charAt(0).toUpperCase() +
                      transaction.type.slice(1)
                    }
                </span>
            </td>
            <td class="actions">
                <button class="edit-btn" data-id="${transaction.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="delete-btn" data-id="${transaction.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `
    )
    .join("");

  initializeTransactionActions();
}

// Initialize transaction actions
function initializeTransactionActions() {
  const tbody = document.getElementById('transactionsTableBody');
  if (!tbody) return;

  tbody.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const transactionId = button.dataset.id;
    if (!transactionId) return;

    // Disable the button to prevent double-clicks
    button.disabled = true;

    try {
      if (button.classList.contains('delete-btn')) {
        await deleteTransaction(transactionId);
      } else if (button.classList.contains('edit-btn')) {
        // Store the current page in sessionStorage before redirecting
        sessionStorage.setItem('lastTransactionPage', currentPage);
        window.location.href = `index.html?edit=${transactionId}`;
      }
    } finally {
      // Re-enable the button
      button.disabled = false;
    }
  });

  // Restore last page if coming back from edit
  const lastPage = sessionStorage.getItem('lastTransactionPage');
  if (lastPage) {
    currentPage = parseInt(lastPage);
    sessionStorage.removeItem('lastTransactionPage');
    loadTransactions();
  }
}

// Add this pagination function
function updatePagination(totalItems) {
  totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");
  const pageInfo = document.getElementById("pageInfo");

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

  // Update pagination buttons event listeners
  if (prevBtn) {
    prevBtn.onclick = () => {
      if (currentPage > 1) {
        currentPage--;
        loadTransactions();
      }
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      if (currentPage < totalPages) {
        currentPage++;
        loadTransactions();
      }
    };
  }
}

// Add this helper function to TransactionManager class in transactions.js
async function getTotalTransactionsCount(filters) {
  try {
    const allTransactions = await this.getFilteredTransactions({
      ...filters,
      limit: 1000000, // High number to get all transactions
      offset: 0,
    });
    return allTransactions.length;
  } catch (error) {
    console.error("Failed to get total transactions count:", error);
    return 0;
  }
}

// Export the necessary functions
export {
  initializeTransactionActions,
  formatDate,
  formatCurrency,
  getCategoryIcon,
  updatePagination,
};

// Clean up when leaving the page
window.addEventListener("unload", () => {
  if (transactionManager) {
    transactionManager.unsubscribeFromTransactions();
  }
});
