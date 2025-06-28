# 🚀 fake-it-til-you-git

A modern, TypeScript-powered CLI tool to generate realistic fake Git commit history for your GitHub profile. Perfect for testing, demonstrations, or filling gaps in your contribution graph.

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2%2B-blue)](https://www.typescriptlang.org/)

## ✨ Features

- 🎯 **Multiple Distribution Patterns**: Uniform, random, gaussian, and custom distributions
- 📅 **Flexible Date Ranges**: Specify exact dates or days back from today
- 👤 **Custom Author Info**: Set custom author name and email for commits
- 🎨 **Multiple Message Styles**: Realistic, lorem ipsum, or emoji-based commit messages
- 🔍 **Preview Mode**: Safe preview of commits before creation
- 🌱 **Smart Repository Handling**: Auto-detects or initializes Git repositories
- 🔄 **Reproducible Results**: Use seeds for consistent output
- 📊 **GitHub-style Contribution Graph**: Visual preview of your commit pattern
- 🛡️ **Backup & Recovery**: Automatic backup system for safe operations
- 🚀 **Auto-push Support**: Optionally push commits to remote repositories
- 🎛️ **Configuration Files**: JSON-based configuration with CLI overrides
- 🔧 **Cross-platform**: Works on Windows, macOS, and Linux

## 📦 Installation

### Global Installation

```bash
# Install globally via npm
npm install -g fake-it-til-you-git

# Or using yarn
yarn global add fake-it-til-you-git
```

### Local Installation

```bash
# Install locally in your project
npm install fake-it-til-you-git

# Or using yarn
yarn add fake-it-til-you-git
```

### From Source

```bash
# Clone the repository
git clone https://github.com/matifanger/fake-it-til-you-git.git
cd fake-it-til-you-git

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

## 🚀 Quick Start

```bash
# Generate 30 days of commits with default settings
fake-it-til-you-git --days 30

# Preview commits without creating them (safe mode)
fake-it-til-you-git --days 30 --preview

# Generate commits for a specific date range
fake-it-til-you-git --start-date 2023-01-01 --end-date 2023-12-31

# Create commits with custom author info
fake-it-til-you-git --days 90 --author-name "John Doe" --author-email "john@example.com"
```

## 📖 Usage

### Basic Command Structure

```bash
fake-it-til-you-git [options]
```

### Command Line Options

#### Date and Range Options
- `-d, --days <number>` - Number of days to go back from today (1-3650)
- `--start-date <date>` - Start date in YYYY-MM-DD format
- `--end-date <date>` - End date in YYYY-MM-DD format

#### Commit Configuration
- `-c, --commits <number>` - Maximum commits per day (1-100, default: 10)
- `--distribution <type>` - Distribution pattern: uniform, random, gaussian, custom
- `--message-style <style>` - Message style: default, lorem, emoji

#### Author Configuration
- `--author-name <name>` - Git author name (overrides config file)
- `--author-email <email>` - Git author email (overrides config file)

#### Behavior Options
- `--preview` - Preview commits without creating them (safe mode)
- `--config <path>` - Path to JSON configuration file
- `--push` - Push commits to remote repository after creation
- `--seed <string>` - Random seed for reproducible results
- `--dev` - Development mode: use test-repo directory
- `--repo-path <path>` - Path to the git repository (default: current directory)
- `-y, --yes` - Automatically answer yes to all prompts (non-interactive mode)
- `-v, --verbose` - Enable verbose output for debugging

#### Utility Options
- `-h, --help` - Display help information
- `--version` - Display version number

### 📊 Distribution Types

1. **uniform** - Evenly distributed commits across the date range
   ```bash
   fake-it-til-you-git --days 30 --distribution uniform --commits 5
   ```

2. **random** - Random distribution (default)
   ```bash
   fake-it-til-you-git --days 30 --distribution random
   ```

3. **gaussian** - Bell curve distribution (more commits in the middle)
   ```bash
   fake-it-til-you-git --days 90 --distribution gaussian --commits 8
   ```

4. **custom** - Custom distribution pattern
   ```bash
   fake-it-til-you-git --days 60 --distribution custom --commits 12
   ```

5. **pattern** - 🎨 **NEW!** Create visual patterns in your GitHub contribution graph
   ```bash
   # Heart pattern
   fake-it-til-you-git --pattern heart --days 365

   # Write text
   fake-it-til-you-git --pattern-text "HELLO" --days 365

   # Custom ASCII art
   fake-it-til-you-git --custom-pattern "  ██  \n ████ \n  ██  " --days 365
   ```

### 🎨 Message Styles

1. **default** - Realistic commit messages (default)
   - "Fix bug", "Add feature", "Update documentation", etc.

2. **lorem** - Lorem ipsum style messages
   - "Lorem ipsum dolor sit amet", "Consectetur adipiscing elit", etc.

3. **emoji** - Messages with emojis
   - "🐛 Fix bug", "✨ Add feature", "📚 Update docs", etc.

### 🎨 Pattern System (NEW!)

Create amazing visual patterns in your GitHub contribution graph! Perfect for making your profile stand out or sending messages through your commit history.

#### Preset Patterns

Choose from beautiful predefined patterns:

```bash
# Heart shape - perfect for showing love for coding
fake-it-til-you-git --pattern heart --days 365

# Star pattern - show you're a star developer
fake-it-til-you-git --pattern star --days 365

# Wave pattern - smooth and elegant
fake-it-til-you-git --pattern wave --days 365

# Geometric shapes
fake-it-til-you-git --pattern square --days 365
fake-it-til-you-git --pattern triangle --days 365
fake-it-til-you-git --pattern diamond --days 365
fake-it-til-you-git --pattern cross --days 365
```

#### Text Patterns

Write letters and numbers in your contribution graph:

```bash
# Write your name
fake-it-til-you-git --pattern-text "JOHN" --days 365

# Show the year
fake-it-til-you-git --pattern-text "2025" --days 365

# Numbers and letters
fake-it-til-you-git --pattern-text "DEV123" --days 365
```

#### Custom ASCII Patterns

Create your own patterns using ASCII art:

```bash
# Simple smiley face
fake-it-til-you-git --custom-pattern " ◯◯◯ \n◯   ◯\n ◯ ◯ \n  ◯  " --days 365

# Arrow pointing up
fake-it-til-you-git --custom-pattern "  ██  \n ████ \n██████\n  ██  \n  ██  " --days 365

# Custom initials
fake-it-til-you-git --custom-pattern "██ ██\n██ ██\n█████\n██ ██\n██ ██" --days 365
```

#### Pattern Customization

Fine-tune your patterns with these options:

```bash
# Scale patterns larger (1-5)
fake-it-til-you-git --pattern heart --pattern-scale 2 --days 365

# Adjust commit intensity
fake-it-til-you-git --pattern star --pattern-intensity high --days 365
fake-it-til-you-git --pattern wave --pattern-intensity low --days 365

# Combine all options
fake-it-til-you-git --pattern-text "2024" \
  --pattern-scale 1 \
  --pattern-intensity medium \
  --days 365
```

#### Pattern Configuration File

You can also define patterns in configuration files:

```json
{
  "commits": {
    "maxPerDay": 8,
    "distribution": "pattern",
    "pattern": {
      "type": "preset",
      "preset": "heart",
      "scale": 2,
      "intensity": "high",
      "centerX": 0.5,
      "centerY": 0.5
    }
  }
}
```

Or for text patterns:

```json
{
  "commits": {
    "distribution": "pattern",
    "pattern": {
      "type": "text",
      "text": "HELLO",
      "scale": 1,
      "intensity": "medium"
    }
  }
}
```

Or for custom patterns:

```json
{
  "commits": {
    "distribution": "pattern",
    "pattern": {
      "type": "custom",
      "custom": "  ██  \\n ████ \\n██████\\n ████ \\n  ██  ",
      "scale": 1,
      "intensity": "high"
    }
  }
}
```

## 📋 Examples

### Basic Usage

```bash
# Generate 1 year of commits
fake-it-til-you-git --days 365

# Generate commits for specific months
fake-it-til-you-git --start-date 2023-06-01 --end-date 2023-08-31

# Preview before creating
fake-it-til-you-git --days 30 --preview --verbose
```

### Advanced Usage

```bash
# High-activity simulation with gaussian distribution
fake-it-til-you-git --days 90 --commits 15 --distribution gaussian --author-name "Active Developer"

# Consistent results with seed
fake-it-til-you-git --seed "project-2024" --days 60 --commits 8

# Custom repository path
fake-it-til-you-git --repo-path /path/to/my/project --days 30 --push

# Non-interactive mode (auto-accept all prompts)
fake-it-til-you-git --yes --days 30 --commits 5

# Automation-friendly with custom config
fake-it-til-you-git --yes --config production.json --push

# Development testing
fake-it-til-you-git --dev --days 10 --commits 3 --preview
```

### 🎨 Pattern Examples

```bash
# 💝 Create a heart pattern for your coding passion
fake-it-til-you-git --pattern heart --days 365 --author-name "Passionate Developer" --preview

# ⭐ Star pattern with high intensity for impressive activity
fake-it-til-you-git --pattern star --pattern-intensity high --days 365 --commits 12

# 📝 Write your name or brand in the contribution graph
fake-it-til-you-git --pattern-text "GITHUB" --days 365 --pattern-scale 1

# 🎯 Show the current year prominently
fake-it-til-you-git --pattern-text "2024" --pattern-scale 2 --pattern-intensity high --days 365

# 🌊 Elegant wave pattern for smooth activity visualization
fake-it-til-you-git --pattern wave --days 365 --message-style emoji

# 🔷 Diamond pattern with custom scaling
fake-it-til-you-git --pattern diamond --pattern-scale 3 --days 365

# 🎨 Custom ASCII art pattern
fake-it-til-you-git --custom-pattern "  ██  \\n ████ \\n██████\\n ████ \\n  ██  " --days 365

# 🔤 Multi-word text patterns
fake-it-til-you-git --pattern-text "HELLO WORLD" --days 365 --pattern-intensity medium

# 🎭 Use configuration file for complex patterns
fake-it-til-you-git --config test-configs/pattern-examples.json --preview

# 🚀 Combine patterns with other options for maximum impact
fake-it-til-you-git --pattern heart \\
  --pattern-scale 2 \\
  --pattern-intensity high \\
  --author-name "Code Artist" \\
  --author-email "artist@example.com" \\
  --message-style emoji \\
  --seed "art-2024" \\
  --days 365 \\
  --preview
```

### Using Configuration Files

Create a `my-config.json` file:

```json
{
  "author": {
    "name": "John Developer",
    "email": "john@company.com"
  },
  "dateRange": {
    "startDate": "2023-01-01",
    "endDate": "2023-12-31"
  },
  "commits": {
    "maxPerDay": 12,
    "distribution": "gaussian",
    "messageStyle": "default"
  },
  "options": {
    "preview": false,
    "push": true,
    "verbose": false,
    "repositoryPath": ".",
    "yes": false
  },
  "seed": "consistent-2024"
}
```

Then use it:

```bash
fake-it-til-you-git --config my-config.json
```

## ⚙️ Configuration

### Configuration File Structure

The tool supports JSON configuration files with the following structure:

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
    "maxPerDay": 10,
    "distribution": "random",
    "messageStyle": "default"
  },
  "options": {
    "preview": false,
    "push": false,
    "verbose": false,
    "dev": false,
    "repositoryPath": ".",
    "yes": false
  },
  "seed": "optional-seed-value"
}
```

### Configuration Priority

Configuration values are applied in the following order (later values override earlier ones):

1. **Default values** (built-in defaults)
2. **Configuration file** (if specified)
3. **Command line arguments** (highest priority)

### Default Configuration

```json
{
  "author": {
    "name": "Fake Git User",
    "email": "fake@example.com"
  },
  "dateRange": {
    "startDate": "auto-calculated based on days",
    "endDate": "today"
  },
  "commits": {
    "maxPerDay": 10,
    "distribution": "random",
    "messageStyle": "default"
  },
  "options": {
    "preview": false,
    "push": false,
    "verbose": false,
    "dev": false,
    "repositoryPath": ".",
    "yes": false
  }
}
```

## 🛡️ Safety Features

### Preview Mode

Always test your configuration with `--preview` first:

```bash
fake-it-til-you-git --days 30 --preview --verbose
```

This shows you:
- 📊 GitHub-style contribution graph
- 📈 Detailed statistics and analysis
- 🎯 Realism score and suggestions
- ⚡ Pattern analysis (weekdays vs weekends)
- 📅 Monthly activity breakdown

### Backup System

The tool automatically creates backups before making changes:

- Backups are stored in `.fake-git-backups/` directory
- Automatic cleanup of old backups
- Recovery instructions provided if something goes wrong

### Validation

Comprehensive validation ensures:
- Valid date ranges and formats
- Reasonable commit counts
- Proper email format validation
- Git repository integrity checks

## 🔧 Development

### Prerequisites

- Node.js ≥ 16.0.0
- npm or yarn
- Git

### Development Setup

```bash
# Clone repository
git clone https://github.com/matifanger/fake-it-til-you-git.git
cd fake-it-til-you-git

# Install dependencies
npm install

# Run in development mode
npm run dev -- --help

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build project
npm run build

# Run linting
npm run lint

# Format code
npm run format
```

### Testing

```bash
# Run all tests
npm test
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Write tests for new features
- Follow TypeScript best practices
- Use conventional commit messages
- Update documentation as needed
- Ensure cross-platform compatibility

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [artiebits/fake-git-history](https://github.com/artiebits/fake-git-history)
- Built with modern TypeScript and Node.js best practices
- Uses [simple-git](https://github.com/steveukx/git-js) for Git operations
- CLI powered by [Commander.js](https://github.com/tj/commander.js)

## 📞 Support

- 🐛 [Report Issues](https://github.com/matifanger/fake-it-til-you-git/issues)
- 📖 [Documentation](https://github.com/matifanger/fake-it-til-you-git/blob/master/docs/README.md)

---

**⚠️ Disclaimer:** This tool is intended for educational purposes, testing, and personal projects. Please be mindful of your organization's policies regarding Git history manipulation. 