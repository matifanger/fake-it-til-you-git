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
import { populateCommitMessages, createCommitsFromPlan, generateAndCreateCommits, validateCommitPlan } from '../../src/commits.js';
import { getDefaultConfig } from '../../src/config.js';
import { GitOperations } from '../../src/git.js';

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
        preview: false,
        push: false,
        verbose: false,
        dev: true,
        repositoryPath: '.',
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

describe('Step 5.2: Commit Creation', () => {
  describe('populateCommitMessages', () => {
    it('should populate commit plans with messages based on style', () => {
      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 2, messages: [] },
        { date: new Date('2023-01-02'), count: 1, messages: [] },
        { date: new Date('2023-01-03'), count: 0, messages: [] },
      ];

      const config: Config = {
        ...getDefaultConfig(),
        commits: {
          maxPerDay: 5,
          distribution: 'uniform',
          messageStyle: 'emoji',
        },
        seed: 'test-seed',
      };

      const populatedPlans = populateCommitMessages(plans, config);

      expect(populatedPlans).toHaveLength(3);
      expect(populatedPlans[0].messages).toHaveLength(2);
      expect(populatedPlans[1].messages).toHaveLength(1);
      expect(populatedPlans[2].messages).toHaveLength(0);

      // All messages should be strings
      populatedPlans.forEach(plan => {
        plan.messages.forEach(message => {
          expect(typeof message).toBe('string');
          expect(message.length).toBeGreaterThan(0);
        });
      });
    });

    it('should handle different message styles', () => {
      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 1, messages: [] },
      ];

      const configs = [
        { messageStyle: 'default' as const },
        { messageStyle: 'lorem' as const },
        { messageStyle: 'emoji' as const },
      ];

      configs.forEach(({ messageStyle }) => {
        const config: Config = {
          ...getDefaultConfig(),
          commits: {
            maxPerDay: 5,
            distribution: 'uniform',
            messageStyle,
          },
        };

        const populatedPlans = populateCommitMessages(plans, config);
        expect(populatedPlans[0].messages).toHaveLength(1);
        expect(typeof populatedPlans[0].messages[0]).toBe('string');
      });
    });

    it('should use fallback messages when message generation fails', () => {
      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 2, messages: [] },
      ];

      const config: Config = {
        ...getDefaultConfig(),
        commits: {
          maxPerDay: 5,
          distribution: 'uniform',
          messageStyle: 'invalid-style' as any,
        },
      };

      const populatedPlans = populateCommitMessages(plans, config);
      
      expect(populatedPlans[0].messages).toHaveLength(2);
      expect(populatedPlans[0].messages[0]).toBe('Update 1');
      expect(populatedPlans[0].messages[1]).toBe('Update 2');
    });

    it('should generate consistent messages with same seed', () => {
      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 3, messages: [] },
      ];

      const config: Config = {
        ...getDefaultConfig(),
        commits: {
          maxPerDay: 5,
          distribution: 'uniform',
          messageStyle: 'emoji',
        },
        seed: 'consistent-seed',
      };

      const result1 = populateCommitMessages(plans, config);
      const result2 = populateCommitMessages(plans, config);

      expect(result1[0].messages).toEqual(result2[0].messages);
    });
  });

  describe('validateCommitPlan', () => {
    const validConfig: Config = getDefaultConfig();

    it('should validate a correct commit plan', () => {
      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 2, messages: ['msg1', 'msg2'] },
        { date: new Date('2023-01-02'), count: 1, messages: ['msg3'] },
      ];

      const result = validateCommitPlan(plans, validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect empty or invalid plans', () => {
      const emptyPlans: CommitPlan[] = [];
      const result = validateCommitPlan(emptyPlans, validConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Commit plan is empty or invalid');
    });

    it('should detect invalid dates', () => {
      const plans = [
        { date: null as any, count: 1, messages: ['msg'] },
        { date: 'invalid-date' as any, count: 1, messages: ['msg'] },
      ];

      const result = validateCommitPlan(plans, validConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Plan at index 0 has invalid date');
      expect(result.errors).toContain('Plan at index 1 has invalid date');
    });

    it('should detect invalid commit counts', () => {
      const plans = [
        { date: new Date(), count: -1, messages: [] },
        { date: new Date(), count: 'invalid' as any, messages: [] },
      ];

      const result = validateCommitPlan(plans, validConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Plan at index 0 has invalid commit count');
      expect(result.errors).toContain('Plan at index 1 has invalid commit count');
    });

    it('should warn about missing messages', () => {
      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 2, messages: [] },
      ];

      const result = validateCommitPlan(plans, validConfig);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Plan at index 0 has commits but no messages');
    });

    it('should warn about exceeding maxPerDay', () => {
      const config: Config = {
        ...validConfig,
        commits: {
          ...validConfig.commits,
          maxPerDay: 5,
        },
      };

      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 10, messages: [] },
      ];

      const result = validateCommitPlan(plans, config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Plan at index 0 exceeds maxPerDay limit (10 > 5)');
    });

    it('should warn about large commit volumes', () => {
      const plans: CommitPlan[] = Array.from({ length: 100 }, (_, i) => ({
        date: new Date(2023, 0, i + 1),
        count: 101,
        messages: [],
      }));

      const result = validateCommitPlan(plans, validConfig);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('Large number of commits'))).toBe(true);
    });

    it('should detect non-chronological dates', () => {
      const plans: CommitPlan[] = [
        { date: new Date('2023-01-02'), count: 1, messages: ['msg1'] },
        { date: new Date('2023-01-01'), count: 1, messages: ['msg2'] },
      ];

      const result = validateCommitPlan(plans, validConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Commit plan dates are not in chronological order');
    });
  });

  describe('createCommitsFromPlan', () => {
    let mockGitOps: jest.Mocked<GitOperations>;

    beforeEach(() => {
      mockGitOps = {
        isWorkingDirectoryClean: jest.fn().mockResolvedValue(true),
        createBackup: jest.fn().mockResolvedValue({
          id: 'backup-123',
          timestamp: new Date(),
          branch: 'main',
          lastCommitHash: 'abc123',
          totalCommits: 5,
          backupPath: '/tmp/backup',
          repositoryPath: '/repo',
        }),
        addAll: jest.fn().mockResolvedValue(undefined),
                 createCommit: jest.fn().mockResolvedValue({ 
           commit: 'commit-hash-123',
           author: { name: 'Test', email: 'test@example.com' },
           branch: 'main',
           root: false,
           summary: { changes: 1, insertions: 1, deletions: 0 }
         }),
      } as any;
    });

    it('should handle empty commit plan', async () => {
      const plans: CommitPlan[] = [];
      const config = getDefaultConfig();

      const result = await createCommitsFromPlan(plans, config, mockGitOps);

      expect(result.success).toBe(true);
      expect(result.totalCommits).toBe(0);
      expect(result.successfulCommits).toBe(0);
      expect(result.failedCommits).toBe(0);
    });

    it('should handle plans with zero commits', async () => {
      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 0, messages: [] },
      ];
      const config = getDefaultConfig();

      const result = await createCommitsFromPlan(plans, config, mockGitOps);

      expect(result.success).toBe(true);
      expect(result.totalCommits).toBe(0);
      expect(mockGitOps.createCommit).not.toHaveBeenCalled();
    });

    it('should fail if working directory is not clean', async () => {
      mockGitOps.isWorkingDirectoryClean.mockResolvedValue(false);

      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 1, messages: ['Test commit'] },
      ];
      const config = getDefaultConfig();

      const result = await createCommitsFromPlan(plans, config, mockGitOps);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Working directory is not clean');
    });

    it('should successfully create commits', async () => {
      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 2, messages: ['Commit 1', 'Commit 2'] },
        { date: new Date('2023-01-02'), count: 1, messages: ['Commit 3'] },
      ];
      const config = getDefaultConfig();

      const result = await createCommitsFromPlan(plans, config, mockGitOps);

      expect(result.success).toBe(true);
      expect(result.totalCommits).toBe(3);
      expect(result.successfulCommits).toBe(3);
      expect(result.failedCommits).toBe(0);
      expect(result.commitHashes).toHaveLength(3);
      expect(mockGitOps.createCommit).toHaveBeenCalledTimes(3);
    });

    it('should handle commit creation failures gracefully', async () => {
             mockGitOps.createCommit
         .mockResolvedValueOnce({ 
           commit: 'hash1',
           author: { name: 'Test', email: 'test@example.com' },
           branch: 'main',
           root: false,
           summary: { changes: 1, insertions: 1, deletions: 0 }
         })
         .mockRejectedValueOnce(new Error('Commit failed'))
         .mockResolvedValueOnce({ 
           commit: 'hash3',
           author: { name: 'Test', email: 'test@example.com' },
           branch: 'main',
           root: false,
           summary: { changes: 1, insertions: 1, deletions: 0 }
         });

      const plans: CommitPlan[] = [
        { date: new Date('2023-01-01'), count: 3, messages: ['C1', 'C2', 'C3'] },
      ];
      const config = getDefaultConfig();

      const result = await createCommitsFromPlan(plans, config, mockGitOps);

      expect(result.success).toBe(true); // Still success because some commits succeeded
      expect(result.totalCommits).toBe(3);
      expect(result.successfulCommits).toBe(2);
      expect(result.failedCommits).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.commitHashes).toHaveLength(2);
    });

    it('should use correct commit dates and authors', async () => {
      const testDate = new Date('2023-06-15T10:30:00Z');
      const plans: CommitPlan[] = [
        { date: testDate, count: 1, messages: ['Test message'] },
      ];
      
      const config: Config = {
        ...getDefaultConfig(),
        author: {
          name: 'Test Author',
          email: 'test@example.com',
        },
      };

      await createCommitsFromPlan(plans, config, mockGitOps);

      expect(mockGitOps.createCommit).toHaveBeenCalledWith(
        'Test message',
        expect.any(Date),
        { name: 'Test Author', email: 'test@example.com' }
      );

      const callDate = (mockGitOps.createCommit as jest.Mock).mock.calls[0][1];
      expect(callDate.getFullYear()).toBe(2023);
      expect(callDate.getMonth()).toBe(5); // June (0-indexed)
      expect(callDate.getDate()).toBe(15);
    });

    it('should abort after too many failures', async () => {
      mockGitOps.createCommit.mockRejectedValue(new Error('Always fails'));

      // Create a plan with many commits to trigger the failure limit
      const plans: CommitPlan[] = [
        {
          date: new Date('2023-01-01'),
          count: 15,
          messages: Array.from({ length: 15 }, (_, i) => `Commit ${i + 1}`),
        },
      ];
      const config = getDefaultConfig();

      const result = await createCommitsFromPlan(plans, config, mockGitOps);

      expect(result.success).toBe(false);
      expect(result.failedCommits).toBeGreaterThan(10);
      expect(result.errors.some(e => e.includes('Too many commit failures'))).toBe(true);
    });
  });

  describe('generateAndCreateCommits', () => {
    let mockGitOps: jest.Mocked<GitOperations>;

    beforeEach(() => {
      mockGitOps = {
        isWorkingDirectoryClean: jest.fn().mockResolvedValue(true),
        createBackup: jest.fn().mockResolvedValue({
          id: 'backup-123',
          timestamp: new Date(),
          branch: 'main',
          lastCommitHash: 'abc123',
          totalCommits: 5,
          backupPath: '/tmp/backup',
          repositoryPath: '/repo',
        }),
        addAll: jest.fn().mockResolvedValue(undefined),
                 createCommit: jest.fn().mockResolvedValue({ 
           commit: 'commit-hash',
           author: { name: 'Test', email: 'test@example.com' },
           branch: 'main',
           root: false,
           summary: { changes: 1, insertions: 1, deletions: 0 }
         }),
      } as any;
    });

    it('should complete the full workflow successfully', async () => {
      const config: Config = {
        ...getDefaultConfig(),
        dateRange: {
          startDate: '2023-01-01',
          endDate: '2023-01-03',
        },
        commits: {
          maxPerDay: 3,
          distribution: 'uniform',
          messageStyle: 'emoji',
        },
        seed: 'test-workflow',
      };

      const result = await generateAndCreateCommits(config, mockGitOps);

      expect(result.success).toBe(true);
      expect(result.totalCommits).toBeGreaterThan(0);
      expect(result.successfulCommits).toBe(result.totalCommits);
      expect(result.failedCommits).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors gracefully', async () => {
      mockGitOps.isWorkingDirectoryClean.mockRejectedValue(new Error('Git error'));

      const config = getDefaultConfig();
      const result = await generateAndCreateCommits(config, mockGitOps);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Critical error during commit creation');
    });

    it('should handle invalid date ranges', async () => {
      const config: Config = {
        ...getDefaultConfig(),
        dateRange: {
          startDate: 'invalid-date',
          endDate: '2023-01-01',
        },
      };

      const result = await generateAndCreateCommits(config, mockGitOps);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to generate and create commits');
    });
  });
});

describe('Step 9.2: Seed Reproducibility', () => {
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
      distribution: 'random',
      messageStyle: 'default',
    },
    options: {
      preview: false,
      push: false,
      verbose: false,
      dev: true,
      repositoryPath: '.',
    },
    seed: 'step-9-2-test-seed',
  };

  it('should produce identical results across multiple runs with same seed', () => {
    // Generate multiple commit plans with the same seed
    const results: CommitPlan[][] = [];
    
    for (let i = 0; i < 5; i++) {
      const plans = generateCommitPlan(testConfig);
      results.push(plans);
    }

    // All results should be identical
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toEqual(results[0]);
    }
  });

  it('should produce different results with different seeds', () => {
    const configs = [
      { ...testConfig, seed: 'seed-alpha' },
      { ...testConfig, seed: 'seed-beta' },
      { ...testConfig, seed: 'seed-gamma' },
    ];

    const results = configs.map(config => generateCommitPlan(config));

    // Results should be different between seeds
    expect(results[0]).not.toEqual(results[1]);
    expect(results[1]).not.toEqual(results[2]);
    expect(results[0]).not.toEqual(results[2]);
  });

  it('should maintain reproducibility across different distribution types', () => {
    const distributions: Array<'uniform' | 'random' | 'gaussian' | 'custom'> = [
      'uniform', 'random', 'gaussian', 'custom'
    ];

    for (const distribution of distributions) {
      const config = {
        ...testConfig,
        commits: { ...testConfig.commits, distribution },
        seed: 'consistent-seed-for-all-distributions',
      };

      const result1 = generateCommitPlan(config);
      const result2 = generateCommitPlan(config);

      expect(result1).toEqual(result2);
    }
  });

  it('should generate reproducible commit messages with seed', () => {
    const plans: CommitPlan[] = [
      { date: new Date('2023-01-01'), count: 3, messages: [] },
      { date: new Date('2023-01-02'), count: 2, messages: [] },
    ];

    const config = { ...testConfig, seed: 'message-reproducibility-test' };

    const result1 = populateCommitMessages(plans, config);
    const result2 = populateCommitMessages(plans, config);

    expect(result1).toEqual(result2);
    expect(result1[0].messages).toHaveLength(3);
    expect(result1[1].messages).toHaveLength(2);
  });

  it('should work correctly without seed (non-deterministic)', () => {
    const configWithoutSeed = {
      ...testConfig,
      seed: undefined,
    };

    // Should not throw errors
    expect(() => generateCommitPlan(configWithoutSeed)).not.toThrow();

    // Generate multiple results - they might be different (non-deterministic)
    const result1 = generateCommitPlan(configWithoutSeed);
    const result2 = generateCommitPlan(configWithoutSeed);

    // Should have same structure even if content might differ
    expect(result1).toHaveLength(result2.length);
    expect(result1.every(plan => typeof plan.count === 'number')).toBe(true);
    expect(result2.every(plan => typeof plan.count === 'number')).toBe(true);
  });

  it('should demonstrate real-world seed usage scenarios', () => {
    // Scenario 1: Team collaboration - same seed produces same results
    const teamSeed = 'team-project-2024';
    const memberAConfig = { ...testConfig, seed: teamSeed };
    const memberBConfig = { ...testConfig, seed: teamSeed };

    const memberAResult = generateCommitPlan(memberAConfig);
    const memberBResult = generateCommitPlan(memberBConfig);

    expect(memberAResult).toEqual(memberBResult);

    // Scenario 2: Different projects - different seeds produce different results
    const projectAlpha = { ...testConfig, seed: 'project-alpha-v1' };
    const projectBeta = { ...testConfig, seed: 'project-beta-v1' };

    const alphaResult = generateCommitPlan(projectAlpha);
    const betaResult = generateCommitPlan(projectBeta);

    expect(alphaResult).not.toEqual(betaResult);

    // Scenario 3: Version control - adding version to seed changes results
    const v1Config = { ...testConfig, seed: 'project-seed-v1' };
    const v2Config = { ...testConfig, seed: 'project-seed-v2' };

    const v1Result = generateCommitPlan(v1Config);
    const v2Result = generateCommitPlan(v2Config);

    expect(v1Result).not.toEqual(v2Result);
  });
});
