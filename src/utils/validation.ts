/**
 * Validation utilities for configuration and user inputs
 */

import { isValidDate, parseDate } from './dates.js';
import { type MessageStyle, validateCustomMessages } from './messages.js';

export interface Author {
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
  messageStyle: MessageStyle;
  customMessages?: string[];
}

export interface OptionsConfig {
  preview?: boolean;
  push?: boolean;
  verbose?: boolean;
  dev?: boolean;
  seed?: string;
}

export interface Config {
  author: Author;
  dateRange: DateRangeConfig;
  commits: CommitsConfig;
  options?: OptionsConfig;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates email format using a robust regex pattern
 */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();

  // Basic structure validation
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  if (!emailRegex.test(trimmed)) {
    return false;
  }

  // Additional validation for consecutive dots
  if (trimmed.includes('..')) {
    return false;
  }

  return true;
}

/**
 * Validates author name format
 */
export function isValidAuthorName(name: string): boolean {
  const trimmed = name.trim();

  // Must not be empty
  if (trimmed.length === 0) return false;

  // Must be reasonable length
  if (trimmed.length > 100) return false;

  // Must not contain control characters or line breaks
  if (/[\x00-\x1f\x7f-\x9f]/.test(trimmed)) return false;

  // Must not start or end with whitespace after trimming
  if (trimmed !== name) return false;

  return true;
}

/**
 * Validates author configuration
 */
export function validateAuthor(author: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!author || typeof author !== 'object') {
    errors.push('Author configuration must be an object');
    return { valid: false, errors, warnings };
  }

  const authorObj = author as Record<string, unknown>;

  // Validate name
  if (!authorObj.name || typeof authorObj.name !== 'string') {
    errors.push('Author name is required and must be a string');
  } else if (!isValidAuthorName(authorObj.name)) {
    errors.push('Author name is invalid (must be 1-100 characters, no control characters)');
  }

  // Validate email
  if (!authorObj.email || typeof authorObj.email !== 'string') {
    errors.push('Author email is required and must be a string');
  } else if (!isValidEmail(authorObj.email)) {
    errors.push('Author email format is invalid');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates date range configuration
 */
export function validateDateRange(dateRange: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!dateRange || typeof dateRange !== 'object') {
    errors.push('Date range configuration must be an object');
    return { valid: false, errors, warnings };
  }

  const rangeObj = dateRange as Record<string, unknown>;

  // Validate startDate
  if (!rangeObj.startDate || typeof rangeObj.startDate !== 'string') {
    errors.push('Start date is required and must be a string');
  } else if (!isValidDate(rangeObj.startDate)) {
    errors.push('Start date format is invalid (expected YYYY-MM-DD)');
  }

  // Validate endDate
  if (!rangeObj.endDate || typeof rangeObj.endDate !== 'string') {
    errors.push('End date is required and must be a string');
  } else if (!isValidDate(rangeObj.endDate)) {
    errors.push('End date format is invalid (expected YYYY-MM-DD)');
  }

  // Validate date range logic
  if (errors.length === 0) {
    const startDate = parseDate(rangeObj.startDate as string);
    const endDate = parseDate(rangeObj.endDate as string);

    if (startDate && endDate) {
      if (startDate > endDate) {
        errors.push('Start date must be before or equal to end date');
      }

      // Check if the range is too far in the future
      const today = new Date();
      if (endDate > today) {
        warnings.push('End date is in the future');
      }

      // Check if the range is very large
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 3650) {
        // More than 10 years
        warnings.push('Date range spans more than 10 years, this may take a while');
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates commits configuration
 */
export function validateCommits(commits: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!commits || typeof commits !== 'object') {
    errors.push('Commits configuration must be an object');
    return { valid: false, errors, warnings };
  }

  const commitsObj = commits as Record<string, unknown>;

  // Validate maxPerDay
  if (commitsObj.maxPerDay === undefined || commitsObj.maxPerDay === null) {
    errors.push('maxPerDay is required');
  } else if (typeof commitsObj.maxPerDay !== 'number' || !Number.isInteger(commitsObj.maxPerDay)) {
    errors.push('maxPerDay must be an integer');
  } else if (commitsObj.maxPerDay < 1) {
    errors.push('maxPerDay must be at least 1');
  } else if (commitsObj.maxPerDay > 100) {
    warnings.push('maxPerDay is very high (>100), this may create unrealistic commit patterns');
  }

  // Validate distribution
  const validDistributions = ['uniform', 'random', 'gaussian', 'custom'];
  if (!commitsObj.distribution || typeof commitsObj.distribution !== 'string') {
    errors.push('Distribution is required and must be a string');
  } else if (!validDistributions.includes(commitsObj.distribution)) {
    errors.push(`Distribution must be one of: ${validDistributions.join(', ')}`);
  }

  // Validate messageStyle
  const validMessageStyles: MessageStyle[] = ['default', 'lorem', 'emoji'];
  if (!commitsObj.messageStyle || typeof commitsObj.messageStyle !== 'string') {
    errors.push('Message style is required and must be a string');
  } else if (!validMessageStyles.includes(commitsObj.messageStyle as MessageStyle)) {
    errors.push(`Message style must be one of: ${validMessageStyles.join(', ')}`);
  }

  // Validate customMessages if present
  if (commitsObj.customMessages !== undefined) {
    if (!Array.isArray(commitsObj.customMessages)) {
      errors.push('Custom messages must be an array');
    } else {
      const messageValidation = validateCustomMessages(commitsObj.customMessages);
      if (!messageValidation.valid) {
        errors.push(...messageValidation.errors.map((err) => `Custom messages: ${err}`));
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates options configuration
 */
export function validateOptions(options: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Options are optional, so undefined/null is valid
  if (!options) {
    return { valid: true, errors, warnings };
  }

  if (typeof options !== 'object') {
    errors.push('Options configuration must be an object');
    return { valid: false, errors, warnings };
  }

  const optionsObj = options as Record<string, unknown>;

  // Validate preview
  if (optionsObj.preview !== undefined && typeof optionsObj.preview !== 'boolean') {
    errors.push('preview option must be a boolean');
  }

  // Validate dev
  if (optionsObj.dev !== undefined && typeof optionsObj.dev !== 'boolean') {
    errors.push('dev option must be a boolean');
  }

  // Validate push
  if (optionsObj.push !== undefined && typeof optionsObj.push !== 'boolean') {
    errors.push('push option must be a boolean');
  }

  // Validate verbose
  if (optionsObj.verbose !== undefined && typeof optionsObj.verbose !== 'boolean') {
    errors.push('verbose option must be a boolean');
  }

  // Validate seed
  if (optionsObj.seed !== undefined) {
    if (typeof optionsObj.seed !== 'string') {
      errors.push('seed option must be a string');
    } else if (optionsObj.seed.trim().length === 0) {
      errors.push('seed option cannot be empty');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validates the complete configuration object
 */
export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be an object');
    return { valid: false, errors, warnings };
  }

  const configObj = config as Record<string, unknown>;

  // Validate each section
  const authorValidation = validateAuthor(configObj.author);
  const dateRangeValidation = validateDateRange(configObj.dateRange);
  const commitsValidation = validateCommits(configObj.commits);
  const optionsValidation = validateOptions(configObj.options);

  // Collect all errors and warnings
  errors.push(...authorValidation.errors);
  errors.push(...dateRangeValidation.errors);
  errors.push(...commitsValidation.errors);
  errors.push(...optionsValidation.errors);

  warnings.push(...authorValidation.warnings);
  warnings.push(...dateRangeValidation.warnings);
  warnings.push(...commitsValidation.warnings);
  warnings.push(...optionsValidation.warnings);

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Sanitizes a string by trimming whitespace and removing control characters
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '') // Remove control characters but keep \t (\x09) and \n (\x0a)
    .replace(/\s+/g, ' ') // Normalize whitespace (including tabs and newlines to spaces)
    .trim(); // Trim after normalization
}

/**
 * Sanitizes an email address
 */
export function sanitizeEmail(email: string): string {
  return sanitizeString(email).toLowerCase();
}

/**
 * Sanitizes an author name
 */
export function sanitizeAuthorName(name: string): string {
  const sanitized = sanitizeString(name);
  // Ensure it doesn't exceed max length
  return sanitized.length > 100 ? sanitized.substring(0, 100).trim() : sanitized;
}

/**
 * Sanitizes the entire configuration object
 */
export function sanitizeConfig(config: Config): Config {
  const sanitized: Config = {
    author: {
      name: sanitizeAuthorName(config.author.name),
      email: sanitizeEmail(config.author.email),
    },
    dateRange: {
      startDate: sanitizeString(config.dateRange.startDate),
      endDate: sanitizeString(config.dateRange.endDate),
    },
    commits: {
      maxPerDay: Math.max(1, Math.floor(Math.abs(config.commits.maxPerDay))),
      distribution: config.commits.distribution,
      messageStyle: config.commits.messageStyle,
      ...(config.commits.customMessages && {
        customMessages: config.commits.customMessages
          .map((msg) => sanitizeString(msg))
          .filter((msg) => msg.length > 0),
      }),
    },
    options: config.options
      ? {
          preview: Boolean(config.options.preview),
          push: Boolean(config.options.push),
          verbose: Boolean(config.options.verbose),
          dev: Boolean(config.options.dev),
          ...(config.options.seed && { seed: sanitizeString(config.options.seed) }),
        }
      : {},
  };

  return sanitized;
}
