import { validationResult } from 'express-validator';
import {
  registerUser,
  loginUser,
  updateUserPassword,
  forgetUserPassword,
  resetUserPassword
} from '../services/authService.js';
import { sendEmail } from '../services/emailService.js';
import User from '../models/User.js';

export const register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const user = await registerUser(req.body);

    // Try to send verification email, but don't fail registration if email fails
    try {
      const verifyUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${user?.token}&id=${user._id}`;
      const emailResult = await sendEmail(
        user.email,
        'Verify your email',
        'verify-email',
        {
          name: user.firstName,
          verifyUrl
        }
      );

      if (emailResult.error) {
        console.warn(
          'Email sending failed during registration:',
          emailResult.message
        );
      }
    } catch (emailError) {
      console.warn(
        'Email sending failed during registration:',
        emailError.message
      );
    }

    res.status(201).json({
      success: true,
      data: user,
      message:
        'User registered successfully. Please check your email for verification.'
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const result = await loginUser(req.body);

    res.status(200).json({
      success: true,
      user: result?.userData,
      token: result?.token
    });
  } catch (error) {
    next(error);
  }
};

export const updatePassword = async (req, res) => {
  try {
    const result = await updateUserPassword(req, res);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const result = await forgetUserPassword(req, res);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res) => {
  try {
    await resetUserPassword(req, res);
  } catch (err) {
    next(err);
  }
};
