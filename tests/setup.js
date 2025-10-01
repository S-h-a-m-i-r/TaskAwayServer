// Jest setup file
// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  // Uncomment to suppress specific console methods during tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Make jest globals available
import { jest } from '@jest/globals';
global.jest = jest;

// Setup any global test requirements here