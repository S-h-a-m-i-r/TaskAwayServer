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

describe('Reset Password Tests', () => {
  let testUser;
  let resetToken;

  beforeEach(async () => {
    // Create a test user
    testUser = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      passwordHash: await bcrypt.hash('oldPassword123', 10),
      phone: '1234567890',
      isEmailVerified: true
    });

    // Set up reset token
    resetToken = 'test-reset-token-123';
    const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
    
    await User.findByIdAndUpdate(testUser._id, {
      resetPasswordToken: resetToken,
      resetPasswordExpires: tokenExpiry
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token and strong password', async () => {
      const newPassword = 'NewPassword123!';

      const response = await request(app)
        .post(`/api/auth/reset-password?token=${resetToken}&id=${testUser._id}`)
        .send({ new_password: newPassword })
        .expect(200);

      expect(response.body.message).toBe('Password updated successfully.');

      // Verify password was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.resetPasswordToken).toBeUndefined();
      expect(updatedUser.resetPasswordExpires).toBeUndefined();
      
      // Verify password hash was updated
      const isPasswordUpdated = await bcrypt.compare(newPassword, updatedUser.passwordHash);
      expect(isPasswordUpdated).toBe(true);
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app)
        .post(`/api/auth/reset-password?token=invalid-token&id=${testUser._id}`)
        .send({ new_password: 'NewPassword123!' })
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
        .send({ new_password: 'NewPassword123!' })
        .expect(400);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('should return 400 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .post(`/api/auth/reset-password?token=${resetToken}&id=${fakeId}`)
        .send({ new_password: 'NewPassword123!' })
        .expect(400);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post(`/api/auth/reset-password?token=${resetToken}&id=${testUser._id}`)
        .send({})
        .expect(400);

      expect(response.body.message).toBe('New password is required');
    });

    it('should return 400 for password too short', async () => {
      const response = await request(app)
        .post(`/api/auth/reset-password?token=${resetToken}&id=${testUser._id}`)
        .send({ new_password: '123' })
        .expect(400);

      expect(response.body.message).toBe('Password must be at least 6 characters long');
    });

    it('should return 400 for weak password (no uppercase)', async () => {
      const response = await request(app)
        .post(`/api/auth/reset-password?token=${resetToken}&id=${testUser._id}`)
        .send({ new_password: 'newpassword123' })
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('Password must contain at least one uppercase letter');
    });

    it('should return 400 for weak password (no lowercase)', async () => {
      const response = await request(app)
        .post(`/api/auth/reset-password?token=${resetToken}&id=${testUser._id}`)
        .send({ new_password: 'NEWPASSWORD123' })
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('Password must contain at least one lowercase letter');
    });

    it('should return 400 for weak password (no number)', async () => {
      const response = await request(app)
        .post(`/api/auth/reset-password?token=${resetToken}&id=${testUser._id}`)
        .send({ new_password: 'NewPassword' })
        .expect(400);

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].msg).toContain('Password must contain at least one number');
    });

    it('should prevent password reuse (last 3 passwords)', async () => {
      // Set up user with password history
      const oldPassword = 'OldPassword123!';
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

      expect(response.body.message).toBe('You cannot reuse your last 3 passwords.');
    });

    it('should clear reset token after successful password reset', async () => {
      const newPassword = 'NewPassword123!';

      await request(app)
        .post(`/api/auth/reset-password?token=${resetToken}&id=${testUser._id}`)
        .send({ new_password: newPassword })
        .expect(200);

      // Verify token is cleared
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.resetPasswordToken).toBeUndefined();
      expect(updatedUser.resetPasswordExpires).toBeUndefined();
    });

    it('should update password history correctly', async () => {
      const newPassword = 'NewPassword123!';
      const originalPasswordHash = testUser.passwordHash;

      await request(app)
        .post(`/api/auth/reset-password?token=${resetToken}&id=${testUser._id}`)
        .send({ new_password: newPassword })
        .expect(200);

      // Verify password history is updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.lastPassword).toBe(originalPasswordHash);
      expect(updatedUser.secondLastPassword).toBe(testUser.lastPassword || null);
      expect(updatedUser.thirdLastPassword).toBe(testUser.secondLastPassword || null);
    });
  });

  describe('Integration with Forgot Password', () => {
    it('should complete full forgot password to reset flow', async () => {
      // Step 1: Request password reset
      sendEmail.mockResolvedValue({ messageId: 'test-message-id' });

      const forgotResponse = await request(app)
        .post('/api/auth/forget-password')
        .send({ email: 'john.doe@example.com' })
        .expect(200);

      expect(forgotResponse.body.message).toBe('Password reset email sent successfully');

      // Get the user with reset token
      const userWithToken = await User.findById(testUser._id);
      const generatedToken = userWithToken.resetPasswordToken;

      // Step 2: Reset password
      const newPassword = 'NewSecurePassword123!';
      const resetResponse = await request(app)
        .post(`/api/auth/reset-password?token=${generatedToken}&id=${testUser._id}`)
        .send({ new_password: newPassword })
        .expect(200);

      expect(resetResponse.body.message).toBe('Password updated successfully.');

      // Verify final state
      const finalUser = await User.findById(testUser._id);
      expect(finalUser.resetPasswordToken).toBeUndefined();
      expect(finalUser.resetPasswordExpires).toBeUndefined();
      
      // Verify new password works
      const isPasswordValid = await bcrypt.compare(newPassword, finalUser.passwordHash);
      expect(isPasswordValid).toBe(true);
    });
  });
}); 