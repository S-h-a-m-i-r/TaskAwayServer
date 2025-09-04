import express from 'express';
import { getUserCreditsController, addCreditsController, getCreditHistoryController } from '../controllers/creditsController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Get user's available credits
router.get('/available', authenticateToken, getUserCreditsController);

// Add credits (admin only)
router.post('/add', authenticateToken, addCreditsController);

// Get credit transaction history
router.get('/history', authenticateToken, getCreditHistoryController);

export default router;