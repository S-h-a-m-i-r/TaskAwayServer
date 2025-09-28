import { getUserCredits, addCredits, getCreditHistory, getSystemCreditStatistics, getAllCustomersWithCredits } from '../services/creditsService.js';

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
    const { userId, amount, reason = 'Purchase' } = req.body;
    
    
    const credit = await addCredits(userId, amount, reason);
    
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

export async function getSystemCreditStatisticsController(req, res) {
  try {
    const statistics = await getSystemCreditStatistics();
    
    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
}

export async function getAllCustomersWithCreditsController(req, res) {
  try {
    const customers = await getAllCustomersWithCredits();
    
    res.status(200).json({
      success: true,
      data: customers,
      count: customers.length
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
}