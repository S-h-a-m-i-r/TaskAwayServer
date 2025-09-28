import express from 'express';
import { getUserCreditsController, addCreditsController, getCreditHistoryController, getSystemCreditStatisticsController, getAllCustomersWithCreditsController } from '../controllers/creditsController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Get user's available credits
router.get('/available', authenticateToken, getUserCreditsController);

// Add credits (admin only)
router.post('/add', authenticateToken, authorizeRoles('ADMIN', 'MANAGER','CUSTOMER'), addCreditsController);

// Get credit transaction history
router.get('/history', authenticateToken, getCreditHistoryController);

// Get all customers with their credit information (admin/manager only)
router.get('/customers', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), getAllCustomersWithCreditsController);

// Get system credit statistics (admin/manager only)
router.get('/statistics', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), getSystemCreditStatisticsController);

export default router;