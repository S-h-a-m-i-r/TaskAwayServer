import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import app from '../src/server.js';
import User from '../src/models/User.js';
import { sendEmail } from '../src/services/emailService.js';

// Mock the email service
jest.mock('../src/services/emailService.js');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  jest.clearAllMocks();
});

describe('Forgot Password Tests', () => {
  let testUser;

  beforeEach(async () => {
    // Create a test user
    testUser = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      passwordHash: 'hashedPassword123',
      phone: '1234567890',
      isEmailVerified: true
    });
  });

  describe('POST /api/auth/forget-password', () => {
    it('should send reset email for valid email', async () => {
      // Mock successful email sending
      sendEmail.mockResolvedValue({ messageId: 'test-message-id' });

      const response = await request(app)
        .post('/api/auth/forget-password')
        .send({ email: 'john.doe@example.com' })
        .expect(200);

      expect(response.body.message).toBe('Password reset email sent successfully');
      
      // Verify user was updated with reset token
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.resetPasswordToken).toBeDefined();
      expect(updatedUser.resetPasswordExpires).toBeDefined();
      expect(updatedUser.resetPasswordExpires.getTime()).toBeGreaterThan(Date.now());

      // Verify email was sent
      expect(sendEmail).toHaveBeenCalledWith(
        'john.doe@example.com',
        'Reset your password',
        'reset-password',
        expect.objectContaining({
          name: 'John',
          resetUrl: expect.stringContaining('forgot-password/new-password')
        })
      );
    });

    it('should return 404 for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/forget-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(404);

      expect(response.body.message).toBe('User not found');
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/forget-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should handle email sending failure gracefully', async () => {
      // Mock email sending failure
      sendEmail.mockRejectedValue(new Error('SMTP connection failed'));

      const response = await request(app)
        .post('/api/auth/forget-password')
        .send({ email: 'john.doe@example.com' })
        .expect(500);

      expect(response.body.message).toBe('Failed to send reset email. Please try again.');

      // Verify reset token was removed after email failure
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.resetPasswordToken).toBeUndefined();
      expect(updatedUser.resetPasswordExpires).toBeUndefined();
    });

    it('should handle case-insensitive email lookup', async () => {
      sendEmail.mockResolvedValue({ messageId: 'test-message-id' });

      const response = await request(app)
        .post('/api/auth/forget-password')
        .send({ email: 'JOHN.DOE@EXAMPLE.COM' })
        .expect(200);

      expect(response.body.message).toBe('Password reset email sent successfully');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let resetToken;
    let resetUrl;

    beforeEach(async () => {
      // Set up user with reset token
      resetToken = 'test-reset-token-123';
      const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
      
      await User.findByIdAndUpdate(testUser._id, {
        resetPasswordToken: resetToken,
        resetPasswordExpires: tokenExpiry
      });

      resetUrl = `${process.env.FRONTEND_BASE_URL}/forgot-password/new-password?token=${resetToken}&id=${testUser._id}`;
    });

    it('should reset password with valid token and id', async () => {
      const newPassword = 'newPassword123';

      const response = await request(app)
        .post(`/api/auth/reset-password?token=${resetToken}&id=${testUser._id}`)
        .send({ new_password: newPassword })
        .expect(200);

      expect(response.body.message).toBe('Password updated successfully.');

      // Verify password was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.resetPasswordToken).toBeUndefined();
      expect(updatedUser.resetPasswordExpires).toBeUndefined();
      
      // Verify password hash was updated (should be different)
      expect(updatedUser.passwordHash).not.toBe(testUser.passwordHash);
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app)
        .post(`/api/auth/reset-password?token=invalid-token&id=${testUser._id}`)
        .send({ new_password: 'newPassword123' })
        .expect(400);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('should return 400 for expired token', async () => {
      // Set expired token
      const expiredToken = 'expired-token';
      const expiredTime = new Date(Date.now() - 60 * 1000); // 1 minute ago
      
      await User.findByIdAndUpdate(testUser._id, {
        resetPasswordToken: expiredToken,
        resetPasswordExpires: expiredTime
      });

      const response = await request(app)
        .post(`/api/auth/reset-password?token=${expiredToken}&id=${testUser._id}`)
        .send({ new_password: 'newPassword123' })
        .expect(400);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('should return 400 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .post(`/api/auth/reset-password?token=${resetToken}&id=${fakeId}`)
        .send({ new_password: 'newPassword123' })
        .expect(400);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('should prevent password reuse (last 3 passwords)', async () => {
      // Set up user with password history
      const oldPassword = 'oldPassword123';
      const hashedOldPassword = await bcrypt.hash(oldPassword, 10);
      
      await User.findByIdAndUpdate(testUser._id, {
        lastPassword: hashedOldPassword,
        secondLastPassword: 'second-old-hash',
        thirdLastPassword: 'third-old-hash'
      });

      const response = await request(app)
        .post(`/api/auth/reset-password?token=${resetToken}&id=${testUser._id}`)
        .send({ new_password: oldPassword })
        .expect(400);

      expect(response.body.error).toBe('You cannot reuse your last 3 passwords.');
    });

    it('should require new_password in request body', async () => {
      const response = await request(app)
        .post(`/api/auth/reset-password?token=${resetToken}&id=${testUser._id}`)
        .send({})
        .expect(400);

      expect(response.body.message).toBe('Invalid or expired token');
    });
  });

  describe('POST /api/auth/test-email', () => {
    it('should send test email successfully', async () => {
      sendEmail.mockResolvedValue({ messageId: 'test-message-id' });

      const response = await request(app)
        .post('/api/auth/test-email')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Test email sent successfully');
      
      expect(sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test Email',
        'reset-password',
        expect.objectContaining({
          name: 'Test User',
          resetUrl: 'https://example.com/test'
        })
      );
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/test-email')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Email is required');
    });

    it('should handle email sending errors', async () => {
      sendEmail.mockRejectedValue(new Error('SMTP connection failed'));

      const response = await request(app)
        .post('/api/auth/test-email')
        .send({ email: 'test@example.com' })
        .expect(500);

      expect(response.body.error).toBe('SMTP connection failed');
    });
  });
});

describe('Email Service Tests', () => {
  describe('sendEmail function', () => {
    it('should validate email configuration', async () => {
      // Temporarily remove email config
      const originalSmtpUser = process.env.SMTP_USER;
      const originalGmailUser = process.env.GMAIL_USER;
      delete process.env.SMTP_USER;
      delete process.env.GMAIL_USER;

      const result = await sendEmail('test@example.com', 'Test', 'reset-password', {});
      
      expect(result.error).toBe(true);
      expect(result.message).toContain('Email configuration missing');

      // Restore environment variables
      if (originalSmtpUser) process.env.SMTP_USER = originalSmtpUser;
      if (originalGmailUser) process.env.GMAIL_USER = originalGmailUser;
    });

    it('should handle missing template file', async () => {
      const result = await sendEmail('test@example.com', 'Test', 'non-existent-template', {});
      
      expect(result.error).toBe(true);
      expect(result.message).toContain('Email template not found');
    });
  });
});

describe('Integration Tests', () => {
  it('should complete full forgot password flow', async () => {
    // Create user
    const user = await User.create({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      passwordHash: 'hashedPassword123',
      phone: '1234567890',
      isEmailVerified: true
    });

    // Mock email sending
    sendEmail.mockResolvedValue({ messageId: 'test-message-id' });

    // Step 1: Request password reset
    const forgotResponse = await request(app)
      .post('/api/auth/forget-password')
      .send({ email: 'jane.smith@example.com' })
      .expect(200);

    expect(forgotResponse.body.message).toBe('Password reset email sent successfully');

    // Get the user with reset token
    const userWithToken = await User.findById(user._id);
    const resetToken = userWithToken.resetPasswordToken;

    // Step 2: Reset password
    const newPassword = 'newSecurePassword123';
    const resetResponse = await request(app)
      .post(`/api/auth/reset-password?token=${resetToken}&id=${user._id}`)
      .send({ new_password: newPassword })
      .expect(200);

    expect(resetResponse.body.message).toBe('Password updated successfully.');

    // Verify final state
    const finalUser = await User.findById(user._id);
    expect(finalUser.resetPasswordToken).toBeUndefined();
    expect(finalUser.resetPasswordExpires).toBeUndefined();
    expect(finalUser.passwordHash).not.toBe('hashedPassword123');
  });
}); 