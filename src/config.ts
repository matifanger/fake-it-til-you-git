import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateConfig } from './utils/validation.js';

// Configuration interfaces
export interface AuthorConfig {
  name: string;
  email: string;
}

export interface DateRangeConfig {
  startDate: string;
  endDate: string;
}

export interface CommitsConfig {
  maxPerDay: number;
  distribution: 'uniform' | 'random' | 'gaussian' | 'custom' | 'pattern';
  messageStyle: 'default' | 'lorem' | 'emoji';
  pattern?: PatternConfig;
}

export interface PatternConfig {
  type?: 'preset' | 'custom' | 'text';
  preset?: string; // Name of predefined pattern like 'heart', 'star', 'wave'
  custom?: string; // Custom pattern as a string (ASCII art style)
  text?: string; // Text to render as pattern
  scale?: number; // Scale factor for the pattern (1-5, default: 1)
  intensity?: 'low' | 'medium' | 'high'; // Commit intensity (default: medium)
  repeat?: number; // Number of times to repeat the pattern horizontally (1-10, default: 1)
  centerX?: number; // Horizontal center position (0-1, default: 0.5)
  centerY?: number; // Vertical center position (0-1, default: 0.5)
}

export interface OptionsConfig {
  preview: boolean;
  push: boolean;
  verbose: boolean;
  dev: boolean;
  repositoryPath: string;
  yes: boolean;
}

export interface Config {
  author: AuthorConfig;
  dateRange: DateRangeConfig;
  commits: CommitsConfig;
  options: OptionsConfig;
  seed?: string;
}

export interface PartialConfig {
  author?: Partial<AuthorConfig>;
  dateRange?: Partial<DateRangeConfig>;
  commits?: Partial<CommitsConfig>;
  options?: Partial<OptionsConfig>;
  seed?: string;
}

export interface CliOptions {
  days?: string;
  commits?: string;
  startDate?: string;
  endDate?: string;
  distribution?: string;
  messageStyle?: string;
  authorName?: string;
  authorEmail?: string;
  preview?: boolean;
  config?: string;
  push?: boolean;
  seed?: string;
  verbose?: boolean;
  dev?: boolean;
  repoPath?: string;
  yes?: boolean;
  pattern?: string; // Preset pattern name
  customPattern?: string; // Custom pattern string
  patternText?: string; // Text to render as pattern
  patternScale?: string; // Scale factor
  patternIntensity?: string; // Intensity level
  patternRepeat?: string; // Number of pattern repetitions
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Config = {
  author: {
    name: 'Fake Git User',
    email: 'fake@example.com',
  },
  dateRange: {
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  },
  commits: {
    maxPerDay: 10,
    distribution: 'random',
    messageStyle: 'default',
  },
  options: {
    preview: false,
    push: false,
    verbose: false,
    dev: false,
    repositoryPath: '.',
    yes: false,
  },
};

/**
 * Load configuration from a JSON file
 * @param configPath - Path to the configuration file
 * @returns Parsed configuration object or null if file doesn't exist
 */
export async function loadConfigFromFile(configPath: string): Promise<PartialConfig | null> {
  try {
    const resolvedPath = resolve(configPath);

    if (!existsSync(resolvedPath)) {
      return null;
    }

    const fileContent = await readFile(resolvedPath, 'utf-8');
    const parsedConfig = JSON.parse(fileContent);

    // Return the configuration as-is (should already be in correct nested format)
    return parsedConfig;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${configPath}. ${error.message}`);
    }
    throw new Error(
      `Failed to load config file: ${configPath}. ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Convert CLI options to partial config format
 * @param cliOptions - Options from CLI
 * @returns Partial configuration object
 */
export function cliOptionsToConfig(cliOptions: CliOptions): PartialConfig {
  const config: PartialConfig = {};

  // Handle author configuration
  if (cliOptions.authorName || cliOptions.authorEmail) {
    config.author = {};

    if (cliOptions.authorName) {
      config.author.name = cliOptions.authorName;
    }

    if (cliOptions.authorEmail) {
      config.author.email = cliOptions.authorEmail;
    }
  }

  // Handle date range
  if (cliOptions.startDate || cliOptions.endDate || cliOptions.days) {
    config.dateRange = {};

    if (cliOptions.startDate) {
      config.dateRange.startDate = cliOptions.startDate;
    }

    if (cliOptions.endDate) {
      config.dateRange.endDate = cliOptions.endDate;
    } else if (cliOptions.days && !cliOptions.startDate && !cliOptions.endDate) {
      // If only days is provided, calculate date range 
      const daysBack = Number.parseInt(cliOptions.days, 10);
      const startDate = new Date(Date.now() - (daysBack - 1) * 24 * 60 * 60 * 1000);
      config.dateRange.startDate = startDate.toISOString().split('T')[0];
      config.dateRange.endDate = new Date().toISOString().split('T')[0];
    }
  }

  // Handle commits configuration
  if (cliOptions.commits || cliOptions.distribution || cliOptions.messageStyle || 
      cliOptions.pattern || cliOptions.customPattern || cliOptions.patternText || 
      cliOptions.patternScale || cliOptions.patternIntensity || cliOptions.patternRepeat) {
    config.commits = {};

    if (cliOptions.commits) {
      config.commits.maxPerDay = Number.parseInt(cliOptions.commits, 10);
    }

    if (cliOptions.distribution) {
      config.commits.distribution = cliOptions.distribution as CommitsConfig['distribution'];
    }

    if (cliOptions.messageStyle) {
      config.commits.messageStyle = cliOptions.messageStyle as CommitsConfig['messageStyle'];
    }

    // Handle pattern configuration
    if (cliOptions.pattern || cliOptions.customPattern || cliOptions.patternText || 
        cliOptions.patternScale || cliOptions.patternIntensity || cliOptions.patternRepeat) {
      config.commits.pattern = {};

      if (cliOptions.pattern) {
        config.commits.pattern.type = 'preset';
        config.commits.pattern.preset = cliOptions.pattern;
      } else if (cliOptions.customPattern) {
        config.commits.pattern.type = 'custom';
        config.commits.pattern.custom = cliOptions.customPattern;
      } else if (cliOptions.patternText) {
        config.commits.pattern.type = 'text';
        config.commits.pattern.text = cliOptions.patternText;
      }

      if (cliOptions.patternScale && config.commits.pattern) {
        config.commits.pattern.scale = Number.parseInt(cliOptions.patternScale, 10);
      }

      if (cliOptions.patternIntensity && config.commits.pattern) {
        config.commits.pattern.intensity = cliOptions.patternIntensity as PatternConfig['intensity'];
      }

      if (cliOptions.patternRepeat && config.commits.pattern) {
        config.commits.pattern.repeat = Number.parseInt(cliOptions.patternRepeat, 10);
      }

      // If pattern options are specified, automatically set distribution to 'pattern'
      if (!cliOptions.distribution) {
        config.commits.distribution = 'pattern';
      }
    }
  }

  // Handle options
  if (
    cliOptions.preview !== undefined ||
    cliOptions.push !== undefined ||
    cliOptions.verbose !== undefined ||
    cliOptions.dev !== undefined ||
    cliOptions.repoPath !== undefined ||
    cliOptions.yes !== undefined
  ) {
    config.options = {};

    if (cliOptions.preview !== undefined) {
      config.options.preview = cliOptions.preview;
    }

    if (cliOptions.push !== undefined) {
      config.options.push = cliOptions.push;
    }

    if (cliOptions.verbose !== undefined) {
      config.options.verbose = cliOptions.verbose;
    }

    if (cliOptions.dev !== undefined) {
      config.options.dev = cliOptions.dev;
    }

    if (cliOptions.repoPath !== undefined) {
      config.options.repositoryPath = cliOptions.repoPath;
    }

    if (cliOptions.yes !== undefined) {
      config.options.yes = cliOptions.yes;
    }
  }

  // Handle seed
  if (cliOptions.seed) {
    config.seed = cliOptions.seed;
  }

  return config;
}

/**
 * Deep merge configuration objects
 * @param target - Target configuration object
 * @param source - Source configuration object to merge
 * @returns Merged configuration object
 */
function deepMergeConfig(target: PartialConfig, source: PartialConfig): PartialConfig {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key as keyof PartialConfig];
    const targetValue = result[key as keyof PartialConfig];

    if (sourceValue !== undefined) {
      if (typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue)) {
        result[key as keyof PartialConfig] = {
          ...(targetValue as object),
          ...sourceValue,
        } as any;
      } else {
        result[key as keyof PartialConfig] = sourceValue as any;
      }
    }
  }

  return result;
}

/**
 * Apply default values to configuration
 * @param config - Partial configuration object
 * @returns Complete configuration with defaults applied
 */
export function applyDefaults(config: PartialConfig): Config {
  // Deep merge with defaults
  const mergedConfig = deepMergeConfig(
    {
      author: DEFAULT_CONFIG.author,
      dateRange: DEFAULT_CONFIG.dateRange,
      commits: DEFAULT_CONFIG.commits,
      options: DEFAULT_CONFIG.options,
      seed: DEFAULT_CONFIG.seed,
    },
    config
  );

  return {
    author: {
      name: mergedConfig.author?.name ?? DEFAULT_CONFIG.author.name,
      email: mergedConfig.author?.email ?? DEFAULT_CONFIG.author.email,
    },
    dateRange: {
      startDate: mergedConfig.dateRange?.startDate ?? DEFAULT_CONFIG.dateRange.startDate,
      endDate: mergedConfig.dateRange?.endDate ?? DEFAULT_CONFIG.dateRange.endDate,
    },
    commits: {
      maxPerDay: mergedConfig.commits?.maxPerDay ?? DEFAULT_CONFIG.commits.maxPerDay,
      distribution: mergedConfig.commits?.distribution ?? DEFAULT_CONFIG.commits.distribution,
      messageStyle: mergedConfig.commits?.messageStyle ?? DEFAULT_CONFIG.commits.messageStyle,
      ...(mergedConfig.commits?.pattern && { pattern: mergedConfig.commits.pattern }),
    },
    options: {
      preview: mergedConfig.options?.preview ?? DEFAULT_CONFIG.options.preview,
      push: mergedConfig.options?.push ?? DEFAULT_CONFIG.options.push,
      verbose: mergedConfig.options?.verbose ?? DEFAULT_CONFIG.options.verbose,
      dev: mergedConfig.options?.dev ?? DEFAULT_CONFIG.options.dev,
      repositoryPath: mergedConfig.options?.repositoryPath ?? DEFAULT_CONFIG.options.repositoryPath,
      yes: mergedConfig.options?.yes ?? DEFAULT_CONFIG.options.yes,
    },
    seed: mergedConfig.seed,
  };
}

/**
 * Load and merge configuration from file and CLI options
 * @param cliOptions - CLI options
 * @returns Complete validated configuration
 */
export async function loadConfig(cliOptions: CliOptions): Promise<Config> {
  let fileConfig: PartialConfig = {};

  // Load from config file if specified
  const configPath = cliOptions.config || './test-configs/fake-git.config.json';

  try {
    const loadedConfig = await loadConfigFromFile(configPath);
    if (loadedConfig) {
      fileConfig = loadedConfig;
    } else if (cliOptions.config) {
      // If config file was explicitly specified but doesn't exist, throw error
      throw new Error(`Configuration file not found: ${configPath}`);
    }
  } catch (error) {
    // If config file was explicitly specified but failed to load, throw error
    if (cliOptions.config) {
      throw error;
    }
    // Otherwise, silently continue with empty config (default behavior)
  }

  // Convert CLI options to config format
  const cliConfig = cliOptionsToConfig(cliOptions);

  // Merge configurations: defaults < file < CLI
  const mergedConfig = deepMergeConfig(fileConfig, cliConfig);

  // Apply defaults to any missing values
  const finalConfig = applyDefaults(mergedConfig);

  // Validate the final configuration
  const validation = validateConfig(finalConfig);
  if (!validation.valid) {
    throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
  }

  return finalConfig;
}

/**
 * Get default configuration
 * @returns Default configuration object
 */
export function getDefaultConfig(): Config {
  return { ...DEFAULT_CONFIG };
}
