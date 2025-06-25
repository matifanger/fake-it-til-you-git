// Jest setup file
// This file runs before all tests and can be used to configure the testing environment

// Mock console methods for cleaner test output
global.console = {
  ...console,
  // Uncomment below lines if you want to suppress console output during tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Set up any global test configuration here
export {}; 