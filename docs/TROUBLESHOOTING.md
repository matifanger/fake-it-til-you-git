# 🔧 Troubleshooting Guide

This guide helps you diagnose and fix common issues when using `fake-it-til-you-git`.

## 📖 Table of Contents

- [Quick Diagnosis](#quick-diagnosis)
- [Installation Issues](#installation-issues)
- [Configuration Problems](#configuration-problems)
- [Git Repository Issues](#git-repository-issues)
- [Performance Problems](#performance-problems)
- [Network and Push Issues](#network-and-push-issues)
- [Platform-Specific Issues](#platform-specific-issues)
- [Error Reference](#error-reference)
- [Debugging Tips](#debugging-tips)
- [Recovery Procedures](#recovery-procedures)
- [Getting Help](#getting-help)

## Quick Diagnosis

### Step 1: Check Installation

```bash
# Verify the tool is installed
fake-it-til-you-git --version

# Check Node.js version (requires ≥16.0.0)
node --version

# Verify npm/yarn installation
npm --version
```

### Step 2: Test Basic Functionality

```bash
# Test with minimal configuration (safe)
fake-it-til-you-git --days 7 --preview --verbose
```

### Step 3: Check Git Setup

```bash
# Verify Git installation
git --version

# Check if you're in a Git repository
git status

# Verify Git configuration
git config --list
```

## Installation Issues

### Issue: `Command not found: fake-it-til-you-git`

**Symptoms:**
```bash
$ fake-it-til-you-git --help
bash: fake-it-til-you-git: command not found
```

**Solutions:**

1. **Global installation missing:**
   ```bash
   npm install -g fake-it-til-you-git
   ```

2. **PATH not updated:**
   ```bash
   # Check npm global path
   npm config get prefix
   
   # Add to your shell profile (.bashrc, .zshrc, etc.)
   export PATH="$(npm config get prefix)/bin:$PATH"
   ```

3. **Permission issues on Unix systems:**
   ```bash
   # Fix npm permissions
   sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
   
   # Or use a Node version manager like nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   ```

### Issue: `Cannot find module` errors

**Symptoms:**
```
Error: Cannot find module 'commander'
    at Function.Module._resolveFilename
```

**Solutions:**

1. **Reinstall dependencies:**
   ```bash
   npm uninstall -g fake-it-til-you-git
   npm install -g fake-it-til-you-git
   ```

2. **Clear npm cache:**
   ```bash
   npm cache clean --force
   npm install -g fake-it-til-you-git
   ```

3. **Check Node.js version:**
   ```bash
   node --version  # Should be ≥16.0.0
   
   # Update Node.js if needed
   nvm install node  # If using nvm
   ```

## Configuration Problems

### Issue: `Configuration validation failed`

**Symptoms:**
```
❌ Configuration Error: Configuration validation failed: Invalid date format: 2023-1-1
```

**Solutions:**

1. **Fix date format:**
   ```bash
   # Wrong: 2023-1-1
   # Right: 2023-01-01
   fake-it-til-you-git --start-date 2023-01-01 --end-date 2023-12-31
   ```

2. **Check date ranges:**
   ```bash
   # Ensure start date is before end date
   fake-it-til-you-git --start-date 2023-01-01 --end-date 2023-06-30
   ```

3. **Validate email format:**
   ```bash
   # Wrong: invalid-email
   # Right: user@example.com
   fake-it-til-you-git --author-email "user@example.com"
   ```

### Issue: `Cannot load configuration file`

**Symptoms:**
```
❌ Error: Configuration file not found: my-config.json
```

**Solutions:**

1. **Check file path:**
   ```bash
   # Use absolute path
   fake-it-til-you-git --config /full/path/to/config.json
   
   # Or relative to current directory
   ls -la *.json  # Verify file exists
   ```

2. **Validate JSON syntax:**
   ```bash
   # Test JSON validity
   cat config.json | python -m json.tool
   
   # Or use jq
   jq . config.json
   ```

3. **Fix JSON structure:**
   ```json
   {
     "author": {
       "name": "Your Name",
       "email": "your@email.com"
     },
     "commits": {
       "maxPerDay": 10
     }
   }
   ```

### Issue: Option conflicts

**Symptoms:**
```
❌ Configuration Error: Cannot use --days option together with --start-date or --end-date
```

**Solutions:**

1. **Use either days OR date range:**
   ```bash
   # Option 1: Use days
   fake-it-til-you-git --days 30
   
   # Option 2: Use date range
   fake-it-til-you-git --start-date 2023-01-01 --end-date 2023-01-31
   ```

2. **Check conflicting options:**
   ```bash
   # Remove conflicting flags
   fake-it-til-you-git --preview --push  # Push ignored in preview mode
   ```

## Git Repository Issues

### Issue: `Not a git repository`

**Symptoms:**
```
❌ Error: fatal: not a git repository (or any of the parent directories): .git
```

**Solutions:**

1. **Initialize Git repository:**
   ```bash
   git init
   fake-it-til-you-git --days 30
   ```

2. **Navigate to correct directory:**
   ```bash
   cd /path/to/your/git/repo
   fake-it-til-you-git --days 30
   ```

3. **Use custom repository path:**
   ```bash
   fake-it-til-you-git --repo-path /path/to/git/repo --days 30
   ```

4. **Use development mode for testing:**
   ```bash
   fake-it-til-you-git --dev --days 30  # Uses test-repo directory
   ```

### Issue: Permission denied errors

**Symptoms:**
```
❌ Error: EACCES: permission denied, open '.git/objects/...'
```

**Solutions:**

1. **Fix Git directory permissions:**
   ```bash
   # Linux/macOS
   sudo chown -R $(whoami) .git/
   chmod -R 755 .git/
   ```

2. **Check disk space:**
   ```bash
   df -h .  # Check available space
   ```

3. **Use different repository:**
   ```bash
   # Create temporary repository for testing
   mkdir temp-repo
   cd temp-repo
   git init
   fake-it-til-you-git --days 10
   ```

### Issue: Git configuration missing

**Symptoms:**
```
❌ Error: Please tell me who you are
```

**Solutions:**

1. **Configure Git globally:**
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your@email.com"
   ```

2. **Configure for current repository:**
   ```bash
   git config user.name "Your Name"
   git config user.email "your@email.com"
   ```

3. **Use CLI options:**
   ```bash
   fake-it-til-you-git --author-name "Your Name" --author-email "your@email.com" --days 30
   ```

## Performance Problems

### Issue: High memory usage

**Symptoms:**
- System becomes slow during operation
- Out of memory errors
- Process killed by system

**Solutions:**

1. **Reduce commit counts:**
   ```bash
   # Instead of high counts
   fake-it-til-you-git --days 365 --commits 50
   
   # Use moderate counts
   fake-it-til-you-git --days 365 --commits 8
   ```

2. **Use efficient distributions:**
   ```bash
   # Uniform is more memory efficient
   fake-it-til-you-git --days 1000 --distribution uniform --commits 5
   ```

3. **Process in chunks:**
   ```bash
   # Split large ranges
   fake-it-til-you-git --start-date 2023-01-01 --end-date 2023-06-30 --commits 6
   fake-it-til-you-git --start-date 2023-07-01 --end-date 2023-12-31 --commits 6
   ```

### Issue: Slow performance

**Symptoms:**
- Operations take very long to complete
- System becomes unresponsive

**Solutions:**

1. **Use seeds for reproducibility:**
   ```bash
   # Faster repeated runs with same seed
   fake-it-til-you-git --seed "fixed-seed" --days 365 --commits 5
   ```

2. **Optimize settings:**
   ```bash
   # Avoid very high commit counts
   fake-it-til-you-git --days 30 --commits 8  # Instead of --commits 30
   ```

3. **Monitor with verbose:**
   ```bash
   fake-it-til-you-git --days 365 --commits 5 --verbose
   ```

## Network and Push Issues

### Issue: Push failures

**Symptoms:**
```
❌ Error: failed to push some refs to 'origin'
```

**Solutions:**

1. **Check remote configuration:**
   ```bash
   git remote -v
   git remote add origin https://github.com/username/repo.git
   ```

2. **Verify authentication:**
   ```bash
   # Test push manually
   git push origin main
   
   # For GitHub, ensure you have proper credentials/tokens
   git config --global credential.helper store
   ```

3. **Pull before push:**
   ```bash
   git pull origin main --rebase
   fake-it-til-you-git --days 30 --push
   ```

4. **Use verbose mode for details:**
   ```bash
   fake-it-til-you-git --days 30 --push --verbose
   ```

### Issue: Network connectivity

**Symptoms:**
```
❌ Error: getaddrinfo ENOTFOUND github.com
```

**Solutions:**

1. **Check internet connection:**
   ```bash
   ping github.com
   curl -I https://github.com
   ```

2. **Configure proxy (if needed):**
   ```bash
   git config --global http.proxy http://proxy.company.com:8080
   npm config set proxy http://proxy.company.com:8080
   ```

3. **Use SSH instead of HTTPS:**
   ```bash
   git remote set-url origin git@github.com:username/repo.git
   ```

## Platform-Specific Issues

### Windows Issues

**Issue: PowerShell execution policy**

**Symptoms:**
```
cannot be loaded because running scripts is disabled on this system
```

**Solutions:**
```powershell
# Set execution policy (as administrator)
Set-ExecutionPolicy RemoteSigned

# Or bypass for current session
Set-ExecutionPolicy Bypass -Scope Process
```

**Issue: Path separators**

**Solutions:**
```bash
# Use forward slashes or double backslashes
fake-it-til-you-git --repo-path "C:/Users/Username/repo"
fake-it-til-you-git --repo-path "C:\\Users\\Username\\repo"
```

### macOS Issues

**Issue: Permission errors with npm**

**Solutions:**
```bash
# Use Node Version Manager
brew install nvm
nvm install node
nvm use node

# Or fix npm permissions
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### Linux Issues

**Issue: Node.js version too old**

**Solutions:**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

## Error Reference

### Error Codes

#### `INVALID_CONFIG`
- **Cause:** Configuration validation failed
- **Fix:** Check configuration file syntax and values
- **Example:** Invalid date format, out-of-range commit counts

#### `GIT_OPERATION_FAILED`
- **Cause:** Git command failed
- **Fix:** Check Git installation and repository state
- **Example:** Not in Git repository, permission issues

#### `COMMIT_CREATION_FAILED`
- **Cause:** Failed to create commits
- **Fix:** Check repository state and permissions
- **Example:** Conflicting files, disk space issues

#### `BACKUP_FAILED`
- **Cause:** Backup operation failed
- **Fix:** Check disk space and permissions
- **Example:** Insufficient space, read-only filesystem

#### `PUSH_FAILED`
- **Cause:** Push to remote failed
- **Fix:** Check network and authentication
- **Example:** No remote configured, authentication failure

### Common Error Messages

#### `Command failed with exit code 1`
**Cause:** General Git command failure
**Debug:**
```bash
fake-it-til-you-git --days 10 --verbose  # See detailed output
git status  # Check repository state
```

#### `ENOSPC: no space left on device`
**Cause:** Insufficient disk space
**Fix:**
```bash
df -h .  # Check available space
rm -rf .fake-git-backups/old-*  # Clean old backups
```

#### `Cannot read property 'length' of undefined`
**Cause:** Internal error, likely configuration issue
**Fix:**
```bash
fake-it-til-you-git --config ./test-configs/fake-git.config.json --preview
```

## Debugging Tips

### Enable Verbose Mode

Always use verbose mode when troubleshooting:

```bash
fake-it-til-you-git --days 30 --verbose
```

This shows:
- Configuration loading details
- Git operations being performed
- Backup creation/restoration
- Detailed error information

### Use Preview Mode

Test configurations safely:

```bash
fake-it-til-you-git --days 30 --preview --verbose
```

### Check Configuration

Validate your configuration:

```bash
# Test with minimal config
fake-it-til-you-git --days 7 --commits 1 --preview

# Test with example config
fake-it-til-you-git --config ./test-configs/fake-git.config.json --preview
```

### Development Mode

Use development mode for safe testing:

```bash
fake-it-til-you-git --dev --days 10 --commits 3 --verbose
```

### Step-by-step Debugging

1. **Test basic functionality:**
   ```bash
   fake-it-til-you-git --version
   fake-it-til-you-git --help
   ```

2. **Test minimal configuration:**
   ```bash
   fake-it-til-you-git --days 1 --commits 1 --preview
   ```

3. **Test with your configuration:**
   ```bash
   fake-it-til-you-git --config your-config.json --preview --verbose
   ```

4. **Test without preview:**
   ```bash
   fake-it-til-you-git --days 7 --commits 2 --verbose
   ```

## Recovery Procedures

### Restore from Backup

If something goes wrong, the tool creates automatic backups:

```bash
# List available backups (in verbose mode)
fake-it-til-you-git --days 1 --preview --verbose

# Manual backup restoration (if needed)
ls -la .fake-git-backups/
```

### Manual Git Recovery

If you need to manually recover:

```bash
# Check Git log
git log --oneline -n 20

# Reset to previous state (careful!)
git reset --hard HEAD~10  # Remove last 10 commits

# Or reset to specific commit
git reset --hard <commit-hash>
```

### Clean Repository State

Start fresh if needed:

```bash
# Save important files
cp -r important-files/ ../backup/

# Clean working directory
git clean -fd
git reset --hard HEAD

# Or start completely fresh
rm -rf .git/
git init
```

## Getting Help

### Information to Include

When asking for help, include:

1. **Environment information:**
   ```bash
   fake-it-til-you-git --version
   node --version
   git --version
   echo $SHELL
   uname -a  # Linux/macOS
   ```

2. **Command that failed:**
   ```bash
   fake-it-til-you-git --days 30 --verbose  # Full command with --verbose
   ```

3. **Configuration file** (if used):
   ```json
   {
     "author": { ... },
     "commits": { ... }
   }
   ```

4. **Error output** (complete error message)
5. **What you expected to happen**

### Resources

- **GitHub Issues:** [Report bugs and request features](https://github.com/matifanger/fake-it-til-you-git/issues)
- **Discussions:** [Ask questions and share ideas](https://github.com/matifanger/fake-it-til-you-git/discussions)
- **Documentation:** [Complete documentation](../README.md)

### Before Reporting Issues

1. **Check existing issues:** Search for similar problems
2. **Try the latest version:** Update to the newest release
3. **Test with minimal configuration:** Reproduce with simple settings
4. **Use verbose mode:** Gather detailed error information

### Creating Good Bug Reports

Include these sections:

```markdown
## Environment
- OS: macOS 12.6
- Node.js: v18.17.0
- fake-it-til-you-git: v1.0.0

## Command
```bash
fake-it-til-you-git --days 30 --commits 10 --push --verbose
```

## Expected Behavior
Should create 30 days of commits and push to remote.

## Actual Behavior
Fails with "Push operation failed" error.

## Error Output
[Complete error message]

## Configuration
[Configuration file content if used]
```

---

For more information, see the [Usage Guide](USAGE.md) and [API Documentation](API.md). 