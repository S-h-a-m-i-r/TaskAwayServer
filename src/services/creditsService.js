import Credit from "../models/Credit.js";
import CreditTransaction from "../models/CreditTransaction.js";
import User from "../models/User.js";
import Transaction from '../models/transaction.js';

/**
 * Give credits to a user
 */
export async function addCredits(userId, amount, reason = 'Purchase') {
  const creditBatch = await Credit.create({
    user: userId,
    totalCredits: amount,
    remainingCredits: amount,
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
  });

  await CreditTransaction.create({
    user: userId,
    creditBatch: creditBatch._id,
    change: amount,
    reason
  });

  return creditBatch;
}

export async function deductCredits(userId, taskId, creditCost, creditBatches) {
  try {
    let remainingCost = creditCost;

    for (const batch of creditBatches) {
      if (remainingCost <= 0) break;

      const deduct = Math.min(batch.remainingCredits, remainingCost);

      batch.remainingCredits -= deduct;
      await batch.save();

      await CreditTransaction.create({
        user: userId,
        task: taskId,
        creditBatch: batch._id,
        change: -deduct,
        reason: 'Task Creation'
      });

      remainingCost -= deduct;
    }

    return { success: true, deducted: creditCost };
  } catch (error) {
    console.error(' Error deducting credits:', error.message);

    throw {
      success: false,
      message: error.message || 'Failed to deduct credits',
      code: error.code || 'CREDIT_DEDUCTION_ERROR',
      availableCredits: error.availableCredits || 0,
      requiredCredits: error.requiredCredits || creditCost
    };
  }
}

export async function getUserCredits(userId) {
  try {
    // Find all non-expired credits
    const now = new Date();
    const credits = await Credit.find({
      user: userId,
      expiresAt: { $gt: now },
      remainingCredits: { $gt: 0 }
    }).sort({ expiresAt: 1 });

    // Calculate total available credits
    const totalAvailable = credits.reduce(
      (sum, credit) => sum + credit.remainingCredits,
      0
    );

    // Get credits expiring soon (in the next 7 days)
    const oneWeekFromNow = new Date(now);
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

    const expiringSoon = credits
      .filter((credit) => credit.expiresAt <= oneWeekFromNow)
      .reduce((sum, credit) => sum + credit.remainingCredits, 0);

    // Get recently spent credits (last 30 days)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = await CreditTransaction.find({
      user: userId, // Note: Changed from userId to user to match your schema
      change: { $lt: 0 }, // Changed to less than 0 to find spent credits
      createdAt: { $gte: thirtyDaysAgo } // Added date filter for "recent"
    });

    // Use Math.abs to convert negative values to positive for the sum
    const recentlySpent = recentTransactions.reduce(
      (sum, transaction) => sum + Math.abs(transaction.change),
      0
    );
    return {
      totalAvailable,
      expiringSoon,
      recentlySpent,
      creditDetails: credits
    };
  } catch (err) {
    console.error('Error fetching user credits:', err);
    throw new Error('Failed to fetch user credits');
  }
}

// Get credit transaction history
export async function getCreditHistory(userId) {
  try {
    const transactions = await CreditTransaction.find({ user: userId })
      .populate('task', 'title')
      .sort({ createdAt: -1 });

    return transactions;
  } catch (err) {
    console.error('Error fetching credit history:', err);
    throw new Error('Failed to fetch credit history');
  }
}

// Get system-wide credit statistics (admin/manager only)
export async function getSystemCreditStatistics() {
  try {
    const now = new Date();

    // Calculate total credits used so far (all negative transactions)
    const totalCreditsUsedResult = await CreditTransaction.aggregate([
      {
        $match: {
          change: { $lt: 0 } // Only negative transactions (credits spent)
        }
      },
      {
        $group: {
          _id: null,
          totalUsed: { $sum: { $abs: '$change' } } // Convert negative to positive
        }
      }
    ]);

    const totalCreditsUsed =
      totalCreditsUsedResult.length > 0
        ? totalCreditsUsedResult[0].totalUsed
        : 0;

    // Calculate credits used this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const creditsUsedThisMonthResult = await CreditTransaction.aggregate([
      {
        $match: {
          change: { $lt: 0 }, // Only negative transactions
          createdAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          monthlyUsed: { $sum: { $abs: '$change' } }
        }
      }
    ]);

    const creditsUsedThisMonth =
      creditsUsedThisMonthResult.length > 0
        ? creditsUsedThisMonthResult[0].monthlyUsed
        : 0;

    // Calculate remaining credits overall (all non-expired credits)
    const remainingCreditsResult = await Credit.aggregate([
      {
        $match: {
          expiresAt: { $gt: now },
          remainingCredits: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          totalRemaining: { $sum: '$remainingCredits' }
        }
      }
    ]);

    const remainingCreditsOverall =
      remainingCreditsResult.length > 0
        ? remainingCreditsResult[0].totalRemaining
        : 0;

    // Calculate expiring credits soon (next 30 days)
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringCreditsResult = await Credit.aggregate([
      {
        $match: {
          expiresAt: { $gt: now, $lte: thirtyDaysFromNow },
          remainingCredits: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          expiringSoon: { $sum: '$remainingCredits' }
        }
      }
    ]);

    const expiringCreditsSoon =
      expiringCreditsResult.length > 0
        ? expiringCreditsResult[0].expiringSoon
        : 0;

    return {
      totalCreditsUsed,
      creditsUsedThisMonth,
      remainingCreditsOverall,
      expiringCreditsSoon
    };
  } catch (err) {
    console.error('Error fetching system credit statistics:', err);
    throw new Error('Failed to fetch system credit statistics');
  }
}

// Get all customers with their credit information
export async function getAllCustomersWithCredits() {
  try {
    const now = new Date();

    // Get all users with role 'CUSTOMER'
    const customers = await User.find({ role: 'CUSTOMER' })
      .select('firstName lastName email planType phone createdAt lastLogin')
      .sort({ createdAt: -1 });

    // Get credit data for all customers
    const customerIds = customers.map((customer) => customer._id);

    // Get all credits for these customers (including expired and used up credits)
    const credits = await Credit.find({
      user: { $in: customerIds }
    }).sort({ expiresAt: 1 });

    // Get all credit transactions for purchase history (all positive transactions)
    const purchaseTransactions = await CreditTransaction.find({
      user: { $in: customerIds },
      change: { $gt: 0 } // All positive transactions (purchases, admin additions, subscriptions, etc.)
    }).sort({ createdAt: -1 });

    // Group credits by user
    const creditsByUser = {};
    credits.forEach((credit) => {
      if (!creditsByUser[credit.user.toString()]) {
        creditsByUser[credit.user.toString()] = [];
      }
      creditsByUser[credit.user.toString()].push(credit);
    });

    // Group purchase transactions by user
    const purchasesByUser = {};
    purchaseTransactions.forEach((transaction) => {
      if (!purchasesByUser[transaction.user.toString()]) {
        purchasesByUser[transaction.user.toString()] = [];
      }
      purchasesByUser[transaction.user.toString()].push(transaction);
    });

    // Calculate data for each customer
    const customersWithCredits = customers.map((customer) => {
      const customerId = customer._id.toString();
      const customerCredits = creditsByUser[customerId] || [];
      const customerPurchases = purchasesByUser[customerId] || [];

      // Calculate total purchased credits (sum of all positive transactions)
      const totalPurchasedCredits = customerPurchases.reduce(
        (sum, transaction) => sum + transaction.change,
        0
      );

      // Alternative calculation: sum of all credit batches (this should match the transaction total)
      const totalCreditsFromBatches = customerCredits.reduce(
        (sum, credit) => sum + credit.totalCredits,
        0
      );

      // Use the higher value to ensure we don't miss any credits
      const finalTotalPurchasedCredits = Math.max(
        totalPurchasedCredits,
        totalCreditsFromBatches
      );

      // Calculate total remaining credits (only non-expired credits with remaining > 0)
      const now = new Date();
      const totalRemainingCredits = customerCredits
        .filter(
          (credit) => credit.expiresAt > now && credit.remainingCredits > 0
        )
        .reduce((sum, credit) => sum + credit.remainingCredits, 0);

      // Calculate total spent credits (total purchased - total remaining)
      const totalSpentCredits =
        finalTotalPurchasedCredits - totalRemainingCredits;

      // Calculate credits expiring soon (next 7 days)
      const oneWeekFromNow = new Date(now);
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

      const expiringSoonCredits = customerCredits
        .filter(
          (credit) =>
            credit.expiresAt > now &&
            credit.expiresAt <= oneWeekFromNow &&
            credit.remainingCredits > 0
        )
        .reduce((sum, credit) => sum + credit.remainingCredits, 0);

      // Get last purchase date
      const lastPurchaseDate =
        customerPurchases.length > 0 ? customerPurchases[0].createdAt : null;

      // Get earliest expiry date
      const earliestExpiryDate =
        customerCredits.length > 0 ? customerCredits[0].expiresAt : null;

      return {
        customerId: customer._id,
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerPlanType: customer.planType,
        totalPurchasedCredits: finalTotalPurchasedCredits,
        totalRemainingCredits,
        totalSpentCredits,
        expiringSoonCredits,
        lastPurchaseDate,
        earliestExpiryDate,
        lastLogin: customer.lastLogin || null,
        creditBatches: customerCredits.map((credit) => ({
          batchId: credit._id,
          totalCredits: credit.totalCredits,
          remainingCredits: credit.remainingCredits,
          expiresAt: credit.expiresAt,
          createdAt: credit.createdAt
        }))
      };
    });

    return customersWithCredits;
  } catch (err) {
    console.error('Error fetching customers with credits:', err);
    throw new Error('Failed to fetch customers with credits');
  }
}

/**
 * Get revenue over time grouped by month
 * Returns revenue data for the last 6 months
 */
export async function getRevenueOverTime() {
  try {
    const now = new Date();
    // Calculate date for 6 months ago
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get all completed transactions (credit purchases and subscriptions) from last 6 months
    const transactions = await Transaction.find({
      status: 'completed',
      transactionType: { $in: ['credit_purchase', 'subscription'] },
      createdAt: { $gte: sixMonthsAgo }
    }).sort({ createdAt: 1 });

    // Group transactions by month
    const monthlyRevenue = {};
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];

    transactions.forEach((transaction) => {
      const date = new Date(transaction.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = `${monthNames[date.getMonth()]}`;

      if (!monthlyRevenue[monthKey]) {
        monthlyRevenue[monthKey] = {
          month: monthLabel,
          revenue: 0,
          date: date
        };
      }
      monthlyRevenue[monthKey].revenue += transaction.amount || 0;
    });

    // Get last 6 months in order
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = monthNames[date.getMonth()];

      last6Months.push({
        month: monthLabel,
        revenue: monthlyRevenue[monthKey]?.revenue || 0
      });
    }

    // Calculate total revenue
    const totalRevenue = last6Months.reduce(
      (sum, month) => sum + month.revenue,
      0
    );

    // Calculate percentage change (compare last 6 months to previous 6 months)
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const previousPeriodTransactions = await Transaction.find({
      status: 'completed',
      transactionType: { $in: ['credit_purchase', 'subscription'] },
      createdAt: { $gte: twelveMonthsAgo, $lt: sixMonthsAgo }
    });

    const previousPeriodRevenue = previousPeriodTransactions.reduce(
      (sum, tx) => sum + (tx.amount || 0),
      0
    );

    let percentageChange = 0;
    if (previousPeriodRevenue > 0) {
      percentageChange =
        ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100;
    } else if (totalRevenue > 0) {
      percentageChange = 100; // 100% increase from 0
    }

    return {
      monthlyData: last6Months,
      totalRevenue: Math.round(totalRevenue * 100) / 100, // Round to 2 decimal places
      percentageChange: Math.round(percentageChange * 100) / 100, // Round to 2 decimal places
      period: 'Last 6 Months'
    };
  } catch (err) {
    console.error('Error fetching revenue over time:', err);
    throw new Error('Failed to fetch revenue over time');
  }
}

