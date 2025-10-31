import express from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  googleAuth,
  logout
} from '../controllers/authController.js';
import { validateRegister } from '../middleware/validateRegister.js';
import { validatePasswordReset } from '../middleware/validatePasswordReset.js';
import { verifyEmail } from '../services/authService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Strict rate limiter for authentication endpoints - 5 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Limit each IP to 5 requests per windowMs (login, register, etc.)
  message: {
    success: false,
    message:
      'Too many authentication attempts, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful requests
});

// Apply strict rate limiting to authentication endpoints
router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, login);
router.post(
  '/forget-password',
  authLimiter,
  body('email').isEmail().withMessage('Invalid email'),
  forgotPassword
);
router.post(
  '/reset-password',
  authLimiter,
  validatePasswordReset,
  resetPassword
);
router.get('/verify-email', authLimiter, verifyEmail);
router.post('/google', authLimiter, googleAuth);
router.post('/logout', authenticateToken, logout);

export default router;
