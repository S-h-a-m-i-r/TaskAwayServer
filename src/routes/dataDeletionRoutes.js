import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  manualDeletion,
  configureScheduledDeletion,
  getDeletionSettings,
  cancelScheduledDeletion
} from '../controllers/dataDeletionController.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken);

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.'
    });
  }
  next();
};

router.use(requireAdmin);

// Manual deletion endpoint
router.post('/manual', manualDeletion);

// Scheduled deletion configuration endpoint
router.post('/scheduled', configureScheduledDeletion);

// Get deletion settings endpoint
router.get('/settings', getDeletionSettings);

// Cancel scheduled deletion endpoint
router.delete('/scheduled', cancelScheduledDeletion);

export default router;
