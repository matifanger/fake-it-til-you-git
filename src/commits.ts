/**
 * Commit generation and distribution algorithms
 * This module handles the logic for distributing commits across date ranges
 * using different distribution strategies.
 */

import { randomInt } from 'node:crypto';
import type { Config } from './config.js';
import { generateDateRange, parseDate } from './utils/dates.js';
import { generateRandomMessage, type MessageStyle } from './utils/messages.js';
import { GitOperations } from './git.js';

export interface CommitPlan {
  date: Date;
  count: number;
  messages: string[];
}

export interface DistributionParams {
  totalDays: number;
  maxPerDay: number;
  seed?: string;
}

export interface GaussianDistributionParams extends DistributionParams {
  mean?: number; // Center of the distribution as a ratio (0-1) of the date range
  stdDev?: number; // Standard deviation as a ratio (0-1) of the date range
}

export interface CustomDistributionParams extends DistributionParams {
  pattern?: number[]; // Custom pattern to repeat across the date range
  weights?: number[]; // Weights for different days of the week (0=Sunday, 6=Saturday)
}

/**
 * Seeded random number generator for reproducible results
 */
class SeededRandom {
  private seed: number;

  constructor(seed?: string) {
    // Convert string seed to number, or use current time
    this.seed = seed ? this.hashString(seed) : Date.now();
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate a random number between 0 and 1
   */
  random(): number {
    // Linear congruential generator
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Generate a random integer between min (inclusive) and max (exclusive)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min;
  }

  /**
   * Generate a random number following normal distribution
   * Box-Muller transformation
   */
  randomGaussian(mean = 0, stdDev = 1): number {
    let u = 0,
      v = 0;
    while (u === 0) u = this.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = this.random();

    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
  }
}

/**
 * Generate commits using uniform distribution
 * Distributes commits evenly across the date range
 */
export function generateUniformDistribution(
  dateRange: Date[],
  params: DistributionParams
): CommitPlan[] {
  const rng = new SeededRandom(params.seed);
  const plans: CommitPlan[] = [];

  for (const date of dateRange) {
    // Uniform distribution: each day has the same probability
    const commitCount = rng.randomInt(1, params.maxPerDay + 1);

    plans.push({
      date: new Date(date),
      count: commitCount,
      messages: [], // Will be filled later with actual messages
    });
  }

  return plans;
}

/**
 * Generate commits using random distribution
 * Each day has a random chance of having commits, with random counts
 */
export function generateRandomDistribution(
  dateRange: Date[],
  params: DistributionParams
): CommitPlan[] {
  const rng = new SeededRandom(params.seed);
  const plans: CommitPlan[] = [];

  for (const date of dateRange) {
    // Random chance of having commits (70% chance)
    if (rng.random() < 0.7) {
      // Random number of commits, weighted towards lower numbers
      const randomValue = rng.random();
      let commitCount: number;

      if (randomValue < 0.5) {
        // 50% chance of 1-3 commits (or 1-maxPerDay if maxPerDay < 3)
        commitCount = rng.randomInt(1, Math.min(4, params.maxPerDay + 1));
      } else if (randomValue < 0.8) {
        // 30% chance of 4-7 commits (or up to maxPerDay)
        const minCommits = Math.min(4, params.maxPerDay);
        const maxCommits = Math.min(8, params.maxPerDay + 1);
        commitCount = rng.randomInt(minCommits, Math.max(minCommits + 1, maxCommits));
      } else {
        // 20% chance of 8-maxPerDay commits
        const minCommits = Math.min(8, params.maxPerDay);
        commitCount = rng.randomInt(minCommits, Math.max(minCommits + 1, params.maxPerDay + 1));
      }

      plans.push({
        date: new Date(date),
        count: commitCount,
        messages: [],
      });
    } else {
      // No commits for this day
      plans.push({
        date: new Date(date),
        count: 0,
        messages: [],
      });
    }
  }

  return plans;
}

/**
 * Generate commits using Gaussian (normal) distribution
 * Concentrates commits around a central period with natural falloff
 */
export function generateGaussianDistribution(
  dateRange: Date[],
  params: GaussianDistributionParams
): CommitPlan[] {
  const rng = new SeededRandom(params.seed);
  const plans: CommitPlan[] = [];

  const totalDays = dateRange.length;
  const mean = params.mean ?? 0.5; // Default to middle of range
  const stdDev = params.stdDev ?? 0.2; // Default to 20% of range

  // Convert mean and stdDev from ratios to actual day indices
  const meanDay = mean * totalDays;
  const stdDevDays = stdDev * totalDays;

  for (let i = 0; i < dateRange.length; i++) {
    const date = dateRange[i];

    // Calculate probability based on distance from mean
    const distanceFromMean = Math.abs(i - meanDay);
    const normalizedDistance = distanceFromMean / stdDevDays;

    // Gaussian probability function
    const probability = Math.exp(-0.5 * normalizedDistance * normalizedDistance);

    // Scale probability to get actual commit count
    const baseCommitCount = probability * params.maxPerDay;

    // Add some randomness
    const commitCount = Math.max(
      0,
      Math.round(baseCommitCount + rng.randomGaussian(0, baseCommitCount * 0.3))
    );

    if (commitCount > 0) {
      plans.push({
        date: new Date(date),
        count: Math.min(commitCount, params.maxPerDay),
        messages: [],
      });
    } else {
      plans.push({
        date: new Date(date),
        count: 0,
        messages: [],
      });
    }
  }

  return plans;
}

/**
 * Generate commits using custom distribution
 * Allows for custom patterns and day-of-week weights
 */
export function generateCustomDistribution(
  dateRange: Date[],
  params: CustomDistributionParams
): CommitPlan[] {
  const rng = new SeededRandom(params.seed);
  const plans: CommitPlan[] = [];

  // Default day-of-week weights (higher for weekdays)
  const defaultWeights = [0.3, 0.8, 0.9, 0.9, 0.9, 0.8, 0.4]; // Sun-Sat
  const dayWeights = params.weights ?? defaultWeights;

  for (let i = 0; i < dateRange.length; i++) {
    const date = dateRange[i];
    const dayOfWeek = date.getDay();

    let commitCount = 0;

    if (params.pattern && params.pattern.length > 0) {
      // Use custom pattern
      const patternIndex = i % params.pattern.length;
      const patternValue = params.pattern[patternIndex];
      commitCount = patternValue;
    } else {
      // Use day-of-week weights
      const weight = dayWeights[dayOfWeek];
      const baseCount = Math.floor(params.maxPerDay * weight);

      // Add some randomness
      const variance = Math.floor(baseCount * 0.3);
      commitCount = Math.max(0, baseCount + rng.randomInt(-variance, variance + 1));
    }

    plans.push({
      date: new Date(date),
      count: Math.min(commitCount, params.maxPerDay),
      messages: [],
    });
  }

  return plans;
}

/**
 * Generate commit plan based on configuration
 * Main entry point for commit generation
 */
export function generateCommitPlan(config: Config): CommitPlan[] {
  const startDate = parseDate(config.dateRange.startDate);
  const endDate = parseDate(config.dateRange.endDate);

  if (!startDate || !endDate) {
    throw new Error('Invalid date range: start and end dates must be valid');
  }

  const dateRange = generateDateRange(startDate, endDate);

  const baseParams: DistributionParams = {
    totalDays: dateRange.length,
    maxPerDay: config.commits.maxPerDay,
    seed: config.seed,
  };

  switch (config.commits.distribution) {
    case 'uniform':
      return generateUniformDistribution(dateRange, baseParams);

    case 'random':
      return generateRandomDistribution(dateRange, baseParams);

    case 'gaussian':
      return generateGaussianDistribution(dateRange, {
        ...baseParams,
        mean: 0.5, // Center of the date range
        stdDev: 0.25, // 25% of the range
      });

    case 'custom':
      return generateCustomDistribution(dateRange, {
        ...baseParams,
        // Default pattern emphasizes weekdays
        weights: [0.2, 0.8, 1.0, 1.0, 1.0, 0.8, 0.3],
      });

    default:
      throw new Error(`Unknown distribution type: ${config.commits.distribution}`);
  }
}

/**
 * Calculate statistics for a commit plan
 */
export function calculateCommitStats(plans: CommitPlan[]): {
  totalCommits: number;
  totalDays: number;
  activeDays: number;
  averagePerDay: number;
  maxPerDay: number;
  minPerDay: number;
} {
  const totalCommits = plans.reduce((sum, plan) => sum + plan.count, 0);
  const totalDays = plans.length;
  const activeDays = plans.filter((plan) => plan.count > 0).length;
  const commitCounts = plans.map((plan) => plan.count);

  return {
    totalCommits,
    totalDays,
    activeDays,
    averagePerDay: activeDays > 0 ? totalCommits / activeDays : 0,
    maxPerDay: Math.max(...commitCounts),
    minPerDay: Math.min(...commitCounts),
  };
}

/**
 * Result of commit creation process
 */
export interface CommitCreationResult {
  success: boolean;
  totalCommits: number;
  successfulCommits: number;
  failedCommits: number;
  errors: string[];
  commitHashes: string[];
  duration: number; // in milliseconds
}

/**
 * Populate commit plan with actual messages based on style
 */
export function populateCommitMessages(
  plans: CommitPlan[],
  config: Config
): CommitPlan[] {
  const style = config.commits.messageStyle;
  const customMessages: string[] = []; // TODO: Add support for custom messages in config
  const seed = config.seed;

  return plans.map((plan) => {
    const messages: string[] = [];

    for (let i = 0; i < plan.count; i++) {
      try {
        const message = generateRandomMessage({
          style: style as MessageStyle,
          customMessages,
          seed: seed ? `${seed}-${plan.date.toISOString()}-${i}` : undefined,
        });
        messages.push(message);
      } catch (error) {
        // Fallback to simple numbered message if generation fails
        const fallbackMessage = `Update ${i + 1}`;
        messages.push(fallbackMessage);
        console.warn(
          `Failed to generate message for ${plan.date.toISOString()}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }. Using fallback: "${fallbackMessage}"`
        );
      }
    }

    return {
      ...plan,
      messages,
    };
  });
}

/**
 * Create actual commits based on the populated commit plan
 */
export async function createCommitsFromPlan(
  plans: CommitPlan[],
  config: Config,
  gitOps: GitOperations
): Promise<CommitCreationResult> {
  const startTime = Date.now();
  const result: CommitCreationResult = {
    success: false,
    totalCommits: 0,
    successfulCommits: 0,
    failedCommits: 0,
    errors: [],
    commitHashes: [],
    duration: 0,
  };

  // Calculate total commits to create
  result.totalCommits = plans.reduce((sum, plan) => sum + plan.count, 0);

  if (result.totalCommits === 0) {
    result.success = true;
    result.duration = Date.now() - startTime;
    return result;
  }

  try {
    // Ensure we have a clean working directory
    const isClean = await gitOps.isWorkingDirectoryClean();
    if (!isClean) {
      throw new Error(
        'Working directory is not clean. Please commit or stash your changes before proceeding.'
      );
    }

    // Create a backup before starting
    let backup;
    try {
      backup = await gitOps.createBackup();
      console.log(`Created backup: ${backup.id}`);
    } catch (error) {
      console.warn(
        `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Process each day's commits
    for (const plan of plans) {
      if (plan.count === 0 || plan.messages.length === 0) {
        continue;
      }

      // Create commits for this day
      for (let i = 0; i < plan.count && i < plan.messages.length; i++) {
        try {
          // Add a small dummy file change for each commit
          const commitMessage = plan.messages[i];
          const commitDate = new Date(plan.date);
          
          // Add slight time variation to avoid conflicts (spread commits across the day)
          const hoursOffset = Math.floor((i * 24) / plan.count);
          const minutesOffset = Math.floor(Math.random() * 60);
          commitDate.setHours(hoursOffset, minutesOffset, 0, 0);

          const author = {
            name: config.author.name,
            email: config.author.email,
          };

          // Ensure there's something to commit by adding all changes
          await gitOps.addAll();

          const commitResult = await gitOps.createCommit(commitMessage, commitDate, author);

          result.commitHashes.push(commitResult.commit);
          result.successfulCommits++;

          // Optional: Add a small delay to avoid overwhelming the system
          if (result.totalCommits > 100 && i % 10 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        } catch (error) {
          const errorMessage = `Failed to create commit on ${plan.date.toISOString()}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          result.errors.push(errorMessage);
          result.failedCommits++;
          console.error(errorMessage);

          // If too many commits are failing, abort the process
          if (result.failedCommits > 10) {
            throw new Error(
              `Too many commit failures (${result.failedCommits}). Aborting to prevent further issues.`
            );
          }
        }
      }
    }

    // Check final success status
    result.success = result.failedCommits === 0 || result.successfulCommits > 0;

    if (result.success) {
      console.log(
        `Successfully created ${result.successfulCommits}/${result.totalCommits} commits`
      );
    } else {
      console.error(
        `Commit creation failed: ${result.failedCommits} failures out of ${result.totalCommits} attempts`
      );
    }
  } catch (error) {
    const errorMessage = `Critical error during commit creation: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`;
    result.errors.push(errorMessage);
    result.success = false;
    console.error(errorMessage);
  }

  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Main function to generate and create commits based on configuration
 * This is the main entry point for Step 5.2
 */
export async function generateAndCreateCommits(
  config: Config,
  gitOps: GitOperations
): Promise<CommitCreationResult> {
  try {
    console.log('Generating commit plan...');
    
    // Step 1: Generate the distribution plan
    const rawPlans = generateCommitPlan(config);
    
    // Step 2: Populate with actual messages
    console.log('Populating commit messages...');
    const populatedPlans = populateCommitMessages(rawPlans, config);
    
    // Step 3: Display preview statistics
    const stats = calculateCommitStats(populatedPlans);
    console.log('\nCommit Plan Statistics:');
    console.log(`  Total commits: ${stats.totalCommits}`);
    console.log(`  Active days: ${stats.activeDays}/${stats.totalDays}`);
    console.log(`  Average per active day: ${stats.averagePerDay.toFixed(1)}`);
    console.log(`  Max per day: ${stats.maxPerDay}`);
    console.log(`  Date range: ${populatedPlans[0]?.date.toISOString().split('T')[0]} to ${populatedPlans[populatedPlans.length - 1]?.date.toISOString().split('T')[0]}`);
    
    // Step 4: Create the actual commits
    console.log('\nCreating commits...');
    const result = await createCommitsFromPlan(populatedPlans, config, gitOps);
    
    return result;
  } catch (error) {
    const errorMessage = `Failed to generate and create commits: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`;
    
    return {
      success: false,
      totalCommits: 0,
      successfulCommits: 0,
      failedCommits: 1,
      errors: [errorMessage],
      commitHashes: [],
      duration: 0,
    };
  }
}

/**
 * Validate commit plan before execution
 */
export function validateCommitPlan(
  plans: CommitPlan[],
  config: Config
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate basic structure
  if (!Array.isArray(plans) || plans.length === 0) {
    errors.push('Commit plan is empty or invalid');
    return { valid: false, errors, warnings };
  }

  // Check for required fields
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    
    if (!plan.date || !(plan.date instanceof Date)) {
      errors.push(`Plan at index ${i} has invalid date`);
    }
    
    if (typeof plan.count !== 'number' || plan.count < 0) {
      errors.push(`Plan at index ${i} has invalid commit count`);
    }
    
    if (plan.count > 0 && (!plan.messages || plan.messages.length === 0)) {
      warnings.push(`Plan at index ${i} has commits but no messages`);
    }
    
    if (plan.count > config.commits.maxPerDay) {
      warnings.push(
        `Plan at index ${i} exceeds maxPerDay limit (${plan.count} > ${config.commits.maxPerDay})`
      );
    }
  }

  // Check total volume
  const totalCommits = plans.reduce((sum, plan) => sum + plan.count, 0);
  if (totalCommits > 10000) {
    warnings.push(
      `Large number of commits planned (${totalCommits}). This may take a long time to execute.`
    );
  }

  // Check date ordering
  for (let i = 1; i < plans.length; i++) {
    if (plans[i].date < plans[i - 1].date) {
      errors.push('Commit plan dates are not in chronological order');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
