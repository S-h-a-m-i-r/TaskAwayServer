import { validationResult } from 'express-validator';
import {
  registerUser,
  loginUser,
  updateUserPassword,
  forgetUserPassword,
  resetUserPassword
} from '../services/authService.js';
import { sendEmail } from '../services/emailService.js';
import User from '../models/Users.js';

export const register = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  try {
    const user = await registerUser(req.body);
    const verifyUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${user?.token}&id=${user._id}`;
    await sendEmail(user.email, 'Verify your email', 'verify-email', {
      name: user.firstName,
      verifyUrl
    });
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res) => {
  try {
    const result = await loginUser(req.body);

    if (result.error) {
      const status = result.message.startsWith('Internal') ? 500 : 401;
      return res.status(status).json({
        success: false,
        message: result?.message,
        ...(result?.details && { details: result?.details })
      });
    }

    res.status(200).json({
      success: true,
      data: result?.userData,
      token: result?.token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Unexpected server error',
      details: error.message
    });
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
    res.status(500).json({
      success: false,
      message: 'Unexpected server error',
      details: err.message
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    await resetUserPassword(req, res);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Unexpected server error',
      details: err.message
    });
  }
};
