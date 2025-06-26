import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GitOperations, createGitOperations, isGitRepository, getRepositoryInfo } from '../../src/git.js';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// Mock data
const mockAuthor = {
  name: 'Test User',
  email: 'test@example.com'
};

const testRepoPath = join(process.cwd(), 'test-temp-repo');

// Helper function to safely remove directory on Windows
const safeRemoveDir = (path: string) => {
  if (!existsSync(path)) return;
  
  try {
    // Try to remove .git folder attributes on Windows
    if (process.platform === 'win32') {
      try {
        execSync(`attrib -R -H -S "${path}\\*.*" /S /D`, { stdio: 'ignore' });
        execSync(`rmdir /S /Q "${path}"`, { stdio: 'ignore' });
      } catch {
        // If Windows commands fail, try rmSync
        rmSync(path, { recursive: true, force: true });
      }
    } else {
      rmSync(path, { recursive: true, force: true });
    }
  } catch (error) {
    // If all else fails, just continue
    console.warn(`Could not remove ${path}:`, error);
  }
};

describe('GitOperations', () => {
  let gitOps: GitOperations;

  beforeEach(() => {
    // Clean up any existing test repo
    safeRemoveDir(testRepoPath);
    
    // Create fresh test directory
    mkdirSync(testRepoPath, { recursive: true });
    
    // Initialize git repository
    execSync('git init', { cwd: testRepoPath, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: testRepoPath, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath, stdio: 'ignore' });
    
    gitOps = new GitOperations(testRepoPath);
  });

  afterEach(() => {
    // Clean up test repo
    safeRemoveDir(testRepoPath);
  });

  describe('Constructor', () => {
    it('should use test-repo directory in development/test mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      const git = new GitOperations();
      expect(git.getRepositoryPath()).toContain('test-repo');
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should use current working directory in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const git = new GitOperations();
      expect(git.getRepositoryPath()).toBe(process.cwd());
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should use provided path when specified', () => {
      // Create a temporary directory for testing
      const customPath = join(process.cwd(), 'custom-test-path');
      mkdirSync(customPath, { recursive: true });
      
      const git = new GitOperations(customPath);
      expect(git.getRepositoryPath()).toBe(customPath);
      
      safeRemoveDir(customPath);
    });
  });

  describe('isGitRepository', () => {
    it('should return true for valid Git repository', async () => {
      const isRepo = await gitOps.isGitRepository();
      expect(isRepo).toBe(true);
    });

    it('should return false for non-Git directory', async () => {
      const nonGitPath = join(process.cwd(), 'test-non-git');
      mkdirSync(nonGitPath, { recursive: true });
      
      const nonGitOps = new GitOperations(nonGitPath);
      const isRepo = await nonGitOps.isGitRepository();
      expect(isRepo).toBe(false);
      
      safeRemoveDir(nonGitPath);
    });

    it('should return false for non-existent directory', async () => {
      const nonExistentOps = new GitOperations('/non/existent/path');
      const isRepo = await nonExistentOps.isGitRepository();
      expect(isRepo).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      // Create initial commit to establish branch
      writeFileSync(join(testRepoPath, 'README.md'), 'Initial commit');
      execSync('git add .', { cwd: testRepoPath, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: testRepoPath, stdio: 'ignore' });
      
      const branch = await gitOps.getCurrentBranch();
      expect(branch).toBe('master');
    });
  });

  describe('getRemotes', () => {
    it('should return empty array when no remotes exist', async () => {
      const remotes = await gitOps.getRemotes();
      expect(remotes).toEqual([]);
    });

    it('should return remotes when they exist', async () => {
      // Add a remote
      execSync('git remote add origin https://github.com/test/repo.git', { 
        cwd: testRepoPath, 
        stdio: 'ignore' 
      });
      
      const remotes = await gitOps.getRemotes();
      expect(remotes).toHaveLength(1);
      expect(remotes[0]).toEqual({
        name: 'origin',
        url: 'https://github.com/test/repo.git'
      });
    });
  });

  describe('getCommitHistory', () => {
    it('should return empty array when no commits exist', async () => {
      const commits = await gitOps.getCommitHistory();
      expect(commits).toEqual([]);
    });

    it('should return commit history when commits exist', async () => {
      // Create a commit
      writeFileSync(join(testRepoPath, 'test.txt'), 'Test content');
      execSync('git add .', { cwd: testRepoPath, stdio: 'ignore' });
      execSync('git commit -m "Test commit"', { cwd: testRepoPath, stdio: 'ignore' });
      
      const commits = await gitOps.getCommitHistory();
      expect(commits).toHaveLength(1);
      expect(commits[0]).toMatchObject({
        message: 'Test commit',
        author: 'Test User',
        email: 'test@example.com'
      });
      expect(commits[0].hash).toBeDefined();
      expect(commits[0].date).toBeInstanceOf(Date);
    });

    it('should respect limit parameter', async () => {
      // Create multiple commits
      for (let i = 0; i < 5; i++) {
        writeFileSync(join(testRepoPath, `test${i}.txt`), `Test content ${i}`);
        execSync('git add .', { cwd: testRepoPath, stdio: 'ignore' });
        execSync(`git commit -m "Test commit ${i}"`, { cwd: testRepoPath, stdio: 'ignore' });
      }
      
      const commits = await gitOps.getCommitHistory(3);
      expect(commits).toHaveLength(3);
    });
  });

  describe('getTotalCommitCount', () => {
    it('should return 0 when no commits exist', async () => {
      const count = await gitOps.getTotalCommitCount();
      expect(count).toBe(0);
    });

    it('should return correct commit count', async () => {
      // Create commits
      for (let i = 0; i < 3; i++) {
        writeFileSync(join(testRepoPath, `test${i}.txt`), `Test content ${i}`);
        execSync('git add .', { cwd: testRepoPath, stdio: 'ignore' });
        execSync(`git commit -m "Test commit ${i}"`, { cwd: testRepoPath, stdio: 'ignore' });
      }
      
      const count = await gitOps.getTotalCommitCount();
      expect(count).toBe(3);
    });
  });

  describe('getRepositoryStatus', () => {
    it('should return clean status for clean repository', async () => {
      const status = await gitOps.getRepositoryStatus();
      expect(status.isClean).toBe(true);
      expect(status.staged).toHaveLength(0);
      expect(status.modified).toHaveLength(0);
      expect(status.untracked).toHaveLength(0);
      expect(status.deleted).toHaveLength(0);
    });

    it('should detect untracked files', async () => {
      writeFileSync(join(testRepoPath, 'untracked.txt'), 'Untracked content');
      
      const status = await gitOps.getRepositoryStatus();
      expect(status.isClean).toBe(false);
      expect(status.untracked).toContain('untracked.txt');
    });

    it('should detect staged files', async () => {
      writeFileSync(join(testRepoPath, 'staged.txt'), 'Staged content');
      execSync('git add staged.txt', { cwd: testRepoPath, stdio: 'ignore' });
      
      const status = await gitOps.getRepositoryStatus();
      expect(status.isClean).toBe(false);
      expect(status.staged).toContain('staged.txt');
    });
  });

  describe('isWorkingDirectoryClean', () => {
    it('should return true for clean directory', async () => {
      const isClean = await gitOps.isWorkingDirectoryClean();
      expect(isClean).toBe(true);
    });

    it('should return false for dirty directory', async () => {
      writeFileSync(join(testRepoPath, 'dirty.txt'), 'Dirty content');
      
      const isClean = await gitOps.isWorkingDirectoryClean();
      expect(isClean).toBe(false);
    });
  });

  describe('getRepositoryInfo', () => {
    it('should throw error for non-Git repository', async () => {
      const nonGitPath = join(process.cwd(), 'test-non-git-info');
      mkdirSync(nonGitPath, { recursive: true });
      
      const nonGitOps = new GitOperations(nonGitPath);
      
      await expect(nonGitOps.getRepositoryInfo()).rejects.toThrow('Not a Git repository');
      
      safeRemoveDir(nonGitPath);
    });

    it('should return repository info with no commits', async () => {
      const info = await gitOps.getRepositoryInfo();
      
      expect(info).toMatchObject({
        path: testRepoPath,
        branch: 'master',
        totalCommits: 0,
        lastCommit: undefined
      });
      expect(info.remote).toBeUndefined();
      expect(info.remoteUrl).toBeUndefined();
    });

    it('should return complete repository info with commits and remote', async () => {
      // Add remote
      execSync('git remote add origin https://github.com/test/repo.git', { 
        cwd: testRepoPath, 
        stdio: 'ignore' 
      });
      
      // Create commit
      writeFileSync(join(testRepoPath, 'README.md'), 'Test repository');
      execSync('git add .', { cwd: testRepoPath, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: testRepoPath, stdio: 'ignore' });
      
      const info = await gitOps.getRepositoryInfo();
      
      expect(info).toMatchObject({
        path: testRepoPath,
        branch: 'master',
        remote: 'origin',
        remoteUrl: 'https://github.com/test/repo.git',
        totalCommits: 1
      });
      
      expect(info.lastCommit).toBeDefined();
      expect(info.lastCommit?.message).toBe('Initial commit');
      expect(info.lastCommit?.author).toBe('Test User');
    });
  });

  describe('createCommit', () => {
    beforeEach(async () => {
      // Add a file to commit
      writeFileSync(join(testRepoPath, 'test.txt'), 'Test content');
      await gitOps.addAll();
    });

    it('should create commit with custom date and author', async () => {
      const commitDate = new Date('2023-01-01T12:00:00Z');
      const customAuthor = { name: 'Custom Author', email: 'custom@example.com' };
      
      const result = await gitOps.createCommit('Custom commit', commitDate, customAuthor);
      
      expect(result.commit).toBeDefined();
      
      // Verify commit was created with correct details
      const commits = await gitOps.getCommitHistory(1);
      expect(commits).toHaveLength(1);
      expect(commits[0].message).toBe('Custom commit');
      expect(commits[0].author).toBe('Custom Author');
      expect(commits[0].email).toBe('custom@example.com');
    });

    it('should create commit with environment variables correctly', async () => {
      // This test verifies that the commit creation works with custom author
      // and that we properly handle the git commit process
      const result = await gitOps.createCommit('Test commit with env', new Date(), mockAuthor);
      
      // Verify the commit was created
      expect(result).toBeDefined();
      expect(typeof result.commit).toBe('string');
      
      // Verify the commit appears in history
      const commits = await gitOps.getCommitHistory(1);
      expect(commits).toHaveLength(1);
      expect(commits[0].message).toBe('Test commit with env');
    });
  });

  describe('branchExists', () => {
    it('should return true for existing branch', async () => {
      // Create initial commit to establish master branch
      writeFileSync(join(testRepoPath, 'README.md'), 'Initial');
      execSync('git add .', { cwd: testRepoPath, stdio: 'ignore' });
      execSync('git commit -m "Initial"', { cwd: testRepoPath, stdio: 'ignore' });
      
      const exists = await gitOps.branchExists('master');
      expect(exists).toBe(true);
    });

    it('should return false for non-existing branch', async () => {
      const exists = await gitOps.branchExists('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('createBranch', () => {
    it('should create new branch', async () => {
      // Create initial commit first
      writeFileSync(join(testRepoPath, 'README.md'), 'Initial');
      execSync('git add .', { cwd: testRepoPath, stdio: 'ignore' });
      execSync('git commit -m "Initial"', { cwd: testRepoPath, stdio: 'ignore' });
      
      await gitOps.createBranch('feature-branch');
      
      const exists = await gitOps.branchExists('feature-branch');
      expect(exists).toBe(true);
      
      const currentBranch = await gitOps.getCurrentBranch();
      expect(currentBranch).toBe('feature-branch');
    });
  });

  describe('switchBranch', () => {
    it('should switch to existing branch', async () => {
      // Create initial commit and branch
      writeFileSync(join(testRepoPath, 'README.md'), 'Initial');
      execSync('git add .', { cwd: testRepoPath, stdio: 'ignore' });
      execSync('git commit -m "Initial"', { cwd: testRepoPath, stdio: 'ignore' });
      
      await gitOps.createBranch('feature-branch');
      await gitOps.switchBranch('master');
      
      const currentBranch = await gitOps.getCurrentBranch();
      expect(currentBranch).toBe('master');
    });

    it('should throw error when switching to non-existent branch', async () => {
      await expect(
        gitOps.switchBranch('non-existent')
      ).rejects.toThrow('Failed to switch to branch');
    });
  });
});

describe('Utility Functions', () => {
  describe('createGitOperations', () => {
    it('should create GitOperations instance', () => {
      // Create a temporary directory for testing
      const testPath = join(process.cwd(), 'factory-test-path');
      mkdirSync(testPath, { recursive: true });
      
      const git = createGitOperations(testPath);
      expect(git).toBeInstanceOf(GitOperations);
      expect(git.getRepositoryPath()).toBe(testPath);
      
      safeRemoveDir(testPath);
    });
  });

  describe('isGitRepository', () => {
    it('should check Git repository status', async () => {
      const testPath = join(process.cwd(), 'test-util-repo');
      mkdirSync(testPath, { recursive: true });
      
      // Should return false for non-Git directory
      let isRepo = await isGitRepository(testPath);
      expect(isRepo).toBe(false);
      
      // Initialize Git repository
      execSync('git init', { cwd: testPath, stdio: 'ignore' });
      
      // Should return true for Git directory
      isRepo = await isGitRepository(testPath);
      expect(isRepo).toBe(true);
      
      safeRemoveDir(testPath);
    });
  });

  describe('getRepositoryInfo', () => {
    it('should get repository information', async () => {
      const testPath = join(process.cwd(), 'test-util-info-repo');
      mkdirSync(testPath, { recursive: true });
      
      // Initialize Git repository
      execSync('git init', { cwd: testPath, stdio: 'ignore' });
      execSync('git config user.name "Test"', { cwd: testPath, stdio: 'ignore' });
      execSync('git config user.email "test@test.com"', { cwd: testPath, stdio: 'ignore' });
      
      const info = await getRepositoryInfo(testPath);
      expect(info.path).toBe(testPath);
      expect(info.branch).toBe('master');
      expect(info.totalCommits).toBe(0);
      
      safeRemoveDir(testPath);
    });
  });
}); 