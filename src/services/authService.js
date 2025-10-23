import User from '../models/User.js';
import {
  generateToken,
  generateVerificationToken
} from '../utils/generateToken.js';
import { sendEmail } from './emailService.js';
import bcrypt from 'bcryptjs';
import { createError } from '../utils/AppError.js';
import Stripe from 'stripe';
import { OAuth2Client } from 'google-auth-library';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
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
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    firstName,
    lastName,
    userName,
    email,
    passwordHash: hashedPassword,
    phone,
    planType,
    paymentMethod
  });

  if (user.planType === '10_CREDITS' && user.paymentMethod) {
    try {
      // Create or get customer in Stripe
      let customer;
      if (!user.paymentMethod.customerId) {
        // Create a new customer in Stripe
        customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          phone: user.phone,
          metadata: {
            userId: user._id.toString()
          }
        });

        // Save the Stripe customer ID to the user
        user.paymentMethod.customerId = customer.id;
      } else {
        // Get existing customer
        customer = await stripe.customers.retrieve(
          user.paymentMethod.customerId
        );
      }
      await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: process.env.STRIPE_10_CREDITS_PRICE_ID }],
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId: user._id.toString(),
          planType: user.planType
        }
      });
    } catch (stripeError) {
      console.error('Stripe subscription creation failed:', stripeError);
      // Continue with verification even if subscription fails
      // We'll handle subscription issues separately
    }
  }
  await user.save();
  return {
    _id: user._id,
    userName: user?.userName,
    email: user?.email,
    paymentMethod: user.paymentMethod,
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
    token: generateToken(user._id, user.role)
  };
};

export const forgetUserPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    throw createError.notFound('User not found');
  }

  const resetToken = generateVerificationToken();
  const resetUrl = `${process.env.FRONTEND_BASE_URL}/forgot-password/new-password?token=${resetToken}`;

  // Store the reset token and expiration in the database
  user.passwordResetToken = resetToken;
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
    const { currentPassword, newPassword } = req.body;

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
  const { id } = req.query;

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
  user.thirdLastPassword = user.secondLastPassword; // Move down
  user.secondLastPassword = user.lastPassword; // Move down
  user.lastPassword = user.passwordHash; // Save current as previous

  // 2. THEN set the new password

  user.passwordHash = hashed; // Set new current password

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

const verifyGoogleToken = async (token) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw createError.unauthorized('Invalid Google token');
  }

  const { email, given_name, family_name, name } = payload;

  if (!email) {
    throw createError.unauthorized('Email not provided by Google');
  }

  return { email, given_name, family_name, name };
};

const handleGoogleTokenError = (error) => {
  console.error('Google OAuth error:', error);

  if (
    error.name === 'Error' &&
    error.message.includes('Token used too early')
  ) {
    throw createError.unauthorized('Google token is not yet valid');
  }

  if (error.name === 'Error' && error.message.includes('Token used too late')) {
    throw createError.unauthorized('Google token has expired');
  }

  if (
    error.name === 'Error' &&
    error.message.includes('Invalid token signature')
  ) {
    throw createError.unauthorized('Invalid Google token signature');
  }

  // Re-throw known errors
  if (error.statusCode) {
    throw error;
  }

  // Handle unknown errors
  throw createError.internalServerError('Google authentication failed');
};

export const googleAuthUser = async ({ token }) => {
  try {
    if (!token) {
      throw createError.badRequest('Google token is required');
    }

    // Verify the Google token
    const { email } = await verifyGoogleToken(token);

    // Check if user exists in database
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // User doesn't exist, create new user
      return {
        error: true,
        message: 'User not found',
        userData: null,
        token: null
      };
    } else if (!user.isEmailVerified) {
      // User exists, update email verification status if needed
      user.isEmailVerified = true;
      await user.save();
    }

    // Remove sensitive data
    const { passwordHash, ...userData } = user.toObject();

    return {
      error: false,
      userData,
      token: generateToken(user._id, user.role)
    };
  } catch (error) {
    handleGoogleTokenError(error);
  }
};
