import express from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  forgotPassword,
  resetPassword
} from '../controllers/authController.js';
import { validateRegister } from '../middleware/validateRegister.js';
import { verifyEmail } from '../services/authService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', validateRegister, register);

router.post('/login', login);
router.post(
  '/forget-password',
  body('email').isEmail().withMessage('Invalid email'),
  forgotPassword
);

router.post('/reset-password', resetPassword);
router.get('/verify-email', verifyEmail);

export default router;
