import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock chalk and ora before importing main
jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    blue: jest.fn((text: string) => `[BLUE]${text}[/BLUE]`),
    green: jest.fn((text: string) => `[GREEN]${text}[/GREEN]`),
    yellow: jest.fn((text: string) => `[YELLOW]${text}[/YELLOW]`),
    cyan: jest.fn((text: string) => `[CYAN]${text}[/CYAN]`),
    red: jest.fn((text: string) => `[RED]${text}[/RED]`),
  }
}));

jest.mock('ora', () => ({
  __esModule: true,
  default: jest.fn((text: string) => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: text,
  }))
}));

import { main } from '../../src/main.js';

// Mock console.log to capture output
const originalLog = console.log;
let logOutput: string[] = [];

beforeEach(() => {
  logOutput = [];
  console.log = jest.fn((...args) => {
    logOutput.push(args.join(' '));
  });
  
  // Clear all mock calls
  jest.clearAllMocks();
});

afterEach(() => {
  console.log = originalLog;
});

describe('main function', () => {
  it('should initialize successfully with default options', async () => {
    const options = {
      dryRun: true,
      verbose: false
    };

    await expect(main(options)).resolves.not.toThrow();
  });

  it('should show verbose output when verbose option is true', async () => {
    const options = {
      dryRun: true,
      verbose: true,
      days: '365',
      commits: '10'
    };

    await main(options);
    
    // Check if CLI options were logged
    const verboseOutput = logOutput.find(line => line.includes('CLI Options:'));
    expect(verboseOutput).toBeDefined();
  });

  it('should indicate dry run mode when dryRun is true', async () => {
    const options = {
      dryRun: true,
      verbose: false
    };

    await main(options);
    
    // Check if dry run message was shown
    const dryRunOutput = logOutput.find(line => line.includes('Dry run mode'));
    expect(dryRunOutput).toBeDefined();
  });
}); 