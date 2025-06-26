import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
  distribution: 'uniform' | 'random' | 'gaussian' | 'custom';
  messageStyle: 'default' | 'lorem' | 'emoji';
}

export interface OptionsConfig {
  dryRun: boolean;
  push: boolean;
  verbose: boolean;
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
  dryRun?: boolean;
  config?: string;
  push?: boolean;
  seed?: string;
  verbose?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Config = {
  author: {
    name: 'Fake Git User',
    email: 'fake@example.com'
  },
  dateRange: {
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  },
  commits: {
    maxPerDay: 10,
    distribution: 'random',
    messageStyle: 'default'
  },
  options: {
    dryRun: false,
    push: false,
    verbose: false
  }
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
    
    return parsedConfig;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${configPath}. ${error.message}`);
    }
    throw new Error(`Failed to load config file: ${configPath}. ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    } else if (cliOptions.days && !cliOptions.startDate) {
      // If only days is provided, calculate end date from today
      const daysBack = Number.parseInt(cliOptions.days, 10);
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      config.dateRange.startDate = startDate.toISOString().split('T')[0];
      config.dateRange.endDate = new Date().toISOString().split('T')[0];
    }
  }

  // Handle commits configuration
  if (cliOptions.commits || cliOptions.distribution || cliOptions.messageStyle) {
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
  }

  // Handle options
  if (cliOptions.dryRun !== undefined || cliOptions.push !== undefined || cliOptions.verbose !== undefined) {
    config.options = {};
    
    if (cliOptions.dryRun !== undefined) {
      config.options.dryRun = cliOptions.dryRun;
    }
    
    if (cliOptions.push !== undefined) {
      config.options.push = cliOptions.push;
    }
    
    if (cliOptions.verbose !== undefined) {
      config.options.verbose = cliOptions.verbose;
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
          ...targetValue as object,
          ...sourceValue
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
  const mergedConfig = deepMergeConfig({
    author: DEFAULT_CONFIG.author,
    dateRange: DEFAULT_CONFIG.dateRange,
    commits: DEFAULT_CONFIG.commits,
    options: DEFAULT_CONFIG.options,
    seed: DEFAULT_CONFIG.seed
  }, config);

  return {
    author: {
      name: mergedConfig.author?.name ?? DEFAULT_CONFIG.author.name,
      email: mergedConfig.author?.email ?? DEFAULT_CONFIG.author.email
    },
    dateRange: {
      startDate: mergedConfig.dateRange?.startDate ?? DEFAULT_CONFIG.dateRange.startDate,
      endDate: mergedConfig.dateRange?.endDate ?? DEFAULT_CONFIG.dateRange.endDate
    },
    commits: {
      maxPerDay: mergedConfig.commits?.maxPerDay ?? DEFAULT_CONFIG.commits.maxPerDay,
      distribution: mergedConfig.commits?.distribution ?? DEFAULT_CONFIG.commits.distribution,
      messageStyle: mergedConfig.commits?.messageStyle ?? DEFAULT_CONFIG.commits.messageStyle
    },
    options: {
      dryRun: mergedConfig.options?.dryRun ?? DEFAULT_CONFIG.options.dryRun,
      push: mergedConfig.options?.push ?? DEFAULT_CONFIG.options.push,
      verbose: mergedConfig.options?.verbose ?? DEFAULT_CONFIG.options.verbose
    },
    seed: mergedConfig.seed
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
  let mergedConfig = deepMergeConfig(fileConfig, cliConfig);
  
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