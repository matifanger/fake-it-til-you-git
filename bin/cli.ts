#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import { main } from '../src/main.js';

const program = new Command();

program
  .name('fake-it-til-you-git')
  .description('A modern CLI tool to generate fake Git commit history for your GitHub profile')
  .version('1.0.0')
  .addHelpText(
    'after',
    `
${chalk.cyan('Examples:')}
  ${chalk.dim('# Generate 30 days of commits with default settings')}
  fake-it-til-you-git --days 30

  ${chalk.dim('# Generate commits for a specific date range')}
  fake-it-til-you-git --start-date 2023-01-01 --end-date 2023-12-31

  ${chalk.dim('# Generate commits with custom author and distribution')}
  fake-it-til-you-git --author-name "John Doe" --author-email "john@example.com" --distribution uniform

  ${chalk.dim('# Preview commits without creating them')}
  fake-it-til-you-git --preview --verbose

  ${chalk.dim('# Use a custom configuration file')}
  fake-it-til-you-git --config my-config.json

  ${chalk.dim('# Generate reproducible results with seed')}
  fake-it-til-you-git --seed "my-seed-123" --commits 5

  ${chalk.dim('# Development mode (use test-repo directory)')}
  fake-it-til-you-git --dev --commits 10 --days 30

${chalk.cyan('Configuration:')}
  You can use a JSON configuration file to set defaults. CLI arguments will override config file values.
  See test-configs/fake-git.config.json for an example.

${chalk.cyan('Distribution Types:')}
  • uniform    - Evenly distributed commits across the date range
  • random     - Random distribution (default)
  • gaussian   - Bell curve distribution (more commits in the middle)
  • custom     - Custom distribution pattern

${chalk.cyan('Message Styles:')}
  • default    - Realistic commit messages (default)
  • lorem      - Lorem ipsum style messages
  • emoji      - Messages with emojis
`
  );

// Date and Range Options
program
  .option(
    '-d, --days <number>',
    'Number of days to go back from today (e.g., 365 for one year)',
    validateDays,
    '365'
  )
  .option('--start-date <date>', 'Start date in YYYY-MM-DD format (e.g., 2023-01-01)', validateDate)
  .option('--end-date <date>', 'End date in YYYY-MM-DD format (e.g., 2023-12-31)', validateDate);

// Commit Configuration
program
  .option(
    '-c, --commits <number>',
    'Maximum commits per day (1-100, default: 10)',
    validateCommits,
    '10'
  )
  .option(
    '--distribution <type>',
    'Distribution type: uniform, random, gaussian, custom (default: random)',
    validateDistribution,
    'random'
  )
  .option(
    '--message-style <style>',
    'Message style: default, lorem, emoji (default: default)',
    validateMessageStyle,
    'default'
  );

// Author Configuration
program
  .option('--author-name <name>', 'Git author name (overrides config file)')
  .option('--author-email <email>', 'Git author email (overrides config file)', validateEmail);

// Behavior Options
program
  .option('--preview', 'Preview commits without creating them (safe mode)', false)
  .option(
    '--config <path>',
    'Path to JSON configuration file (default: ./test-configs/fake-git.config.json)',
    './test-configs/fake-git.config.json'
  )
  .option('--push', 'Push commits to remote repository after creation', false)
  .option('--seed <string>', 'Random seed for reproducible results (any string)')
  .option('--dev', 'Development mode: use test-repo directory instead of current directory', false)
  .option('-v, --verbose', 'Enable verbose output for debugging', false);

// Validation functions
function validateDays(value: string): string {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num) || num < 1 || num > 3650) {
    throw new Error(`Invalid days value: ${value}. Must be between 1 and 3650.`);
  }
  return value;
}

function validateCommits(value: string): string {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num) || num < 1 || num > 100) {
    throw new Error(`Invalid commits value: ${value}. Must be between 1 and 100.`);
  }
  return value;
}

function validateDate(value: string): string {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    throw new Error(`Invalid date format: ${value}. Use YYYY-MM-DD format.`);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}. Please provide a valid date.`);
  }

  // Check if date is not too far in the future (more than 1 year)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (date > oneYearFromNow) {
    throw new Error(
      `Date too far in the future: ${value}. Please use a date within one year from now.`
    );
  }

  return value;
}

function validateDistribution(value: string): string {
  const validDistributions = ['uniform', 'random', 'gaussian', 'custom'];
  if (!validDistributions.includes(value)) {
    throw new Error(
      `Invalid distribution: ${value}. Valid options: ${validDistributions.join(', ')}`
    );
  }
  return value;
}

function validateMessageStyle(value: string): string {
  const validStyles = ['default', 'lorem', 'emoji'];
  if (!validStyles.includes(value)) {
    throw new Error(`Invalid message style: ${value}. Valid options: ${validStyles.join(', ')}`);
  }
  return value;
}

function validateEmail(value: string): string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    throw new Error(`Invalid email format: ${value}. Please provide a valid email address.`);
  }
  return value;
}

// Custom error handling for argument validation
program.exitOverride();

try {
  program.parse();
} catch (error: any) {
  // Handle Commander.js specific errors
  if (error.code === 'commander.version' || error.code === 'commander.helpDisplayed') {
    // These are normal exit cases, not errors
    process.exit(0);
  }

  if (error instanceof Error) {
    if (error.message.includes('unknown option')) {
      // Commander.js unknown option error
      console.error(chalk.red('❌ CLI Error:'), error.message);
      console.log(chalk.dim('\nUse --help for usage information.'));
    } else {
      // Validation error
      console.error(chalk.red('❌ Validation Error:'), error.message);
      console.log(chalk.dim('\nUse --help for usage information.'));
    }
    process.exit(1);
  }
  throw error;
}

const options = program.opts();

// Additional validation for option combinations
try {
  validateOptionCombinations(options);
} catch (error) {
  console.error(
    chalk.red('❌ Configuration Error:'),
    error instanceof Error ? error.message : 'Unknown error'
  );
  console.log(chalk.dim('\nUse --help for usage information.'));
  process.exit(1);
}

// Enhanced error handling for main function
main(options).catch((error: Error) => {
  console.error(chalk.red('❌ Error:'), error.message);

  if (options.verbose) {
    console.error(chalk.dim('\nStack trace:'));
    console.error(chalk.dim(error.stack));
  }

  console.log(chalk.dim('\nUse --verbose for more details or --help for usage information.'));
  process.exit(1);
});

/**
 * Validates combinations of options to ensure they make sense together
 */
function validateOptionCombinations(options: Record<string, any>): void {
  // Validate date range logic
  if (options.startDate && options.endDate) {
    const startDate = new Date(options.startDate);
    const endDate = new Date(options.endDate);

    if (startDate >= endDate) {
      throw new Error('Start date must be before end date.');
    }

    // Check if date range is too large (more than 10 years)
    const maxRange = 10 * 365 * 24 * 60 * 60 * 1000; // 10 years in milliseconds
    if (endDate.getTime() - startDate.getTime() > maxRange) {
      throw new Error('Date range too large. Maximum supported range is 10 years.');
    }
  }

  // Validate that days option doesn't conflict with date range
  // Only check if days was explicitly provided (not just default value)
  const daysWasExplicitlyProvided = process.argv.includes('--days') || process.argv.includes('-d');
  if (daysWasExplicitlyProvided && (options.startDate || options.endDate)) {
    throw new Error(
      'Cannot use --days option together with --start-date or --end-date. Choose one approach.'
    );
  }

  // Validate seed is not empty if provided
  if (options.seed && typeof options.seed === 'string' && options.seed.trim().length === 0) {
    throw new Error('Seed cannot be empty. Provide a meaningful string value.');
  }

  // Warn about potentially problematic combinations
  if (options.commits && Number.parseInt(options.commits, 10) > 50 && !options.preview) {
    console.warn(
      chalk.yellow(
        '⚠️  Warning: High commits per day (>50) may create unrealistic patterns. Consider using --preview first.'
      )
    );
  }

  if (options.push && options.preview) {
    console.warn(chalk.yellow('⚠️  Warning: --push option ignored in preview mode.'));
  }
}
