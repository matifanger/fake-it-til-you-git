// Jest setup file
// This file runs before all tests and can be used to configure the testing environment

// Mock console methods for cleaner test output
global.console = {
  ...console,
  // Suppress console output during tests for cleaner output
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set up any global test configuration here
export {};
