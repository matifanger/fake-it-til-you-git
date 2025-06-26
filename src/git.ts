import { simpleGit, SimpleGit, CommitResult, StatusResult } from 'simple-git';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { cwd } from 'process';

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
    if (!await this.isGitRepository()) {
      throw new Error(`Not a Git repository: ${this.repoPath}`);
    }

    try {
      const [branch, remotes, log] = await Promise.all([
        this.getCurrentBranch(),
        this.getRemotes(),
        this.getCommitHistory(1)
      ]);

      const remote = remotes.length > 0 ? remotes[0].name : undefined;
      const remoteUrl = remotes.length > 0 ? remotes[0].url : undefined;
      const totalCommits = await this.getTotalCommitCount();

      const lastCommit = log.length > 0 ? {
        hash: log[0].hash,
        date: log[0].date,
        message: log[0].message,
        author: log[0].author
      } : undefined;

      return {
        path: this.repoPath,
        branch,
        remote,
        remoteUrl,
        totalCommits,
        lastCommit
      };
    } catch (error) {
      throw new Error(`Failed to get repository info: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      return remotes.map(remote => ({
        name: remote.name,
        url: remote.refs.fetch || remote.refs.push || ''
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
  async getCommitHistory(limit: number = 100): Promise<CommitInfo[]> {
    try {
      const log = await this.git.log({ maxCount: limit });
      return log.all.map(commit => ({
        hash: commit.hash,
        date: new Date(commit.date),
        message: commit.message,
        author: commit.author_name,
        email: commit.author_email
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
      return parseInt(log.trim(), 10);
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
        deleted: status.deleted
      };
    } catch (error) {
      throw new Error(`Failed to get repository status: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw new Error(`Failed to initialize Git repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw new Error(`Failed to add files: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        config: [
          `user.name=${author.name}`,
          `user.email=${author.email}`
        ]
      });

      // Set environment variables for the current process temporarily
      const originalEnv = {
        GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME,
        GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL,
        GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME,
        GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL,
        GIT_AUTHOR_DATE: process.env.GIT_AUTHOR_DATE,
        GIT_COMMITTER_DATE: process.env.GIT_COMMITTER_DATE
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
        Object.keys(originalEnv).forEach(key => {
          const value = originalEnv[key as keyof typeof originalEnv];
          if (value === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = value;
          }
        });
      }
    } catch (error) {
      throw new Error(`Failed to create commit: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw new Error(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      throw new Error(`Failed to switch to branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
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