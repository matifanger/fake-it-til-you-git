/**
 * Date handling utilities for the fake-it-til-you-git project
 */

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Parses a date in YYYY-MM-DD format and returns a Date object
 * @param dateString Date in YYYY-MM-DD format
 * @returns Date object or null if the date is invalid
 */
export function parseDate(dateString: string): Date | null {
  // Validate basic YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return null;
  }

  // Split the date into components
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Create date (month - 1 because Date uses 0-based months)
  const date = new Date(year, month - 1, day);
  
  // Verify that the created date matches the given values
  // This catches cases like 2023-02-30 that JavaScript would automatically convert
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Validates if a date string is valid
 * @param dateString Date in YYYY-MM-DD format
 * @returns true if the date is valid, false otherwise
 */
export function isValidDate(dateString: string): boolean {
  return parseDate(dateString) !== null;
}

/**
 * Generates a date range between two given dates
 * @param startDate Start date
 * @param endDate End date
 * @returns Array of Date objects representing each day in the range
 */
export function generateDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  
  // Ensure that the start date is not greater than the end date
  if (startDate > endDate) {
    throw new Error('Start date cannot be greater than end date');
  }

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

/**
 * Generates a date range from strings in YYYY-MM-DD format
 * @param startDateString Start date in YYYY-MM-DD format
 * @param endDateString End date in YYYY-MM-DD format
 * @returns Array of Date objects or null if any date is invalid
 */
export function generateDateRangeFromStrings(
  startDateString: string,
  endDateString: string
): Date[] | null {
  const startDate = parseDate(startDateString);
  const endDate = parseDate(endDateString);

  if (!startDate || !endDate) {
    return null;
  }

  return generateDateRange(startDate, endDate);
}

/**
 * Calculates the number of days between two dates
 * @param startDate Start date
 * @param endDate End date
 * @returns Number of days between dates (positive if endDate > startDate)
 */
export function daysBetween(startDate: Date, endDate: Date): number {
  const timeDiff = endDate.getTime() - startDate.getTime();
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
}

/**
 * Calculates the number of days between two dates in string format
 * @param startDateString Start date in YYYY-MM-DD format
 * @param endDateString End date in YYYY-MM-DD format
 * @returns Number of days or null if any date is invalid
 */
export function daysBetweenStrings(
  startDateString: string,
  endDateString: string
): number | null {
  const startDate = parseDate(startDateString);
  const endDate = parseDate(endDateString);

  if (!startDate || !endDate) {
    return null;
  }

  return daysBetween(startDate, endDate);
}

/**
 * Formats a date as YYYY-MM-DD string
 * @param date Date object to format
 * @returns String in YYYY-MM-DD format
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets today's date in YYYY-MM-DD format
 * @returns String with today's date
 */
export function getTodayString(): string {
  return formatDate(new Date());
}

/**
 * Gets a date N days ago from today
 * @param days Number of days backwards
 * @returns String with the date in YYYY-MM-DD format
 */
export function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

/**
 * Validates that a date is within an allowed range
 * @param dateString Date to validate in YYYY-MM-DD format
 * @param minDate Minimum allowed date (optional)
 * @param maxDate Maximum allowed date (optional)
 * @returns true if the date is in range, false otherwise
 */
export function isDateInRange(
  dateString: string,
  minDate?: string,
  maxDate?: string
): boolean {
  const date = parseDate(dateString);
  if (!date) return false;

  if (minDate) {
    const min = parseDate(minDate);
    if (!min || date < min) return false;
  }

  if (maxDate) {
    const max = parseDate(maxDate);
    if (!max || date > max) return false;
  }

  return true;
} 