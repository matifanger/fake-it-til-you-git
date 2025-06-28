import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { writeFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig, type CliOptions } from './config.js';
import { GitOperations } from './git.js';
import { generateAndCreateCommits, validateCommitPlan, generateCommitPlan, populateCommitMessages, calculateCommitStats } from './commits.js';

// Global state for cleanup
let globalGitOps: GitOperations | null = null;
let isOperationInProgress = false;
let currentBackup: import('./git.js').BackupInfo | null = null;

/**
 * Enhanced error handler with better context and cleanup
 */
export class FakeGitError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = false,
    public context?: any
  ) {
    super(message);
    this.name = 'FakeGitError';
  }
}

/**
 * Setup cleanup handlers for graceful interruption
 */
function setupCleanupHandlers(): void {
  const cleanup = async (signal: string) => {
    if (!isOperationInProgress) {
      console.log(chalk.yellow(`\n🔄 Received ${signal}, exiting cleanly...`));
      process.exit(0);
    }

    console.log(chalk.yellow(`\n🛑 Received ${signal} during operation. Cleaning up...`));
    
         try {
       if (globalGitOps && currentBackup) {
         console.log(chalk.cyan('🔄 Restoring repository state from backup...'));
         await globalGitOps.restoreFromBackup(currentBackup);
         console.log(chalk.green('✅ Repository state restored successfully'));
         
         // Clean up the backup we just used
         await globalGitOps.cleanupBackup(currentBackup);
       }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to restore repository state: ${error instanceof Error ? error.message : 'Unknown error'}`));
      console.error(chalk.red('⚠️  Repository might be in an inconsistent state. Manual cleanup may be required.'));
    } finally {
      console.log(chalk.yellow('👋 Cleanup completed. Exiting...'));
      process.exit(1);
    }
  };

  // Handle different termination signals
  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error(chalk.red('\n💥 Uncaught Exception:'), error);
    await cleanup('UNCAUGHT_EXCEPTION');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error(chalk.red('\n💥 Unhandled Rejection at:'), promise, 'reason:', reason);
    await cleanup('UNHANDLED_REJECTION');
  });
}

export async function main(options: CliOptions): Promise<void> {
  // Setup cleanup handlers early
  setupCleanupHandlers();
  
  const spinner = ora('Initializing fake-it-til-you-git...').start();

  try {
    isOperationInProgress = true;
    
    // Load and validate configuration
    spinner.text = 'Loading configuration...';
    const config = await loadConfig(options);

    // Generate random seed if no seed was specified in CLI
    if (!options.seed) {
      config.seed = Math.random().toString(36).substring(2, 15);
    }

    // Generate commit plan
    const rawPlans = generateCommitPlan(config);
    const populatedPlans = populateCommitMessages(rawPlans, config);
    
    // Validate the plan (after messages are populated)
    const validation = validateCommitPlan(populatedPlans, config);
    if (!validation.valid) {
      throw new FakeGitError(
        `Invalid commit plan: ${validation.errors.join(', ')}`,
        'INVALID_PLAN',
        false,
        { validation }
      );
    }
    
    // Initialize Git operations (for both preview and actual execution)
    spinner.text = 'Initializing Git operations...';
    const isDevelopmentMode = config.options.dev || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    
    // Determine repository path: dev mode > repositoryPath > current directory
    let targetRepoPath: string | undefined;
    if (isDevelopmentMode) {
      targetRepoPath = join(process.cwd(), 'test-repo');
    } else if (config.options.repositoryPath !== '.') {
      targetRepoPath = config.options.repositoryPath;
    }
    
    const gitOps = new GitOperations(targetRepoPath);
    globalGitOps = gitOps; // Store for cleanup
    const repoPath = gitOps.getRepositoryPath();

    // Check if it's a Git repository
    const isRepo = await gitOps.isGitRepository();
    if (!isRepo && !config.options.preview) {
      spinner.text = 'Initializing Git repository...';
      await gitOps.initRepository();
    }
    
    spinner.succeed();

    // DISPLAY INFORMATION (for both preview and actual execution)
    const stats = calculateCommitStats(populatedPlans);
    const totalDays = populatedPlans.length;
    const realismScore = calculateRealismScore(populatedPlans, config);
    const realismLevel = getRealismLevel(realismScore);
    
    if (config.options.preview) {
      console.log(chalk.cyan('\n🎭 ') + chalk.bold.cyan('HISTORY PREVIEW'));
    } else {
      console.log(chalk.cyan('\n📋 ') + chalk.bold.cyan('EXECUTION PLAN'));
    }
    
    console.log(chalk.cyan('\n📊 OVERVIEW:'));
    console.log(chalk.white(`   📅 ${config.dateRange.startDate} → ${config.dateRange.endDate} (${totalDays} days)`));
    console.log(chalk.white(`   📈 ${stats.totalCommits} commits across ${stats.activeDays} active days (${((stats.activeDays / totalDays) * 100).toFixed(1)}% activity)`));
    console.log(chalk.white(`   📊 ${stats.minPerDay}-${stats.maxPerDay} commits/day (avg: ${stats.averagePerDay.toFixed(1)})`));
    console.log(chalk.white(`   👤 ${config.author.name} <${config.author.email}>`));
    console.log(chalk.white(`   💬 ${config.commits.messageStyle} messages`));
    console.log(chalk.white(`   🎯 ${realismLevel.label} (${realismScore % 1 === 0 ? realismScore.toString() : realismScore.toFixed(1)}/10)`));
    if (config.seed) {
      console.log(chalk.white(`   🌱 Seed: ${config.seed}`));
    }

    // Repository information (for non-preview mode)
    if (!config.options.preview) {
      const repoInfo = await gitOps.getRepositoryInfo();
      console.log(chalk.white(`   📁 Repository: ${repoInfo.path}`));
      console.log(chalk.white(`   🌿 Branch: ${repoInfo.branch}${repoInfo.totalCommits > 0 ? ` (${repoInfo.totalCommits} existing commits)` : ''}`));
      if (config.options.push && repoInfo.remote) {
        console.log(chalk.white(`   🚀 Will push to: ${repoInfo.remote}`));
      }
    }

    // GitHub contribution graph
    console.log(chalk.cyan('\n📈 GITHUB CONTRIBUTION GRAPH:'));
    displayGitHubStyleGraph(populatedPlans);

    // Realism warnings if needed
    if (realismScore < 6) {
      console.log(chalk.yellow('\n⚠️  REALISM SUGGESTIONS:'));
      if (stats.averagePerDay > 8) {
        console.log(chalk.yellow(`   • Consider reducing commits/day (currently ${stats.averagePerDay.toFixed(1)})`));
      }
      if (stats.activeDays / totalDays > 0.8) {
        console.log(chalk.yellow(`   • Add more rest days (currently ${((stats.activeDays / totalDays) * 100).toFixed(1)}% active)`));
      }
      if (stats.maxPerDay > 15) {
        console.log(chalk.yellow(`   • Reduce maximum daily commits (currently ${stats.maxPerDay})`));
      }
    }
    
    // PREVIEW MODE - Just show the plan and exit
    if (config.options.preview) {
      console.log(chalk.yellow('\n💡 This is a preview only. Remove --preview to create actual commits.'));
      isOperationInProgress = false;
      return;
    }

    // CONFIRMATION for actual execution
    let shouldProceed = true;
    
    if (!config.options.yes) {
      shouldProceed = await showConfirmationDialog(populatedPlans, config, gitOps);
      if (!shouldProceed) {
        console.log(chalk.yellow('\n🚫 Operation cancelled by user'));
        console.log(chalk.dim('💡 Use --preview to see what would be created without making changes'));
        isOperationInProgress = false;
        return;
      }
    } else {
      // Auto-accept with yes flag
      console.log(chalk.cyan(`\n✅ Auto-confirming: Proceeding with ${calculateCommitStats(populatedPlans).totalCommits} commits (--yes flag)`));
    }

    // Prepare history.txt file (only when actually creating commits)
    const historyFilePath = join(repoPath, 'history.txt');
    if (!existsSync(historyFilePath)) {
      const header = '# Fake Git History Log\n# Format: DATE | AUTHOR | EMAIL | MESSAGE\n\n';
      writeFileSync(historyFilePath, header, 'utf-8');
    }

    // Execute commit creation with elegant progress tracking
    const result = await createCommitsWithProgress(populatedPlans, config, gitOps, historyFilePath);

    // Show results
    if (result.success) {
      console.log(chalk.green('\n🎉 Fake Git history created successfully!'));
      
      // Show final repository stats
      const finalRepoInfo = await gitOps.getRepositoryInfo();
      console.log(chalk.cyan('\n📊 FINAL STATUS:'));
      console.log(chalk.white(`   📈 Created: ${result.successfulCommits} commits`));
      console.log(chalk.white(`   ⏱️  Duration: ${(result.duration / 1000).toFixed(1)}s`));
      console.log(chalk.white(`   🌿 ${finalRepoInfo.branch} (${finalRepoInfo.totalCommits} total commits)`));
      if (finalRepoInfo.lastCommit) {
        console.log(chalk.white(`   📝 Latest: "${finalRepoInfo.lastCommit.message}"`));
      }
      
      // Enhanced push functionality
      if (config.options.push && finalRepoInfo.remote) {
        await handlePushToRemote(gitOps, finalRepoInfo, config.options.verbose);
      }

      // Clean up old backups on success
      try {
        await gitOps.cleanupOldBackups();
      } catch (error) {
        // Don't fail the whole operation for backup cleanup issues
        if (config.options.verbose) {
          console.log(chalk.yellow(`⚠️  Failed to cleanup old backups: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      }

    } else {
      throw new FakeGitError(
        'Failed to create fake Git history',
        'COMMIT_CREATION_FAILED',
        true,
        { result }
      );
    }

    isOperationInProgress = false;

  } catch (error) {
    isOperationInProgress = false;
    spinner.fail(chalk.red('❌ Execution failed'));
    
    if (error instanceof FakeGitError) {
      console.error(chalk.red(`\n💥 ${error.message}`));
      
      if (error.code === 'COMMIT_CREATION_FAILED' && error.recoverable) {
        console.log(chalk.yellow('\n🔄 Attempting to recover...'));
        if (globalGitOps && currentBackup) {
          try {
            await globalGitOps.restoreFromBackup(currentBackup);
            console.log(chalk.green('✅ Repository restored to previous state'));
          } catch (restoreError) {
            console.error(chalk.red(`❌ Failed to restore: ${restoreError instanceof Error ? restoreError.message : 'Unknown error'}`));
          }
        }
      }
      
      if (options.verbose && error.context) {
        console.error(chalk.gray('\n🔍 Error context:'), JSON.stringify(error.context, null, 2));
      }
    } else {
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      
      if (options.verbose && error instanceof Error && error.stack) {
        console.error(chalk.gray('\n🔍 Stack trace:'), error.stack);
      }
    }
    
    console.error(chalk.red('\n💡 Tips:'));
    console.error(chalk.red('   - Use --preview to see what would be created without making changes'));
    console.error(chalk.red('   - Use --verbose for more detailed error information'));
    console.error(chalk.red('   - Check that your Git repository is in a clean state'));
    
    process.exit(1);
  }
}

/**
 * Handle pushing to remote with proper error handling and progress
 */
async function handlePushToRemote(
  gitOps: GitOperations,
  repoInfo: any,
  verbose: boolean
): Promise<void> {
  const pushSpinner = ora('Pushing commits to remote...').start();
  
  try {
    // Check if we have commits to push
    const status = await gitOps.getRepositoryStatus();
    
    if (status.ahead === 0) {
      pushSpinner.info(chalk.yellow('📡 No commits to push - repository is up to date'));
      return;
    }
    
    pushSpinner.text = `Pushing ${status.ahead} commits to ${repoInfo.remote}...`;
    
    // Perform the push
    const pushResult = await gitOps.push();
    
    if (pushResult.success) {
      pushSpinner.succeed(chalk.green(`🚀 Successfully pushed ${status.ahead} commits to ${repoInfo.remote}`));
      
      if (verbose && pushResult.details) {
        console.log(chalk.gray(`   Push details: ${pushResult.details}`));
      }
    } else {
      throw new Error(pushResult.error || 'Push failed for unknown reason');
    }
    
  } catch (error) {
    pushSpinner.fail(chalk.red('❌ Failed to push to remote'));
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(chalk.red(`   Error: ${errorMessage}`));
    
    // Provide helpful suggestions based on common push errors
    if (errorMessage.includes('rejected')) {
      console.log(chalk.yellow('\n💡 Push was rejected. This might be because:'));
      console.log(chalk.yellow('   - The remote has commits that you don\'t have locally'));
      console.log(chalk.yellow('   - You need to pull first: git pull origin main'));
      console.log(chalk.yellow('   - Force push might be needed (use with caution): git push --force'));
    } else if (errorMessage.includes('permission') || errorMessage.includes('authentication')) {
      console.log(chalk.yellow('\n💡 Authentication failed. Make sure:'));
      console.log(chalk.yellow('   - Your SSH key is properly configured'));
      console.log(chalk.yellow('   - You have push access to the repository'));
      console.log(chalk.yellow('   - Your credentials are up to date'));
    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      console.log(chalk.yellow('\n💡 Network error. Check your internet connection and try again.'));
    }
    
    // Don't exit on push failure - the commits were created successfully
    console.log(chalk.dim('\n📝 Note: Commits were created successfully locally. Push can be done manually later.'));
  }
}

/**
 * Display a GitHub-style contribution graph using the improved algorithm
 * Based on the GitHub activity visualization algorithm provided by user
 */
function displayGitHubStyleGraph(plans: import('./commits.js').CommitPlan[]): void {
  if (plans.length === 0) {
    console.log('   No commits to display');
    return;
  }

  // Extract commit dates list and date range
  const commitDateList: Date[] = [];
  plans.forEach(plan => {
    for (let i = 0; i < plan.count; i++) {
      commitDateList.push(plan.date);
    }
  });

  const startDate = plans[0].date;
  const endDate = plans[plans.length - 1].date;

  // Count commits by day
  const commitsByDay: Record<string, number> = {};
  commitDateList.forEach(date => {
    const dateKey = formatDateKey(date);
    if (!commitsByDay[dateKey]) {
      commitsByDay[dateKey] = 0;
    }
    commitsByDay[dateKey]++;
  });

  // Get the max number of commits in a day
  let maxCommitsInDay = 0;
  Object.values(commitsByDay).forEach(count => {
    if (count > maxCommitsInDay) {
      maxCommitsInDay = count;
    }
  });

  // Generate a list of all days between start and end date
  const totalDays = differenceInDays(endDate, startDate) + 1;
  const days: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    days.push(addDays(startDate, i));
  }

  // Calculate the number of weeks
  const totalWeeks = Math.ceil(totalDays / 7);

  // Track month positions for labels
  const monthLabelPositions: Array<{ month: string; week: number }> = [];
  let currentMonth: string | null = null;
  days.forEach((day, index) => {
    const month = formatMonth(day);
    const week = Math.floor(index / 7);
    if (month !== currentMonth) {
      monthLabelPositions.push({ month, week });
      currentMonth = month;
    }
  });

  // Build the visualization
  const result: string[] = [];

  // Create month labels row
  let monthRow = "     "; // Space for day labels
  for (let i = 0; i < monthLabelPositions.length; i++) {
    const { month, week } = monthLabelPositions[i];

    // Add the month label
    monthRow += month;

    if (i < monthLabelPositions.length - 1) {
      // Add spaces to align with the next month or fill to the end
      const nextMonthWeek =
        monthLabelPositions.find(m => m.week > week)?.week || totalWeeks;
      const spacesToAdd = (nextMonthWeek - week - 1) * 1.7;
      monthRow += " ".repeat(Math.floor(spacesToAdd));
    }
  }
  result.push(monthRow);

  // Create day rows with contribution cells
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // GitHub-like intensity blocks using Unicode characters
  const intensityBlocks = [
    chalk.hex("#fdfdfd")("■"), // Empty/no commits (white square)
    chalk.hex("#7feebb")("■"), // Few commits (light green)
    chalk.hex("#4ac26b")("■"), // Some commits (medium green)
    chalk.hex("#2da44e")("■"), // Many commits (darker green)
    chalk.hex("#116329")("■")  // Most commits (darkest green)
  ];

  // Organize days by day of week and week number
  const calendar: Array<Array<Date | null>> = Array(7)
    .fill(null)
    .map(() => Array(totalWeeks).fill(null));

  days.forEach((day, index) => {
    const dayOfWeek = getDay(day); // 0 = Sunday, 1 = Monday, etc.
    const week = Math.floor(index / 7);
    calendar[dayOfWeek][week] = day;
  });

  // Generate rows for each day of the week
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    let row = chalk.bold(dayLabels[dayOfWeek]) + " ";

    for (let week = 0; week < totalWeeks; week++) {
      const day = calendar[dayOfWeek][week];

      if (day) {
        const dateKey = formatDateKey(day);

        // If there are no commits on this day
        if (!commitsByDay[dateKey]) {
          row += intensityBlocks[0] + " "; // No activity square
        } else {
          // There are commits on this day
          const commitCount = commitsByDay[dateKey];

          // Calculate intensity level (0-4)
          const intensity = Math.min(
            Math.ceil((commitCount / maxCommitsInDay) * 4),
            4
          );
          row += intensityBlocks[intensity] + " ";
        }
      } else {
        row += "  "; // No day (outside the date range)
      }
    }
    result.push(row);
  }

  result.push("");
  // Add a legend
  result.push(
    `Legend: ${intensityBlocks[0]} No commits  ${intensityBlocks[1]} Few  ${intensityBlocks[2]} Some  ${intensityBlocks[3]} Many  ${intensityBlocks[4]} Most`
  );
  result.push("");

  // Print all the results
  console.log(result.join('\n'));
}

// Helper functions to match the original algorithm
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('en', { month: 'short' });
}

function getDay(date: Date): number {
  return date.getDay(); // 0 = Sunday, 1 = Monday, etc.
}

function differenceInDays(endDate: Date, startDate: Date): number {
  const timeDiff = endDate.getTime() - startDate.getTime();
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculate a realism score based on commit patterns
 */
function calculateRealismScore(plans: import('./commits.js').CommitPlan[], config: import('./config.js').Config): number {
  const stats = calculateCommitStats(plans);
  let score = 10;
  
  // Penalize unrealistic averages
  if (stats.averagePerDay > 10) score -= 2;
  else if (stats.averagePerDay > 6) score -= 1;
  
  // Penalize too many active days
  const activityRate = stats.activeDays / stats.totalDays;
  if (activityRate > 0.9) score -= 2;
  else if (activityRate > 0.7) score -= 1;
  
  // Penalize extreme days
  if (stats.maxPerDay > 20) score -= 3;
  else if (stats.maxPerDay > 15) score -= 2;
  else if (stats.maxPerDay > 10) score -= 1;
  
  // Bonus for realistic patterns
  if (stats.averagePerDay >= 2 && stats.averagePerDay <= 5) score += 1;
  if (activityRate >= 0.3 && activityRate <= 0.6) score += 1;
  
  return Math.max(0, Math.min(10, score));
}

/**
 * Get realism level description
 */
function getRealismLevel(score: number): { label: string; icon: string; description: string } {
  if (score >= 8) {
    return {
      label: 'Very Realistic',
      icon: '🎯',
      description: 'This pattern looks very natural and realistic'
    };
  } else if (score >= 6) {
    return {
      label: 'Realistic',
      icon: '✅',
      description: 'This pattern looks believable'
    };
  } else if (score >= 4) {
    return {
      label: 'Somewhat Artificial',
      icon: '⚠️',
      description: 'This pattern might look artificial to careful observers'
    };
  } else {
    return {
      label: 'Very Artificial',
      icon: '🚨',
      description: 'This pattern will likely be detected as fake'
    };
  }
}

/**
 * Show interactive confirmation dialog for non-preview operations
 */
async function showConfirmationDialog(
  plans: import('./commits.js').CommitPlan[], 
  config: import('./config.js').Config,
  gitOps: GitOperations
): Promise<boolean> {
  const stats = calculateCommitStats(plans);
  const repoInfo = await gitOps.getRepositoryInfo();
  
  const message = `\nProceed with creating ${stats.totalCommits} commits?`;
  
  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message,
      default: false,
    },
  ]);
  
  return answer.proceed;
}

/**
 * Create commits with elegant progress tracking
 * This function creates commits with a clean progress indicator
 */
async function createCommitsWithProgress(
  plans: import('./commits.js').CommitPlan[],
  config: import('./config.js').Config,
  gitOps: GitOperations,
  historyFilePath: string
): Promise<import('./commits.js').CommitCreationResult> {
  const startTime = Date.now();
  const result: import('./commits.js').CommitCreationResult = {
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

  const progressSpinner = ora({
    text: `Creating commits... 0/${result.totalCommits}`,
    spinner: 'dots'
  }).start();

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
      currentBackup = backup; // Store globally for cleanup
    } catch (error) {
      // Continue without backup if it fails
    }

    // Process each day's commits
    for (const plan of plans) {
      if (plan.count === 0 || plan.messages.length === 0) {
        continue;
      }

      // Create commits for this day
      for (let i = 0; i < plan.count && i < plan.messages.length; i++) {
        try {
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

          // Append to history.txt with commit information
          const historyLine = `${commitDate.toISOString()} | ${author.name} | ${author.email} | ${commitMessage}\n`;
          appendFileSync(historyFilePath, historyLine, 'utf-8');

          // Add the history file to git
          await gitOps.addAll();

          // Create the commit
          const commitResult = await gitOps.createCommit(commitMessage, commitDate, author);

          result.commitHashes.push(commitResult.commit);
          result.successfulCommits++;

          // Update progress
          progressSpinner.text = `Creating commits... ${result.successfulCommits}/${result.totalCommits}`;

          // Optional: Add a small delay to avoid overwhelming the system
          if (result.totalCommits > 100 && result.successfulCommits % 50 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        } catch (error) {
          const errorMessage = `Failed to create commit on ${plan.date.toISOString()}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          result.errors.push(errorMessage);
          result.failedCommits++;

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
    progressSpinner.succeed(chalk.green(`✅ Created ${result.successfulCommits} commits`));

  } catch (error) {
    const errorMessage = `Critical error during commit creation: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`;
    result.errors.push(errorMessage);
    result.success = false;
    progressSpinner.fail(chalk.red('❌ Failed to create commits'));
  }

  result.duration = Date.now() - startTime;
  return result;
}
