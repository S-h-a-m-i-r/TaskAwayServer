// Test setup file
import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config({ path: '.env.test' });

// Set default test environment variables if not present
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3001';
process.env.BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 