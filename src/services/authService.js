import User from '../models/User.js';
import {
  generateToken,
  generateVerificationToken
} from '../utils/generateToken.js';
import { verifyUserEmail, sendEmail } from './emailService.js';
import bcrypt from 'bcryptjs';
export const registerUser = async ({
  firstName,
  lastName,
  userName,
  email,
  password,
  phone,
  planType
}) => {
  const userExists = await User.findOne({ email });
  if (userExists) throw new Error('User already exists');
  const usernameCount = await User.countDocuments({ userName });
  if (usernameCount >= 2) {
    throw new Error('Only two users can have the same username.');
  }
  const user = await User.create({
    firstName,
    lastName,
    userName,
    email,
    passwordHash: password,
    phone,
    planType
  });
  await user.save();
  return {
    _id: user._id,
    userName: user?.userName,
    email: user?.email,
    token: generateVerificationToken()
  };
};

export const loginUser = async ({ email, password }) => {
  try {
    const checkEmail = email.toLowerCase();

    const user = await User.findOne({ email: checkEmail });
    if (!user) {
      return { error: true, message: 'Invalid credentials: user not found.' };
    }

    if (!user.isEmailVerified) {
      return { error: true, message: 'Please verify your email address.' };
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return {
        error: true,
        message: 'Invalid credentials: incorrect password.'
      };
    }

    const { passwordHash, ...userData } = user.toObject?.() ?? user.toJSON();

    return {
      error: false,
      userData,
      token: generateToken(user._id, user?.role)
    };
  } catch (err) {
    console.error('Login error:', err);
    return {
      error: true,
      message: 'Internal server error',
      details: err.message
    };
  }
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
  await verifyUserEmail(req, res);
  return res.status(200).json({ message: 'Email verified successfully!' });
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
