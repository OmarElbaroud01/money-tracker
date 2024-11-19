import { TransactionManager } from "./transactions.js";
import {
  handleSignOut,
  getUserProfile,
  initializeUserProfile,
} from "./auth.js";

let currentUser = null;
let transactionManager = null;
let hasUnsavedChanges = false;

// Authentication state observer
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    await initializeApp(user);
  } else {
    window.location.href = "/login.html";
  }
});

// Initialize app with user context
async function initializeApp(user) {
  try {
    const userProfile = await getUserProfile(user.uid);
    if (!userProfile) {
      // If profile doesn't exist, initialize it
      const initializedProfile = await initializeUserProfile(user);
      userProfile = initializedProfile;
    }

    transactionManager = new TransactionManager(user.uid);

    // Update UI with user info
    const userName = document.getElementById("userName");
    if (userName) {
      userName.textContent = userProfile?.name || user.email.split("@")[0];
    }

    // Update avatar with dynamic URL
    const avatarElement = document.querySelector(".user-avatar");
    if (avatarElement) {
      avatarElement.src =
        userProfile?.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
          userProfile?.name || "User"
        )}&background=random`;
      avatarElement.alt = `${userProfile?.name || "User"}'s avatar`;
    }

    // Initialize sign out button
    initializeSignOutButton();

    // Initialize transaction form
    initializeTransactionForm();

    // Initialize net worth modal
    initializeNetWorthModal();

    // Initialize transaction actions
    initializeTransactionActions();

    // Load initial data
    await Promise.all([loadTransactions(), updateNetWorthDisplay()]);

    // ... rest of initialization
  } catch (error) {
    console.error("Failed to initialize app:", error);
    // Handle initialization error (maybe redirect to login)
    await handleSignOut();
  }
}

// Initialize sign out with confirmation
function initializeSignOutButton() {
  const signOutBtn = document.getElementById("signOutBtn");
  if (!signOutBtn) {
    console.error("Sign out button not found");
    return;
  }

  signOutBtn.addEventListener("click", async () => {
    try {
      if (hasUnsavedChanges) {
        const confirm = window.confirm(
          "You have unsaved changes. Are you sure you want to sign out?"
        );
        if (!confirm) {
          return;
        }
      }

      // Clear any app state
      currentUser = null;
      transactionManager = null;
      hasUnsavedChanges = false;

      await handleSignOut();
    } catch (error) {
      console.error("Failed to sign out:", error);
      alert("Failed to sign out. Please try again.");
    }
  });
}

// Initialize transaction form
function initializeTransactionForm() {
  const transactionForm = document.querySelector(".transaction-form");
  if (!transactionForm) return;

  transactionForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const amount = parseFloat(document.getElementById("amount").value);
    const category = document.getElementById("category").value;
    const date = document.getElementById("date").value;
    const note = document.getElementById("note").value;
    const type = document
      .querySelector(".tab.active")
      .textContent.toLowerCase();
    const submitBtn = document.querySelector(".add-expense-btn");
    const editId = submitBtn.dataset.editId;

    try {
      if (editId) {
        // Update existing transaction
        await transactionManager.updateTransaction(editId, {
          amount,
          category,
          date,
          note,
          type,
          timestamp: new Date().toISOString(),
        });
        submitBtn.textContent = "Add Transaction";
        delete submitBtn.dataset.editId;
      } else {
        // Add new transaction
        await transactionManager.addTransaction({
          amount,
          category,
          date,
          note,
          type,
          timestamp: new Date().toISOString(),
        });
      }

      // Reset form and refresh
      transactionForm.reset();
      document.getElementById("date").value = new Date()
        .toISOString()
        .split("T")[0];

      await Promise.all([loadTransactions(), updateNetWorthDisplay()]);
    } catch (error) {
      console.error("Failed to save transaction:", error);
      alert("Failed to save transaction. Please try again.");
    }
  });

  // Initialize transaction tabs
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const submitBtn = document.querySelector(".add-expense-btn");
      submitBtn.textContent = submitBtn.dataset.editId
        ? "Update Transaction"
        : `Add ${tab.textContent}`;
    });
  });
}

// Load and display transactions
async function loadTransactions() {
  try {
    const transactions = await transactionManager.getAllTransactions();
    const transactionsList = document.querySelector(".transactions-list");

    if (!transactions || transactions.length === 0) {
      transactionsList.innerHTML = `
        <div class="no-transactions">
          <i class="fas fa-receipt fa-2x"></i>
          <p>No transactions yet</p>
        </div>
      `;
      return;
    }

    // Sort transactions by date (most recent first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    transactionsList.innerHTML = transactions
      .map(
        (transaction) => `
      <div class="transaction-item ${transaction.type}" data-id="${
          transaction.id
        }">
        <div class="transaction-info">
          <div class="transaction-main">
            <div class="transaction-icon">
              ${getCategoryIcon(transaction.category)}
            </div>
            <div class="transaction-details">
              <span class="transaction-category">${transaction.category}</span>
              <span class="transaction-note">${transaction.note || ""}</span>
            </div>
          </div>
          <div class="transaction-secondary">
            <span class="transaction-amount ${transaction.type}">
              ${formatCurrency(
                transaction.type === "expense"
                  ? -transaction.amount
                  : transaction.amount
              )}
            </span>
            <span class="transaction-date">${formatDate(
              transaction.date
            )}</span>
          </div>
        </div>
        <div class="transaction-actions">
          <button class="edit-btn" title="Edit" data-id="${transaction.id}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="delete-btn" title="Delete" data-id="${transaction.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `
      )
      .join("");
  } catch (error) {
    console.error("Failed to load transactions:", error);
    const transactionsList = document.querySelector(".transactions-list");
    transactionsList.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-circle"></i>
        <p>Failed to load transactions. Please try again.</p>
      </div>
    `;
  }
}

// Initialize transaction actions (Edit/Delete)
function initializeTransactionActions() {
    const transactionsList = document.querySelector('.transactions-list');
    if (!transactionsList) return;

    transactionsList.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const transactionId = button.dataset.id;
        if (!transactionId) return;

        // Disable the button and show loading state
        button.disabled = true;
        const originalContent = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            if (button.classList.contains('delete-btn')) {
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

                if (result.isConfirmed) {
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
                        // Refresh both transactions and net worth display
                        await Promise.all([
                            loadTransactions(),
                            updateNetWorthDisplay()
                        ]);
                        
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
                }
            } else if (button.classList.contains('edit-btn')) {
                // Show loading state for edit
                const loadingToast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true
                });

                await loadingToast.fire({
                    icon: 'info',
                    title: 'Loading transaction details...'
                });

                await editTransaction(transactionId);
            }
        } catch (error) {
            console.error('Failed to process transaction action:', error);
            await Swal.fire({
                title: 'Error!',
                text: 'Failed to process your request. Please try again.',
                icon: 'error'
            });
        } finally {
            // Restore button state
            button.disabled = false;
            button.innerHTML = originalContent;
        }
    });
}

// Helper functions
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount) {
  const formattedAmount = new Intl.NumberFormat("ar-MA", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  return `${amount < 0 ? "-" : "+"} ${formattedAmount} MAD`;
}

function getCategoryIcon(category) {
  const icons = {
    food: '<i class="fas fa-utensils"></i>',
    transport: '<i class="fas fa-car"></i>',
    utilities: '<i class="fas fa-bolt"></i>',
    entertainment: '<i class="fas fa-film"></i>',
    salary: '<i class="fas fa-money-check-alt"></i>',
    investment: '<i class="fas fa-chart-line"></i>',
    other: '<i class="fas fa-box"></i>',
  };
  return icons[category] || icons.other;
}

// Add this after initializeApp function
async function updateNetWorthDisplay() {
  try {
    const balance = await transactionManager.getWalletBalance();

    // Update net worth amount
    const netWorthAmount = document.querySelector(".net-worth-section .amount");
    if (netWorthAmount) {
      netWorthAmount.textContent = formatCurrency(balance.current).replace(
        "+",
        ""
      );
    }

    // Update wallet balance
    const walletBalance = document.querySelector(
      ".account-item .multi-currency span"
    );
    if (walletBalance) {
      walletBalance.textContent = formatCurrency(balance.current).replace(
        "+",
        ""
      );
    }
  } catch (error) {
    console.error("Failed to update net worth:", error);
  }
}

// Add these functions after the existing initialization code

function initializeNetWorthModal() {
  const modal = document.getElementById("netWorthModal");
  const setNetWorthBtn = document.getElementById("setNetWorthBtn");
  const cancelBtn = document.getElementById("cancelNetWorth");
  const netWorthForm = document.getElementById("netWorthForm");

  setNetWorthBtn.addEventListener("click", () => {
    modal.classList.add("active");
  });

  cancelBtn.addEventListener("click", () => {
    modal.classList.remove("active");
    netWorthForm.reset();
  });

  netWorthForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById("netWorthAmount").value);

    try {
      await transactionManager.setInitialNetWorth(amount);
      await updateNetWorthDisplay();
      modal.classList.remove("active");
      netWorthForm.reset();
      alert("Net worth has been set successfully!");
    } catch (error) {
      console.error("Failed to set net worth:", error);
      alert("Failed to set net worth. Please try again.");
    }
  });
}

// Update the editTransaction function
window.editTransaction = async function(transactionId) {
    try {
        const transaction = await transactionManager.getTransaction(transactionId);
        if (!transaction) {
            await Swal.fire({
                title: 'Not Found',
                text: 'Transaction not found.',
                icon: 'error'
            });
            return;
        }

        // Set form values
        document.getElementById('amount').value = transaction.amount;
        document.getElementById('category').value = transaction.category;
        document.getElementById('date').value = transaction.date;
        document.getElementById('note').value = transaction.note || '';

        // Set transaction type
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            if (tab.textContent.toLowerCase() === transaction.type) {
                tab.click();
            }
        });

        // Update submit button
        const submitBtn = document.querySelector('.add-expense-btn');
        submitBtn.textContent = 'Update Transaction';
        submitBtn.dataset.editId = transactionId;

        // Show success toast
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });

        await Toast.fire({
            icon: 'success',
            title: 'Transaction loaded for editing'
        });

        // Scroll to form with smooth animation
        document.querySelector('.new-transaction-section').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });

    } catch (error) {
        console.error('Failed to load transaction for editing:', error);
        await Swal.fire({
            title: 'Error!',
            text: 'Failed to load transaction for editing. Please try again.',
            icon: 'error'
        });
    }
};
