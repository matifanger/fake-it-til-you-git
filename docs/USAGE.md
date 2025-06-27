# 📖 Usage Guide

This comprehensive guide provides practical examples and best practices for using `fake-it-til-you-git`.

## 📖 Table of Contents

- [Getting Started](#getting-started)
- [Basic Usage Patterns](#basic-usage-patterns)
- [Advanced Usage](#advanced-usage)
- [Configuration Management](#configuration-management)
- [Distribution Strategies](#distribution-strategies)
- [Message Customization](#message-customization)
- [Safety and Best Practices](#safety-and-best-practices)
- [Real-world Scenarios](#real-world-scenarios)
- [Performance Tips](#performance-tips)
- [Integration Workflows](#integration-workflows)

## Getting Started

### Your First Fake Git History

Start with a simple preview to understand how the tool works:

```bash
# Preview 30 days of commits (safe mode)
fake-it-til-you-git --days 30 --preview --verbose
```

This will show you:
- 📊 A GitHub-style contribution graph
- 📈 Statistics about the planned commits
- 🎯 A realism score with suggestions
- 📅 Breakdown by weekdays and months

### Creating Your First Real History

Once you're satisfied with the preview:

```bash
# Create 30 days of commits for real
fake-it-til-you-git --days 30
```

**⚠️ Important:** Always use `--preview` first to verify your configuration!

## Basic Usage Patterns

### 1. Fill Recent Activity Gaps

Fill the last month with moderate activity:

```bash
fake-it-til-you-git --days 30 --commits 3 --distribution gaussian
```

### 2. Create Year-Long Activity

Generate a full year of commits with realistic patterns:

```bash
fake-it-til-you-git --days 365 --commits 8 --distribution random --message-style default
```

### 3. Specific Date Range

Target specific months or periods:

```bash
# Summer internship period
fake-it-til-you-git --start-date 2023-06-01 --end-date 2023-08-31 --commits 12

# Academic year
fake-it-til-you-git --start-date 2023-09-01 --end-date 2024-05-31 --commits 6
```

### 4. Quick Testing

Test with a small date range first:

```bash
# Test with just one week
fake-it-til-you-git --days 7 --commits 2 --preview
```

## Advanced Usage

### 1. Reproducible Results

Use seeds for consistent results across runs:

```bash
# Same seed will always produce the same pattern
fake-it-til-you-git --seed "project-alpha-2024" --days 90 --commits 5

# Different seed, different pattern
fake-it-til-you-git --seed "project-beta-2024" --days 90 --commits 5
```

### 2. Custom Repository Paths

Work with specific repositories:

```bash
# Target a specific project
fake-it-til-you-git --repo-path /path/to/my/project --days 60 --push

# Use relative paths
fake-it-til-you-git --repo-path ../other-project --days 30
```

### 3. Development and Testing

Use development mode for safe testing:

```bash
# Uses test-repo directory, safe for experimentation
fake-it-til-you-git --dev --days 10 --commits 5 --verbose
```

### 4. Automated Push

Automatically push to remote after creation:

```bash
fake-it-til-you-git --days 30 --push --author-name "CI Bot" --author-email "ci@company.com"
```

## Configuration Management

### 1. Basic Configuration File

Create `my-config.json`:

```json
{
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com"
  },
  "dateRange": {
    "startDate": "2023-01-01",
    "endDate": "2023-12-31"
  },
  "commits": {
    "maxPerDay": 8,
    "distribution": "random",
    "messageStyle": "default"
  },
  "options": {
    "preview": false,
    "push": false,
    "verbose": false
  }
}
```

Use it:

```bash
fake-it-til-you-git --config my-config.json
```

### 2. Profile-Based Configurations

Create different profiles for different purposes:

**`profiles/casual-dev.json`** - Light, realistic activity:
```json
{
  "commits": {
    "maxPerDay": 5,
    "distribution": "gaussian",
    "messageStyle": "default"
  },
  "author": {
    "name": "Casual Developer",
    "email": "casual@example.com"
  }
}
```

**`profiles/active-dev.json`** - High activity periods:
```json
{
  "commits": {
    "maxPerDay": 15,
    "distribution": "random",
    "messageStyle": "emoji"
  },
  "author": {
    "name": "Active Developer", 
    "email": "active@example.com"
  }
}
```

**`profiles/weekend-warrior.json`** - Focus on weekends:
```json
{
  "commits": {
    "maxPerDay": 20,
    "distribution": "custom",
    "messageStyle": "default"
  }
}
```

### 3. Configuration Override Patterns

Start with base config and override specific values:

```bash
# Use base config but change distribution
fake-it-til-you-git --config base-config.json --distribution uniform

# Override author for specific run
fake-it-til-you-git --config team-config.json --author-name "John Doe"

# Override date range
fake-it-til-you-git --config my-config.json --start-date 2024-01-01 --end-date 2024-03-31
```

## Distribution Strategies

### 1. Uniform Distribution

Perfect for consistent, steady work patterns:

```bash
# Steady 5 commits every day for 3 months
fake-it-til-you-git --days 90 --commits 5 --distribution uniform
```

**Best for:**
- Demonstrating consistent work habits
- Academic projects with regular deadlines
- Maintenance work patterns

### 2. Random Distribution

Most realistic for typical development work:

```bash
# Natural-looking random activity
fake-it-til-you-git --days 180 --commits 8 --distribution random
```

**Best for:**
- General portfolio enhancement
- Realistic development patterns
- Hiding the artificial nature

### 3. Gaussian Distribution

Creates more activity in the middle of the period:

```bash
# Peak activity in the middle, tapering off at edges
fake-it-til-you-git --days 120 --commits 10 --distribution gaussian
```

**Best for:**
- Project lifecycles (ramp up, peak, wind down)
- Learning curves (increasing then stable activity)
- Sprint-based development cycles

### 4. Custom Distribution

For specialized patterns:

```bash
# Custom pattern based on your specific needs
fake-it-til-you-git --days 60 --commits 12 --distribution custom
```

**Best for:**
- Specific work patterns you want to replicate
- Complex project timelines
- Advanced users who understand the algorithm

## Message Customization

### 1. Default Messages

Realistic commit messages for professional appearance:

```bash
fake-it-til-you-git --days 30 --message-style default
```

Examples:
- "Fix bug"
- "Add feature" 
- "Update documentation"
- "Refactor code"
- "Improve performance"

### 2. Lorem Ipsum Style

Generic placeholder messages:

```bash
fake-it-til-you-git --days 30 --message-style lorem
```

Examples:
- "Lorem ipsum dolor sit amet"
- "Consectetur adipiscing elit"
- "Sed do eiusmod tempor"

### 3. Emoji Messages

Fun, modern commit style:

```bash
fake-it-til-you-git --days 30 --message-style emoji
```

Examples:
- "🐛 Fix bug"
- "✨ Add feature"
- "📚 Update docs"
- "🚀 Improve performance"

### 4. Message Style Selection Guide

Choose based on your target audience:

- **Professional portfolios**: `default`
- **Personal projects**: `emoji`
- **Testing/development**: `lorem`
- **Open source contributions**: `default` or `emoji`

## Safety and Best Practices

### 1. Always Preview First

**Never skip the preview step:**

```bash
# Good practice - always preview
fake-it-til-you-git --days 365 --preview --verbose

# Then execute if satisfied
fake-it-til-you-git --days 365
```

### 2. Start Small

Test with small ranges before committing to large periods:

```bash
# Test with one week first
fake-it-til-you-git --days 7 --preview

# Scale up gradually
fake-it-til-you-git --days 30 --preview
fake-it-til-you-git --days 90 --preview
```

### 3. Use Development Mode

Test configurations safely:

```bash
# Safe testing in development mode
fake-it-til-you-git --dev --days 30 --commits 10 --verbose
```

### 4. Backup Awareness

The tool automatically creates backups, but understand the process:

```bash
# Enable verbose to see backup information
fake-it-til-you-git --days 30 --verbose
```

### 5. Realistic Patterns

Aim for realistic-looking activity:

```bash
# Good: Moderate, varied activity
fake-it-til-you-git --days 90 --commits 8 --distribution random

# Avoid: Too perfect or too intense
fake-it-til-you-git --days 90 --commits 50 --distribution uniform  # Too obvious
```

## Real-world Scenarios

### 1. Student Portfolio

Create activity that looks like learning and project work:

```bash
# Academic year with learning curve
fake-it-til-you-git \
  --start-date 2023-09-01 \
  --end-date 2024-05-31 \
  --commits 6 \
  --distribution gaussian \
  --message-style default \
  --author-name "Student Name" \
  --author-email "student@university.edu"
```

### 2. Job Seeker

Fill gaps in employment history:

```bash
# Fill the last 6 months with moderate activity
fake-it-til-you-git \
  --days 180 \
  --commits 5 \
  --distribution random \
  --message-style default \
  --seed "job-search-$(date +%Y)"
```

### 3. Open Source Contributor

Show consistent contribution patterns:

```bash
# Year-long contribution pattern
fake-it-til-you-git \
  --days 365 \
  --commits 8 \
  --distribution random \
  --message-style emoji \
  --author-name "OSS Contributor" \
  --push
```

### 4. Freelancer/Consultant

Show project-based activity cycles:

```bash
# Project cycles with peaks and valleys
fake-it-til-you-git \
  --days 90 \
  --commits 12 \
  --distribution gaussian \
  --message-style default \
  --seed "project-alpha-2024"
```

### 5. Career Transition

Bridge gap between different roles:

```bash
# Transition period with learning activity
fake-it-til-you-git \
  --start-date 2023-06-01 \
  --end-date 2023-12-31 \
  --commits 7 \
  --distribution gaussian \
  --message-style default
```

## Performance Tips

### 1. Large Date Ranges

For very large ranges, use appropriate settings:

```bash
# Multiple years - use moderate commit counts
fake-it-til-you-git --days 1095 --commits 6 --distribution random  # 3 years

# Monitor with verbose for progress
fake-it-til-you-git --days 1095 --commits 6 --verbose
```

### 2. Memory Considerations

For systems with limited memory:

```bash
# Use smaller commit counts for large ranges
fake-it-til-you-git --days 730 --commits 4 --distribution uniform

# Process in chunks if needed (run multiple times with different date ranges)
fake-it-til-you-git --start-date 2023-01-01 --end-date 2023-06-30 --commits 6
fake-it-til-you-git --start-date 2023-07-01 --end-date 2023-12-31 --commits 6
```

### 3. Network Considerations

When using `--push`:

```bash
# Push smaller batches more frequently
fake-it-til-you-git --days 30 --commits 5 --push

# Rather than large batches
fake-it-til-you-git --days 365 --commits 10 --push  # Could be slow
```

## Integration Workflows

### 1. CI/CD Integration

Use in automated workflows:

```bash
#!/bin/bash
# CI script example

# Load configuration from environment
cat > ci-config.json << EOF
{
  "author": {
    "name": "$CI_AUTHOR_NAME",
    "email": "$CI_AUTHOR_EMAIL"
  },
  "commits": {
    "maxPerDay": $CI_MAX_COMMITS,
    "distribution": "$CI_DISTRIBUTION"
  },
  "options": {
    "push": true,
    "verbose": true
  }
}
EOF

# Execute with configuration
fake-it-til-you-git --config ci-config.json --days $CI_DAYS
```

### 2. Multi-Repository Setup

Manage multiple repositories:

```bash
#!/bin/bash
# Multi-repo script

REPOS=("/path/to/repo1" "/path/to/repo2" "/path/to/repo3")
CONFIG="shared-config.json"

for repo in "${REPOS[@]}"; do
  echo "Processing $repo..."
  fake-it-til-you-git --config $CONFIG --repo-path "$repo" --days 90
done
```

### 3. Scheduled Generation

Use with cron or system schedulers:

```bash
# Crontab entry for weekly updates
# 0 0 * * 0 /usr/local/bin/fake-it-til-you-git --days 7 --commits 3 --push

# Or use configuration files for consistency
# 0 0 * * 0 /usr/local/bin/fake-it-til-you-git --config /home/user/.fake-git-weekly.json
```

### 4. Development Team Integration

Team configurations:

```json
{
  "profiles": {
    "backend": {
      "commits": { "maxPerDay": 8, "messageStyle": "default" },
      "author": { "name": "Backend Team", "email": "backend@company.com" }
    },
    "frontend": {
      "commits": { "maxPerDay": 12, "messageStyle": "emoji" },
      "author": { "name": "Frontend Team", "email": "frontend@company.com" }
    }
  }
}
```

## Troubleshooting Common Usage Issues

### 1. Permission Errors

```bash
# If you get permission errors, check repository permissions
ls -la .git/

# Or use a different repository path
fake-it-til-you-git --repo-path /tmp/test-repo --days 10
```

### 2. Large Memory Usage

```bash
# Reduce commit counts for large date ranges
fake-it-til-you-git --days 1000 --commits 3  # Instead of --commits 20

# Use more efficient distributions
fake-it-til-you-git --days 1000 --distribution uniform  # More efficient than random
```

### 3. Slow Performance

```bash
# Use seeds for faster repeated runs
fake-it-til-you-git --seed "fixed-seed" --days 365 --commits 5

# Avoid very high commit counts
fake-it-til-you-git --days 30 --commits 10  # Instead of --commits 50
```

### 4. Network Issues with Push

```bash
# Test connectivity first
git push origin main

# Use verbose mode to see detailed error information
fake-it-til-you-git --days 30 --push --verbose
```

## Best Practices Summary

### ✅ Do:

- Always use `--preview` before real execution
- Start with small date ranges for testing
- Use realistic commit counts (3-15 per day)
- Choose appropriate message styles for your context
- Use seeds for reproducible results
- Test with `--dev` mode first
- Use configuration files for complex setups
- Monitor with `--verbose` for important operations

### ❌ Don't:

- Create obviously artificial patterns (too uniform, too many commits)
- Skip preview mode for large operations
- Use extremely high commit counts (>20 per day regularly)
- Ignore the realism score and suggestions
- Use the same seed for different projects
- Forget to backup important repositories manually
- Create patterns that don't match your claimed experience level

### 🎯 Goals:

- Create realistic, believable activity patterns
- Enhance your profile without being deceptive
- Use the tool responsibly and ethically
- Test thoroughly before applying to important repositories
- Understand the implications of the changes you're making

---

For more information, see the [API Documentation](API.md) and [Troubleshooting Guide](TROUBLESHOOTING.md). 