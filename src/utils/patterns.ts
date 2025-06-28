/**
 * Pattern generation utilities for creating visual patterns in GitHub contribution graphs
 * This module handles converting various pattern types into commit intensity maps.
 */

import type { PatternConfig } from '../config.js';

export interface PatternMatrix {
  width: number;
  height: number;
  data: number[][]; // 2D array where 0 = no commits, 1-4 = commit intensity levels
}

/**
 * Predefined patterns as ASCII art
 * Each pattern is defined as a string where:
 * - ' ' (space) = no commits (0)
 * - '.' = low intensity (1)  
 * - 'o' = medium intensity (2)
 * - 'O' = high intensity (3)
 * - '█' = maximum intensity (4)
 */
const PRESET_PATTERNS: Record<string, string> = {
  heart: `
 ███ ███ 
█████████
█████████
 ███████ 
  █████  
   ███   
    █    
  `,
  
  star: `
    █    
   ███   
   █O█   
O███████O
█████████
O███████O
  █████  
   ███   
    █    
  `,
  
  diamond: `
   █   
  ███  
 █████ 
███████
 █████ 
  ███  
   █   
  `,
  
  square: `
███████
█ooooo█
█ooooo█
█ooooo█
█ooooo█
███████
  `,
  
  triangle: `
     █     
    ███    
   █████   
  ███████  
 █████████ 
███████████
  `,
  
  cross: `
     █     
     █     
     █     
  ███████  
     █     
     █     
     █     
  `,
  
  wave: `
█       █  
██     ██  
 ██   ██   
  ██ ██    
   ███     
   ███     
  ██ ██    
 ██   ██   
██     ██  
█       █  
  `,
};

/**
 * Text patterns for letters and numbers
 * Each character is 5x7 pixels for readability
 */
const TEXT_PATTERNS: Record<string, string> = {
  'A': `
  ███  
 █   █ 
█     █
███████
█     █
█     █
█     █
  `,
  
  'B': `
██████ 
█     █
█     █
██████ 
█     █
█     █
██████ 
  `,
  
  'C': `
 ██████
█      
█      
█      
█      
█      
 ██████
  `,
  
  'D': `
██████ 
█     █
█     █
█     █
█     █
█     █
██████ 
  `,
  
  'E': `
███████
█      
█      
██████ 
█      
█      
███████
  `,
  
  'F': `
███████
█      
█      
██████ 
█      
█      
█      
  `,
  
  'G': `
 ██████
█      
█      
█  ████
█     █
█     █
 ██████
  `,
  
  'H': `
█     █
█     █
█     █
███████
█     █
█     █
█     █
  `,
  
  'I': `
███████
   █   
   █   
   █   
   █   
   █   
███████
  `,
  
  'J': `
███████
     █ 
     █ 
     █ 
     █ 
█    █ 
 █████ 
  `,
  
  'K': `
█     █
█    █ 
█   █  
████   
█   █  
█    █ 
█     █
  `,
  
  'L': `
█      
█      
█      
█      
█      
█      
███████
  `,
  
  'M': `
█     █
██   ██
█ █ █ █
█  █  █
█     █
█     █
█     █
  `,
  
  'N': `
█     █
██    █
█ █   █
█  █  █
█   █ █
█    ██
█     █
  `,
  
  'O': `
 █████ 
█     █
█     █
█     █
█     █
█     █
 █████ 
  `,
  
  'P': `
██████ 
█     █
█     █
██████ 
█      
█      
█      
  `,
  
  'Q': `
 █████ 
█     █
█     █
█     █
█   █ █
█    ██
 ██████
      █
  `,
  
  'R': `
██████ 
█     █
█     █
██████ 
█   █  
█    █ 
█     █
  `,
  
  'S': `
 ██████
█      
█      
 █████ 
      █
      █
██████ 
  `,
  
  'T': `
███████
   █   
   █   
   █   
   █   
   █   
   █   
  `,
  
  'U': `
█     █
█     █
█     █
█     █
█     █
█     █
 █████ 
  `,
  
  'V': `
█     █
█     █
█     █
█     █
 █   █ 
  █ █  
   █   
  `,
  
  'W': `
█     █
█     █
█     █
█  █  █
█ █ █ █
██   ██
█     █
  `,
  
  'X': `
█     █
 █   █ 
  █ █  
   █   
  █ █  
 █   █ 
█     █
  `,
  
  'Y': `
█     █
 █   █ 
  █ █  
   █   
   █   
   █   
   █   
  `,
  
  'Z': `
███████
     █ 
    █  
   █   
  █    
 █     
███████
  `,
  
  '0': `
 █████ 
█     █
█    ██
█   █ █
█  █  █
██    █
 █████ 
  `,
  
  '1': `
   █   
  ██   
   █   
   █   
   █   
   █   
███████
  `,
  
  '2': `
 █████ 
█     █
      █
 █████ 
█      
█      
███████
  `,
  
  '3': `
 █████ 
█     █
      █
 █████ 
      █
█     █
 █████ 
  `,
  
  '4': `
█    █ 
█    █ 
█    █ 
███████
     █ 
     █ 
     █ 
  `,
  
  '5': `
███████
█      
█      
██████ 
      █
█     █
 █████ 
  `,
  
  '6': `
 █████ 
█     █
█      
██████ 
█     █
█     █
 █████ 
  `,
  
  '7': `
███████
     █ 
    █  
   █   
  █    
 █     
█      
  `,
  
  '8': `
 █████ 
█     █
█     █
 █████ 
█     █
█     █
 █████ 
  `,
  
  '9': `
 █████ 
█     █
█     █
 ██████
      █
█     █
 █████ 
  `,
  
  ' ': `
       
       
       
       
       
       
       
  `,
};

/**
 * Convert a character to its intensity value
 */
function charToIntensity(char: string): number {
  switch (char) {
    case ' ': return 0;
    case '.': return 1;
    case 'o': return 2;
    case 'O': return 3;
    case '█': return 4;
    default: return 2; // Default to medium intensity for any other character
  }
}

/**
 * Parse a pattern string into a matrix
 */
function parsePatternString(patternStr: string): PatternMatrix {
  const lines = patternStr.trim().split('\n').map(line => line.trimEnd());
  const height = lines.length;
  const width = Math.max(...lines.map(line => line.length));
  
  const data: number[][] = [];
  
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    const line = lines[y] || '';
    
    for (let x = 0; x < width; x++) {
      const char = line[x] || ' ';
      row.push(charToIntensity(char));
    }
    
    data.push(row);
  }
  
  return { width, height, data };
}

/**
 * Generate a pattern matrix from preset pattern name
 */
export function generatePresetPattern(patternName: string): PatternMatrix {
  const patternStr = PRESET_PATTERNS[patternName];
  if (!patternStr) {
    throw new Error(`Unknown preset pattern: ${patternName}. Available: ${Object.keys(PRESET_PATTERNS).join(', ')}`);
  }
  
  return parsePatternString(patternStr);
}

/**
 * Generate a pattern matrix from custom ASCII art string
 */
export function generateCustomPattern(patternStr: string): PatternMatrix {
  // Replace common escape sequences
  const normalizedPattern = patternStr
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');
  
  return parsePatternString(normalizedPattern);
}

/**
 * Generate a pattern matrix from text
 */
export function generateTextPattern(text: string): PatternMatrix {
  const normalizedText = text.toUpperCase();
  const patterns: PatternMatrix[] = [];
  
  // Generate pattern for each character
  for (const char of normalizedText) {
    const charPattern = TEXT_PATTERNS[char];
    if (charPattern) {
      patterns.push(parsePatternString(charPattern));
    } else {
      // Use space for unknown characters
      patterns.push(parsePatternString(TEXT_PATTERNS[' ']));
    }
  }
  
  if (patterns.length === 0) {
    throw new Error('No valid characters found in text');
  }
  
  // Combine patterns horizontally with 1-pixel spacing
  const height = Math.max(...patterns.map(p => p.height));
  let totalWidth = 0;
  
  // Calculate total width including spacing
  for (let i = 0; i < patterns.length; i++) {
    totalWidth += patterns[i].width;
    if (i < patterns.length - 1) {
      totalWidth += 1; // spacing between characters
    }
  }
  
  const data: number[][] = [];
  
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      
      // Add character data
      for (let x = 0; x < pattern.width; x++) {
        if (y < pattern.height) {
          row.push(pattern.data[y][x]);
        } else {
          row.push(0); // Fill with empty space if character is shorter
        }
      }
      
      // Add spacing between characters (except for the last one)
      if (i < patterns.length - 1) {
        row.push(0);
      }
    }
    
    data.push(row);
  }
  
  return { width: totalWidth, height, data };
}

/**
 * Scale a pattern matrix by a given factor
 */
export function scalePattern(pattern: PatternMatrix, scale: number): PatternMatrix {
  if (scale === 1) {
    return pattern;
  }
  
  const newWidth = pattern.width * scale;
  const newHeight = pattern.height * scale;
  const data: number[][] = [];
  
  for (let y = 0; y < newHeight; y++) {
    const row: number[] = [];
    const sourceY = Math.floor(y / scale);
    
    for (let x = 0; x < newWidth; x++) {
      const sourceX = Math.floor(x / scale);
      const intensity = pattern.data[sourceY]?.[sourceX] || 0;
      row.push(intensity);
    }
    
    data.push(row);
  }
  
  return { width: newWidth, height: newHeight, data };
}

/**
 * Apply intensity scaling to pattern
 */
export function applyIntensity(pattern: PatternMatrix, intensity: 'low' | 'medium' | 'high'): PatternMatrix {
  const multipliers = {
    low: 0.5,
    medium: 1.0,
    high: 1.5
  };
  
  const multiplier = multipliers[intensity];
  const data = pattern.data.map(row => 
    row.map(value => {
      if (value === 0) return 0;
      return Math.min(4, Math.max(1, Math.round(value * multiplier)));
    })
  );
  
  return { ...pattern, data };
}

/**
 * Repeat a pattern horizontally with spacing
 */
export function repeatPattern(pattern: PatternMatrix, times: number): PatternMatrix {
  if (times <= 1) {
    return pattern;
  }
  
  // Calculate spacing between repetitions (1-2 pixels depending on pattern size)
  const spacing = Math.max(1, Math.floor(pattern.width / 10));
  
  const newWidth = pattern.width * times + spacing * (times - 1);
  const newHeight = pattern.height;
  const data: number[][] = [];
  
  for (let y = 0; y < newHeight; y++) {
    const row: number[] = [];
    
    for (let rep = 0; rep < times; rep++) {
      // Add pattern data
      for (let x = 0; x < pattern.width; x++) {
        const value = pattern.data[y]?.[x] || 0;
        row.push(value);
      }
      
      // Add spacing between repetitions (except for the last one)
      if (rep < times - 1) {
        for (let s = 0; s < spacing; s++) {
          row.push(0);
        }
      }
    }
    
    data.push(row);
  }
  
  return { width: newWidth, height: newHeight, data };
}

/**
 * Generate a complete pattern matrix from pattern configuration
 */
export function generatePattern(config: PatternConfig): PatternMatrix {
  let pattern: PatternMatrix;
  
  // Generate base pattern
  if (config.type === 'preset' && config.preset) {
    pattern = generatePresetPattern(config.preset);
  } else if (config.type === 'custom' && config.custom) {
    pattern = generateCustomPattern(config.custom);
  } else if (config.type === 'text' && config.text) {
    pattern = generateTextPattern(config.text);
  } else {
    // Default to heart pattern if no valid configuration
    pattern = generatePresetPattern('heart');
  }
  
  // Apply scaling
  if (config.scale && config.scale > 1) {
    pattern = scalePattern(pattern, config.scale);
  }
  
  // Apply repetition
  if (config.repeat && config.repeat > 1) {
    pattern = repeatPattern(pattern, config.repeat);
  }
  
  // Apply intensity
  if (config.intensity) {
    pattern = applyIntensity(pattern, config.intensity);
  }
  
  return pattern;
}

/**
 * Map pattern to date range, properly handling GitHub's contribution graph layout
 */
export function mapPatternToDateRange(
  pattern: PatternMatrix, 
  totalDays: number,
  config: PatternConfig,
  startDate?: Date
): number[] {
  const commits = new Array(totalDays).fill(0);
  
  // If no start date provided, assume we're starting from today minus totalDays
  const firstDate = startDate || new Date(Date.now() - (totalDays - 1) * 24 * 60 * 60 * 1000);
  const firstDayOfWeek = firstDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate the actual grid dimensions based on GitHub's layout
  // GitHub shows contributions in a grid where:
  // - Each column is a week
  // - Each row is a day of the week (0=Sunday, 6=Saturday)
  // - The first week may be incomplete (depending on what day the period starts)
  
  const totalWeeks = Math.ceil((totalDays + firstDayOfWeek) / 7);
  const gridWidth = totalWeeks;
  const gridHeight = 7;
  
  // Center the pattern within the available space
  const centerX = config.centerX ?? 0.5;
  const centerY = config.centerY ?? 0.5;
  
  // Calculate pattern placement, ensuring it fits within the grid
  const maxStartX = Math.max(0, gridWidth - pattern.width);
  const maxStartY = Math.max(0, gridHeight - pattern.height);
  
  const startX = Math.floor(maxStartX * centerX);
  const startY = Math.floor(maxStartY * centerY);
  
  // Map pattern to the contribution grid
  for (let py = 0; py < pattern.height; py++) {
    for (let px = 0; px < pattern.width; px++) {
      const gridX = startX + px; // Week number
      const gridY = startY + py; // Day of week (0=Sunday, 6=Saturday)
      
      // Check if this grid position is valid
      if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
        // Convert grid coordinates to day index in our linear array
        // For the first week, we need to account for the offset
        let dayIndex;
        
        if (gridX === 0) {
          // First week - may be incomplete
          if (gridY >= firstDayOfWeek) {
            dayIndex = gridY - firstDayOfWeek;
          } else {
            continue; // This day doesn't exist in our range
          }
        } else {
          // Subsequent weeks
          dayIndex = (7 - firstDayOfWeek) + (gridX - 1) * 7 + gridY;
        }
        
        // Apply the pattern if the day index is valid
        if (dayIndex >= 0 && dayIndex < totalDays) {
          const intensity = pattern.data[py][px];
          if (intensity > 0) {
            commits[dayIndex] = intensity;
          }
        }
      }
    }
  }
  
  return commits;
} 