import { getUserCredits, addCredits, getCreditHistory } from '../services/creditsService.js';

export async function getUserCreditsController(req, res) {
  try {
    const userId = req.user._id;
    const credits = await getUserCredits(userId);
    
    res.status(200).json({
      success: true,
      data: credits
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
}

export async function addCreditsController(req, res) {
  try {
    const { userId, amount } = req.body;
    
    // Only admin can add credits to any user
    if (req.user.role !== 'ADMIN' && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to add credits for other users'
      });
    }
    
    const credit = await addCredits(userId, amount);
    
    res.status(201).json({
      success: true,
      data: credit
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
}

export async function getCreditHistoryController(req, res) {
  try {
    const userId = req.user._id;
    const transactions = await getCreditHistory(userId);
    
    res.status(200).json({
      success: true,
      data: transactions
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
}