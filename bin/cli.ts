#!/usr/bin/env node

import { Command } from 'commander';
import { main } from '../src/main.js';

const program = new Command();

program
  .name('fake-it-til-you-git')
  .description('A modern CLI tool to generate fake Git commit history for your GitHub profile')
  .version('1.0.0');

program
  .option('-d, --days <number>', 'Number of days to go back', '365')
  .option('-c, --commits <number>', 'Maximum commits per day', '10')
  .option('--start-date <date>', 'Start date (YYYY-MM-DD)')
  .option('--end-date <date>', 'End date (YYYY-MM-DD)')
  .option('--distribution <type>', 'Distribution type', 'random')
  .option('--message-style <style>', 'Message style', 'default')
  .option('--dry-run', 'Preview commits without creating them', false)
  .option('--config <path>', 'Path to config file', './fake-git.config.json')
  .option('--push', 'Push commits to remote repository', false)
  .option('--seed <number>', 'Random seed for reproducibility')
  .option('-v, --verbose', 'Verbose output', false);

program.parse();

const options = program.opts();

main(options).catch((error: Error) => {
  console.error('Error:', error.message);
  process.exit(1);
}); 