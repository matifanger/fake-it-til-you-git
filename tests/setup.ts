// Jest setup file
// This file runs before all tests and can be used to configure the testing environment

import { rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Clean up test directory before and after each test
const testRepoPath = join(process.cwd(), 'test-repo');

beforeEach(() => {
  // Clean up test repo before each test
  if (existsSync(testRepoPath)) {
    try {
      rmSync(testRepoPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});

afterEach(() => {
  // Clean up test repo after each test
  if (existsSync(testRepoPath)) {
    try {
      rmSync(testRepoPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});

// Mock console methods for cleaner test output, but preserve functionality for CLI tests
const originalConsole = { ...console };

global.console = {
  ...console,
  // Only suppress for non-CLI tests (preserve output for CLI integration tests)
  log: process.env.JEST_CLI_TEST === 'true' ? originalConsole.log : jest.fn(),
  warn: process.env.JEST_CLI_TEST === 'true' ? originalConsole.warn : jest.fn(),
  error: process.env.JEST_CLI_TEST === 'true' ? originalConsole.error : jest.fn(),
};

// Set up any global test configuration here
export {};
