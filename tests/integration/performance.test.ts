import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { generateCommitPlan } from '../../src/commits.js';
import { applyDefaults } from '../../src/config.js';
import { GitOperations } from '../../src/git.js';

// Get current directory 
const projectRoot = path.resolve(__dirname, '../../');

describe('Performance Tests', () => {
  const testRepoPath = path.join(projectRoot, 'test-perf-repo');
  let gitOps: GitOperations;

  beforeAll(() => {
    // Create test repository
    if (fs.existsSync(testRepoPath)) {
      safeRemoveDir(testRepoPath);
    }
    fs.mkdirSync(testRepoPath, { recursive: true });
    execSync('git init', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath, stdio: 'pipe' });
    
    // Create initial commit
    fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Performance Test Repository');
    execSync('git add README.md', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: testRepoPath, stdio: 'pipe' });

    gitOps = new GitOperations(testRepoPath);
  });

  afterAll(() => {
    safeRemoveDir(testRepoPath);
  });

  describe('Commit Generation Performance', () => {
    it('should generate 1000 commits in under 5 seconds', () => {
             const config = applyDefaults({
         commits: {
           maxPerDay: 1000,
           distribution: 'uniform',
           messageStyle: 'default'
         },
         dateRange: {
           startDate: '2023-01-01',
           endDate: '2023-12-31'
         },
         author: {
           name: 'Test User',
           email: 'test@example.com'
         },
         options: {
           repositoryPath: testRepoPath
         }
       });

      const startTime = performance.now();
      const plan = generateCommitPlan(config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`Generated ${plan.length} commits in ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(5000); // 5 seconds
      expect(plan.length).toBeGreaterThan(0);
    });

    it('should generate large commit plans efficiently', () => {
             const config = applyDefaults({
         commits: {
           maxPerDay: 5000,
           distribution: 'random',
           messageStyle: 'default'
         },
         dateRange: {
           startDate: '2020-01-01',
           endDate: '2024-12-31'
         },
         author: {
           name: 'Test User',
           email: 'test@example.com'
         },
         options: {
           repositoryPath: testRepoPath
         }
       });

      const startTime = performance.now();
      const plan = generateCommitPlan(config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`Generated ${plan.length} commits in ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(15000); // 15 seconds
      expect(plan.length).toBeGreaterThan(0);
    });

    it('should handle large date ranges efficiently', () => {
             const config = applyDefaults({
         commits: {
           maxPerDay: 2000,
           distribution: 'gaussian',
           messageStyle: 'emoji'
         },
         dateRange: {
           startDate: '2010-01-01',
           endDate: '2024-12-31' // 15 year range
         },
         author: {
           name: 'Test User',
           email: 'test@example.com'
         },
         options: {
           repositoryPath: testRepoPath
         }
       });

      const startTime = performance.now();
      const plan = generateCommitPlan(config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`Generated ${plan.length} commits across 15 years in ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(10000); // 10 seconds
      expect(plan.length).toBeGreaterThan(0);
      
      // Verify commits are within date range
      const dates = plan.map(p => p.date);
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      expect(minDate.getFullYear()).toBeGreaterThanOrEqual(2010);
      expect(maxDate.getFullYear()).toBeLessThanOrEqual(2024);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not exceed reasonable memory usage for large commit plans', () => {
             const config = applyDefaults({
         commits: {
           maxPerDay: 10000,
           distribution: 'uniform',
           messageStyle: 'default'
         },
         dateRange: {
           startDate: '2020-01-01',
           endDate: '2024-12-31'
         },
         author: {
           name: 'Test User',
           email: 'test@example.com'
         },
         options: {
           repositoryPath: testRepoPath
         }
       });

      // Measure memory before
      const memBefore = process.memoryUsage();
      
      const plan = generateCommitPlan(config);
      
      // Measure memory after
      const memAfter = process.memoryUsage();
      
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      console.log(`Memory increase for ${plan.length} commits: ${memoryIncreaseMB.toFixed(2)}MB`);
      
      // Should not use more than 100MB for large commit plans
      expect(memoryIncreaseMB).toBeLessThan(100);
      expect(plan.length).toBeGreaterThan(0);
    });

    it('should clean up memory properly after operations', () => {
             const config = applyDefaults({
         commits: {
           maxPerDay: 1000,
           distribution: 'random',
           messageStyle: 'default'
         },
         dateRange: {
           startDate: '2023-01-01',
           endDate: '2023-12-31'
         },
         author: {
           name: 'Test User',
           email: 'test@example.com'
         },
         options: {
           repositoryPath: testRepoPath
         }
       });

      const memBefore = process.memoryUsage();
      
      // Generate multiple plans
      for (let i = 0; i < 5; i++) {
        const plan = generateCommitPlan(config);
        expect(plan.length).toBeGreaterThan(0);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const memAfter = process.memoryUsage();
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      console.log(`Memory increase after 5 iterations: ${memoryIncreaseMB.toFixed(2)}MB`);
      
      // Should not accumulate significant memory
      expect(memoryIncreaseMB).toBeLessThan(50);
    });
  });

  describe('Distribution Algorithm Performance', () => {
    const testDistributionPerformance = (distribution: 'uniform' | 'random' | 'gaussian') => {
      it(`should handle ${distribution} distribution efficiently for large commit counts`, () => {
        const config = applyDefaults({
          commits: {
            maxPerDay: 3000,
            distribution,
            messageStyle: 'default'
          },
          dateRange: {
            startDate: '2023-01-01',
            endDate: '2023-12-31'
          },
          author: {
            name: 'Test User',
            email: 'test@example.com'
          },
          options: {
            repositoryPath: testRepoPath
          }
        });

        const startTime = performance.now();
        const plan = generateCommitPlan(config);
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        console.log(`${distribution} distribution for ${plan.length} commits: ${duration.toFixed(2)}ms`);
        
        expect(duration).toBeLessThan(8000); // 8 seconds
        expect(plan.length).toBeGreaterThan(0);
        
        // Verify all commits have valid dates
        expect(plan.every(p => p.date instanceof Date && !isNaN(p.date.getTime()))).toBe(true);
      });
    };

    testDistributionPerformance('uniform');
    testDistributionPerformance('random');
    testDistributionPerformance('gaussian');
  });

  describe('Git Operations Performance', () => {
    it('should detect git repository quickly', async () => {
      const startTime = performance.now();
      const isGitRepo = await gitOps.isGitRepository();
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`Git repository detection: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(1000); // 1 second
      expect(isGitRepo).toBe(true);
    });

    it('should get repository info efficiently', async () => {
      const startTime = performance.now();
      const repoInfo = await gitOps.getRepositoryInfo();
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`Repository info retrieval: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(2000); // 2 seconds
      expect(repoInfo).toBeDefined();
      expect(repoInfo.branch).toBeDefined();
    });

    it('should handle backup operations efficiently', async () => {
      const startTime = performance.now();
      const backupInfo = await gitOps.createBackup();
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`Backup creation: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(5000); // 5 seconds
      expect(backupInfo).toBeDefined();
      expect(typeof backupInfo.id).toBe('string');
      
      // Cleanup
      await gitOps.cleanupBackup(backupInfo);
    });
  });

  describe('End-to-End Performance', () => {
    it('should complete full workflow for moderate commit count within time limit', async () => {
      const config = applyDefaults({
        commits: {
          maxPerDay: 100,
          distribution: 'uniform',
          messageStyle: 'default'
        },
        dateRange: {
          startDate: '2023-01-01',
          endDate: '2023-03-31'
        },
        author: {
          name: 'Test User',
          email: 'test@example.com'
        },
        options: {
          repositoryPath: testRepoPath,
          preview: true // Don't actually create commits
        }
      });

      const startTime = performance.now();
      
      // This simulates the full workflow without actually creating commits
      const plan = generateCommitPlan(config);
      
      // Simulate message generation and validation
      const messages = plan.map((_, index) => `Update ${index + 1}`);
      
      // Simulate git operations validation
      const isRepo = await gitOps.isGitRepository();
      const repoInfo = await gitOps.getRepositoryInfo();
      
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`Full workflow simulation for ${plan.length} commits: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(10000); // 10 seconds
      expect(plan.length).toBeGreaterThan(0);
      expect(messages.length).toBe(plan.length);
      expect(isRepo).toBe(true);
      expect(repoInfo).toBeDefined();
    });

    it('should handle stress test with large commit count', () => {
      const config = applyDefaults({
                 commits: {
           maxPerDay: 50000, // Very large number
           distribution: 'random',
           messageStyle: 'default'
         },
         dateRange: {
           startDate: '2020-01-01',
           endDate: '2024-12-31'
         },
        author: {
          name: 'Test User',
          email: 'test@example.com'
        },
        options: {
          repositoryPath: testRepoPath
        }
      });

      const startTime = performance.now();
      const plan = generateCommitPlan(config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`Stress test - ${plan.length} commits generated in: ${duration.toFixed(2)}ms`);
      
      // Should complete within 60 seconds even for very large numbers
      expect(duration).toBeLessThan(60000);
      expect(plan.length).toBeGreaterThan(0);
      
      // Verify data integrity
      expect(plan.every(p => p.date instanceof Date)).toBe(true);
      expect(plan.every(p => !isNaN(p.date.getTime()))).toBe(true);
    });
  });

  describe('Performance Regression Tests', () => {
    it('should maintain consistent performance across multiple runs', () => {
      const config = applyDefaults({
        commits: {
          maxPerDay: 1000,
          distribution: 'uniform',
          messageStyle: 'default'
        },
        dateRange: {
          startDate: '2023-01-01',
          endDate: '2023-12-31'
        },
        author: {
          name: 'Test User',
          email: 'test@example.com'
        },
        options: {
          repositoryPath: testRepoPath
        }
      });

      const durations: number[] = [];
      
      // Run multiple times to check consistency
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        const plan = generateCommitPlan(config);
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        durations.push(duration);
        expect(plan.length).toBeGreaterThan(0);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);
      
      console.log(`Performance consistency test:
        Average: ${avgDuration.toFixed(2)}ms
        Min: ${minDuration.toFixed(2)}ms
        Max: ${maxDuration.toFixed(2)}ms
        Variance: ${(maxDuration - minDuration).toFixed(2)}ms`);
      
      // Variance should not be too high (no more than 3x difference)
      expect(maxDuration / minDuration).toBeLessThan(3);
      expect(avgDuration).toBeLessThan(5000); // Average should be under 5 seconds
    });
  });

  describe('CLI Performance Tests', () => {
    it('should handle help command quickly', () => {
      const startTime = performance.now();
      
      try {
        execSync('npm run build && node dist/bin/cli.js --help', {
          cwd: projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        });
      } catch (error) {
        // Help command exits with code 0, but exec may throw
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`CLI help command: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should handle version command quickly', () => {
      const startTime = performance.now();
      
      try {
        execSync('npm run build && node dist/bin/cli.js --version', {
          cwd: projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        });
      } catch (error) {
        // Version command exits, but exec may throw
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`CLI version command: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });
});

// Helper function to safely remove directories
function safeRemoveDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;

  try {
    // On Windows, we need to handle locked files
    if (process.platform === 'win32') {
      execSync(`rd /s /q "${dirPath}"`, { stdio: 'pipe' });
    } else {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (error) {
    // If the directory is locked, try multiple times
    for (let i = 0; i < 3; i++) {
      try {
        setTimeout(() => {}, 100); // Small delay
        fs.rmSync(dirPath, { recursive: true, force: true });
        break;
      } catch (retryError) {
        if (i === 2) {
          console.warn(`Could not remove ${dirPath}:`, retryError);
        }
      }
    }
  }
} 