import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Get current directory 
const projectRoot = path.resolve(__dirname, '../..');

describe('End-to-End Integration Tests', () => {
  const testRepoPath = path.join(projectRoot, 'test-e2e-repo');
  const configPath = path.join(projectRoot, 'test-configs', 'e2e-test.config.json');

  beforeAll(() => {
    // Build the project
    execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });

    // Create test repository
    if (!fs.existsSync(testRepoPath)) {
      fs.mkdirSync(testRepoPath, { recursive: true });
      execSync('git init', { cwd: testRepoPath, stdio: 'pipe' });
      execSync('git config user.email "test@example.com"', { cwd: testRepoPath, stdio: 'pipe' });
      execSync('git config user.name "Test User"', { cwd: testRepoPath, stdio: 'pipe' });
      
      // Create initial commit
      fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Repository\n');
      execSync('git add README.md', { cwd: testRepoPath, stdio: 'pipe' });
      execSync('git commit -m "Initial commit"', { cwd: testRepoPath, stdio: 'pipe' });
    }

    // Create test config file
    const testConfig = {
      commits: 5,
      startDate: '2023-01-01',
      endDate: '2023-01-05',
      distribution: 'uniform',
      messageStyle: 'default',
      author: {
        name: 'Test User',
        email: 'test@example.com'
      },
      repoPath: testRepoPath
    };

    fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    safeRemoveDir(testRepoPath);
  });

  beforeEach(() => {
    // Clean up any existing test repo
    safeRemoveDir(testRepoPath);
    
    // Create fresh test repository
    fs.mkdirSync(testRepoPath, { recursive: true });
    execSync('git init', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath, stdio: 'pipe' });
    
    // Create initial commit
    fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Repository');
    execSync('git add README.md', { cwd: testRepoPath, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: testRepoPath, stdio: 'pipe' });
  });

  afterEach(() => {
    safeRemoveDir(testRepoPath);
  });

  describe('CLI Integration', () => {
    it('should handle --help flag', () => {
      const result = execSync('npm run build && node dist/bin/cli.js --help', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      expect(result).toContain('Usage:');
      expect(result).toContain('Options:');
    });

    it('should handle --version flag', () => {
      const result = execSync('npm run build && node dist/bin/cli.js --version', {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
      expect(result).toContain(packageJson.version);
    });

    it('should run successfully with config file', () => {
      const result = execSync(`npm run build && node dist/bin/cli.js --config ${configPath} --preview`, {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      expect(result).toContain('Commit Plan Preview');
      expect(result).toContain('Total commits:');
    });

    it('should handle missing git repository', () => {
      const nonGitPath = path.join(projectRoot, 'temp-non-git');
      fs.mkdirSync(nonGitPath, { recursive: true });

      try {
        const result = execSync(`npm run build && node dist/bin/cli.js --repo-path ${nonGitPath} --preview`, {
          cwd: projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        // The CLI should run but show a message about not being in a git repository
        expect(result).toContain('Total commits:');
      } finally {
        safeRemoveDir(nonGitPath);
      }
    });
  });

  describe('Preview Mode Integration', () => {
    it('should generate preview without creating commits', () => {
      const result = execSync(`npm run build && node dist/bin/cli.js --config ${configPath} --preview`, {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      expect(result).toContain('Commit Plan Preview');
      expect(result).toContain('Total commits:');
      expect(result).toContain('Date range:');

      // Verify no commits were actually created
      const commitCount = execSync('git rev-list --count HEAD', {
        cwd: testRepoPath,
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();
      expect(commitCount).toBe('1'); // Only initial commit
    });

    it('should show contribution graph in preview', () => {
      const result = execSync(`npm run build && node dist/bin/cli.js --config ${configPath} --preview`, {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      // Check for contribution graph elements
      expect(result).toContain('Jan'); // Month header
      expect(result).toMatch(/[⬜🟩🟨🟧🟥]/); // Graph squares
    });
  });

  describe('Different Distribution Modes', () => {
    it('should work with uniform distribution', async () => {
      const config = {
        dateRange: {
          startDate: '2023-01-01',
          endDate: '2023-01-10'
        },
        commits: {
          maxPerDay: 10,
          distribution: 'uniform',
          messageStyle: 'default'
        },
        options: {
          repositoryPath: testRepoPath,
          preview: false,
          push: false,
          verbose: false,
          dev: false
        }
      };

      const tempConfigPath = path.join(projectRoot, 'temp-uniform.config.json');
      fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));

      try {
        const result = execSync(`npm run build && node dist/bin/cli.js --config ${tempConfigPath} --preview`, {
          cwd: projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        });

        expect(result).toContain('Total commits:');
        expect(result).toContain('Distribution: uniform');
      } finally {
        fs.unlinkSync(tempConfigPath);
      }
    });

    it('should work with random distribution', async () => {
      const config = {
        dateRange: {
          startDate: '2023-01-01',
          endDate: '2023-01-08'
        },
        commits: {
          maxPerDay: 8,
          distribution: 'random',
          messageStyle: 'default'
        },
        options: {
          repositoryPath: testRepoPath,
          preview: false,
          push: false,
          verbose: false,
          dev: false
        }
      };

      const tempConfigPath = path.join(projectRoot, 'temp-random.config.json');
      fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));

      try {
        const result = execSync(`npm run build && node dist/bin/cli.js --config ${tempConfigPath} --preview`, {
          cwd: projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        });

        expect(result).toContain('Total commits:');
        expect(result).toContain('Distribution: random');
      } finally {
        fs.unlinkSync(tempConfigPath);
      }
    });

    it('should work with gaussian distribution', async () => {
      const config = {
        dateRange: {
          startDate: '2023-01-01',
          endDate: '2023-01-12'
        },
        commits: {
          maxPerDay: 12,
          distribution: 'gaussian',
          messageStyle: 'default'
        },
        options: {
          repositoryPath: testRepoPath,
          preview: false,
          push: false,
          verbose: false,
          dev: false
        }
      };

      const tempConfigPath = path.join(projectRoot, 'temp-gaussian.config.json');
      fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));

      try {
        const result = execSync(`npm run build && node dist/bin/cli.js --config ${tempConfigPath} --preview`, {
          cwd: projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        });

        expect(result).toContain('Total commits:');
        expect(result).toContain('Distribution: gaussian');
      } finally {
        fs.unlinkSync(tempConfigPath);
      }
    });
  });

  describe('Different Message Styles', () => {
    it('should work with default message style', async () => {
      const config = {
        dateRange: {
          startDate: '2023-01-01',
          endDate: '2023-01-05'
        },
        commits: {
          maxPerDay: 5,
          distribution: 'uniform',
          messageStyle: 'default'
        },
        options: {
          repositoryPath: testRepoPath,
          preview: false,
          push: false,
          verbose: false,
          dev: false
        }
      };

      const tempConfigPath = path.join(projectRoot, 'temp-default-style.config.json');
      fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));

      try {
        const result = execSync(`npm run build && node dist/bin/cli.js --config ${tempConfigPath} --preview`, {
          cwd: projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        });

        expect(result).toContain('Message style: default');
      } finally {
        fs.unlinkSync(tempConfigPath);
      }
    });

    it('should work with emoji message style', async () => {
      const config = {
        dateRange: {
          startDate: '2023-01-01',
          endDate: '2023-01-05'
        },
        commits: {
          maxPerDay: 5,
          distribution: 'uniform',
          messageStyle: 'emoji'
        },
        options: {
          repositoryPath: testRepoPath,
          preview: false,
          push: false,
          verbose: false,
          dev: false
        }
      };

      const tempConfigPath = path.join(projectRoot, 'temp-emoji-style.config.json');
      fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));

      try {
        const result = execSync(`npm run build && node dist/bin/cli.js --config ${tempConfigPath} --preview`, {
          cwd: projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        });

        expect(result).toContain('Message style: emoji');
      } finally {
        fs.unlinkSync(tempConfigPath);
      }
    });
  });

  describe('Configuration Validation', () => {
    it('should handle invalid date ranges', async () => {
      const config = {
        dateRange: {
          startDate: '2023-12-31',
          endDate: '2023-01-01'
        },
        commits: {
          maxPerDay: 5,
          distribution: 'uniform',
          messageStyle: 'default'
        },
        options: {
          repositoryPath: testRepoPath,
          preview: false,
          push: false,
          verbose: false,
          dev: false
        }
      };

      const tempConfigPath = path.join(projectRoot, 'temp-invalid-dates.config.json');
      fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));

      try {
        let output = '';
        try {
          output = execSync(`node dist/bin/cli.js --config ${tempConfigPath} --preview`, {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
        } catch (error: any) {
          // Command failed, combine stdout and stderr
          output = (error.stdout || '') + (error.stderr || '');
        }

        expect(output).toMatch(/Start date.*must be.*before.*end date/i);
      } finally {
        fs.unlinkSync(tempConfigPath);
      }
    });

    it('should handle invalid commit counts', async () => {
      const config = {
        dateRange: {
          startDate: '2023-01-01',
          endDate: '2023-01-05'
        },
        commits: {
          maxPerDay: -5,
          distribution: 'uniform',
          messageStyle: 'default'
        },
        options: {
          repositoryPath: testRepoPath,
          preview: false,
          push: false,
          verbose: false,
          dev: false
        }
      };

      const tempConfigPath = path.join(projectRoot, 'temp-invalid-commits.config.json');
      fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));

      try {
        let output = '';
        try {
          output = execSync(`node dist/bin/cli.js --config ${tempConfigPath} --preview`, {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
        } catch (error: any) {
          output = (error.stdout || '') + (error.stderr || '');
        }

        expect(output).toMatch(/maxPerDay.*must be.*at least/i);
      } finally {
        fs.unlinkSync(tempConfigPath);
      }
    });

    it('should handle invalid distribution types', async () => {
      const config = {
        dateRange: {
          startDate: '2023-01-01',
          endDate: '2023-01-05'
        },
        commits: {
          maxPerDay: 5,
          distribution: 'invalid-distribution',
          messageStyle: 'default'
        },
        options: {
          repositoryPath: testRepoPath,
          preview: false,
          push: false,
          verbose: false,
          dev: false
        }
      };

      const tempConfigPath = path.join(projectRoot, 'temp-invalid-distribution.config.json');
      fs.writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));

      try {
        let output = '';
        try {
          output = execSync(`node dist/bin/cli.js --config ${tempConfigPath} --preview`, {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
        } catch (error: any) {
          output = (error.stdout || '') + (error.stderr || '');
        }

        expect(output).toMatch(/distribution.*must be one of/i);
      } finally {
        fs.unlinkSync(tempConfigPath);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing config file gracefully', () => {
      expect(() => {
        execSync('npm run build && node dist/bin/cli.js --config non-existent.json', {
          cwd: projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        });
      }).toThrow();
    });

    it('should handle invalid JSON config file', () => {
      const invalidConfigPath = path.join(projectRoot, 'temp-invalid.json');
      fs.writeFileSync(invalidConfigPath, '{ invalid json }');

      try {
        expect(() => {
          execSync(`npm run build && node dist/bin/cli.js --config ${invalidConfigPath} --preview`, {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: 'pipe'
          });
        }).toThrow();
      } finally {
        fs.unlinkSync(invalidConfigPath);
      }
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