import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig, type CliOptions } from './config.js';
import { GitOperations } from './git.js';
import { generateAndCreateCommits, validateCommitPlan, generateCommitPlan, populateCommitMessages } from './commits.js';

export async function main(options: CliOptions): Promise<void> {
  const spinner = ora('Initializing fake-it-til-you-git...').start();

  try {
    if (options.verbose) {
      console.log(chalk.blue('CLI Options:'), JSON.stringify(options, null, 2));
    }

    // Load and validate configuration
    const config = await loadConfig(options);
    if (options.verbose) {
      console.log(chalk.blue('Final Configuration:'), JSON.stringify(config, null, 2));
    }

    spinner.succeed(chalk.green('✅ fake-it-til-you-git initialized successfully!'));

    // Initialize Git operations with proper directory handling
    // Use development mode if --dev flag is set OR NODE_ENV is development/test
    const isDevelopmentMode = config.options.dev || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    const gitOps = new GitOperations(isDevelopmentMode ? join(process.cwd(), 'test-repo') : undefined);
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
      console.log(chalk.yellow('🔧 Initializing Git repository...'));
      await gitOps.initRepository();
      console.log(chalk.green('✅ Git repository initialized'));
    }

    // Generate commit plan first (for preview/execution)
    console.log(chalk.cyan('📋 Generating commit plan...'));
    const rawPlans = generateCommitPlan(config);
    const populatedPlans = populateCommitMessages(rawPlans, config);
    
    // Validate the plan
    const validation = validateCommitPlan(populatedPlans, config);
    if (!validation.valid) {
      throw new Error(`Invalid commit plan: ${validation.errors.join(', ')}`);
    }
    
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
      return;
    }

    // Prepare history.txt file (only when actually creating commits)
    const historyFilePath = join(repoPath, 'history.txt');
    if (!existsSync(historyFilePath)) {
      const header = '# Fake Git History Log\n# Format: DATE | AUTHOR | EMAIL | MESSAGE\n\n';
      writeFileSync(historyFilePath, header, 'utf-8');
      console.log(chalk.green('📝 Created history.txt file'));
    }

    // Execute commit creation
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
      
      if (config.options.push && repoInfo.remote) {
        console.log(chalk.yellow('\n🚀 Pushing to remote...'));
        // TODO: Implement push functionality
        console.log(chalk.yellow('   Push functionality not yet implemented'));
      }
    } else {
      console.log(chalk.red('\n❌ Failed to create fake Git history'));
      process.exit(1);
    }

  } catch (error) {
    spinner.fail(chalk.red('❌ Execution failed'));
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

/**
 * Display a GitHub-style contribution graph using ASCII characters
 */
function displayGitHubStyleGraph(plans: import('./commits.js').CommitPlan[]): void {
  // Group plans by week
  const weeks: Array<import('./commits.js').CommitPlan[]> = [];
  let currentWeek: import('./commits.js').CommitPlan[] = [];
  
  plans.forEach((plan, index) => {
    const dayOfWeek = plan.date.getDay(); // 0 = Sunday
    
    // If it's Sunday and we have plans, start a new week
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    
    currentWeek.push(plan);
    
    // If it's the last plan, add the current week
    if (index === plans.length - 1) {
      weeks.push(currentWeek);
    }
  });

  // Find max commits for color scaling
  const maxCommits = Math.max(...plans.map(plan => plan.count));
  
  // Function to get intensity based on commit count
  const getIntensity = (count: number): string => {
    if (count === 0) return chalk.gray('⬜');
    if (count <= maxCommits * 0.25) return chalk.green('🟩');
    if (count <= maxCommits * 0.5) return chalk.green('🟩');
    if (count <= maxCommits * 0.75) return chalk.green('🟨');
    return chalk.red('🟥');
  };

  // Print month headers (simplified)
  console.log('      ' + weeks.map((week, i) => {
    if (i % 4 === 0 && week.length > 0) {
      const monthName = week[0].date.toLocaleDateString('en', { month: 'short' });
      return monthName.substring(0, 3);
    }
    return '   ';
  }).join(' '));

  // Days of week
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Print each day row
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const dayLabel = dayIndex % 2 === 1 ? dayLabels[dayIndex] : '   '; // Show every other day
    let row = `${dayLabel} `;
    
    weeks.forEach(week => {
      const plan = week.find(p => p.date.getDay() === dayIndex);
      if (plan) {
        row += getIntensity(plan.count) + ' ';
      } else {
        row += chalk.gray('⬜') + ' ';
      }
    });
    
    console.log(row);
  }

  // Legend
  console.log('\n      Less ' + chalk.gray('⬜') + ' ' + chalk.green('🟩') + ' ' + chalk.green('🟨') + ' ' + chalk.red('🟥') + ' More');
  console.log(`      Showing ${plans.filter(p => p.count > 0).length} days with commits`);
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
