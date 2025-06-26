/**
 * Commit generation and distribution algorithms
 * This module handles the logic for distributing commits across date ranges
 * using different distribution strategies.
 */

import { randomInt } from 'node:crypto';
import type { Config } from './config.js';
import { generateDateRange, parseDate } from './utils/dates.js';

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
