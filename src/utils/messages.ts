import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export type MessageStyle = 'default' | 'lorem' | 'emoji';

interface MessageGeneratorOptions {
  style: MessageStyle;
  customMessages?: string[];
  seed?: string;
}

/**
 * Lorem ipsum style commit messages for realistic fake history
 */
const LOREM_MESSAGES = [
  'Lorem ipsum dolor sit amet',
  'Consectetur adipiscing elit',
  'Sed do eiusmod tempor incididunt',
  'Ut labore et dolore magna aliqua',
  'Ut enim ad minim veniam',
  'Quis nostrud exercitation ullamco',
  'Laboris nisi ut aliquip ex ea',
  'Commodo consequat duis aute irure',
  'Dolor in reprehenderit in voluptate',
  'Velit esse cillum dolore eu fugiat',
  'Nulla pariatur excepteur sint occaecat',
  'Cupidatat non proident sunt in culpa',
  'Qui officia deserunt mollit anim',
  'Id est laborum sed ut perspiciatis',
  'Unde omnis iste natus error sit',
  'Voluptatem accusantium doloremque laudantium',
  'Totam rem aperiam eaque ipsa quae',
  'Ab illo inventore veritatis et quasi',
  'Architecto beatae vitae dicta sunt',
  'Explicabo nemo enim ipsam voluptatem',
];

/**
 * Emoji-based commit messages for fun fake history
 */
const EMOJI_MESSAGES = [
  '🐛 Fix bug',
  '✨ Add new feature',
  '📝 Update documentation',
  '♻️ Refactor code',
  '⚡ Improve performance',
  '✅ Add tests',
  '🎨 Improve code structure',
  '🔧 Add configuration file',
  '🚀 Deploy to production',
  '🔒 Fix security issues',
  '📦 Update dependencies',
  '🎉 Initial commit',
  '💄 Update UI and style files',
  '🚨 Fix compiler warnings',
  '🔀 Merge branches',
  '📱 Work on responsive design',
  '♿ Improve accessibility',
  '🔍 Improve SEO',
  '💡 Add comments',
  '🔥 Remove dead code',
  '🚧 Work in progress',
  '💥 Introduce breaking changes',
  '🍱 Add or update assets',
  '♻️ Refactor database queries',
  '🔐 Add authentication',
  '🌐 Internationalization and localization',
  '💫 Add animations and transitions',
  '🎯 Improve focus and targeting',
  '⚙️ Configuration changes',
  '🏗️ Make architectural changes',
];

/**
 * Load messages from a file
 */
export function loadMessagesFromFile(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch (error) {
    throw new Error(
      `Failed to load messages from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Load default messages from templates directory
 */
export function loadDefaultMessages(): string[] {
  // Strategy 1: Development environment or Jest test environment
  // Templates are at ./templates/ from project root
  const developmentPath = join(process.cwd(), 'templates', 'messages.txt');
  if (existsSync(developmentPath)) {
    return loadMessagesFromFile(developmentPath);
  }
  
  // Strategy 2: If we're running from the compiled dist/ directory (npm install)
  // The templates should be at ../../templates/ from dist/src/utils/
  let templatesPath: string | undefined;
  
  try {
    // Only try import.meta in non-test environments
    const isTestEnv = process.env.NODE_ENV === 'test' || 
                      process.env.JEST_WORKER_ID !== undefined ||
                      (typeof globalThis !== 'undefined' && 'jest' in globalThis);
    
    if (!isTestEnv) {
      // Use dynamic access to avoid TypeScript compilation issues in Jest
      const importMeta = (globalThis as any).importMeta || (globalThis as any).import?.meta;
      if (importMeta?.url) {
        const currentFilePath = fileURLToPath(importMeta.url);
        const currentDir = dirname(currentFilePath);
        templatesPath = join(currentDir, '..', '..', 'templates', 'messages.txt');
        
        if (existsSync(templatesPath)) {
          return loadMessagesFromFile(templatesPath);
        }
      }
      
      // Try another approach for ES modules
      try {
        // This will only work in actual ES module runtime, not in Jest
        const metaUrl = eval('import.meta.url');
        if (metaUrl) {
          const currentFilePath = fileURLToPath(metaUrl);
          const currentDir = dirname(currentFilePath);
          templatesPath = join(currentDir, '..', '..', 'templates', 'messages.txt');
          
          if (existsSync(templatesPath)) {
            return loadMessagesFromFile(templatesPath);
          }
        }
      } catch {
        // Ignore errors, continue to next strategy
      }
    }
  } catch (error) {
    // Continue to fallback strategies
  }
  
  // Strategy 3: Try to find templates relative to node_modules
  // This handles the case where we're installed as a dependency
  try {
    // Go up from where we might be in node_modules
    let searchPath = process.cwd();
    for (let i = 0; i < 10; i++) { // Limit search depth
      const candidatePath = join(searchPath, 'node_modules', 'fake-it-til-you-git', 'templates', 'messages.txt');
      if (existsSync(candidatePath)) {
        return loadMessagesFromFile(candidatePath);
      }
      const parentPath = dirname(searchPath);
      if (parentPath === searchPath) break; // Reached filesystem root
      searchPath = parentPath;
    }
  } catch (error) {
    // Continue to fallback
  }
  
  // If all else fails, throw an error with helpful information
  throw new Error(
    `Could not find templates/messages.txt. Searched in:\n` +
    `1. ${developmentPath} (development/test)\n` +
    `2. ${templatesPath || 'N/A'} (compiled package)\n` +
    `3. node_modules/fake-it-til-you-git/templates/messages.txt (npm install)\n` +
    `Please ensure the package is properly installed or the templates directory exists.`
  );
}

/**
 * Get messages array based on style
 */
export function getMessagesByStyle(style: MessageStyle, customMessages?: string[]): string[] {
  switch (style) {
    case 'default':
      if (customMessages && customMessages.length > 0) {
        return customMessages;
      }
      return loadDefaultMessages();
    case 'lorem':
      return LOREM_MESSAGES;
    case 'emoji':
      return EMOJI_MESSAGES;
    default:
      throw new Error(`Unknown message style: ${style}`);
  }
}

/**
 * Simple seeded random number generator for reproducible results
 */
class SeededRandom {
  private seed: number;

  constructor(seed: string) {
    this.seed = this.hashString(seed);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) & 0x7fffffff; // Keep positive 32-bit
    }
    // Add some salt to improve distribution
    hash = (hash * 16777619) & 0x7fffffff;
    return hash;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

/**
 * Generate a random commit message
 */
export function generateRandomMessage(options: MessageGeneratorOptions): string {
  const { style, customMessages, seed } = options;
  const messages = getMessagesByStyle(style, customMessages);

  if (messages.length === 0) {
    throw new Error('No messages available for generation');
  }

  if (seed) {
    const seededRandom = new SeededRandom(seed);
    const index = Math.floor(seededRandom.next() * messages.length);
    return messages[index];
  } else {
    const index = Math.floor(Math.random() * messages.length);
    return messages[index];
  }
}

/**
 * Validate custom messages
 */
export function validateCustomMessages(messages: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(messages)) {
    errors.push('Messages must be an array');
    return { valid: false, errors };
  }

  if (messages.length === 0) {
    errors.push('Messages array cannot be empty');
    return { valid: false, errors };
  }

  messages.forEach((message, index) => {
    if (typeof message !== 'string') {
      errors.push(`Message at index ${index} must be a string`);
      return;
    }

    const trimmed = message.trim();
    if (trimmed.length === 0) {
      errors.push(`Message at index ${index} cannot be empty or whitespace only`);
      return;
    }

    if (trimmed.length > 100) {
      errors.push(
        `Message at index ${index} is too long (max 100 characters): "${trimmed.substring(0, 50)}..."`
      );
      return;
    }

    // Check for potentially problematic characters
    if (trimmed.includes('\n') || trimmed.includes('\r')) {
      errors.push(`Message at index ${index} contains line breaks: "${trimmed}"`);
      return;
    }

    // Basic commit message format validation
    if (message.startsWith(' ') || message.endsWith(' ')) {
      errors.push(`Message at index ${index} has leading or trailing spaces: "${message}"`);
      return;
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize a single commit message
 */
export function sanitizeMessage(message: string): string {
  return message
    .trim()
    .replace(/[\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .substring(0, 100);
}

/**
 * Sanitize an array of commit messages
 */
export function sanitizeMessages(messages: string[]): string[] {
  return messages.map(sanitizeMessage).filter((message) => message.length > 0);
}

/**
 * Get message generator statistics
 */
export function getMessageStats(
  style: MessageStyle,
  customMessages?: string[]
): {
  style: MessageStyle;
  totalMessages: number;
  sampleMessages: string[];
} {
  const messages = getMessagesByStyle(style, customMessages);
  const sampleSize = Math.min(5, messages.length);
  const sampleMessages = messages.slice(0, sampleSize);

  return {
    style,
    totalMessages: messages.length,
    sampleMessages,
  };
}
