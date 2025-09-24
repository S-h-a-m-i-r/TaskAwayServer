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
          totalUsed: { $sum: { $abs: "$change" } } // Convert negative to positive
        }
      }
    ]);
    
    const totalCreditsUsed = totalCreditsUsedResult.length > 0 ? totalCreditsUsedResult[0].totalUsed : 0;
    
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
          monthlyUsed: { $sum: { $abs: "$change" } }
        }
      }
    ]);
    
    const creditsUsedThisMonth = creditsUsedThisMonthResult.length > 0 ? creditsUsedThisMonthResult[0].monthlyUsed : 0;
    
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
          totalRemaining: { $sum: "$remainingCredits" }
        }
      }
    ]);
    
    const remainingCreditsOverall = remainingCreditsResult.length > 0 ? remainingCreditsResult[0].totalRemaining : 0;
    
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
          expiringSoon: { $sum: "$remainingCredits" }
        }
      }
    ]);
    
    const expiringCreditsSoon = expiringCreditsResult.length > 0 ? expiringCreditsResult[0].expiringSoon : 0;
    
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

