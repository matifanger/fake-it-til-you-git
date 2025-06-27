# 📚 API Documentation

This document provides detailed information about the internal APIs and modules of `fake-it-til-you-git`.

## 📖 Table of Contents

- [Configuration System](#configuration-system)
- [Git Operations](#git-operations)
- [Commit Generation](#commit-generation)
- [Date Utilities](#date-utilities)
- [Message Utilities](#message-utilities)
- [Validation System](#validation-system)
- [Main Orchestrator](#main-orchestrator)
- [CLI Interface](#cli-interface)

## Configuration System

### `src/config.ts`

#### Interfaces

##### `Config`
Complete configuration object with all required properties.

```typescript
interface Config {
  author: AuthorConfig;
  dateRange: DateRangeConfig;
  commits: CommitsConfig;
  options: OptionsConfig;
  seed?: string;
}
```

##### `AuthorConfig`
Git author information configuration.

```typescript
interface AuthorConfig {
  name: string;
  email: string;
}
```

##### `DateRangeConfig`
Date range configuration for commit generation.

```typescript
interface DateRangeConfig {
  startDate: string; // YYYY-MM-DD format
  endDate: string;   // YYYY-MM-DD format
}
```

##### `CommitsConfig`
Commit generation settings.

```typescript
interface CommitsConfig {
  maxPerDay: number;                    // 1-100
  distribution: 'uniform' | 'random' | 'gaussian' | 'custom';
  messageStyle: 'default' | 'lorem' | 'emoji';
}
```

##### `OptionsConfig`
Behavioral options.

```typescript
interface OptionsConfig {
  preview: boolean;
  push: boolean;
  verbose: boolean;
  dev: boolean;
  repositoryPath: string;
}
```

#### Functions

##### `loadConfig(cliOptions: CliOptions): Promise<Config>`
Loads and merges configuration from file and CLI options.

**Parameters:**
- `cliOptions`: Command line options object

**Returns:** Complete validated configuration

**Throws:** Error if configuration is invalid

##### `loadConfigFromFile(filePath: string): Promise<PartialConfig | null>`
Loads configuration from a JSON file.

**Parameters:**
- `filePath`: Path to configuration file

**Returns:** Parsed configuration or null if file doesn't exist

##### `validateConfig(config: Config): ValidationResult`
Validates complete configuration object.

**Parameters:**
- `config`: Configuration to validate

**Returns:** Validation result with errors and warnings

##### `applyDefaults(partialConfig: PartialConfig): Config`
Applies default values to partial configuration.

**Parameters:**
- `partialConfig`: Partial configuration object

**Returns:** Complete configuration with defaults applied

## Git Operations

### `src/git.ts`

#### Class: `GitOperations`

Git repository management and operations.

##### Constructor
```typescript
constructor(repositoryPath?: string)
```

**Parameters:**
- `repositoryPath` (optional): Path to git repository

##### Methods

###### `isGitRepository(): Promise<boolean>`
Checks if the current directory is a Git repository.

**Returns:** True if Git repository exists

###### `initRepository(): Promise<void>`
Initializes a new Git repository.

**Throws:** Error if initialization fails

###### `getRepositoryInfo(): Promise<RepositoryInfo>`
Gets comprehensive repository information.

**Returns:** Repository information object
```typescript
interface RepositoryInfo {
  path: string;
  branch: string;
  remote: string | null;
  totalCommits: number;
  lastCommit: {
    hash: string;
    message: string;
    date: Date;
    author: string;
  } | null;
}
```

###### `createCommit(plan: CommitPlan): Promise<string>`
Creates a single commit according to the plan.

**Parameters:**
- `plan`: Commit plan with date, count, and messages

**Returns:** Commit hash

###### `createCommits(plans: CommitPlan[]): Promise<CommitResult>`
Creates multiple commits from an array of plans.

**Parameters:**
- `plans`: Array of commit plans

**Returns:** Result object with success status and statistics

###### `pushToRemote(remoteName?: string): Promise<void>`
Pushes commits to remote repository.

**Parameters:**
- `remoteName` (optional): Name of remote (defaults to 'origin')

**Throws:** Error if push fails

###### `createBackup(): Promise<string>`
Creates a backup of the current repository state.

**Returns:** Backup identifier

###### `restoreFromBackup(backupId: string): Promise<void>`
Restores repository from a backup.

**Parameters:**
- `backupId`: Backup identifier to restore from

###### `listBackups(): Promise<BackupInfo[]>`
Lists available backups.

**Returns:** Array of backup information objects

###### `cleanupOldBackups(maxAge?: number): Promise<void>`
Removes old backup files.

**Parameters:**
- `maxAge` (optional): Maximum age in days (default: 30)

## Commit Generation

### `src/commits.ts`

#### Interfaces

##### `CommitPlan`
Plan for creating commits on a specific date.

```typescript
interface CommitPlan {
  date: Date;
  count: number;
  messages: string[];
}
```

##### `CommitResult`
Result of commit creation operation.

```typescript
interface CommitResult {
  success: boolean;
  totalCommits: number;
  failedCommits: number;
  errors: string[];
}
```

#### Functions

##### `generateCommitPlan(config: Config): CommitPlan[]`
Generates a plan for creating commits based on configuration.

**Parameters:**
- `config`: Complete configuration object

**Returns:** Array of commit plans for each date in range

##### `populateCommitMessages(plans: CommitPlan[], config: Config): CommitPlan[]`
Populates commit plans with actual messages.

**Parameters:**
- `plans`: Array of commit plans to populate
- `config`: Configuration containing message style preferences

**Returns:** Commit plans with messages populated

##### `validateCommitPlan(plans: CommitPlan[], config: Config): ValidationResult`
Validates a complete commit plan.

**Parameters:**
- `plans`: Array of commit plans to validate
- `config`: Configuration to validate against

**Returns:** Validation result with errors and warnings

##### `calculateCommitDistribution(dateRange: DateRangeConfig, distribution: string, maxPerDay: number, seed?: string): number[]`
Calculates commit distribution across date range.

**Parameters:**
- `dateRange`: Start and end dates
- `distribution`: Distribution type ('uniform', 'random', 'gaussian', 'custom')
- `maxPerDay`: Maximum commits per day
- `seed` (optional): Random seed for reproducible results

**Returns:** Array of commit counts for each day

## Date Utilities

### `src/utils/dates.ts`

#### Functions

##### `parseDate(dateString: string): Date`
Parses date string in YYYY-MM-DD format.

**Parameters:**
- `dateString`: Date in YYYY-MM-DD format

**Returns:** Parsed Date object

**Throws:** Error if date format is invalid

##### `formatDate(date: Date): string`
Formats Date object to YYYY-MM-DD string.

**Parameters:**
- `date`: Date object to format

**Returns:** Formatted date string

##### `generateDateRange(startDate: string, endDate: string): Date[]`
Generates array of dates between start and end dates.

**Parameters:**
- `startDate`: Start date in YYYY-MM-DD format
- `endDate`: End date in YYYY-MM-DD format

**Returns:** Array of Date objects

##### `validateDateRange(startDate: string, endDate: string): boolean`
Validates that start date is before end date.

**Parameters:**
- `startDate`: Start date string
- `endDate`: End date string

**Returns:** True if date range is valid

##### `daysBetween(startDate: Date, endDate: Date): number`
Calculates number of days between two dates.

**Parameters:**
- `startDate`: Start date
- `endDate`: End date

**Returns:** Number of days between dates

##### `addDays(date: Date, days: number): Date`
Adds specified number of days to a date.

**Parameters:**
- `date`: Base date
- `days`: Number of days to add (can be negative)

**Returns:** New Date object

## Message Utilities

### `src/utils/messages.ts`

#### Interfaces

##### `MessageStyle`
Available message styles.

```typescript
type MessageStyle = 'default' | 'lorem' | 'emoji';
```

#### Functions

##### `loadMessagesFromFile(filePath: string): Promise<string[]>`
Loads commit messages from a text file.

**Parameters:**
- `filePath`: Path to messages file

**Returns:** Array of message strings

**Throws:** Error if file cannot be read

##### `generateMessage(style: MessageStyle, seed?: string): string`
Generates a single commit message in the specified style.

**Parameters:**
- `style`: Message style to use
- `seed` (optional): Random seed for reproducible results

**Returns:** Generated commit message

##### `generateMessages(count: number, style: MessageStyle, seed?: string): string[]`
Generates multiple commit messages.

**Parameters:**
- `count`: Number of messages to generate
- `style`: Message style to use
- `seed` (optional): Random seed for reproducible results

**Returns:** Array of generated messages

##### `validateCustomMessages(messages: string[]): ValidationResult`
Validates an array of custom commit messages.

**Parameters:**
- `messages`: Array of messages to validate

**Returns:** Validation result with errors and warnings

## Validation System

### `src/utils/validation.ts`

#### Interfaces

##### `ValidationResult`
Result of validation operations.

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

#### Functions

##### `validateEmail(email: string): boolean`
Validates email address format.

**Parameters:**
- `email`: Email address to validate

**Returns:** True if email format is valid

##### `validateDateString(dateString: string): boolean`
Validates date string format (YYYY-MM-DD).

**Parameters:**
- `dateString`: Date string to validate

**Returns:** True if date format is valid

##### `validateCommitCount(count: number): boolean`
Validates commit count is within acceptable range.

**Parameters:**
- `count`: Commit count to validate

**Returns:** True if count is valid (1-100)

##### `validateDistributionType(distribution: string): boolean`
Validates distribution type is supported.

**Parameters:**
- `distribution`: Distribution type to validate

**Returns:** True if distribution type is valid

##### `validateMessageStyle(style: string): boolean`
Validates message style is supported.

**Parameters:**
- `style`: Message style to validate

**Returns:** True if message style is valid

##### `sanitizeInput(input: string): string`
Sanitizes user input by removing dangerous characters.

**Parameters:**
- `input`: Input string to sanitize

**Returns:** Sanitized string

## Main Orchestrator

### `src/main.ts`

#### Functions

##### `main(options: CliOptions): Promise<void>`
Main application entry point that orchestrates the entire process.

**Parameters:**
- `options`: CLI options object

**Process Flow:**
1. Load and validate configuration
2. Initialize Git operations
3. Generate commit plan
4. Show preview (if enabled)
5. Create commits
6. Push to remote (if enabled)
7. Handle cleanup and error recovery

**Throws:** FakeGitError with detailed error information

#### Classes

##### `FakeGitError`
Custom error class for application-specific errors.

```typescript
class FakeGitError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean,
    public context?: any
  )
}
```

## CLI Interface

### `bin/cli.ts`

#### Command Line Options

The CLI uses Commander.js to provide a rich command-line interface.

##### Validation Functions

All CLI options are validated using dedicated validation functions:

- `validateDays(value: string): string` - Validates days parameter (1-3650)
- `validateCommits(value: string): string` - Validates commits parameter (1-100)
- `validateDate(value: string): string` - Validates date format and range
- `validateDistribution(value: string): string` - Validates distribution type
- `validateMessageStyle(value: string): string` - Validates message style
- `validateEmail(value: string): string` - Validates email format
- `validateOptionCombinations(options: Record<string, any>): void` - Validates option combinations

#### Error Handling

The CLI provides comprehensive error handling:

- **Validation Errors**: Clear messages for invalid input
- **Configuration Errors**: Detailed feedback on configuration issues
- **Runtime Errors**: Graceful handling with helpful tips
- **Unknown Options**: Helpful suggestions for typos

#### Help System

Enhanced help system includes:

- Detailed command descriptions
- Usage examples for common scenarios
- Configuration file explanations
- Distribution type descriptions
- Message style explanations

## Error Handling

### Common Error Types

#### `INVALID_CONFIG`
Configuration validation failed.

**Common Causes:**
- Invalid date formats
- Out-of-range values
- Missing required fields

#### `GIT_OPERATION_FAILED`
Git operation encountered an error.

**Common Causes:**
- Not in a Git repository
- Permission issues
- Network problems (for push operations)

#### `COMMIT_CREATION_FAILED`
Failed to create commits.

**Common Causes:**
- File system permissions
- Git configuration issues
- Repository state conflicts

#### `BACKUP_FAILED`
Backup operation failed.

**Common Causes:**
- Insufficient disk space
- Permission issues
- Corrupted repository state

### Error Recovery

The application provides automatic error recovery:

1. **Backup System**: Automatic backups before operations
2. **Cleanup Handlers**: Graceful cleanup on interruption
3. **State Restoration**: Automatic restoration on failures
4. **Detailed Logging**: Verbose error information for debugging

## Performance Considerations

### Memory Usage

- Commit plans are generated in memory but processed incrementally
- Large date ranges are handled efficiently with streaming
- Backup operations use minimal memory footprint

### CPU Usage

- Distribution calculations are optimized for performance
- Parallel processing where possible
- Efficient algorithms for date range operations

### Disk I/O

- Minimal file system operations
- Efficient backup and restore mechanisms
- Optimized Git operations

## Testing

### Unit Tests

Each module has comprehensive unit tests covering:

- Happy path scenarios
- Edge cases and error conditions
- Performance characteristics
- Cross-platform compatibility

### Integration Tests

End-to-end tests validate:

- Complete CLI workflows
- Configuration loading and merging
- Git operations and recovery
- Cross-platform behavior

### Performance Tests

Specialized tests for:

- Large-scale commit generation
- Memory usage patterns
- Time complexity validation
- Stress testing scenarios

## Extension Points

The API is designed for extensibility:

### Custom Distributions

Add new distribution types by extending the `calculateCommitDistribution` function.

### Custom Message Styles

Add new message styles by extending the message generation system.

### Custom Validations

Add custom validation rules using the validation framework.

### Custom Git Operations

Extend `GitOperations` class for specialized Git workflows.

---

For more detailed examples and usage patterns, see the main [README.md](../README.md) and the [Usage Guide](USAGE.md). 