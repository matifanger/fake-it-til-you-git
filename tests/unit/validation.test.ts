import {
  type Config,
  isValidAuthorName,
  isValidEmail,
  sanitizeAuthorName,
  sanitizeConfig,
  sanitizeEmail,
  sanitizeString,
  validateAuthor,
  validateCommits,
  validateConfig,
  validateDateRange,
  validateOptions,
} from '../../src/utils/validation.js';

describe('Validation Utils', () => {
  describe('isValidEmail', () => {
    test('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
      expect(isValidEmail('user_name@example-domain.com')).toBe(true);
      expect(isValidEmail('123@example.com')).toBe(true);
    });

    test('should reject invalid email formats', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@invalid.com')).toBe(false);
      expect(isValidEmail('invalid@.com')).toBe(false);
      expect(isValidEmail('invalid@domain')).toBe(false);
      expect(isValidEmail('invalid..email@domain.com')).toBe(false);
      expect(isValidEmail('invalid@domain..com')).toBe(false);
    });

    test('should handle emails with whitespace', () => {
      expect(isValidEmail('  test@example.com  ')).toBe(true);
      expect(isValidEmail('test @example.com')).toBe(false);
      expect(isValidEmail('test@ example.com')).toBe(false);
    });
  });

  describe('isValidAuthorName', () => {
    test('should validate correct author names', () => {
      expect(isValidAuthorName('John Doe')).toBe(true);
      expect(isValidAuthorName('Jane Smith-Wilson')).toBe(true);
      expect(isValidAuthorName('José García')).toBe(true);
      expect(isValidAuthorName('A')).toBe(true);
      expect(isValidAuthorName("John O'Connor")).toBe(true);
    });

    test('should reject invalid author names', () => {
      expect(isValidAuthorName('')).toBe(false);
      expect(isValidAuthorName('   ')).toBe(false);
      expect(isValidAuthorName('  John Doe  ')).toBe(false); // Leading/trailing spaces
      expect(isValidAuthorName('John\nDoe')).toBe(false); // Line break
      expect(isValidAuthorName('John\tDoe')).toBe(false); // Tab character
      expect(isValidAuthorName('John\x00Doe')).toBe(false); // Control character
      expect(isValidAuthorName('a'.repeat(101))).toBe(false); // Too long
    });
  });

  describe('validateAuthor', () => {
    test('should validate correct author configuration', () => {
      const validAuthor = {
        name: 'John Doe',
        email: 'john@example.com',
      };

      const result = validateAuthor(validAuthor);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject non-object author', () => {
      const result = validateAuthor('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Author configuration must be an object');
    });

    test('should reject missing or invalid name', () => {
      const authorWithoutName = { email: 'john@example.com' };
      const result1 = validateAuthor(authorWithoutName);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Author name is required and must be a string');

      const authorWithInvalidName = { name: 123, email: 'john@example.com' };
      const result2 = validateAuthor(authorWithInvalidName);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('Author name is required and must be a string');

      const authorWithBadName = { name: 'John\nDoe', email: 'john@example.com' };
      const result3 = validateAuthor(authorWithBadName);
      expect(result3.valid).toBe(false);
      expect(result3.errors).toContain(
        'Author name is invalid (must be 1-100 characters, no control characters)'
      );
    });

    test('should reject missing or invalid email', () => {
      const authorWithoutEmail = { name: 'John Doe' };
      const result1 = validateAuthor(authorWithoutEmail);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Author email is required and must be a string');

      const authorWithInvalidEmail = { name: 'John Doe', email: 'invalid-email' };
      const result2 = validateAuthor(authorWithInvalidEmail);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('Author email format is invalid');
    });
  });

  describe('validateDateRange', () => {
    test('should validate correct date range', () => {
      const validRange = {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
      };

      const result = validateDateRange(validRange);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject non-object date range', () => {
      const result = validateDateRange('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Date range configuration must be an object');
    });

    test('should reject missing or invalid dates', () => {
      const rangeWithoutStart = { endDate: '2023-12-31' };
      const result1 = validateDateRange(rangeWithoutStart);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Start date is required and must be a string');

      const rangeWithInvalidStart = { startDate: 'invalid-date', endDate: '2023-12-31' };
      const result2 = validateDateRange(rangeWithInvalidStart);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('Start date format is invalid (expected YYYY-MM-DD)');

      const rangeWithoutEnd = { startDate: '2023-01-01' };
      const result3 = validateDateRange(rangeWithoutEnd);
      expect(result3.valid).toBe(false);
      expect(result3.errors).toContain('End date is required and must be a string');
    });

    test('should reject invalid date range logic', () => {
      const invalidRange = {
        startDate: '2023-12-31',
        endDate: '2023-01-01',
      };

      const result = validateDateRange(invalidRange);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Start date must be before or equal to end date');
    });

    test('should generate warnings for future dates and large ranges', () => {
      // Future date warning
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureRange = {
        startDate: '2023-01-01',
        endDate: futureDate.toISOString().split('T')[0],
      };

      const result1 = validateDateRange(futureRange);
      expect(result1.valid).toBe(true);
      expect(result1.warnings).toContain('End date is in the future');

      // Large range warning
      const largeRange = {
        startDate: '2000-01-01',
        endDate: '2023-12-31',
      };

      const result2 = validateDateRange(largeRange);
      expect(result2.valid).toBe(true);
      expect(result2.warnings).toContain(
        'Date range spans more than 10 years, this may take a while'
      );
    });
  });

  describe('validateCommits', () => {
    test('should validate correct commits configuration', () => {
      const validCommits = {
        maxPerDay: 5,
        distribution: 'random',
        messageStyle: 'default',
      };

      const result = validateCommits(validCommits);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject non-object commits', () => {
      const result = validateCommits('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Commits configuration must be an object');
    });

    test('should validate maxPerDay', () => {
      const commitsWithoutMaxPerDay = { distribution: 'random', messageStyle: 'default' };
      const result1 = validateCommits(commitsWithoutMaxPerDay);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('maxPerDay is required');

      const commitsWithInvalidMaxPerDay = {
        maxPerDay: 'invalid',
        distribution: 'random',
        messageStyle: 'default',
      };
      const result2 = validateCommits(commitsWithInvalidMaxPerDay);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('maxPerDay must be an integer');

      const commitsWithNegativeMaxPerDay = {
        maxPerDay: -1,
        distribution: 'random',
        messageStyle: 'default',
      };
      const result3 = validateCommits(commitsWithNegativeMaxPerDay);
      expect(result3.valid).toBe(false);
      expect(result3.errors).toContain('maxPerDay must be at least 1');

      const commitsWithHighMaxPerDay = {
        maxPerDay: 150,
        distribution: 'random',
        messageStyle: 'default',
      };
      const result4 = validateCommits(commitsWithHighMaxPerDay);
      expect(result4.valid).toBe(true);
      expect(result4.warnings).toContain(
        'maxPerDay is very high (>100), this may create unrealistic commit patterns'
      );
    });

    test('should validate distribution', () => {
      const commitsWithoutDistribution = { maxPerDay: 5, messageStyle: 'default' };
      const result1 = validateCommits(commitsWithoutDistribution);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Distribution is required and must be a string');

      const commitsWithInvalidDistribution = {
        maxPerDay: 5,
        distribution: 'invalid',
        messageStyle: 'default',
      };
      const result2 = validateCommits(commitsWithInvalidDistribution);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain(
        'Distribution must be one of: uniform, random, gaussian, custom'
      );
    });

    test('should validate messageStyle', () => {
      const commitsWithoutMessageStyle = { maxPerDay: 5, distribution: 'random' };
      const result1 = validateCommits(commitsWithoutMessageStyle);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Message style is required and must be a string');

      const commitsWithInvalidMessageStyle = {
        maxPerDay: 5,
        distribution: 'random',
        messageStyle: 'invalid',
      };
      const result2 = validateCommits(commitsWithInvalidMessageStyle);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('Message style must be one of: default, lorem, emoji');
    });

    test('should validate customMessages when present', () => {
      const commitsWithInvalidCustomMessages = {
        maxPerDay: 5,
        distribution: 'random',
        messageStyle: 'default',
        customMessages: 'not an array',
      };

      const result = validateCommits(commitsWithInvalidCustomMessages);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Custom messages must be an array');
    });
  });

  describe('validateOptions', () => {
    test('should validate correct options configuration', () => {
      const validOptions = {
        preview: true,
        push: false,
        verbose: true,
        seed: 'test-seed',
      };

      const result = validateOptions(validOptions);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should accept undefined options', () => {
      const result = validateOptions(undefined);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject non-object options', () => {
      const result = validateOptions('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Options configuration must be an object');
    });

    test('should validate individual option types', () => {
      const optionsWithInvalidPreview = { preview: 'not a boolean' };
      const result1 = validateOptions(optionsWithInvalidPreview);
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('preview option must be a boolean');

      const optionsWithInvalidPush = { push: 'not a boolean' };
      const result2 = validateOptions(optionsWithInvalidPush);
      expect(result2.valid).toBe(false);
      expect(result2.errors).toContain('push option must be a boolean');

      const optionsWithInvalidVerbose = { verbose: 'not a boolean' };
      const result3 = validateOptions(optionsWithInvalidVerbose);
      expect(result3.valid).toBe(false);
      expect(result3.errors).toContain('verbose option must be a boolean');

      const optionsWithInvalidSeed = { seed: 123 };
      const result4 = validateOptions(optionsWithInvalidSeed);
      expect(result4.valid).toBe(false);
      expect(result4.errors).toContain('seed option must be a string');

      const optionsWithEmptySeed = { seed: '   ' };
      const result5 = validateOptions(optionsWithEmptySeed);
      expect(result5.valid).toBe(false);
      expect(result5.errors).toContain('seed option cannot be empty');
    });
  });

  describe('validateConfig', () => {
    const validConfig = {
      author: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      dateRange: {
        startDate: '2023-01-01',
        endDate: '2023-12-31',
      },
      commits: {
        maxPerDay: 5,
        distribution: 'random',
        messageStyle: 'default',
      },
      options: {
        preview: false,
        push: false,
        verbose: false,
      },
    };

    test('should validate complete valid configuration', () => {
      const result = validateConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject non-object configuration', () => {
      const result = validateConfig('not an object');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration must be an object');
    });

    test('should collect errors from all sections', () => {
      const invalidConfig = {
        author: { name: '', email: 'invalid-email' },
        dateRange: { startDate: 'invalid', endDate: 'invalid' },
        commits: { maxPerDay: -1, distribution: 'invalid', messageStyle: 'invalid' },
      };

      const result = validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Sanitization functions', () => {
    describe('sanitizeString', () => {
      test('should trim whitespace and normalize spaces', () => {
        expect(sanitizeString('  hello   world  ')).toBe('hello world');
        expect(sanitizeString('hello\t\tworld')).toBe('hello world');
        expect(sanitizeString('hello\n\nworld')).toBe('hello world');
      });

      test('should remove control characters', () => {
        expect(sanitizeString('hello\x00world')).toBe('helloworld');
        expect(sanitizeString('hello\x1fworld')).toBe('helloworld');
        expect(sanitizeString('hello\x7fworld')).toBe('helloworld');
      });
    });

    describe('sanitizeEmail', () => {
      test('should sanitize and lowercase email', () => {
        expect(sanitizeEmail('  USER@EXAMPLE.COM  ')).toBe('user@example.com');
        expect(sanitizeEmail('User\x00@Example.com')).toBe('user@example.com');
      });
    });

    describe('sanitizeAuthorName', () => {
      test('should sanitize and truncate long names', () => {
        expect(sanitizeAuthorName('  John Doe  ')).toBe('John Doe');
        const longName = 'a'.repeat(150);
        const sanitized = sanitizeAuthorName(longName);
        expect(sanitized.length).toBeLessThanOrEqual(100);
      });
    });

    describe('sanitizeConfig', () => {
      test('should sanitize complete configuration', () => {
        const dirtyConfig: Config = {
          author: {
            name: '  John Doe  ',
            email: '  JOHN@EXAMPLE.COM  ',
          },
          dateRange: {
            startDate: '  2023-01-01  ',
            endDate: '  2023-12-31  ',
          },
          commits: {
            maxPerDay: -5.7, // Should be sanitized to positive integer
            distribution: 'random',
            messageStyle: 'default',
            customMessages: ['  message 1  ', '', '  message 2  '],
          },
          options: {
            preview: true,
            push: false,
            verbose: true,
            dev: false,
            seed: 'test-seed',
          },
        };

        const sanitized = sanitizeConfig(dirtyConfig);

        expect(sanitized.author.name).toBe('John Doe');
        expect(sanitized.author.email).toBe('john@example.com');
        expect(sanitized.dateRange.startDate).toBe('2023-01-01');
        expect(sanitized.dateRange.endDate).toBe('2023-12-31');
        expect(sanitized.commits.maxPerDay).toBe(5);
        expect(sanitized.commits.customMessages).toEqual(['message 1', 'message 2']);
        expect(sanitized.options?.seed).toBe('test-seed');
      });
    });
  });
});
