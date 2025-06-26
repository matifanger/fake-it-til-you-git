import {
  type DateRange,
  daysBetween,
  daysBetweenStrings,
  formatDate,
  generateDateRange,
  generateDateRangeFromStrings,
  getDaysAgo,
  getTodayString,
  isDateInRange,
  isValidDate,
  parseDate,
} from '../../src/utils/dates';

describe('Date Utilities', () => {
  describe('parseDate', () => {
    test('should parse valid dates correctly', () => {
      const date = parseDate('2023-12-25');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2023);
      expect(date?.getMonth()).toBe(11); // December is month 11 (0-based)
      expect(date?.getDate()).toBe(25);
    });

    test('should parse leap year dates correctly', () => {
      const date = parseDate('2024-02-29');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(1); // February is month 1
      expect(date?.getDate()).toBe(29);
    });

    test('should reject invalid date formats', () => {
      expect(parseDate('2023/12/25')).toBeNull();
      expect(parseDate('25-12-2023')).toBeNull();
      expect(parseDate('2023-12-25T10:30:00')).toBeNull();
      expect(parseDate('2023-12')).toBeNull();
      expect(parseDate('invalid')).toBeNull();
    });

    test('should reject invalid dates', () => {
      expect(parseDate('2023-02-30')).toBeNull(); // February 30th doesn't exist
      expect(parseDate('2023-13-01')).toBeNull(); // Month 13 doesn't exist
      expect(parseDate('2023-12-32')).toBeNull(); // December 32nd doesn't exist
      expect(parseDate('2023-00-01')).toBeNull(); // Month 0 doesn't exist
      expect(parseDate('2023-12-00')).toBeNull(); // Day 0 doesn't exist
    });

    test('should reject non-leap year February 29th', () => {
      expect(parseDate('2023-02-29')).toBeNull(); // 2023 is not a leap year
    });
  });

  describe('isValidDate', () => {
    test('should validate correct dates', () => {
      expect(isValidDate('2023-12-25')).toBe(true);
      expect(isValidDate('2024-02-29')).toBe(true);
      expect(isValidDate('2023-01-01')).toBe(true);
    });

    test('should reject invalid dates', () => {
      expect(isValidDate('2023-02-30')).toBe(false);
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('2023/12/25')).toBe(false);
    });
  });

  describe('generateDateRange', () => {
    test('should generate correct date range', () => {
      const start = new Date(2023, 11, 20); // December 20, 2023
      const end = new Date(2023, 11, 25); // December 25, 2023
      const range = generateDateRange(start, end);

      expect(range).toHaveLength(6); // 6 days inclusive
      expect(range[0]).toEqual(start);
      expect(range[range.length - 1]).toEqual(end);
    });

    test('should generate single day range', () => {
      const date = new Date(2023, 11, 25);
      const range = generateDateRange(date, date);

      expect(range).toHaveLength(1);
      expect(range[0]).toEqual(date);
    });

    test('should throw error for invalid range', () => {
      const start = new Date(2023, 11, 25);
      const end = new Date(2023, 11, 20);

      expect(() => generateDateRange(start, end)).toThrow(
        'Start date cannot be greater than end date'
      );
    });
  });

  describe('generateDateRangeFromStrings', () => {
    test('should generate correct date range from strings', () => {
      const range = generateDateRangeFromStrings('2023-12-20', '2023-12-25');

      expect(range).toHaveLength(6);
      expect(range?.[0]).toEqual(new Date(2023, 11, 20));
      expect(range?.[range.length - 1]).toEqual(new Date(2023, 11, 25));
    });

    test('should return null for invalid dates', () => {
      expect(generateDateRangeFromStrings('2023-02-30', '2023-12-25')).toBeNull();
      expect(generateDateRangeFromStrings('2023-12-20', 'invalid')).toBeNull();
    });
  });

  describe('daysBetween', () => {
    test('should calculate days between dates correctly', () => {
      const start = new Date(2023, 11, 20);
      const end = new Date(2023, 11, 25);

      expect(daysBetween(start, end)).toBe(5);
    });

    test('should handle negative differences', () => {
      const start = new Date(2023, 11, 25);
      const end = new Date(2023, 11, 20);

      expect(daysBetween(start, end)).toBe(-5);
    });

    test('should handle same date', () => {
      const date = new Date(2023, 11, 25);

      expect(daysBetween(date, date)).toBe(0);
    });
  });

  describe('daysBetweenStrings', () => {
    test('should calculate days between string dates', () => {
      expect(daysBetweenStrings('2023-12-20', '2023-12-25')).toBe(5);
    });

    test('should return null for invalid dates', () => {
      expect(daysBetweenStrings('2023-02-30', '2023-12-25')).toBeNull();
      expect(daysBetweenStrings('2023-12-20', 'invalid')).toBeNull();
    });
  });

  describe('formatDate', () => {
    test('should format dates correctly', () => {
      const date = new Date(2023, 11, 25); // December 25, 2023
      expect(formatDate(date)).toBe('2023-12-25');
    });

    test('should pad single digit months and days', () => {
      const date = new Date(2023, 0, 5); // January 5, 2023
      expect(formatDate(date)).toBe('2023-01-05');
    });
  });

  describe('getTodayString', () => {
    test('should return today in correct format', () => {
      const today = getTodayString();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Verify it's actually today
      const parsedToday = parseDate(today);
      const actualToday = new Date();
      expect(parsedToday?.toDateString()).toBe(actualToday.toDateString());
    });
  });

  describe('getDaysAgo', () => {
    test('should return correct date N days ago', () => {
      const daysAgo = getDaysAgo(7);
      expect(daysAgo).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const parsedDate = parseDate(daysAgo);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 7);

      expect(parsedDate?.toDateString()).toBe(expectedDate.toDateString());
    });
  });

  describe('isDateInRange', () => {
    test('should validate date within range', () => {
      expect(isDateInRange('2023-12-20', '2023-12-15', '2023-12-25')).toBe(true);
    });

    test('should reject date outside range', () => {
      expect(isDateInRange('2023-12-10', '2023-12-15', '2023-12-25')).toBe(false);
      expect(isDateInRange('2023-12-30', '2023-12-15', '2023-12-25')).toBe(false);
    });

    test('should work with only min date', () => {
      expect(isDateInRange('2023-12-20', '2023-12-15')).toBe(true);
      expect(isDateInRange('2023-12-10', '2023-12-15')).toBe(false);
    });

    test('should work with only max date', () => {
      expect(isDateInRange('2023-12-20', undefined, '2023-12-25')).toBe(true);
      expect(isDateInRange('2023-12-30', undefined, '2023-12-25')).toBe(false);
    });

    test('should work with no range limits', () => {
      expect(isDateInRange('2023-12-20')).toBe(true);
    });

    test('should reject invalid dates', () => {
      expect(isDateInRange('invalid', '2023-12-15', '2023-12-25')).toBe(false);
    });

    test('should handle invalid range dates', () => {
      expect(isDateInRange('2023-12-20', 'invalid', '2023-12-25')).toBe(false);
      expect(isDateInRange('2023-12-20', '2023-12-15', 'invalid')).toBe(false);
    });
  });
});
