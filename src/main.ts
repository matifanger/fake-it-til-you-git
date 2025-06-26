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
    
    if (options.verbose) {
      console.log(chalk.blue('CLI Options:'), JSON.stringify(options, null, 2));
    }

    // Load and validate configuration
    spinner.text = 'Loading configuration...';
    const config = await loadConfig(options);
    if (options.verbose) {
      console.log(chalk.blue('Final Configuration:'), JSON.stringify(config, null, 2));
    }

    spinner.succeed(chalk.green('✅ fake-it-til-you-git initialized successfully!'));

    // Initialize Git operations with proper directory handling
    spinner.start('Initializing Git operations...');
    const isDevelopmentMode = config.options.dev || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    const gitOps = new GitOperations(isDevelopmentMode ? join(process.cwd(), 'test-repo') : undefined);
    globalGitOps = gitOps; // Store for cleanup
    const repoPath = gitOps.getRepositoryPath();
    
    if (options.verbose) {
      console.log(chalk.blue(`📁 Working in repository: ${repoPath}`));
    }

    if (isDevelopmentMode) {
      console.log(chalk.yellow(`🔧 Development mode: Using test-repo directory`));
    }

    // Check if it's a Git repository
    const isRepo = await gitOps.isGitRepository();
    if (!isRepo) {
      spinner.text = 'Initializing Git repository...';
      await gitOps.initRepository();
      spinner.succeed(chalk.green('✅ Git repository initialized'));
    } else {
      spinner.succeed(chalk.green('✅ Git repository detected'));
    }

    // Generate commit plan first (for preview/execution)
    spinner.start('Generating commit plan...');
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
    
    spinner.succeed(chalk.green('✅ Commit plan generated and validated'));
    
    if (validation.warnings.length > 0) {
      console.log(chalk.yellow('⚠️  Warnings:'));
      validation.warnings.forEach(warning => {
        console.log(chalk.yellow(`   ${warning}`));
      });
    }

    // Show preview
    const totalCommits = populatedPlans.reduce((sum, plan) => sum + plan.count, 0);
    const activeDays = populatedPlans.filter(plan => plan.count > 0).length;
    const maxCommitsPerDay = Math.max(...populatedPlans.map(plan => plan.count));

    console.log(chalk.cyan('\n📊 Commit Plan Preview:'));
    console.log(chalk.white(`   📅 Date range: ${config.dateRange.startDate} to ${config.dateRange.endDate}`));
    console.log(chalk.white(`   📈 Total commits: ${totalCommits}`));
    console.log(chalk.white(`   📆 Active days: ${activeDays}/${populatedPlans.length}`));
    console.log(chalk.white(`   📊 Max commits per day: ${maxCommitsPerDay}`));
    console.log(chalk.white(`   👤 Author: ${config.author.name} <${config.author.email}>`));
    console.log(chalk.white(`   🎨 Message style: ${config.commits.messageStyle}`));
    console.log(chalk.white(`   📐 Distribution: ${config.commits.distribution}`));
    if (config.seed) {
      console.log(chalk.white(`   🌱 Seed: ${config.seed}`));
    }

    if (config.options.preview) {
      console.log(chalk.cyan('\n📈 GitHub Contribution Graph Preview:'));
      displayGitHubStyleGraph(populatedPlans);
      
      // Show enhanced statistics
      displayEnhancedStats(populatedPlans, config);
      
      console.log(chalk.cyan('\n📝 Sample Commits:'));
      const samplePlans = populatedPlans.filter(plan => plan.count > 0).slice(0, 5);
      samplePlans.forEach(plan => {
        console.log(chalk.gray(`   📅 ${plan.date.toISOString().split('T')[0]} (${plan.count} commits):`));
        plan.messages.slice(0, 3).forEach((msg, i) => {
          console.log(chalk.gray(`     ${i + 1}. ${msg}`));
        });
        if (plan.messages.length > 3) {
          console.log(chalk.gray(`     ... and ${plan.messages.length - 3} more`));
        }
      });
      
      if (populatedPlans.filter(plan => plan.count > 0).length > 5) {
        console.log(chalk.gray(`   ... and ${populatedPlans.filter(plan => plan.count > 0).length - 5} more days with commits`));
      }
      
      console.log(chalk.yellow('\n🔍 Preview mode - no changes made to repository'));
      console.log(chalk.dim('💡 Tip: Remove --preview flag to actually create the commits'));
      isOperationInProgress = false;
      return;
    }

    // Interactive confirmation for non-preview operations
    const shouldProceed = await showConfirmationDialog(populatedPlans, config, gitOps);
    if (!shouldProceed) {
      console.log(chalk.yellow('\n🚫 Operation cancelled by user'));
      console.log(chalk.dim('💡 Use --preview to see what would be created without making changes'));
      isOperationInProgress = false;
      return;
    }

    // Prepare history.txt file (only when actually creating commits)
    const historyFilePath = join(repoPath, 'history.txt');
    if (!existsSync(historyFilePath)) {
      const header = '# Fake Git History Log\n# Format: DATE | AUTHOR | EMAIL | MESSAGE\n\n';
      writeFileSync(historyFilePath, header, 'utf-8');
      console.log(chalk.green('📝 Created history.txt file'));
    }

    // Execute commit creation with enhanced progress tracking
    console.log(chalk.cyan('\n🚀 Creating commits...'));
    const result = await createCommitsWithHistory(populatedPlans, config, gitOps, historyFilePath);

    // Show results
    console.log(chalk.cyan('\n📋 Execution Results:'));
    console.log(chalk.white(`   ${result.success ? '✅' : '❌'} Status: ${result.success ? 'Success' : 'Failed'}`));
    console.log(chalk.white(`   📈 Created: ${result.successfulCommits}/${result.totalCommits} commits`));
    console.log(chalk.white(`   ⏱️  Duration: ${result.duration}ms`));
    
    if (result.failedCommits > 0) {
      console.log(chalk.red(`   ❌ Failed: ${result.failedCommits} commits`));
      if (options.verbose && result.errors.length > 0) {
        console.log(chalk.red('   Errors:'));
        result.errors.slice(0, 3).forEach(error => {
          console.log(chalk.red(`     - ${error}`));
        });
        if (result.errors.length > 3) {
          console.log(chalk.red(`     ... and ${result.errors.length - 3} more errors`));
        }
      }
    }

    if (result.success) {
      console.log(chalk.green('\n🎉 Fake Git history created successfully!'));
      
      // Show some repository stats
      const repoInfo = await gitOps.getRepositoryInfo();
      console.log(chalk.cyan('\n📊 Repository Statistics:'));
      console.log(chalk.white(`   📁 Path: ${repoInfo.path}`));
      console.log(chalk.white(`   🌿 Branch: ${repoInfo.branch}`));
      console.log(chalk.white(`   📈 Total commits: ${repoInfo.totalCommits}`));
      if (repoInfo.lastCommit) {
        console.log(chalk.white(`   📝 Last commit: ${repoInfo.lastCommit.message}`));
        console.log(chalk.white(`   📅 Last commit date: ${repoInfo.lastCommit.date.toISOString().split('T')[0]}`));
      }
      
      // Enhanced push functionality
      if (config.options.push && repoInfo.remote) {
        await handlePushToRemote(gitOps, repoInfo, config.options.verbose);
      } else if (config.options.push && !repoInfo.remote) {
        console.log(chalk.yellow('⚠️  Push requested but no remote configured'));
        console.log(chalk.dim('💡 Configure a remote with: git remote add origin <url>'));
      }

      // Clean up old backups on success
      try {
        await gitOps.cleanupOldBackups();
        if (config.options.verbose) {
          console.log(chalk.gray('🧹 Cleaned up old backups'));
        }
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

  // Add a title
  result.push(
    chalk.bold.green("This is what you will see on your GitHub profile:")
  );
  result.push("");

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

  // Add statistics
  result.push("Statistics");
  result.push(`• Total commits: ${commitDateList.length}`);
  result.push(
    `• Date range: ${formatDateKey(startDate)} to ${formatDateKey(endDate)}`
  );
  result.push(`• Distribution: ${process.env.DISTRIBUTION || "random"}`);
  result.push(`• Max commits in a day: ${maxCommitsInDay}`);

  result.push("");
  result.push(
    chalk.italic("Note: This is a preview only. No commits were created.")
  );
  result.push(
    chalk.italic(
      "To generate actual commits, run the command without the --preview flag."
    )
  );

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
 * Display enhanced commit statistics and insights
 */
function displayEnhancedStats(plans: import('./commits.js').CommitPlan[], config: import('./config.js').Config): void {
  const stats = calculateCommitStats(plans);
  const totalDays = plans.length;
  const totalCommits = stats.totalCommits;
  const activeDays = stats.activeDays;
  
  console.log(chalk.cyan('\n📊 Detailed Statistics:'));
  
  // Basic stats
  console.log(chalk.white(`   📈 Total commits: ${totalCommits}`));
  console.log(chalk.white(`   📅 Total days in range: ${totalDays}`));
  console.log(chalk.white(`   🎯 Active days: ${activeDays} (${((activeDays / totalDays) * 100).toFixed(1)}%)`));
  console.log(chalk.white(`   📊 Max commits/day: ${stats.maxPerDay}`));
  console.log(chalk.white(`   📊 Min commits/day: ${stats.minPerDay} (on active days)`));
  console.log(chalk.white(`   📊 Average commits/active day: ${stats.averagePerDay.toFixed(1)}`));
  
  // Pattern analysis
  const weekdays = [0, 0, 0, 0, 0, 0, 0]; // Sunday to Saturday
  const months = new Array(12).fill(0);
  
  plans.forEach(plan => {
    if (plan.count > 0) {
      weekdays[plan.date.getDay()] += plan.count;
      months[plan.date.getMonth()] += plan.count;
    }
  });
  
  const mostActiveDay = weekdays.indexOf(Math.max(...weekdays));
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const mostActiveMonth = months.indexOf(Math.max(...months));
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  console.log(chalk.cyan('\n🔍 Pattern Analysis:'));
  console.log(chalk.white(`   📈 Most active day: ${dayNames[mostActiveDay]} (${weekdays[mostActiveDay]} commits)`));
  console.log(chalk.white(`   📈 Most active month: ${monthNames[mostActiveMonth]} (${months[mostActiveMonth]} commits)`));
  
  // Intensity distribution
  const intensityLevels = { low: 0, medium: 0, high: 0, veryHigh: 0 };
  plans.forEach(plan => {
    if (plan.count === 0) return;
    if (plan.count <= 2) intensityLevels.low++;
    else if (plan.count <= 5) intensityLevels.medium++;
    else if (plan.count <= 10) intensityLevels.high++;
    else intensityLevels.veryHigh++;
  });
  
  console.log(chalk.cyan('\n💪 Intensity Distribution:'));
  console.log(chalk.green(`   🟢 Light days (1-2 commits): ${intensityLevels.low}`));
  console.log(chalk.yellow(`   🟡 Medium days (3-5 commits): ${intensityLevels.medium}`));
  console.log(chalk.magenta(`   🟠 Heavy days (6-10 commits): ${intensityLevels.high}`));
  console.log(chalk.red(`   🔴 Very heavy days (10+ commits): ${intensityLevels.veryHigh}`));
  
  // Realism assessment
  console.log(chalk.cyan('\n🎭 Realism Assessment:'));
  
  const realismScore = calculateRealismScore(plans, config);
  const realismLevel = getRealismLevel(realismScore);
  console.log(chalk.white(`   🎯 Realism Score: ${realismScore.toFixed(1)}/10 (${realismLevel.label})`));
  console.log(chalk.white(`   ${realismLevel.icon} ${realismLevel.description}`));
  
  if (realismScore < 6) {
    console.log(chalk.yellow('\n⚠️  Suggestions for more realistic patterns:'));
    if (stats.averagePerDay > 8) {
      console.log(chalk.yellow(`   • Consider reducing average commits per day (currently ${stats.averagePerDay.toFixed(1)})`));
    }
    if (activeDays / totalDays > 0.8) {
      console.log(chalk.yellow(`   • Add more rest days (currently active ${((activeDays / totalDays) * 100).toFixed(1)}% of time)`));
    }
    if (intensityLevels.veryHigh > activeDays * 0.1) {
      console.log(chalk.yellow(`   • Reduce very heavy days (currently ${intensityLevels.veryHigh})`));
    }
  }
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
  
  console.log(chalk.cyan('\n⚠️  Operation Confirmation Required'));
  console.log(chalk.white('You are about to create fake Git history with the following impact:'));
  console.log(chalk.white(`   📈 ${stats.totalCommits} new commits will be created`));
  console.log(chalk.white(`   📅 Affecting ${stats.activeDays} days in your repository`));
  console.log(chalk.white(`   📁 Repository: ${repoInfo.path}`));
  console.log(chalk.white(`   🌿 Branch: ${repoInfo.branch}`));
  
  if (repoInfo.totalCommits > 0) {
    console.log(chalk.yellow(`   ⚠️  This repository already has ${repoInfo.totalCommits} commits`));
    console.log(chalk.yellow(`   ⚠️  New commits will be mixed with existing history`));
  }
  
  if (repoInfo.remote) {
    console.log(chalk.yellow(`   🌐 Remote repository detected: ${repoInfo.remote}`));
    if (config.options.push) {
      console.log(chalk.red(`   🚨 Commits will be PUSHED to remote after creation!`));
    } else {
      console.log(chalk.yellow(`   ℹ️  Commits will be created locally only (use --push to upload)`));
    }
  }
  
  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'proceed',
      message: 'Do you want to proceed with creating these commits?',
      default: false,
    },
  ]);
  
  if (answer.proceed && (stats.totalCommits > 1000 || repoInfo.totalCommits > 0)) {
    // Double confirmation for high-impact operations
    console.log(chalk.yellow('\n🔄 Double Confirmation Required'));
    
    const questions = [];
    
    if (stats.totalCommits > 1000) {
      questions.push('Creating more than 1000 commits');
    }
    
    if (repoInfo.totalCommits > 0) {
      questions.push('Repository already has commits');
    }
    
    if (config.options.push && repoInfo.remote) {
      questions.push('Commits will be pushed to remote');
    }
    
    console.log(chalk.yellow('This is a high-impact operation because:'));
    questions.forEach(question => {
      console.log(chalk.yellow(`   • ${question}`));
    });
    
    const doubleConfirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'doubleConfirm',
        message: 'Are you absolutely sure you want to proceed?',
        default: false,
      },
    ]);
    
    return doubleConfirm.doubleConfirm;
  }
  
  return answer.proceed;
}

/**
 * Create commits with history.txt logging
 * This function creates commits and appends each commit info to history.txt
 */
async function createCommitsWithHistory(
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

  try {
    if (config.options.verbose) {
      console.log(chalk.blue(`🔍 Debug: Starting commit creation with ${result.totalCommits} total commits`));
    }

    // Ensure we have a clean working directory
    const isClean = await gitOps.isWorkingDirectoryClean();
    if (config.options.verbose) {
      console.log(chalk.blue(`🔍 Debug: Working directory clean: ${isClean}`));
    }
    
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
      console.log(chalk.gray(`   📦 Created backup: ${backup.id}`));
    } catch (error) {
      console.warn(chalk.yellow(`   ⚠️  Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }

    // Process each day's commits
    for (const plan of plans) {
      if (plan.count === 0 || plan.messages.length === 0) {
        continue;
      }

      if (config.options.verbose) {
        console.log(chalk.blue(`🔍 Debug: Processing ${plan.count} commits for ${plan.date.toISOString().split('T')[0]}`));
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

          if (config.options.verbose) {
            console.log(chalk.blue(`🔍 Debug: Creating commit "${commitMessage}" on ${commitDate.toISOString()}`));
          }

          // Append to history.txt with commit information
          const historyLine = `${commitDate.toISOString()} | ${author.name} | ${author.email} | ${commitMessage}\n`;
          appendFileSync(historyFilePath, historyLine, 'utf-8');

          if (config.options.verbose) {
            console.log(chalk.blue(`🔍 Debug: Appended to history.txt: ${historyLine.trim()}`));
          }

          // Add the history file to git
          await gitOps.addAll();

          if (config.options.verbose) {
            console.log(chalk.blue(`🔍 Debug: Added files to git`));
          }

          // Create the commit
          const commitResult = await gitOps.createCommit(commitMessage, commitDate, author);

          if (config.options.verbose) {
            console.log(chalk.blue(`🔍 Debug: Created commit with hash: ${commitResult.commit}`));
          }

          result.commitHashes.push(commitResult.commit);
          result.successfulCommits++;

          if (result.successfulCommits % 10 === 0) {
            console.log(chalk.gray(`   📝 Created ${result.successfulCommits}/${result.totalCommits} commits...`));
          }

          // Optional: Add a small delay to avoid overwhelming the system
          if (result.totalCommits > 100 && i % 10 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        } catch (error) {
          const errorMessage = `Failed to create commit on ${plan.date.toISOString()}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          result.errors.push(errorMessage);
          result.failedCommits++;

          if (config.options.verbose) {
            console.error(chalk.red(`🔍 Debug: ${errorMessage}`));
            console.error(chalk.red(`🔍 Debug: Error stack:`, error instanceof Error ? error.stack : 'No stack trace'));
          }

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

  } catch (error) {
    const errorMessage = `Critical error during commit creation: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`;
    result.errors.push(errorMessage);
    result.success = false;

    if (config.options.verbose) {
      console.error(chalk.red(`🔍 Debug: Critical error: ${errorMessage}`));
      console.error(chalk.red(`🔍 Debug: Error stack:`, error instanceof Error ? error.stack : 'No stack trace'));
    }
  }

  result.duration = Date.now() - startTime;
  return result;
}
