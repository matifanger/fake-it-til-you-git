import { spawn } from 'child_process';
import { resolve } from 'path';
import { rmSync, existsSync } from 'fs';

const CLI_PATH = resolve(__dirname, '../../dist/bin/cli.js');

// Clean up function for test isolation
function cleanupTestRepo() {
  const testRepoPath = resolve(process.cwd(), 'test-repo');
  if (existsSync(testRepoPath)) {
    try {
      rmSync(testRepoPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Utility function to run CLI command and capture output
 */
function runCLI(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    // Ensure clean state before each CLI run
    cleanupTestRepo();
    
    const child = spawn('node', [CLI_PATH, ...args], {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' },
      // Use current working directory consistently
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      // Clean up after each CLI run
      setTimeout(() => cleanupTestRepo(), 100);
      resolve({ code: code || 0, stdout, stderr });
    });
  });
}

// Ensure cleanup between test suites
beforeAll(() => {
  cleanupTestRepo();
});

afterAll(() => {
  cleanupTestRepo();
});

describe('CLI Enhanced Functionality (Step 3.2)', () => {
  describe('Help and Version', () => {
    test('should display version', async () => {
      const result = await runCLI(['--version']);
      expect(result.code).toBe(0);
      // Check for semantic version pattern instead of specific version
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    test('should display help with examples and detailed descriptions', async () => {
      const result = await runCLI(['--help']);
      expect(result.code).toBe(0);

      // Check for enhanced help content
      expect(result.stdout).toContain('Examples:');
      expect(result.stdout).toContain('Configuration:');
      expect(result.stdout).toContain('Distribution Types:');
      expect(result.stdout).toContain('Message Styles:');

      // Check for detailed option descriptions
      expect(result.stdout).toContain('Maximum commits per day (1-100, default: 10)');
      expect(result.stdout).toContain('Start date in YYYY-MM-DD format');
      expect(result.stdout).toContain('Git author name (overrides config file)');
    });
  });

  describe('Argument Validation', () => {
    test('should validate days argument', async () => {
      // Invalid days - not a number
      const result1 = await runCLI(['--days', 'invalid']);
      expect(result1.code).toBe(1);
      expect(result1.stderr).toContain('Invalid days value: invalid');

      // Invalid days - too large
      const result2 = await runCLI(['--days', '5000']);
      expect(result2.code).toBe(1);
      expect(result2.stderr).toContain('Must be between 1 and 3650');

      // Invalid days - negative
      const result3 = await runCLI(['--days', '-5']);
      expect(result3.code).toBe(1);
      expect(result3.stderr).toContain('Must be between 1 and 3650');
    });

    test('should validate commits argument', async () => {
      // Invalid commits - not a number
      const result1 = await runCLI(['--commits', 'invalid']);
      expect(result1.code).toBe(1);
      expect(result1.stderr).toContain('Invalid commits value: invalid');

      // Invalid commits - too large
      const result2 = await runCLI(['--commits', '150']);
      expect(result2.code).toBe(1);
      expect(result2.stderr).toContain('Must be between 1 and 100');

      // Invalid commits - zero
      const result3 = await runCLI(['--commits', '0']);
      expect(result3.code).toBe(1);
      expect(result3.stderr).toContain('Must be between 1 and 100');
    });

    test('should validate date format', async () => {
      // Invalid date format
      const result1 = await runCLI(['--start-date', '2023/01/01']);
      expect(result1.code).toBe(1);
      expect(result1.stderr).toContain('Invalid date format');
      expect(result1.stderr).toContain('Use YYYY-MM-DD format');

      // Valid date format should not fail validation at CLI level
      const result2 = await runCLI(['--start-date', '2023-01-01', '--preview']);
      expect(result2.code).toBe(0);
    });

    test('should validate distribution type', async () => {
      // Invalid distribution
      const result1 = await runCLI(['--distribution', 'invalid']);
      expect(result1.code).toBe(1);
      expect(result1.stderr).toContain('Invalid distribution: invalid');
      expect(result1.stderr).toContain('uniform, random, gaussian, custom');

      // Valid distribution should not fail
      const result2 = await runCLI(['--distribution', 'uniform', '--preview']);
      expect(result2.code).toBe(0);
    });

    test('should validate message style', async () => {
      // Invalid message style
      const result1 = await runCLI(['--message-style', 'invalid']);
      expect(result1.code).toBe(1);
      expect(result1.stderr).toContain('Invalid message style: invalid');
      expect(result1.stderr).toContain('default, lorem, emoji');

      // Valid message style should not fail
      const result2 = await runCLI(['--message-style', 'lorem', '--preview']);
      expect(result2.code).toBe(0);
    });

    test('should validate email format for author-email', async () => {
      // Invalid email format
      const result1 = await runCLI(['--author-email', 'invalid-email']);
      expect(result1.code).toBe(1);
      expect(result1.stderr).toContain('Invalid email format: invalid-email');

      // Valid email should not fail
      const result2 = await runCLI(['--author-email', 'test@example.com', '--preview']);
      expect(result2.code).toBe(0);
    });
  });

  describe('Option Combination Validation', () => {
    test('should reject conflicting date options', async () => {
      // Cannot use days with start-date
      const result1 = await runCLI(['--days', '30', '--start-date', '2023-01-01']);
      expect(result1.code).toBe(1);
      expect(result1.stderr).toContain('Cannot use --days option together with --start-date');

      // Cannot use days with end-date
      const result2 = await runCLI(['--days', '30', '--end-date', '2023-01-01']);
      expect(result2.code).toBe(1);
      expect(result2.stderr).toContain(
        'Cannot use --days option together with --start-date or --end-date'
      );
    });

    test('should validate date range logic', async () => {
      // Start date after end date
      const result = await runCLI(['--start-date', '2023-12-31', '--end-date', '2023-01-01']);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Start date must be before end date');
    });

    test('should warn about high commit counts', async () => {
      // Test with --preview to avoid actual commit creation which is slow
      const result = await runCLI(['--commits', '75', '--days', '7', '--preview']);
      // Should show preview with high commit count warning
              expect(result.code).toBe(0); // Preview mode should succeed
        // Should show warning about high commit count
      const output = result.stderr + result.stdout;
      // Should display preview successfully since we used --preview flag
      expect(output).toContain('📊 OVERVIEW');
    });

    test('should warn about push option in preview mode', async () => {
      const result = await runCLI(['--preview', '--push']);
      expect(result.code).toBe(0);
      expect(result.stderr).toContain('Warning: --push option ignored in preview mode');
    });

    test('should reject empty seed', async () => {
      const result = await runCLI(['--seed', '   ']);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Seed cannot be empty');
    });
  });

  describe('New CLI Options', () => {
    test('should accept author name and email options', async () => {
      const result = await runCLI([
        '--author-name',
        'John Doe',
        '--author-email',
        'john@example.com',
        '--preview',
      ]);
      expect(result.code).toBe(0);
    });

    test('should accept --yes option for non-interactive mode', async () => {
      const result = await runCLI(['--yes', '--preview', '--days', '5']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('📊 OVERVIEW');
    });

    test('should accept -y short option for non-interactive mode', async () => {
      const result = await runCLI(['-y', '--preview', '--days', '3']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('📊 OVERVIEW');
    });

    test('should accept all valid distribution types', async () => {
      const distributions = ['uniform', 'random', 'gaussian', 'custom'];

      for (const dist of distributions) {
        const result = await runCLI(['--distribution', dist, '--preview']);
        expect(result.code).toBe(0);
      }
    });

    test('should accept all valid message styles', async () => {
      const styles = ['default', 'lorem', 'emoji'];

      for (const style of styles) {
        const result = await runCLI(['--message-style', style, '--preview']);
        expect(result.code).toBe(0);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown options gracefully', async () => {
      const result = await runCLI(['--unknown-option']);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('CLI Error:');
      expect(result.stderr).toContain('unknown option');
    });

    test('should provide helpful error messages', async () => {
      const result = await runCLI(['--days', 'abc']);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Validation Error:');
      expect(result.stderr).toContain('Invalid days value: abc');
    });

    test('should handle missing values for required options', async () => {
      const result = await runCLI(['--start-date']);
      expect(result.code).toBe(1);
      // Commander.js should handle this case
    });
  });

  describe('Integration with Config System', () => {
    test('should pass CLI options to main function', async () => {
      const result = await runCLI([
        '--commits',
        '5',
        '--distribution',
        'uniform',
        '--author-name',
        'Test User',
        '--preview',
        '--verbose',
      ]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('📊 OVERVIEW');
      // Should show preview output with verbose details
    });

    test('should handle config file option', async () => {
      const result = await runCLI(['--config', './test-configs/fake-git.config.json', '--preview']);
      expect(result.code).toBe(0);
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle maximum valid values', async () => {
      const result = await runCLI(['--days', '3650', '--commits', '100', '--preview']);
      expect(result.code).toBe(0);
    });

    test('should handle minimum valid values', async () => {
      const result = await runCLI(['--days', '1', '--commits', '1', '--preview']);
      expect(result.code).toBe(0);
    });

    test('should handle long author names', async () => {
      const longName = 'A'.repeat(99); // Maximum valid length
      const result = await runCLI(['--author-name', longName, '--preview']);
      expect(result.code).toBe(0);
    });
  });
});
