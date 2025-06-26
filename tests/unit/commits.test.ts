/**
 * Tests for commit generation and distribution algorithms
 */

import {
  type CommitPlan,
  type CustomDistributionParams,
  type DistributionParams,
  type GaussianDistributionParams,
  calculateCommitStats,
  generateCommitPlan,
  generateCustomDistribution,
  generateGaussianDistribution,
  generateRandomDistribution,
  generateUniformDistribution,
} from '../../src/commits.js';
import type { Config } from '../../src/config.js';
import { generateDateRange, parseDate } from '../../src/utils/dates.js';

describe('Commit Distribution Algorithms', () => {
  const testDateRange = generateDateRange(new Date('2023-01-01'), new Date('2023-01-31'));

  const baseParams: DistributionParams = {
    totalDays: testDateRange.length,
    maxPerDay: 10,
    seed: 'test-seed',
  };

  describe('generateUniformDistribution', () => {
    it('should generate commits for all days', () => {
      const plans = generateUniformDistribution(testDateRange, baseParams);

      expect(plans).toHaveLength(testDateRange.length);
      expect(plans.every((plan) => plan.count > 0)).toBe(true);
      expect(plans.every((plan) => plan.count <= baseParams.maxPerDay)).toBe(true);
    });

    it('should be reproducible with same seed', () => {
      const plans1 = generateUniformDistribution(testDateRange, baseParams);
      const plans2 = generateUniformDistribution(testDateRange, baseParams);

      expect(plans1).toEqual(plans2);
    });

    it('should produce different results with different seeds', () => {
      const plans1 = generateUniformDistribution(testDateRange, { ...baseParams, seed: 'seed1' });
      const plans2 = generateUniformDistribution(testDateRange, { ...baseParams, seed: 'seed2' });

      const areDifferent = plans1.some((plan, index) => plan.count !== plans2[index].count);
      expect(areDifferent).toBe(true);
    });

    it('should respect maxPerDay constraint', () => {
      const maxPerDay = 5;
      const plans = generateUniformDistribution(testDateRange, { ...baseParams, maxPerDay });

      expect(plans.every((plan) => plan.count <= maxPerDay)).toBe(true);
    });

    it('should generate consistent distribution across multiple runs', () => {
      const runs = 5;
      const allPlans: CommitPlan[][] = [];

      for (let i = 0; i < runs; i++) {
        allPlans.push(generateUniformDistribution(testDateRange, baseParams));
      }

      // All runs should be identical with same seed
      for (let i = 1; i < runs; i++) {
        expect(allPlans[i]).toEqual(allPlans[0]);
      }
    });
  });

  describe('generateRandomDistribution', () => {
    it('should generate varying commit patterns', () => {
      const plans = generateRandomDistribution(testDateRange, baseParams);

      expect(plans).toHaveLength(testDateRange.length);

      // Should have some days with no commits
      const daysWithNoCommits = plans.filter((plan) => plan.count === 0).length;
      expect(daysWithNoCommits).toBeGreaterThan(0);

      // Should have some days with commits
      const daysWithCommits = plans.filter((plan) => plan.count > 0).length;
      expect(daysWithCommits).toBeGreaterThan(0);
    });

    it('should be reproducible with same seed', () => {
      const plans1 = generateRandomDistribution(testDateRange, baseParams);
      const plans2 = generateRandomDistribution(testDateRange, baseParams);

      expect(plans1).toEqual(plans2);
    });

    it('should respect maxPerDay constraint', () => {
      const maxPerDay = 3;
      const plans = generateRandomDistribution(testDateRange, { ...baseParams, maxPerDay });

      expect(plans.every((plan) => plan.count <= maxPerDay)).toBe(true);
    });

    it('should vary appropriately across different seeds', () => {
      const plans1 = generateRandomDistribution(testDateRange, { ...baseParams, seed: 'seed1' });
      const plans2 = generateRandomDistribution(testDateRange, { ...baseParams, seed: 'seed2' });

      const areDifferent = plans1.some((plan, index) => plan.count !== plans2[index].count);
      expect(areDifferent).toBe(true);
    });

    it('should have reasonable activity rate (around 70%)', () => {
      const plans = generateRandomDistribution(testDateRange, baseParams);
      const activeDays = plans.filter((plan) => plan.count > 0).length;
      const activityRate = activeDays / plans.length;

      // Should be around 70% with some tolerance
      expect(activityRate).toBeGreaterThan(0.5);
      expect(activityRate).toBeLessThan(0.9);
    });
  });

  describe('generateGaussianDistribution', () => {
    const gaussianParams: GaussianDistributionParams = {
      ...baseParams,
      mean: 0.5,
      stdDev: 0.2,
    };

    it('should follow gaussian curve pattern', () => {
      const plans = generateGaussianDistribution(testDateRange, gaussianParams);

      expect(plans).toHaveLength(testDateRange.length);

      // Find the peak (should be around the middle)
      const middleIndex = Math.floor(plans.length / 2);
      const middleCount = plans[middleIndex].count;

      // Commits around the middle should be higher than at the edges
      const edgeCount1 = plans[0].count;
      const edgeCount2 = plans[plans.length - 1].count;

      expect(middleCount).toBeGreaterThanOrEqual(Math.max(edgeCount1, edgeCount2));
    });

    it('should be reproducible with same seed', () => {
      const plans1 = generateGaussianDistribution(testDateRange, gaussianParams);
      const plans2 = generateGaussianDistribution(testDateRange, gaussianParams);

      expect(plans1).toEqual(plans2);
    });

    it('should respect maxPerDay constraint', () => {
      const maxPerDay = 5;
      const plans = generateGaussianDistribution(testDateRange, { ...gaussianParams, maxPerDay });

      expect(plans.every((plan) => plan.count <= maxPerDay)).toBe(true);
    });

    it('should use default parameters when not provided', () => {
      const plansWithDefaults = generateGaussianDistribution(testDateRange, baseParams);
      const plansWithExplicit = generateGaussianDistribution(testDateRange, {
        ...baseParams,
        mean: 0.5,
        stdDev: 0.2,
      });

      expect(plansWithDefaults).toEqual(plansWithExplicit);
    });

    it('should vary with different mean values', () => {
      const plans1 = generateGaussianDistribution(testDateRange, { ...gaussianParams, mean: 0.2 });
      const plans2 = generateGaussianDistribution(testDateRange, { ...gaussianParams, mean: 0.8 });

      const areDifferent = plans1.some((plan, index) => plan.count !== plans2[index].count);
      expect(areDifferent).toBe(true);
    });
  });

  describe('generateCustomDistribution', () => {
    const customParams: CustomDistributionParams = {
      ...baseParams,
      weights: [0.1, 0.8, 1.0, 1.0, 1.0, 0.8, 0.2], // Lower on weekends
    };

    it('should use day-of-week weights', () => {
      const plans = generateCustomDistribution(testDateRange, customParams);

      expect(plans).toHaveLength(testDateRange.length);

      // Group by day of week
      const dayGroups: { [key: number]: number[] } = {};
      plans.forEach((plan) => {
        const dayOfWeek = plan.date.getDay();
        if (!dayGroups[dayOfWeek]) dayGroups[dayOfWeek] = [];
        dayGroups[dayOfWeek].push(plan.count);
      });

      // Weekdays should generally have more commits than weekends
      const weekdayAvg = [1, 2, 3, 4, 5]
        .flatMap((day) => dayGroups[day] || [])
        .reduce((sum, count, _, arr) => sum + count / arr.length, 0);

      const weekendAvg = [0, 6]
        .flatMap((day) => dayGroups[day] || [])
        .reduce((sum, count, _, arr) => sum + count / arr.length, 0);

      expect(weekdayAvg).toBeGreaterThan(weekendAvg);
    });

    it('should use custom pattern when provided', () => {
      const pattern = [3, 5, 2, 0, 1];
      const plansWithPattern = generateCustomDistribution(testDateRange, {
        ...baseParams,
        pattern,
      });

      // Check that pattern is followed
      for (let i = 0; i < Math.min(pattern.length, plansWithPattern.length); i++) {
        expect(plansWithPattern[i].count).toBe(pattern[i]);
      }

      // Check pattern repeats
      if (plansWithPattern.length > pattern.length) {
        const secondCycleIndex = pattern.length;
        expect(plansWithPattern[secondCycleIndex].count).toBe(pattern[0]);
      }
    });

    it('should be reproducible with same seed', () => {
      const plans1 = generateCustomDistribution(testDateRange, customParams);
      const plans2 = generateCustomDistribution(testDateRange, customParams);

      expect(plans1).toEqual(plans2);
    });

    it('should respect maxPerDay constraint with pattern', () => {
      const maxPerDay = 3;
      const pattern = [5, 8, 2, 1]; // Some values exceed maxPerDay
      const plans = generateCustomDistribution(testDateRange, {
        ...baseParams,
        maxPerDay,
        pattern,
      });

      expect(plans.every((plan) => plan.count <= maxPerDay)).toBe(true);
    });

    it('should use default weights when none provided', () => {
      const plansWithDefaults = generateCustomDistribution(testDateRange, baseParams);

      expect(plansWithDefaults).toHaveLength(testDateRange.length);
      expect(plansWithDefaults.every((plan) => plan.count >= 0)).toBe(true);
    });
  });

  describe('generateCommitPlan', () => {
    const testConfig: Config = {
      author: {
        name: 'Test User',
        email: 'test@example.com',
      },
      dateRange: {
        startDate: '2023-01-01',
        endDate: '2023-01-31',
      },
      commits: {
        maxPerDay: 5,
        distribution: 'uniform',
        messageStyle: 'default',
      },
      options: {
        dryRun: false,
        push: false,
        verbose: false,
      },
      seed: 'test-seed',
    };

    it('should generate plan for uniform distribution', () => {
      const plans = generateCommitPlan(testConfig);

      expect(plans).toHaveLength(31); // January has 31 days
      expect(plans.every((plan) => plan.count > 0)).toBe(true);
      expect(plans.every((plan) => plan.count <= 5)).toBe(true);
    });

    it('should generate plan for random distribution', () => {
      const config = {
        ...testConfig,
        commits: { ...testConfig.commits, distribution: 'random' as const },
      };
      const plans = generateCommitPlan(config);

      expect(plans).toHaveLength(31);
      expect(plans.some((plan) => plan.count === 0)).toBe(true);
      expect(plans.some((plan) => plan.count > 0)).toBe(true);
    });

    it('should generate plan for gaussian distribution', () => {
      const config = {
        ...testConfig,
        commits: { ...testConfig.commits, distribution: 'gaussian' as const },
      };
      const plans = generateCommitPlan(config);

      expect(plans).toHaveLength(31);
      expect(plans.every((plan) => plan.count <= 5)).toBe(true);
    });

    it('should generate plan for custom distribution', () => {
      const config = {
        ...testConfig,
        commits: { ...testConfig.commits, distribution: 'custom' as const },
      };
      const plans = generateCommitPlan(config);

      expect(plans).toHaveLength(31);
      expect(plans.every((plan) => plan.count <= 5)).toBe(true);
    });

    it('should throw error for invalid distribution type', () => {
      const config = {
        ...testConfig,
        commits: { ...testConfig.commits, distribution: 'invalid' as any },
      };

      expect(() => generateCommitPlan(config)).toThrow('Unknown distribution type: invalid');
    });

    it('should throw error for invalid dates', () => {
      const config = {
        ...testConfig,
        dateRange: { startDate: 'invalid-date', endDate: '2023-01-31' },
      };

      expect(() => generateCommitPlan(config)).toThrow('Invalid date range');
    });

    it('should be reproducible with same seed', () => {
      const plans1 = generateCommitPlan(testConfig);
      const plans2 = generateCommitPlan(testConfig);

      expect(plans1).toEqual(plans2);
    });
  });

  describe('calculateCommitStats', () => {
    it('should calculate correct statistics', () => {
      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 3, messages: [] },
        { date: new Date('2023-01-02'), count: 0, messages: [] },
        { date: new Date('2023-01-03'), count: 5, messages: [] },
        { date: new Date('2023-01-04'), count: 2, messages: [] },
        { date: new Date('2023-01-05'), count: 0, messages: [] },
      ];

      const stats = calculateCommitStats(plans);

      expect(stats.totalCommits).toBe(10);
      expect(stats.totalDays).toBe(5);
      expect(stats.activeDays).toBe(3);
      expect(stats.averagePerDay).toBeCloseTo(3.33, 2);
      expect(stats.maxPerDay).toBe(5);
      expect(stats.minPerDay).toBe(0);
    });

    it('should handle empty plans', () => {
      const stats = calculateCommitStats([]);

      expect(stats.totalCommits).toBe(0);
      expect(stats.totalDays).toBe(0);
      expect(stats.activeDays).toBe(0);
      expect(stats.averagePerDay).toBe(0);
      expect(stats.maxPerDay).toBe(Number.NEGATIVE_INFINITY);
      expect(stats.minPerDay).toBe(Number.POSITIVE_INFINITY);
    });

    it('should handle plans with no commits', () => {
      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 0, messages: [] },
        { date: new Date('2023-01-02'), count: 0, messages: [] },
      ];

      const stats = calculateCommitStats(plans);

      expect(stats.totalCommits).toBe(0);
      expect(stats.totalDays).toBe(2);
      expect(stats.activeDays).toBe(0);
      expect(stats.averagePerDay).toBe(0);
      expect(stats.maxPerDay).toBe(0);
      expect(stats.minPerDay).toBe(0);
    });

    it('should handle all days having commits', () => {
      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 2, messages: [] },
        { date: new Date('2023-01-02'), count: 4, messages: [] },
        { date: new Date('2023-01-03'), count: 1, messages: [] },
      ];

      const stats = calculateCommitStats(plans);

      expect(stats.totalCommits).toBe(7);
      expect(stats.totalDays).toBe(3);
      expect(stats.activeDays).toBe(3);
      expect(stats.averagePerDay).toBeCloseTo(2.33, 2);
      expect(stats.maxPerDay).toBe(4);
      expect(stats.minPerDay).toBe(1);
    });
  });
});
