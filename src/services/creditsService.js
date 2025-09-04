import Credit from "../models/Credit.js";
import CreditTransaction from "../models/CreditTransaction.js";

/**
 * Give credits to a user
 */
export async function addCredits(userId, amount, reason = "Purchase") {
    const creditBatch = await Credit.create({
    user: userId,
    totalCredits: amount,
    remainingCredits: amount,
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), 
  });

  await CreditTransaction.create({
    user: userId,
    creditBatch: creditBatch._id,
    change: amount,
    reason,
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
          reason: "Task Creation",
        });
  
        remainingCost -= deduct;
      }
  
      return { success: true, deducted: creditCost };
    } catch (error) {
      console.error(" Error deducting credits:", error.message);
  
      throw {
        success: false,
        message: error.message || "Failed to deduct credits",
        code: error.code || "CREDIT_DEDUCTION_ERROR",
        availableCredits: error.availableCredits || 0,
        requiredCredits: error.requiredCredits || creditCost,
      };
    }
  }



  export async function getUserCredits(userId) {
    try {
      // Find all non-expired credits
      const now = new Date();
      const credits = await Credit.find({
        user:userId,
        expiresAt: { $gt: now },
        remainingCredits: { $gt: 0 }
      }).sort({ expiresAt: 1 });
      
      // Calculate total available credits
      const totalAvailable = credits.reduce((sum, credit) => sum + credit.remainingCredits, 0);
      
      // Get credits expiring soon (in the next 7 days)
      const oneWeekFromNow = new Date(now);
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
      
      const expiringSoon = credits.filter(credit => 
        credit.expiresAt <= oneWeekFromNow
      ).reduce((sum, credit) => sum + credit.remainingCredits, 0);
      
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
      const transactions = await CreditTransaction.find({ userId })
        .populate('taskId', 'title')
        .sort({ transactionDate: -1 });
        
      return transactions;
    } catch (err) {
      console.error('Error fetching credit history:', err);
      throw new Error('Failed to fetch credit history');
    }
}
