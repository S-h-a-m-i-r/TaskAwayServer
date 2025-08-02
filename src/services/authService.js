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
  console.log('Received paymentMethod in registerUser:', paymentMethod);
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
  console.log('the user after creation:', user);
  console.log('paymentMethod in created user:', user.paymentMethod);
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
    return res.status(404).json({ message: 'User not found' });
  }

  const token = generateVerificationToken();
  const resetUrl = `${process.env.FRONTEND_BASE_URL}/forgot-password/new-password?token=${token}&id=${user._id}`;
  await sendEmail(user.email, 'Reset your password', 'reset-password', {
    name: user.firstName,
    resetUrl
  });

  return res
    .status(200)
    .json({ token: token, message: 'Password reset email sent' });
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
  const { id } = req.query;
  const { new_password } = req.body;

  const user = await User.findOne({
    _id: id
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }
  const isSameAsLast3Passwords = await isReusedPassword(new_password, user);
  if (isSameAsLast3Passwords) {
    return res
      .status(400)
      .json({ error: 'You cannot reuse your last 3 passwords.' });
  }

  const hashed = await bcrypt.hash(new_password, 10);
  user.passwordHash = hashed;

  user.thirdLastPassword = user.secondLastPassword;
  user.secondLastPassword = user.lastPassword;
  user.lastPassword = user.passwordHash;

  await user.save();

  return res.status(200).json({ message: 'Password updated successfully.' });
};
