import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock all external dependencies that use ES modules
jest.mock('inquirer', () => ({
  default: {
    prompt: jest.fn().mockImplementation(() => Promise.resolve({ proceed: true, doubleConfirm: true }))
  }
}));

jest.mock('ora', () => {
  return {
    default: jest.fn(() => ({
      start: jest.fn().mockReturnThis(),
      succeed: jest.fn().mockReturnThis(),
      fail: jest.fn().mockReturnThis(),
      stop: jest.fn().mockReturnThis(),
    })),
  };
});

jest.mock('chalk', () => ({
  default: {
    red: jest.fn((text) => text),
    green: jest.fn((text) => text),
    blue: jest.fn((text) => text),
    yellow: jest.fn((text) => text),
    cyan: jest.fn((text) => text),
    white: jest.fn((text) => text),
    gray: jest.fn((text) => text),
    magenta: jest.fn((text) => text),
    dim: jest.fn((text) => text),
  },
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

describe('Enhanced Preview System (Step 6.1)', () => {
  it('should display GitHub-style graph in preview mode', async () => {
    const options = {
      preview: true,
      verbose: false,
      days: '30',
      commits: '5',
    };

    await main(options);

    // Check if GitHub graph was displayed
    const graphOutput = logOutput.find((line) => line.includes('GitHub Contribution Graph Preview'));
    expect(graphOutput).toBeDefined();
    
    // Check for enhanced statistics
    const statsOutput = logOutput.find((line) => line.includes('Detailed Statistics'));
    expect(statsOutput).toBeDefined();
    
    // Check for pattern analysis
    const patternOutput = logOutput.find((line) => line.includes('Pattern Analysis'));
    expect(patternOutput).toBeDefined();
    
    // Check for realism assessment
    const realismOutput = logOutput.find((line) => line.includes('Realism Assessment'));
    expect(realismOutput).toBeDefined();
  });

  it('should display sample commits in preview mode', async () => {
    const options = {
      preview: true,
      verbose: false,
      commits: '3',
    };

    await main(options);

    // Check if sample commits were shown
    const sampleOutput = logOutput.find((line) => line.includes('Sample Commits'));
    expect(sampleOutput).toBeDefined();
  });

  it('should show preview tip when in preview mode', async () => {
    const options = {
      preview: true,
      verbose: false,
    };

    await main(options);

    // Check for preview mode message
    const previewOutput = logOutput.find((line) => line.includes('Preview mode - no changes made'));
    expect(previewOutput).toBeDefined();
    
    // Check for tip
    const tipOutput = logOutput.find((line) => line.includes('Remove --preview flag to actually create'));
    expect(tipOutput).toBeDefined();
  });

  it('should display intensity distribution correctly', async () => {
    const options = {
      preview: true,
      verbose: false,
      commits: '10',
      distribution: 'random',
    };

    await main(options);

    // Check for intensity distribution section
    const intensityOutput = logOutput.find((line) => line.includes('Intensity Distribution'));
    expect(intensityOutput).toBeDefined();
    
    // Check for different intensity levels
    const lightDaysOutput = logOutput.find((line) => line.includes('Light days'));
    const mediumDaysOutput = logOutput.find((line) => line.includes('Medium days'));
    const heavyDaysOutput = logOutput.find((line) => line.includes('Heavy days'));
    
    expect(lightDaysOutput || mediumDaysOutput || heavyDaysOutput).toBeDefined();
  });

  it('should calculate and display realism score', async () => {
    const options = {
      preview: true,
      verbose: false,
      commits: '15', // Higher number to potentially trigger realism warnings
    };

    await main(options);

    // Check for realism score
    const realismScoreOutput = logOutput.find((line) => line.includes('Realism Score:'));
    expect(realismScoreOutput).toBeDefined();
    
    // Should have realism level description
    const realismLevelOutput = logOutput.find((line) => 
      line.includes('Realistic') || 
      line.includes('Artificial') || 
      line.includes('Very Realistic')
    );
    expect(realismLevelOutput).toBeDefined();
  });

  it('should show suggestions for unrealistic patterns', async () => {
    const options = {
      preview: true,
      verbose: false,
      commits: '50', // Very high number to trigger warnings
      distribution: 'uniform',
    };

    await main(options);

    // Should show suggestions when patterns are unrealistic
    const suggestionsFound = logOutput.some((line) => 
      line.includes('Suggestions for more realistic patterns') ||
      line.includes('Consider reducing average commits') ||
      line.includes('Add more rest days') ||
      line.includes('Reduce very heavy days')
    );
    
    // With 50 commits per day in uniform distribution, should definitely show warnings
    expect(suggestionsFound).toBe(true);
  });

  it('should display pattern analysis with weekdays and months', async () => {
    const options = {
      preview: true,
      verbose: false,
      startDate: '2023-01-01',
      endDate: '2023-03-31',
      commits: '5',
    };

    await main(options);

    // Check for pattern analysis
    const patternOutput = logOutput.find((line) => line.includes('Pattern Analysis'));
    expect(patternOutput).toBeDefined();
    
    // Should show most active day and month
    const activeDayOutput = logOutput.find((line) => line.includes('Most active day:'));
    const activeMonthOutput = logOutput.find((line) => line.includes('Most active month:'));
    
    expect(activeDayOutput).toBeDefined();
    expect(activeMonthOutput).toBeDefined();
  });

  it('should handle empty commit plans gracefully', async () => {
    const options = {
      preview: true,
      verbose: false,
      commits: '0', // No commits
    };

    await main(options);

    // Should handle zero commits without crashing
    const previewOutput = logOutput.find((line) => line.includes('Preview mode'));
    expect(previewOutput).toBeDefined();
  });

  it('should show proper formatting for different console widths', async () => {
    // Mock smaller console width
    const originalColumns = process.stdout.columns;
    Object.defineProperty(process.stdout, 'columns', {
      value: 60,
      configurable: true
    });

    const options = {
      preview: true,
      verbose: false,
      days: '365',
    };

    await main(options);

    // Should still work with limited width
    const graphOutput = logOutput.find((line) => line.includes('GitHub Contribution Graph'));
    expect(graphOutput).toBeDefined();

    // Restore original columns
    Object.defineProperty(process.stdout, 'columns', {
      value: originalColumns,
      configurable: true
    });
  });
});
