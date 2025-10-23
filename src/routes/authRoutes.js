import express from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  googleAuth
} from '../controllers/authController.js';
import { validateRegister } from '../middleware/validateRegister.js';
import { validatePasswordReset } from '../middleware/validatePasswordReset.js';
import { verifyEmail } from '../services/authService.js';

const router = express.Router();

router.post('/register', validateRegister, register);

router.post('/login', login);
router.post(
  '/forget-password',
  body('email').isEmail().withMessage('Invalid email'),
  forgotPassword
);

router.post('/reset-password', validatePasswordReset, resetPassword);
router.get('/verify-email', verifyEmail);
router.post('/google', googleAuth);

export default router;
