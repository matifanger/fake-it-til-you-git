import { existsSync } from 'node:fs';
import { mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import {
  type CliOptions,
  type Config,
  type PartialConfig,
  applyDefaults,
  cliOptionsToConfig,
  getDefaultConfig,
  loadConfig,
  loadConfigFromFile,
} from '../../src/config.js';

describe('Config Loader', () => {
  const testDir = join(tmpdir(), 'fake-git-config-tests', Math.random().toString(36).substring(7));
  const validConfigPath = join(testDir, 'valid-config.json');
  const invalidConfigPath = join(testDir, 'invalid-config.json');
  const nonExistentConfigPath = join(testDir, 'non-existent.json');
  const originalCwd = process.cwd();

  const validConfigContent = {
    author: {
      name: 'Test User',
      email: 'test@example.com',
    },
    dateRange: {
      startDate: '2023-01-01',
      endDate: '2023-12-31',
    },
    commits: {
      maxPerDay: 5,
      distribution: 'gaussian' as const,
      messageStyle: 'emoji' as const,
    },
    options: {
      preview: true,
      push: false,
      verbose: true,
      yes: false,
    },
    seed: 'test-seed',
  };

  const invalidJsonContent = '{ "author": { "name": "Test", "email": }';

  beforeEach(async () => {
    // Create test directory and change working directory
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);

    // Create test config files
    await writeFile(validConfigPath, JSON.stringify(validConfigContent, null, 2));
    await writeFile(invalidConfigPath, invalidJsonContent);
  });

  afterEach(async () => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('loadConfigFromFile', () => {
    it('should load valid config file correctly', async () => {
      const result = await loadConfigFromFile(validConfigPath);
      expect(result).toEqual(validConfigContent);
    });

    it('should return null for non-existent file', async () => {
      const result = await loadConfigFromFile(nonExistentConfigPath);
      expect(result).toBeNull();
    });

    it('should throw error for invalid JSON', async () => {
      await expect(loadConfigFromFile(invalidConfigPath)).rejects.toThrow(
        /Invalid JSON in config file/
      );
    });

    it('should resolve relative paths correctly', async () => {
      const relativePath = 'valid-config.json';
      const result = await loadConfigFromFile(relativePath);
      expect(result).toEqual(validConfigContent);
    });
  });

  describe('cliOptionsToConfig', () => {
    it('should convert basic CLI options to config format', () => {
      const cliOptions: CliOptions = {
        commits: '15',
        distribution: 'uniform',
        messageStyle: 'lorem',
        preview: true,
        verbose: false,
        seed: 'cli-seed',
      };

      const result = cliOptionsToConfig(cliOptions);

      expect(result).toEqual({
        commits: {
          maxPerDay: 15,
          distribution: 'uniform',
          messageStyle: 'lorem',
        },
        options: {
          preview: true,
          verbose: false,
        },
        seed: 'cli-seed',
      });
    });

    it('should handle date range options correctly', () => {
      const cliOptions: CliOptions = {
        startDate: '2023-06-01',
        endDate: '2023-06-30',
      };

      const result = cliOptionsToConfig(cliOptions);

      expect(result).toEqual({
        dateRange: {
          startDate: '2023-06-01',
          endDate: '2023-06-30',
        },
      });
    });

    it('should calculate date range from days option', () => {
      const cliOptions: CliOptions = {
        days: '30',
      };

      const result = cliOptionsToConfig(cliOptions);

      expect(result.dateRange).toBeDefined();
      expect(result.dateRange?.startDate).toBeDefined();
      expect(result.dateRange?.endDate).toBeDefined();

      // Verify the date range spans approximately 30 days
      const startDate = new Date(result.dateRange!.startDate!);
      const endDate = new Date(result.dateRange!.endDate!);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysDiff).toBeGreaterThanOrEqual(29);
      expect(daysDiff).toBeLessThanOrEqual(31);
    });

    it('should handle empty CLI options', () => {
      const result = cliOptionsToConfig({});
      expect(result).toEqual({});
    });

    it('should convert author CLI options to config format', () => {
      const cliOptions: CliOptions = {
        authorName: 'John Doe',
        authorEmail: 'john@example.com',
      };

      const result = cliOptionsToConfig(cliOptions);

      expect(result).toEqual({
        author: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      });
    });

    it('should handle partial author options', () => {
      const cliOptionsNameOnly: CliOptions = {
        authorName: 'Jane Smith',
      };

      const result1 = cliOptionsToConfig(cliOptionsNameOnly);
      expect(result1).toEqual({
        author: {
          name: 'Jane Smith',
        },
      });

      const cliOptionsEmailOnly: CliOptions = {
        authorEmail: 'jane@example.com',
      };

      const result2 = cliOptionsToConfig(cliOptionsEmailOnly);
      expect(result2).toEqual({
        author: {
          email: 'jane@example.com',
        },
      });
    });

    it('should handle partial options correctly', () => {
      const cliOptions: CliOptions = {
        push: true,
        distribution: 'random',
      };

      const result = cliOptionsToConfig(cliOptions);

      expect(result).toEqual({
        commits: {
          distribution: 'random',
        },
        options: {
          push: true,
        },
      });
    });

    it('should handle yes option correctly', () => {
      const cliOptions: CliOptions = {
        yes: true,
        preview: false,
      };

      const result = cliOptionsToConfig(cliOptions);

      expect(result).toEqual({
        options: {
          yes: true,
          preview: false,
        },
      });
    });

    it('should include yes option in comprehensive options test', () => {
      const cliOptions: CliOptions = {
        preview: true,
        push: false,
        verbose: true,
        dev: false,
        yes: true,
        repoPath: '/custom/path',
      };

      const result = cliOptionsToConfig(cliOptions);

      expect(result).toEqual({
        options: {
          preview: true,
          push: false,
          verbose: true,
          dev: false,
          yes: true,
          repositoryPath: '/custom/path',
        },
      });
    });
  });

  describe('applyDefaults', () => {
    it('should apply all defaults to empty config', () => {
      const result = applyDefaults({});
      const defaultConfig = getDefaultConfig();

      expect(result.author).toEqual(defaultConfig.author);
      expect(result.commits).toEqual(defaultConfig.commits);
      expect(result.options).toEqual(defaultConfig.options);
      expect(result.dateRange.startDate).toBeDefined();
      expect(result.dateRange.endDate).toBeDefined();
    });

    it('should preserve provided values and fill missing ones', () => {
      const partialConfig: PartialConfig = {
        author: {
          name: 'Custom User',
        },
        commits: {
          maxPerDay: 20,
        },
      };

      const result = applyDefaults(partialConfig);

      expect(result.author.name).toBe('Custom User');
      expect(result.author.email).toBe('fake@example.com'); // default
      expect(result.commits.maxPerDay).toBe(20);
      expect(result.commits.distribution).toBe('random'); // default
      expect(result.options.preview).toBe(false); // default
    });

    it('should handle nested partial objects correctly', () => {
      const partialConfig: PartialConfig = {
        options: {
          preview: true,
        },
      };

      const result = applyDefaults(partialConfig);

      expect(result.options.preview).toBe(true);
      expect(result.options.push).toBe(false); // default
      expect(result.options.verbose).toBe(false); // default
      expect(result.options.yes).toBe(false); // default
    });

    it('should apply default yes option correctly', () => {
      const partialConfig: PartialConfig = {
        options: {
          yes: true,
          preview: false,
        },
      };

      const result = applyDefaults(partialConfig);

      expect(result.options.yes).toBe(true);
      expect(result.options.preview).toBe(false);
      expect(result.options.push).toBe(false); // default
      expect(result.options.verbose).toBe(false); // default
    });

    it('should preserve seed when provided', () => {
      const partialConfig: PartialConfig = {
        seed: 'custom-seed',
      };

      const result = applyDefaults(partialConfig);

      expect(result.seed).toBe('custom-seed');
    });
  });

  describe('loadConfig', () => {
    it('should load and merge config from file and CLI options', async () => {
      const cliOptions: CliOptions = {
        config: validConfigPath,
        commits: '25', // Override file value
        push: true, // Override file value
      };

      const result = await loadConfig(cliOptions);

      expect(result.author).toEqual(validConfigContent.author);
      expect(result.commits.maxPerDay).toBe(25); // CLI override
      expect(result.commits.distribution).toBe('gaussian'); // From file
      expect(result.options.push).toBe(true); // CLI override
      expect(result.options.preview).toBe(true); // From file
      expect(result.seed).toBe('test-seed'); // From file
    });

    it('should work with CLI options only', async () => {
      const cliOptions: CliOptions = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
        commits: '10',
        distribution: 'uniform',
        messageStyle: 'default',
        preview: true,
      };

      const result = await loadConfig(cliOptions);

      expect(result.dateRange.startDate).toBe('2023-01-01');
      expect(result.dateRange.endDate).toBe('2023-12-31');
      expect(result.commits.maxPerDay).toBe(10);
      expect(result.commits.distribution).toBe('uniform');
      expect(result.options.preview).toBe(true);
      expect(result.author.name).toBe('Fake Git User'); // default
    });

    it('should handle non-existent config file gracefully when not explicitly specified', async () => {
      const cliOptions: CliOptions = {
        commits: '5',
      };

      // Should not throw when default config file doesn't exist
      const result = await loadConfig(cliOptions);

      expect(result.commits.maxPerDay).toBe(5);
      expect(result.author.name).toBe('Fake Git User'); // default
    });

    it('should throw error when explicitly specified config file does not exist', async () => {
      const cliOptions: CliOptions = {
        config: nonExistentConfigPath,
        commits: '5',
      };

      // Should throw error when config file is explicitly specified but doesn't exist
      await expect(loadConfig(cliOptions)).rejects.toThrow();
    });

    it('should use default config path when not specified', async () => {
      const cliOptions: CliOptions = {
        commits: '8',
        preview: true,
      };

      const result = await loadConfig(cliOptions);

      expect(result.commits.maxPerDay).toBe(8);
      expect(result.options.preview).toBe(true);
      expect(result.author.name).toBe('Fake Git User'); // default
    });

    it('should throw error for invalid config file when explicitly specified', async () => {
      const cliOptions: CliOptions = {
        config: invalidConfigPath,
      };

      await expect(loadConfig(cliOptions)).rejects.toThrow(/Invalid JSON in config file/);
    });

    it('should validate final configuration', async () => {
      const cliOptions: CliOptions = {
        commits: 'invalid-number' as any,
        startDate: 'invalid-date',
      };

      await expect(loadConfig(cliOptions)).rejects.toThrow(/Configuration validation failed/);
    });

    it('should handle complex merging scenarios', async () => {
      const cliOptions: CliOptions = {
        config: validConfigPath,
        startDate: '2023-06-01', // Override file
        commits: '30', // Override file
        verbose: false, // Override file
        seed: 'cli-seed', // Override file
      };

      const result = await loadConfig(cliOptions);

      // From file
      expect(result.author.name).toBe('Test User');
      expect(result.dateRange.endDate).toBe('2023-12-31');
      expect(result.commits.distribution).toBe('gaussian');
      expect(result.options.preview).toBe(true);

      // CLI overrides
      expect(result.dateRange.startDate).toBe('2023-06-01');
      expect(result.commits.maxPerDay).toBe(30);
      expect(result.options.verbose).toBe(false);
      expect(result.seed).toBe('cli-seed');

      // Untouched values
      expect(result.options.push).toBe(false);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return valid default configuration', () => {
      const defaultConfig = getDefaultConfig();

      expect(defaultConfig.author.name).toBe('Fake Git User');
      expect(defaultConfig.author.email).toBe('fake@example.com');
      expect(defaultConfig.commits.maxPerDay).toBe(10);
      expect(defaultConfig.commits.distribution).toBe('random');
      expect(defaultConfig.commits.messageStyle).toBe('default');
      expect(defaultConfig.options.preview).toBe(false);
      expect(defaultConfig.options.push).toBe(false);
      expect(defaultConfig.options.verbose).toBe(false);
      expect(defaultConfig.dateRange.startDate).toBeDefined();
      expect(defaultConfig.dateRange.endDate).toBeDefined();
    });

    it('should return a new object each time', () => {
      const config1 = getDefaultConfig();
      const config2 = getDefaultConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle config file with missing sections', async () => {
      const partialConfigContent = {
        author: {
          name: 'Partial User',
          email: 'partial@example.com',
        },
      };

      const partialConfigPath = join(testDir, 'partial-config.json');
      await writeFile(partialConfigPath, JSON.stringify(partialConfigContent));

      try {
        const cliOptions: CliOptions = {
          config: partialConfigPath,
        };

        const result = await loadConfig(cliOptions);

        expect(result.author).toEqual(partialConfigContent.author);
        expect(result.commits.maxPerDay).toBe(10); // default
        expect(result.options.preview).toBe(false); // default
      } finally {
        await unlink(partialConfigPath);
      }
    });

    it('should handle config file with extra properties', async () => {
      const configWithExtras = {
        ...validConfigContent,
        extraProperty: 'should be ignored',
        nested: {
          extra: 'property',
        },
      };

      const extrasConfigPath = join(testDir, 'extras-config.json');
      await writeFile(extrasConfigPath, JSON.stringify(configWithExtras));

      try {
        const cliOptions: CliOptions = {
          config: extrasConfigPath,
        };

        const result = await loadConfig(cliOptions);

        expect(result.author).toEqual(validConfigContent.author);
        expect(result.commits).toEqual(validConfigContent.commits);
        expect(result.options).toEqual({
          ...validConfigContent.options,
          dev: false, // Default value added by the system
          repositoryPath: '.', // Default value added by the system
        });
        expect(result.seed).toBe(validConfigContent.seed);
        expect((result as any).extraProperty).toBeUndefined();
      } finally {
        await unlink(extrasConfigPath);
      }
    });

    it('should handle CLI options with undefined values', () => {
      const cliOptions: CliOptions = {
        commits: undefined,
        preview: false,
        verbose: false,
      };

      const result = cliOptionsToConfig(cliOptions);

      expect(result.options?.verbose).toBe(false);
      expect(result.commits).toBeUndefined();
    });

    it('should handle repository path from CLI options', async () => {
      const cliOptions: CliOptions = {
        repoPath: '/custom/repo/path',
        commits: '5',
        preview: true,
      };

      const result = await loadConfig(cliOptions);

      expect(result.options.repositoryPath).toBe('/custom/repo/path');
      expect(result.commits.maxPerDay).toBe(5);
      expect(result.options.preview).toBe(true);
    });

    it('should use default repository path when not specified', async () => {
      const cliOptions: CliOptions = {
        commits: '8',
      };

      const result = await loadConfig(cliOptions);

      expect(result.options.repositoryPath).toBe('.'); // default
      expect(result.commits.maxPerDay).toBe(8);
    });
  });
});
