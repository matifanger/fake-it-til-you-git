import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import {
  loadMessagesFromFile,
  loadDefaultMessages,
  getMessagesByStyle,
  generateRandomMessage,
  validateCustomMessages,
  sanitizeMessage,
  sanitizeMessages,
  getMessageStats,
  type MessageStyle
} from '../../src/utils/messages';

describe('Messages Utilities', () => {
  const tempDir = join(__dirname, 'temp');
  const tempMessagesFile = join(tempDir, 'test-messages.txt');

  beforeAll(() => {
    // Create temp directory for testing
    try {
      mkdirSync(tempDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterAll(() => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('loadMessagesFromFile', () => {
    beforeEach(() => {
      // Create a test messages file
      const testMessages = [
        'Test message 1',
        'Test message 2',
        '',
        '   ',
        'Test message 3',
        'Test message 4'
      ].join('\n');
      writeFileSync(tempMessagesFile, testMessages);
    });

    it('should load messages from file correctly', () => {
      const messages = loadMessagesFromFile(tempMessagesFile);
      expect(messages).toEqual([
        'Test message 1',
        'Test message 2',
        'Test message 3',
        'Test message 4'
      ]);
    });

    it('should filter out empty lines and whitespace-only lines', () => {
      const messages = loadMessagesFromFile(tempMessagesFile);
      expect(messages).not.toContain('');
      expect(messages).not.toContain('   ');
      expect(messages.length).toBe(4);
    });

    it('should throw error for non-existent file', () => {
      expect(() => {
        loadMessagesFromFile('/non/existent/file.txt');
      }).toThrow('Failed to load messages from /non/existent/file.txt');
    });
  });

  describe('loadDefaultMessages', () => {
    it('should load default messages from templates directory', () => {
      const messages = loadDefaultMessages();
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages).toContain('Fix bug');
      expect(messages).toContain('Add feature');
    });
  });

  describe('getMessagesByStyle', () => {
    it('should return default messages when style is "default"', () => {
      const messages = getMessagesByStyle('default');
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should return custom messages when provided for default style', () => {
      const customMessages = ['Custom message 1', 'Custom message 2'];
      const messages = getMessagesByStyle('default', customMessages);
      expect(messages).toEqual(customMessages);
    });

    it('should return lorem messages when style is "lorem"', () => {
      const messages = getMessagesByStyle('lorem');
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages).toContain('Lorem ipsum dolor sit amet');
      expect(messages).toContain('Consectetur adipiscing elit');
    });

    it('should return emoji messages when style is "emoji"', () => {
      const messages = getMessagesByStyle('emoji');
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages).toContain('🐛 Fix bug');
      expect(messages).toContain('✨ Add new feature');
    });

    it('should throw error for unknown style', () => {
      expect(() => {
        getMessagesByStyle('unknown' as MessageStyle);
      }).toThrow('Unknown message style: unknown');
    });
  });

  describe('generateRandomMessage', () => {
    it('should generate message for default style', () => {
      const message = generateRandomMessage({ style: 'default' });
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should generate message for lorem style', () => {
      const message = generateRandomMessage({ style: 'lorem' });
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should generate message for emoji style', () => {
      const message = generateRandomMessage({ style: 'emoji' });
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should use custom messages when provided', () => {
      const customMessages = ['Custom test message'];
      const message = generateRandomMessage({ 
        style: 'default', 
        customMessages 
      });
      expect(message).toBe('Custom test message');
    });

    it('should generate reproducible results with seed', () => {
      const options = { style: 'lorem' as MessageStyle, seed: 'test-seed' };
      const message1 = generateRandomMessage(options);
      const message2 = generateRandomMessage(options);
      expect(message1).toBe(message2);
    });

    it('should generate different results with different seeds', () => {
      // Test multiple times to reduce chance of false failure
      const results1: string[] = [];
      const results2: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        results1.push(generateRandomMessage({ style: 'lorem', seed: 'seed1' }));
        results2.push(generateRandomMessage({ style: 'lorem', seed: 'seed2' }));
      }
      
      // All results with same seed should be identical
      expect(results1.every(msg => msg === results1[0])).toBe(true);
      expect(results2.every(msg => msg === results2[0])).toBe(true);
      
      // Different seeds should produce different results (at least statistically)
      expect(results1[0]).not.toBe(results2[0]);
    });

    it('should fall back to default messages when custom messages array is empty', () => {
      const message = generateRandomMessage({ style: 'default', customMessages: [] });
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      
      // Should use default messages, not throw an error
      const defaultMessages = loadDefaultMessages();
      expect(defaultMessages).toContain(message);
    });
  });

  describe('validateCustomMessages', () => {
    it('should validate valid messages array', () => {
      const messages = ['Valid message 1', 'Valid message 2'];
      const result = validateCustomMessages(messages);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-array input', () => {
      const result = validateCustomMessages('not an array' as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Messages must be an array');
    });

    it('should reject empty array', () => {
      const result = validateCustomMessages([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Messages array cannot be empty');
    });

    it('should reject non-string messages', () => {
      const messages = ['Valid message', 123, 'Another valid message'] as any;
      const result = validateCustomMessages(messages);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('must be a string'))).toBe(true);
    });

    it('should reject empty or whitespace-only messages', () => {
      const messages = ['Valid message', '', '   ', 'Another valid message'];
      const result = validateCustomMessages(messages);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('cannot be empty or whitespace only'))).toBe(true);
    });

    it('should reject messages that are too long', () => {
      const longMessage = 'a'.repeat(101);
      const messages = ['Valid message', longMessage];
      const result = validateCustomMessages(messages);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('is too long'))).toBe(true);
    });

    it('should reject messages with line breaks', () => {
      const messages = ['Valid message', 'Message\nwith\nbreaks'];
      const result = validateCustomMessages(messages);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('contains line breaks'))).toBe(true);
    });

    it('should reject messages with leading or trailing spaces', () => {
      const messages = ['Valid message', ' Leading space', 'Trailing space '];
      const result = validateCustomMessages(messages);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('leading or trailing spaces'))).toBe(true);
    });
  });

  describe('sanitizeMessage', () => {
    it('should trim whitespace', () => {
      expect(sanitizeMessage('  message  ')).toBe('message');
    });

    it('should replace line breaks with spaces', () => {
      expect(sanitizeMessage('line1\nline2\rline3')).toBe('line1 line2 line3');
    });

    it('should collapse multiple spaces', () => {
      expect(sanitizeMessage('multiple    spaces   here')).toBe('multiple spaces here');
    });

    it('should truncate long messages', () => {
      const longMessage = 'a'.repeat(150);
      const sanitized = sanitizeMessage(longMessage);
      expect(sanitized.length).toBe(100);
    });

    it('should handle empty and whitespace-only messages', () => {
      expect(sanitizeMessage('')).toBe('');
      expect(sanitizeMessage('   ')).toBe('');
    });
  });

  describe('sanitizeMessages', () => {
    it('should sanitize all messages in array', () => {
      const messages = [
        '  message 1  ',
        'message\nwith\nbreaks',
        'multiple    spaces',
        '',
        '   ',
        'normal message'
      ];
      const sanitized = sanitizeMessages(messages);
      expect(sanitized).toEqual([
        'message 1',
        'message with breaks',
        'multiple spaces',
        'normal message'
      ]);
    });

    it('should filter out empty messages after sanitization', () => {
      const messages = ['', '   ', 'valid message'];
      const sanitized = sanitizeMessages(messages);
      expect(sanitized).toEqual(['valid message']);
    });
  });

  describe('getMessageStats', () => {
    it('should return correct stats for default style', () => {
      const stats = getMessageStats('default');
      expect(stats.style).toBe('default');
      expect(stats.totalMessages).toBeGreaterThan(0);
      expect(Array.isArray(stats.sampleMessages)).toBe(true);
      expect(stats.sampleMessages.length).toBeGreaterThan(0);
      expect(stats.sampleMessages.length).toBeLessThanOrEqual(5);
    });

    it('should return correct stats for lorem style', () => {
      const stats = getMessageStats('lorem');
      expect(stats.style).toBe('lorem');
      expect(stats.totalMessages).toBe(20); // We know lorem has 20 messages
      expect(stats.sampleMessages).toContain('Lorem ipsum dolor sit amet');
    });

    it('should return correct stats for emoji style', () => {
      const stats = getMessageStats('emoji');
      expect(stats.style).toBe('emoji');
      expect(stats.totalMessages).toBeGreaterThan(20); // We know emoji has 30+ messages
      expect(stats.sampleMessages.some(msg => msg.includes('🐛'))).toBe(true);
    });

    it('should handle custom messages', () => {
      const customMessages = ['Custom 1', 'Custom 2', 'Custom 3'];
      const stats = getMessageStats('default', customMessages);
      expect(stats.totalMessages).toBe(3);
      expect(stats.sampleMessages).toEqual(customMessages);
    });

    it('should limit sample messages to 5', () => {
      const customMessages = Array.from({ length: 10 }, (_, i) => `Message ${i + 1}`);
      const stats = getMessageStats('default', customMessages);
      expect(stats.sampleMessages.length).toBe(5);
    });
  });
}); 