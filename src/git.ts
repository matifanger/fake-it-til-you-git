import { existsSync } from 'fs';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { cwd } from 'process';
import { type CommitResult, type SimpleGit, StatusResult, simpleGit } from 'simple-git';

/**
 * Interface for repository information
 */
export interface RepositoryInfo {
  path: string;
  branch: string;
  remote?: string;
  remoteUrl?: string;
  totalCommits: number;
  lastCommit?: {
    hash: string;
    date: Date;
    message: string;
    author: string;
  };
}

/**
 * Interface for commit information
 */
export interface CommitInfo {
  hash: string;
  date: Date;
  message: string;
  author: string;
  email: string;
}

/**
 * Interface for repository status
 */
export interface RepoStatus {
  isClean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  deleted: string[];
  ahead: number;
  behind: number;
}

/**
 * Interface for backup information
 */
export interface BackupInfo {
  id: string;
  timestamp: Date;
  branch: string;
  lastCommitHash: string;
  totalCommits: number;
  backupPath: string;
  repositoryPath: string;
}

/**
 * Interface for integrity check result
 */
export interface IntegrityCheckResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  commitCount: number;
  branchInfo: {
    current: string;
    exists: boolean;
  };
}

/**
 * Interface for push result
 */
export interface PushResult {
  success: boolean;
  error?: string;
  details?: string;
}

/**
 * Git operations handler with cross-platform compatibility
 */
export class GitOperations {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath?: string) {
    // In development mode, use test-repo directory
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      this.repoPath = repoPath || join(cwd(), 'test-repo');
    } else {
      this.repoPath = repoPath || cwd();
    }

    // Only initialize git if directory exists
    if (existsSync(this.repoPath)) {
      this.git = simpleGit(this.repoPath);
    } else {
      this.git = simpleGit();
    }
  }

  /**
   * Check if current directory is a Git repository
   * @returns Promise<boolean> - True if Git repository exists
   */
  async isGitRepository(): Promise<boolean> {
    try {
      // Check if .git directory exists
      const gitDir = join(this.repoPath, '.git');
      if (!existsSync(gitDir)) {
        return false;
      }

      // Verify it's a valid Git repository by checking if we can get status
      await this.git.status();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get repository information
   * @returns Promise<RepositoryInfo> - Repository details
   */
  async getRepositoryInfo(): Promise<RepositoryInfo> {
    if (!(await this.isGitRepository())) {
      throw new Error(`Not a Git repository: ${this.repoPath}`);
    }

    try {
      const [branch, remotes, log] = await Promise.all([
        this.getCurrentBranch(),
        this.getRemotes(),
        this.getCommitHistory(1),
      ]);

      const remote = remotes.length > 0 ? remotes[0].name : undefined;
      const remoteUrl = remotes.length > 0 ? remotes[0].url : undefined;
      const totalCommits = await this.getTotalCommitCount();

      const lastCommit =
        log.length > 0
          ? {
              hash: log[0].hash,
              date: log[0].date,
              message: log[0].message,
              author: log[0].author,
            }
          : undefined;

      return {
        path: this.repoPath,
        branch,
        remote,
        remoteUrl,
        totalCommits,
        lastCommit,
      };
    } catch (error) {
      throw new Error(
        `Failed to get repository info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get current branch name
   * @returns Promise<string> - Current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const branches = await this.git.branch();
      return branches.current || 'master';
    } catch (error) {
      // If there are no commits yet, return default branch name
      return 'master';
    }
  }

  /**
   * Get list of remotes
   * @returns Promise<Array<{name: string, url: string}>> - Remote repositories
   */
  async getRemotes(): Promise<Array<{ name: string; url: string }>> {
    try {
      const remotes = await this.git.getRemotes(true);
      return remotes.map((remote) => ({
        name: remote.name,
        url: remote.refs.fetch || remote.refs.push || '',
      }));
    } catch (error) {
      // Return empty array if no remotes exist
      return [];
    }
  }

  /**
   * Get commit history
   * @param limit - Maximum number of commits to retrieve
   * @returns Promise<CommitInfo[]> - Array of commit information
   */
  async getCommitHistory(limit = 100): Promise<CommitInfo[]> {
    try {
      const log = await this.git.log({ maxCount: limit });
      return log.all.map((commit) => ({
        hash: commit.hash,
        date: new Date(commit.date),
        message: commit.message,
        author: commit.author_name,
        email: commit.author_email,
      }));
    } catch (error) {
      // Return empty array if no commits exist
      return [];
    }
  }

  /**
   * Get total commit count
   * @returns Promise<number> - Total number of commits
   */
  async getTotalCommitCount(): Promise<number> {
    try {
      const log = await this.git.raw(['rev-list', '--count', 'HEAD']);
      return Number.parseInt(log.trim(), 10);
    } catch (error) {
      // Return 0 if no commits exist
      return 0;
    }
  }

  /**
   * Get repository status
   * @returns Promise<RepoStatus> - Repository working directory status
   */
  async getRepositoryStatus(): Promise<RepoStatus> {
    try {
      const status = await this.git.status();

      return {
        isClean: status.isClean(),
        staged: status.staged,
        modified: status.modified,
        untracked: status.not_added,
        deleted: status.deleted,
        ahead: status.ahead || 0,
        behind: status.behind || 0,
      };
    } catch (error) {
      throw new Error(
        `Failed to get repository status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if working directory is clean
   * @returns Promise<boolean> - True if working directory is clean
   */
  async isWorkingDirectoryClean(): Promise<boolean> {
    const status = await this.getRepositoryStatus();
    return status.isClean;
  }

  /**
   * Initialize a new Git repository
   * @returns Promise<void>
   */
  async initRepository(): Promise<void> {
    try {
      await this.git.init();
    } catch (error) {
      throw new Error(
        `Failed to initialize Git repository: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add all files to staging area
   * @returns Promise<void>
   */
  async addAll(): Promise<void> {
    try {
      await this.git.add('.');
    } catch (error) {
      throw new Error(
        `Failed to add files: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a commit with specific date and author
   * @param message - Commit message
   * @param date - Commit date
   * @param author - Author information
   * @returns Promise<CommitResult>
   */
  async createCommit(
    message: string,
    date: Date,
    author: { name: string; email: string }
  ): Promise<CommitResult> {
    try {
      // Create a new git instance with custom environment
      const gitWithEnv = simpleGit({
        baseDir: this.repoPath,
        config: [`user.name=${author.name}`, `user.email=${author.email}`],
      });

      // Set environment variables for the current process temporarily
      const originalEnv = {
        GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME,
        GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL,
        GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME,
        GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL,
        GIT_AUTHOR_DATE: process.env.GIT_AUTHOR_DATE,
        GIT_COMMITTER_DATE: process.env.GIT_COMMITTER_DATE,
      };

      process.env.GIT_AUTHOR_NAME = author.name;
      process.env.GIT_AUTHOR_EMAIL = author.email;
      process.env.GIT_COMMITTER_NAME = author.name;
      process.env.GIT_COMMITTER_EMAIL = author.email;
      process.env.GIT_AUTHOR_DATE = date.toISOString();
      process.env.GIT_COMMITTER_DATE = date.toISOString();

      try {
        const result = await gitWithEnv.commit(message);
        return result;
      } finally {
        // Restore original environment variables
        Object.keys(originalEnv).forEach((key) => {
          const value = originalEnv[key as keyof typeof originalEnv];
          if (value === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = value;
          }
        });
      }
    } catch (error) {
      throw new Error(
        `Failed to create commit: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get the repository path
   * @returns string - Repository path
   */
  getRepositoryPath(): string {
    return this.repoPath;
  }

  /**
   * Check if a branch exists
   * @param branchName - Name of the branch to check
   * @returns Promise<boolean> - True if branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      const branches = await this.git.branch();
      return branches.all.includes(branchName);
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a new branch
   * @param branchName - Name of the new branch
   * @returns Promise<void>
   */
  async createBranch(branchName: string): Promise<void> {
    try {
      await this.git.checkoutLocalBranch(branchName);
    } catch (error) {
      throw new Error(
        `Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Switch to a branch
   * @param branchName - Name of the branch to switch to
   * @returns Promise<void>
   */
  async switchBranch(branchName: string): Promise<void> {
    try {
      await this.git.checkout(branchName);
    } catch (error) {
      throw new Error(
        `Failed to switch to branch: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a backup of the current repository state
   * @returns Promise<BackupInfo> - Backup information
   */
  async createBackup(): Promise<BackupInfo> {
    if (!(await this.isGitRepository())) {
      throw new Error('Not a Git repository - cannot create backup');
    }

    try {
      const repositoryInfo = await this.getRepositoryInfo();
      const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const backupDir = join(this.repoPath, '.git', 'fake-it-til-you-git-backups');
      const backupPath = join(backupDir, `${backupId}.json`);

      // Create backup directory if it doesn't exist
      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
      }

      // Get current HEAD hash
      const headHash = await this.git.revparse(['HEAD']).catch(() => '');

      // Create backup info
      const backupInfo: BackupInfo = {
        id: backupId,
        timestamp: new Date(),
        branch: repositoryInfo.branch,
        lastCommitHash: headHash,
        totalCommits: repositoryInfo.totalCommits,
        backupPath,
        repositoryPath: this.repoPath,
      };

      // Save backup info to file
      writeFileSync(backupPath, JSON.stringify(backupInfo, null, 2), 'utf8');

      return backupInfo;
    } catch (error) {
      throw new Error(
        `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Restore repository from a backup
   * @param backupInfo - Backup information to restore from
   * @returns Promise<void>
   */
  async restoreFromBackup(backupInfo: BackupInfo): Promise<void> {
    if (!(await this.isGitRepository())) {
      throw new Error('Not a Git repository - cannot restore backup');
    }

    try {
      // Verify backup file exists
      if (!existsSync(backupInfo.backupPath)) {
        throw new Error(`Backup file not found: ${backupInfo.backupPath}`);
      }

      // If we have a valid commit hash, reset to it
      if (backupInfo.lastCommitHash) {
        try {
          // Check if the commit exists
          await this.git.show([backupInfo.lastCommitHash, '--name-only']);

          // Reset to the backup commit
          await this.git.reset(['--hard', backupInfo.lastCommitHash]);
        } catch (error) {
          throw new Error(
            `Cannot restore to commit ${backupInfo.lastCommitHash}: commit not found`
          );
        }
      }

      // Switch to the original branch if it exists
      try {
        const branches = await this.git.branch();
        if (branches.all.includes(backupInfo.branch)) {
          await this.switchBranch(backupInfo.branch);
        }
      } catch (error) {
        // If branch switch fails, continue with current branch
        console.warn(`Warning: Could not switch to original branch ${backupInfo.branch}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify repository integrity after operations
   * @returns Promise<IntegrityCheckResult> - Integrity check results
   */
  async verifyIntegrity(): Promise<IntegrityCheckResult> {
    const result: IntegrityCheckResult = {
      isValid: true,
      errors: [],
      warnings: [],
      commitCount: 0,
      branchInfo: {
        current: '',
        exists: false,
      },
    };

    try {
      // Check if it's a valid Git repository
      if (!(await this.isGitRepository())) {
        result.isValid = false;
        result.errors.push('Not a valid Git repository');
        return result;
      }

      // Check repository status
      try {
        const status = await this.getRepositoryStatus();
        if (!status.isClean) {
          result.warnings.push('Working directory is not clean');
        }
      } catch (error) {
        result.errors.push(
          `Failed to get repository status: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Get current branch info
      try {
        const currentBranch = await this.getCurrentBranch();
        result.branchInfo.current = currentBranch;
        result.branchInfo.exists = true;
      } catch (error) {
        result.errors.push(
          `Failed to get current branch: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        result.branchInfo.exists = false;
      }

      // Get commit count
      try {
        result.commitCount = await this.getTotalCommitCount();
      } catch (error) {
        result.warnings.push(
          `Could not get commit count: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Verify Git objects integrity
      try {
        await this.git.raw(['fsck', '--no-progress']);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('fatal')) {
          result.errors.push(`Git fsck failed: ${errorMessage}`);
        } else {
          result.warnings.push(`Git fsck warning: ${errorMessage}`);
        }
      }

      // Check if HEAD exists and is valid
      try {
        await this.git.revparse(['HEAD']);
      } catch (error) {
        if (result.commitCount > 0) {
          result.errors.push('HEAD reference is invalid despite having commits');
        } else {
          result.warnings.push('No commits in repository (HEAD does not exist)');
        }
      }

      // Set overall validity
      result.isValid = result.errors.length === 0;
    } catch (error) {
      result.isValid = false;
      result.errors.push(
        `Integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return result;
  }

  /**
   * Clean up backup files
   * @param backupInfo - Backup to clean up, or undefined to clean all backups
   * @returns Promise<void>
   */
  async cleanupBackup(backupInfo?: BackupInfo): Promise<void> {
    try {
      const backupDir = join(this.repoPath, '.git', 'fake-it-til-you-git-backups');

      if (!existsSync(backupDir)) {
        return; // No backups to clean up
      }

      if (backupInfo) {
        // Clean up specific backup
        if (existsSync(backupInfo.backupPath)) {
          unlinkSync(backupInfo.backupPath);
        }
      } else {
        // Clean up all backups older than 24 hours
        const fs = await import('fs/promises');
        const files = await fs.readdir(backupDir);

        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = join(backupDir, file);
            try {
              const backupData = JSON.parse(readFileSync(filePath, 'utf8')) as BackupInfo;
              const backupAge = Date.now() - new Date(backupData.timestamp).getTime();
              const twentyFourHours = 24 * 60 * 60 * 1000;

              if (backupAge > twentyFourHours) {
                unlinkSync(filePath);
              }
            } catch (error) {
              // If we can't parse the file, delete it as it's likely corrupted
              unlinkSync(filePath);
            }
          }
        }
      }
    } catch (error) {
      // Cleanup errors are not critical, just log them
      console.warn(
        `Warning: Failed to cleanup backup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * List all available backups
   * @returns Promise<BackupInfo[]> - Array of available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    const backups: BackupInfo[] = [];

    try {
      const backupDir = join(this.repoPath, '.git', 'fake-it-til-you-git-backups');

      if (!existsSync(backupDir)) {
        return backups;
      }

      const fs = await import('fs/promises');
      const files = await fs.readdir(backupDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = join(backupDir, file);
          try {
            const backupData = JSON.parse(readFileSync(filePath, 'utf8')) as BackupInfo;
            backups.push(backupData);
          } catch (error) {
            // Skip corrupted backup files
            continue;
          }
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      // Return empty array if we can't list backups
      console.warn(
        `Warning: Failed to list backups: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return backups;
  }

  /**
   * Push commits to remote repository
   * @returns Promise<PushResult> - Push operation result
   */
  async push(): Promise<PushResult> {
    try {
      const remotes = await this.getRemotes();
      
      if (remotes.length === 0) {
        return {
          success: false,
          error: 'No remote repository configured',
        };
      }

      const currentBranch = await this.getCurrentBranch();
      const remoteName = remotes[0].name; // Use first remote (usually 'origin')
      
      // Attempt to push
      const result = await this.git.push(remoteName, currentBranch);
      
      return {
        success: true,
        details: `Pushed to ${remoteName}/${currentBranch}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Clean up old backup files (older than 24 hours)
   * @returns Promise<void>
   */
  async cleanupOldBackups(): Promise<void> {
    try {
      const backupDir = join(this.repoPath, '.git', 'fake-it-til-you-git-backups');

      if (!existsSync(backupDir)) {
        return; // No backups to clean up
      }

      const fs = await import('fs/promises');
      const files = await fs.readdir(backupDir);
      const twentyFourHours = 24 * 60 * 60 * 1000;
      let cleanedCount = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = join(backupDir, file);
          try {
            const backupData = JSON.parse(readFileSync(filePath, 'utf8')) as BackupInfo;
            const backupAge = Date.now() - new Date(backupData.timestamp).getTime();

            if (backupAge > twentyFourHours) {
              unlinkSync(filePath);
              cleanedCount++;
            }
          } catch (error) {
            // If we can't parse the file, delete it as it's likely corrupted
            unlinkSync(filePath);
            cleanedCount++;
          }
        }
      }
    } catch (error) {
      // Cleanup errors are not critical, just log them
      console.warn(
        `Warning: Failed to cleanup old backups: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Factory function to create GitOperations instance
 * @param repoPath - Optional repository path
 * @returns GitOperations instance
 */
export function createGitOperations(repoPath?: string): GitOperations {
  return new GitOperations(repoPath);
}

/**
 * Utility function to check if a directory is a Git repository
 * @param path - Directory path to check
 * @returns Promise<boolean> - True if Git repository
 */
export async function isGitRepository(path: string = cwd()): Promise<boolean> {
  const git = new GitOperations(path);
  return await git.isGitRepository();
}

/**
 * Utility function to get repository information
 * @param path - Repository path
 * @returns Promise<RepositoryInfo> - Repository information
 */
export async function getRepositoryInfo(path?: string): Promise<RepositoryInfo> {
  const git = new GitOperations(path);
  return await git.getRepositoryInfo();
}
