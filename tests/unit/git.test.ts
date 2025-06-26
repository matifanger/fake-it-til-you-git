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

  describe('Backup and Preservation', () => {
    beforeEach(async () => {
      // Create initial commit for backup tests
      writeFileSync(join(testRepoPath, 'README.md'), 'Initial content');
      execSync('git add .', { cwd: testRepoPath, stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { cwd: testRepoPath, stdio: 'ignore' });
    });

    describe('createBackup', () => {
      it('should create backup of repository state', async () => {
        const backupInfo = await gitOps.createBackup();
        
        expect(backupInfo).toMatchObject({
          branch: 'master',
          totalCommits: 1,
          repositoryPath: testRepoPath
        });
        expect(backupInfo.id).toMatch(/^backup_\d+_[a-z0-9]+$/);
        expect(backupInfo.timestamp).toBeInstanceOf(Date);
        expect(backupInfo.lastCommitHash).toBeDefined();
        expect(backupInfo.backupPath).toContain('fake-it-til-you-git-backups');
        expect(existsSync(backupInfo.backupPath)).toBe(true);
      });

      it('should throw error when not in Git repository', async () => {
        const nonGitPath = join(process.cwd(), 'test-non-git-backup');
        mkdirSync(nonGitPath, { recursive: true });
        
        const nonGitOps = new GitOperations(nonGitPath);
        
        await expect(nonGitOps.createBackup()).rejects.toThrow('Not a Git repository - cannot create backup');
        
        safeRemoveDir(nonGitPath);
      });

      it('should handle repository with no commits', async () => {
        // Create empty repo
        const emptyRepoPath = join(process.cwd(), 'test-empty-backup');
        mkdirSync(emptyRepoPath, { recursive: true });
        execSync('git init', { cwd: emptyRepoPath, stdio: 'ignore' });
        execSync('git config user.name "Test"', { cwd: emptyRepoPath, stdio: 'ignore' });
        execSync('git config user.email "test@test.com"', { cwd: emptyRepoPath, stdio: 'ignore' });
        
        const emptyGitOps = new GitOperations(emptyRepoPath);
        const backupInfo = await emptyGitOps.createBackup();
        
        expect(backupInfo.totalCommits).toBe(0);
        expect(backupInfo.lastCommitHash).toBe('');
        
        safeRemoveDir(emptyRepoPath);
      });
    });

    describe('restoreFromBackup', () => {
      it('should restore repository from backup', async () => {
        // Create backup
        const backupInfo = await gitOps.createBackup();
        const originalCommitHash = backupInfo.lastCommitHash;
        
        // Make additional commit
        writeFileSync(join(testRepoPath, 'test.txt'), 'New content');
        execSync('git add .', { cwd: testRepoPath, stdio: 'ignore' });
        execSync('git commit -m "Additional commit"', { cwd: testRepoPath, stdio: 'ignore' });
        
        // Verify we have 2 commits now
        expect(await gitOps.getTotalCommitCount()).toBe(2);
        
        // Restore from backup
        await gitOps.restoreFromBackup(backupInfo);
        
        // Verify restoration
        const currentCommits = await gitOps.getCommitHistory(1);
        expect(currentCommits[0].hash).toBe(originalCommitHash);
      });

      it('should throw error when backup file does not exist', async () => {
        const fakeBackupInfo = {
          id: 'fake_backup',
          timestamp: new Date(),
          branch: 'master',
          lastCommitHash: 'fake_hash',
          totalCommits: 1,
          backupPath: join(testRepoPath, '.git', 'fake-it-til-you-git-backups', 'nonexistent.json'),
          repositoryPath: testRepoPath
        };
        
        await expect(gitOps.restoreFromBackup(fakeBackupInfo)).rejects.toThrow('Backup file not found');
      });

      it('should handle invalid commit hash in backup', async () => {
        const backupInfo = await gitOps.createBackup();
        backupInfo.lastCommitHash = 'invalid_hash';
        
        await expect(gitOps.restoreFromBackup(backupInfo)).rejects.toThrow('Cannot restore to commit invalid_hash: commit not found');
      });

      it('should handle branch switching gracefully', async () => {
        // Create backup
        const backupInfo = await gitOps.createBackup();
        
        // Create and switch to new branch
        await gitOps.createBranch('feature');
        
        // Restore from backup (should switch back to master)
        await gitOps.restoreFromBackup(backupInfo);
        
        const currentBranch = await gitOps.getCurrentBranch();
        expect(currentBranch).toBe('master');
      });
    });

    describe('verifyIntegrity', () => {
      it('should pass integrity check for valid repository', async () => {
        const result = await gitOps.verifyIntegrity();
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.commitCount).toBe(1);
        expect(result.branchInfo.current).toBe('master');
        expect(result.branchInfo.exists).toBe(true);
      });

      it('should detect non-Git repository', async () => {
        const nonGitPath = join(process.cwd(), 'test-non-git-integrity');
        mkdirSync(nonGitPath, { recursive: true });
        
        const nonGitOps = new GitOperations(nonGitPath);
        const result = await nonGitOps.verifyIntegrity();
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Not a valid Git repository');
        
        safeRemoveDir(nonGitPath);
      });

      it('should detect dirty working directory', async () => {
        // Create uncommitted changes
        writeFileSync(join(testRepoPath, 'dirty.txt'), 'Uncommitted content');
        
        const result = await gitOps.verifyIntegrity();
        
        expect(result.warnings).toContain('Working directory is not clean');
      });
    });

          describe('verifyIntegrity - Empty Repository', () => {
        it('should handle repository with no commits', async () => {
          // Create empty repo
          const emptyRepoPath = join(process.cwd(), 'test-empty-integrity');
          mkdirSync(emptyRepoPath, { recursive: true });
          execSync('git init', { cwd: emptyRepoPath, stdio: 'ignore' });
          execSync('git config user.name "Test"', { cwd: emptyRepoPath, stdio: 'ignore' });
          execSync('git config user.email "test@test.com"', { cwd: emptyRepoPath, stdio: 'ignore' });
          
          const emptyGitOps = new GitOperations(emptyRepoPath);
          const result = await emptyGitOps.verifyIntegrity();
          
          expect(result.commitCount).toBe(0);
          expect(result.warnings).toContain('No commits in repository (HEAD does not exist)');
          
          safeRemoveDir(emptyRepoPath);
        });
      });

    describe('cleanupBackup', () => {
      it('should clean up specific backup', async () => {
        const backupInfo = await gitOps.createBackup();
        
        // Verify backup exists
        expect(existsSync(backupInfo.backupPath)).toBe(true);
        
        // Clean up backup
        await gitOps.cleanupBackup(backupInfo);
        
        // Verify backup is removed
        expect(existsSync(backupInfo.backupPath)).toBe(false);
      });

      it('should handle non-existent backup gracefully', async () => {
        const fakeBackupInfo = {
          id: 'fake_backup',
          timestamp: new Date(),
          branch: 'master',
          lastCommitHash: 'fake_hash',
          totalCommits: 1,
          backupPath: join(testRepoPath, '.git', 'fake-it-til-you-git-backups', 'nonexistent.json'),
          repositoryPath: testRepoPath
        };
        
        // Should not throw error
        await expect(gitOps.cleanupBackup(fakeBackupInfo)).resolves.toBeUndefined();
      });

      it('should clean up old backups when no specific backup provided', async () => {
        // Create old backup by mocking timestamp
        const oldBackupInfo = await gitOps.createBackup();
        
        // Manually modify the backup file to have old timestamp
        const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
        const backupData = JSON.parse(require('fs').readFileSync(oldBackupInfo.backupPath, 'utf8'));
        backupData.timestamp = oldTimestamp.toISOString();
        require('fs').writeFileSync(oldBackupInfo.backupPath, JSON.stringify(backupData, null, 2));
        
        // Create new backup (should not be cleaned up)
        const newBackupInfo = await gitOps.createBackup();
        
        // Clean up all old backups
        await gitOps.cleanupBackup();
        
        // Old backup should be removed, new backup should remain
        expect(existsSync(oldBackupInfo.backupPath)).toBe(false);
        expect(existsSync(newBackupInfo.backupPath)).toBe(true);
      });

      it('should handle no backups directory gracefully', async () => {
        const cleanRepoPath = join(process.cwd(), 'test-clean-repo');
        mkdirSync(cleanRepoPath, { recursive: true });
        execSync('git init', { cwd: cleanRepoPath, stdio: 'ignore' });
        
        const cleanGitOps = new GitOperations(cleanRepoPath);
        
        // Should not throw error
        await expect(cleanGitOps.cleanupBackup()).resolves.toBeUndefined();
        
        safeRemoveDir(cleanRepoPath);
      });
    });

    describe('listBackups', () => {
      it('should return empty array when no backups exist', async () => {
        const cleanRepoPath = join(process.cwd(), 'test-list-repo');
        mkdirSync(cleanRepoPath, { recursive: true });
        execSync('git init', { cwd: cleanRepoPath, stdio: 'ignore' });
        
        const cleanGitOps = new GitOperations(cleanRepoPath);
        const backups = await cleanGitOps.listBackups();
        
        expect(backups).toEqual([]);
        
        safeRemoveDir(cleanRepoPath);
      });

      it('should list existing backups sorted by timestamp', async () => {
        // Create multiple backups with small delay
        const backup1 = await gitOps.createBackup();
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        const backup2 = await gitOps.createBackup();
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        const backup3 = await gitOps.createBackup();
        
        const backups = await gitOps.listBackups();
        
        expect(backups).toHaveLength(3);
        
        // Should be sorted by timestamp (newest first)
        expect(new Date(backups[0].timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(backups[1].timestamp).getTime()
        );
        expect(new Date(backups[1].timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(backups[2].timestamp).getTime()
        );
        
        // Verify backup IDs match
        const backupIds = backups.map(b => b.id).sort();
        const expectedIds = [backup1.id, backup2.id, backup3.id].sort();
        expect(backupIds).toEqual(expectedIds);
      });

      it('should skip corrupted backup files', async () => {
        // Create valid backup
        const validBackup = await gitOps.createBackup();
        
        // Create corrupted backup file
        const backupDir = join(testRepoPath, '.git', 'fake-it-til-you-git-backups');
        const corruptedPath = join(backupDir, 'corrupted.json');
        writeFileSync(corruptedPath, 'invalid json content');
        
        const backups = await gitOps.listBackups();
        
        // Should only return the valid backup
        expect(backups).toHaveLength(1);
        expect(backups[0].id).toBe(validBackup.id);
      });
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