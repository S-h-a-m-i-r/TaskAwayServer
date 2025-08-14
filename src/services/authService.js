import User from '../models/User.js';
import {
  generateToken,
  generateVerificationToken
} from '../utils/generateToken.js';
import { verifyUserEmail, sendEmail } from './emailService.js';
import bcrypt from 'bcryptjs';
import { createError } from '../utils/AppError.js';
export const registerUser = async ({
  firstName,
  lastName,
  userName,
  email,
  password,
  phone,
  planType,
  paymentMethod
}) => {
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw createError.conflict('Email already exists', {
      field: 'email',
      value: email
    });
  }

  // Check if username already exists (only if username is provided)
  if (userName) {
    const userCount = await User.countDocuments({ userName });
    if (userCount >= 2) {
      throw createError.conflict('Username already taken', {
        field: 'userName',
        value: userName
      });
    }
  }

  const user = await User.create({
    firstName,
    lastName,
    userName,
    email,
    passwordHash: password,
    phone,
    planType,
    paymentMethod
  });
  return {
    _id: user._id,
    userName: user?.userName,
    email: user?.email,
    paymentMethod: user?.paymentMethod,
    token: generateVerificationToken()
  };
};

export const loginUser = async ({ email, password }) => {
  const checkEmail = email.toLowerCase();

  const user = await User.findOne({ email: checkEmail });
  if (!user) {
    throw createError.unauthorized('Invalid credentials: user not found');
  }

  if (!user.isEmailVerified) {
    throw createError.unauthorized(
      'Please verify your email address before logging in'
    );
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    throw createError.unauthorized('Invalid credentials: incorrect password');
  }

  const { passwordHash, ...userData } = user.toObject?.() ?? user.toJSON();

  return {
    error: false,
    userData,
    token: generateToken(user._id, user?.role)
  };
};

export const forgetUserPassword = async (req, res) => {
  const { email } = req?.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw createError.notFound('User not found');
  }

  const token = generateVerificationToken();
  const resetUrl = `${process.env.FRONTEND_BASE_URL}/forgot-password/new-password?token=${token}`;
  
  // Store the reset token and expiration in the database
  user.passwordResetToken = token;
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiration
  await user.save();
  
  await sendEmail(user.email, 'Reset your password', 'reset-password', {
    name: user.firstName,
    resetUrl
  });

  return { message: 'Password reset email sent' };
};

export const updateUserPassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req?.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch)
      return res.status(400).json({ error: 'Current password is incorrect' });

    const isSameAsLast3Passwords = isReusedPassword(newPassword, user);
    if (isSameAsLast3Passwords) {
      return res
        .status(400)
        .json({ error: 'You cannot reuse your last 3 passwords.' });
    }

    user.thirdLastPassword = user.secondLastPassword;
    user.secondLastPassword = user.lastPassword;
    user.lastPassword = user.passwordHash;

    const hashed = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hashed;

    await user.save();

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyEmail = async (req, res) => {
  const { token, id } = req.query;

  const user = await User.findOne({
    _id: id
  });

  if (!user) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }

  user.isEmailVerified = true;
  await user.save();

  return res.status(200).json({
    success: true,
    message: 'Email verified successfully!'
  });
};

export const isReusedPassword = async (newPassword, user) => {
  if (!newPassword || typeof newPassword !== 'string') {
    throw new Error('New password is required and must be a string');
  }

  const safeCompare = async (hash) => {
    return typeof hash === 'string' && hash.startsWith('$2')
      ? bcrypt.compare(newPassword, hash)
      : false;
  };
  const checks = await Promise.all([
    safeCompare(user?.lastPassword),
    safeCompare(user?.secondLastPassword),
    safeCompare(user?.thirdLastPassword)
  ]);
  return checks.some(Boolean);
};

export const resetUserPassword = async (req, res) => {
  const { token } = req.query; 
  const { password } = req.body;

  if (!token) {
    throw createError.badRequest('Reset token is required');
  }

  // Find user by token only - no need for user ID
  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw createError.badRequest('Invalid or expired reset token');
  }
  const hashed = await bcrypt.hash(password, 10);
  // Check if new password is not the same as last 3 passwords
  const isSameAsLast3Passwords = await isReusedPassword(password, user);
  if (isSameAsLast3Passwords) {
    throw createError.badRequest('You cannot reuse your last 3 passwords.');
  }

  // 1. FIRST save the current password to history
  user.thirdLastPassword = user.secondLastPassword;     // Move down
  user.secondLastPassword = user.lastPassword;          // Move down  
  user.lastPassword = user.passwordHash;                // Save current as previous

  // 2. THEN set the new password
  
  user.passwordHash = hashed;  // Set new current password
  
  // Clear the reset token and expiration after successful reset
  user.passwordResetToken = null;
  user.passwordResetExpires = null;

  await user.save();

  // Return data instead of sending response
  return {
    success: true,
    message: 'Password updated successfully.'
  };
};
