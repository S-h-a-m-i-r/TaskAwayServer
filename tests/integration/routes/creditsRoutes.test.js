import request from 'supertest';
import mongoose from 'mongoose';
import User from '../../../src/models/User.js';
import Credit from '../../../src/models/Credit.js';
import CreditTransaction from '../../../src/models/CreditTransaction.js';
import jwt from 'jsonwebtoken';
import express from 'express';
import creditsRoutes from '../../../src/routes/creditsRoutes.js';

const app = express();
app.use(express.json());

// Mock authentication middleware for testing
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
});

app.use('/api/credits', creditsRoutes);

describe('Credits Routes - Customer Data Endpoint', () => {
  let adminToken;
  let customerToken;
  let adminUser;
  let customerUser;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskaway_test');
    }
  });

  beforeEach(async () => {
    // Clean up database
    await User.deleteMany({});
    await Credit.deleteMany({});
    await CreditTransaction.deleteMany({});

    // Create admin user
    adminUser = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.com',
      phone: '1234567890',
      passwordHash: 'hashedpassword',
      role: 'ADMIN'
    });

    // Create customer user
    customerUser = await User.create({
      firstName: 'Customer',
      lastName: 'User',
      email: 'customer@test.com',
      phone: '1234567891',
      passwordHash: 'hashedpassword',
      role: 'CUSTOMER'
    });

    // Generate tokens
    adminToken = jwt.sign(
      { _id: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    customerToken = jwt.sign(
      { _id: customerUser._id, role: customerUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create some test credits for the customer
    const credit = await Credit.create({
      user: customerUser._id,
      totalCredits: 50,
      remainingCredits: 30,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });

    // Create some credit transactions
    await CreditTransaction.create({
      user: customerUser._id,
      creditBatch: credit._id,
      change: 50,
      reason: 'Credit Purchase'
    });

    await CreditTransaction.create({
      user: customerUser._id,
      creditBatch: credit._id,
      change: -20,
      reason: 'Task Creation'
    });
  });

  afterAll(async () => {
    // Clean up and close connection
    await User.deleteMany({});
    await Credit.deleteMany({});
    await CreditTransaction.deleteMany({});
    await mongoose.connection.close();
  });

  describe('GET /api/credits/customers', () => {
    it('should return customer credit data for admin user', async () => {
      const response = await request(app)
        .get('/api/credits/customers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.count).toBe(1);

      const customerData = response.body.data[0];
      expect(customerData.customerName).toBe('Customer User');
      expect(customerData.customerEmail).toBe('customer@test.com');
      expect(customerData.totalPurchasedCredits).toBe(50);
      expect(customerData.totalRemainingCredits).toBe(30);
      expect(customerData.creditBatches).toBeDefined();
      expect(Array.isArray(customerData.creditBatches)).toBe(true);
    });

    it('should return customer credit data for manager user', async () => {
      // Create manager user
      const managerUser = await User.create({
        firstName: 'Manager',
        lastName: 'User',
        email: 'manager@test.com',
        phone: '1234567892',
        passwordHash: 'hashedpassword',
        role: 'MANAGER'
      });

      const managerToken = jwt.sign(
        { _id: managerUser._id, role: managerUser.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/credits/customers')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return 403 for customer user', async () => {
      const response = await request(app)
        .get('/api/credits/customers')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.statusCode).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/credits/customers');

      expect(response.statusCode).toBe(401);
    });
  });
});
