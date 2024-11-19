import { db } from "./firebase-config.js";

export class TransactionManager {
  constructor(userId) {
    this.userId = userId;
    this.transactionsRef = db.ref(`users/${userId}/transactions`);
    this.walletRef = db.ref(`users/${userId}/wallet`);
  }

  async addTransaction(transaction) {
    const newTransaction = {
      ...transaction,
      id: crypto.randomUUID(),
    };

    const amount =
      transaction.type === "expense" ? -transaction.amount : transaction.amount;
    await this.updateWalletBalance(amount);

    await this.transactionsRef.push(newTransaction);
    return newTransaction;
  }

  async getAllTransactions() {
    const snapshot = await this.transactionsRef.once("value");
    return Object.values(snapshot.val() || {});
  }

  async getTransaction(transactionId) {
    const snapshot = await this.transactionsRef
      .orderByChild("id")
      .equalTo(transactionId)
      .once("value");
    const data = snapshot.val();
    return data ? Object.values(data)[0] : null;
  }

  async updateTransaction(transactionId, updates) {
    try {
      const snapshot = await this.transactionsRef
        .orderByChild("id")
        .equalTo(transactionId)
        .once("value");
      const data = snapshot.val();
      if (!data) return null;

      const key = Object.keys(data)[0];
      const oldTransaction = data[key];

      // Calculate balance adjustment
      const oldAmount =
        oldTransaction.type === "expense"
          ? -oldTransaction.amount
          : oldTransaction.amount;
      const newAmount =
        updates.type === "expense" ? -updates.amount : updates.amount;
      const balanceAdjustment = newAmount - oldAmount;

      // Update wallet balance
      await this.updateWalletBalance(balanceAdjustment);

      // Update transaction
      await this.transactionsRef.child(key).update(updates);
      return { ...oldTransaction, ...updates };
    } catch (error) {
      console.error("Failed to update transaction:", error);
      throw error;
    }
  }

  async deleteTransaction(transactionId) {
    try {
      // First get the transaction details to adjust the wallet balance
      const snapshot = await this.transactionsRef
        .orderByChild("id")
        .equalTo(transactionId)
        .once("value");

      const data = snapshot.val();
      if (!data) return false;

      const key = Object.keys(data)[0];
      const transaction = data[key];

      // Calculate the amount to adjust the wallet balance
      const adjustmentAmount =
        transaction.type === "expense"
          ? transaction.amount // Add back expense amount
          : -transaction.amount; // Subtract income amount

      // Update wallet balance first
      await this.updateWalletBalance(adjustmentAmount);

      // Then delete the transaction
      await this.transactionsRef.child(key).remove();

      return true;
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      throw error;
    }
  }

  async updateWalletBalance(amount) {
    const snapshot = await this.walletRef.once("value");
    const currentBalance = snapshot.val()?.balance || 0;

    await this.walletRef.set({
      balance: currentBalance + amount,
      lastUpdated: new Date().toISOString(),
    });

    return currentBalance + amount;
  }

  async getWalletBalance() {
    const snapshot = await this.walletRef.once("value");
    const walletData = snapshot.val();
    return {
      current: walletData?.balance || 0,
      initial: walletData?.initialBalance || 0,
      lastUpdated: walletData?.lastUpdated,
    };
  }

  async setInitialNetWorth(amount) {
    try {
      await this.walletRef.set({
        balance: amount,
        initialBalance: amount,
        lastUpdated: new Date().toISOString(),
      });
      return amount;
    } catch (error) {
      console.error("Failed to set initial net worth:", error);
      throw error;
    }
  }

  // For real-time updates
  subscribeToTransactions(callback) {
    this.onTransactionsChange = callback;
    this.transactionsRef.on("value", async (snapshot) => {
      const transactions = snapshot.val() ? Object.values(snapshot.val()) : [];
      callback(transactions);
    });
  }

  unsubscribeFromTransactions() {
    this.transactionsRef.off("value");
    this.onTransactionsChange = null;
  }

  // Get transactions with filtering and pagination
  async getFilteredTransactions({
    startDate,
    endDate,
    type,
    category,
    limit = 50,
    offset = 0,
  }) {
    try {
      let query = this.transactionsRef;

      if (startDate && endDate) {
        query = query.orderByChild("date").startAt(startDate).endAt(endDate);
      }

      const snapshot = await query.once("value");
      let transactions = Object.values(snapshot.val() || {});

      // Apply filters
      if (type) {
        transactions = transactions.filter((t) => t.type === type);
      }
      if (category) {
        transactions = transactions.filter((t) => t.category === category);
      }

      // Sort by date (most recent first)
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Apply pagination
      return transactions.slice(offset, offset + limit);
    } catch (error) {
      console.error("Failed to fetch filtered transactions:", error);
      throw error;
    }
  }

  // Get transaction statistics
  async getTransactionStats(startDate, endDate) {
    try {
      const transactions = await this.getFilteredTransactions({
        startDate,
        endDate,
      });

      return transactions.reduce(
        (stats, transaction) => {
          const amount = transaction.amount;
          if (transaction.type === "expense") {
            stats.totalExpenses += amount;
            stats.expensesByCategory[transaction.category] =
              (stats.expensesByCategory[transaction.category] || 0) + amount;
          } else if (transaction.type === "income") {
            stats.totalIncome += amount;
            stats.incomeByCategory[transaction.category] =
              (stats.incomeByCategory[transaction.category] || 0) + amount;
          }
          return stats;
        },
        {
          totalIncome: 0,
          totalExpenses: 0,
          expensesByCategory: {},
          incomeByCategory: {},
        }
      );
    } catch (error) {
      console.error("Failed to get transaction statistics:", error);
      throw error;
    }
  }

  // Add this method to the TransactionManager class
  async getTotalTransactionsCount(filters = {}) {
    try {
      const transactions = await this.getFilteredTransactions({
        ...filters,
        limit: 1000000, // High number to get all transactions
        offset: 0,
      });
      return transactions.length;
    } catch (error) {
      console.error("Failed to get total transactions count:", error);
      return 0;
    }
  }
}
