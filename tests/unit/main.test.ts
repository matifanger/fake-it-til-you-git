import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock chalk and ora before importing main
jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    blue: jest.fn((text: string) => `[BLUE]${text}[/BLUE]`),
    green: jest.fn((text: string) => `[GREEN]${text}[/GREEN]`),
    yellow: jest.fn((text: string) => `[YELLOW]${text}[/YELLOW]`),
    cyan: jest.fn((text: string) => `[CYAN]${text}[/CYAN]`),
    red: jest.fn((text: string) => `[RED]${text}[/RED]`),
    white: jest.fn((text: string) => `[WHITE]${text}[/WHITE]`),
    dim: jest.fn((text: string) => `[DIM]${text}[/DIM]`),
    gray: jest.fn((text: string) => `[GRAY]${text}[/GRAY]`),
    magenta: jest.fn((text: string) => `[MAGENTA]${text}[/MAGENTA]`),
  },
}));

jest.mock('ora', () => ({
  __esModule: true,
  default: jest.fn((text: string) => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: text,
  })),
}));

import { main } from '../../src/main.js';

// Mock process.exit to prevent tests from actually exiting
const originalExit = process.exit;
let exitCode: number | undefined;

// Mock console.log to capture output
const originalLog = console.log;
let logOutput: string[] = [];

beforeEach(() => {
  logOutput = [];
  exitCode = undefined;
  
  console.log = jest.fn((...args) => {
    logOutput.push(args.join(' '));
  });

  // Mock process.exit to capture exit codes instead of actually exiting
  process.exit = jest.fn((code?: number) => {
    exitCode = code;
    throw new Error(`Process would exit with code ${code}`);
  }) as any;

  // Clear all mock calls
  jest.clearAllMocks();
});

afterEach(() => {
  console.log = originalLog;
  process.exit = originalExit;
});

describe('main function', () => {
  it('should initialize successfully with default options', async () => {
    const options = {
      preview: true,
      verbose: false,
    };

    await expect(main(options)).resolves.not.toThrow();
  });

  it('should show verbose output when verbose option is true', async () => {
    const options = {
      preview: true,
      verbose: true,
      days: '365',
      commits: '10',
    };

    await main(options);

    // Check if CLI options were logged
    const verboseOutput = logOutput.find((line) => line.includes('CLI Options:'));
    expect(verboseOutput).toBeDefined();
  });

  it('should indicate preview mode when preview is true', async () => {
    const options = {
      preview: true,
      verbose: false,
    };

    await main(options);

    // Check if preview message was shown
    const previewOutput = logOutput.find((line) => line.includes('Preview mode'));
    expect(previewOutput).toBeDefined();
  });
});
