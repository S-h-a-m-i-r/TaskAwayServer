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
import { sendEmail } from '../services/emailService.js';

const router = express.Router();

router.post('/register', validateRegister, register);

router.post('/login', login);
router.post(
  '/forget-password',
  body('email').isEmail().withMessage('Invalid email'),
  forgotPassword
);

router.post(
  '/reset-password',
  body('new_password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  resetPassword
);
router.get('/verify-email', verifyEmail);

// Test email endpoint for debugging
router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await sendEmail(email, 'Test Email', 'reset-password', {
      name: 'Test User',
      resetUrl: 'https://example.com/test'
    });

    if (result.error) {
      return res.status(500).json({ error: result.message });
    }

    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
