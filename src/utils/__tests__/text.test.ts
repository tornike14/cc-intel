import { describe, it, expect } from 'vitest';
import {
  normalizeWhitespace,
  countLines,
  truncateToLines,
  isBoilerplate,
  extractSubstantiveLine,
} from '../text.js';

describe('normalizeWhitespace', () => {
  it('collapses multiple spaces', () => {
    expect(normalizeWhitespace('hello   world')).toBe('hello world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeWhitespace('  hello  ')).toBe('hello');
  });

  it('collapses tabs and newlines', () => {
    expect(normalizeWhitespace('hello\t\n  world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(normalizeWhitespace('')).toBe('');
  });
});

describe('countLines', () => {
  it('counts single line', () => {
    expect(countLines('hello')).toBe(1);
  });

  it('counts multiple lines', () => {
    expect(countLines('line1\nline2\nline3')).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(countLines('')).toBe(0);
  });

  it('counts trailing newline as extra line', () => {
    expect(countLines('line1\n')).toBe(2);
  });
});

describe('truncateToLines', () => {
  it('returns full string when under limit', () => {
    expect(truncateToLines('a\nb\nc', 5)).toBe('a\nb\nc');
  });

  it('truncates to max lines', () => {
    expect(truncateToLines('a\nb\nc\nd', 2)).toBe('a\nb');
  });

  it('handles exact limit', () => {
    expect(truncateToLines('a\nb', 2)).toBe('a\nb');
  });

  it('handles single line with limit 1', () => {
    expect(truncateToLines('hello', 1)).toBe('hello');
  });
});

describe('isBoilerplate', () => {
  it('detects session continuation summary', () => {
    const text =
      'This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion.';
    expect(isBoilerplate(text)).toBe(true);
  });

  it('detects with leading whitespace', () => {
    const text =
      '  This session is being continued from a previous conversation that ran out of context.';
    expect(isBoilerplate(text)).toBe(true);
  });

  it('is case-insensitive', () => {
    const text = 'this SESSION is being continued from a previous conversation...';
    expect(isBoilerplate(text)).toBe(true);
  });

  it('returns false for normal project content', () => {
    expect(isBoilerplate('We decided to use TypeScript for the project')).toBe(false);
    expect(isBoilerplate('Build a CLI tool for context monitoring')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isBoilerplate('')).toBe(false);
  });
});

describe('extractSubstantiveLine', () => {
  it('returns content as-is for single substantive line', () => {
    expect(extractSubstantiveLine('We decided to use TypeScript')).toBe(
      'We decided to use TypeScript',
    );
  });

  it('skips empty leading lines', () => {
    expect(extractSubstantiveLine('\n\nWe decided to use TypeScript')).toBe(
      'We decided to use TypeScript',
    );
  });

  it('skips filler openings like "Good question"', () => {
    expect(
      extractSubstantiveLine("Good question.\nWe decided to use TypeScript for strict safety"),
    ).toBe('We decided to use TypeScript for strict safety');
  });

  it('skips "Let me check" style openings', () => {
    expect(
      extractSubstantiveLine("Let me check the configuration.\nThe tsconfig uses strict mode"),
    ).toBe('The tsconfig uses strict mode');
  });

  it('skips "Yes —" style acknowledgments', () => {
    expect(
      extractSubstantiveLine(
        "Yes — the plan is written!\nWe decided to use ESM with TypeScript strict mode",
      ),
    ).toBe('We decided to use ESM with TypeScript strict mode');
  });

  it('skips "Here\'s what" openings', () => {
    expect(
      extractSubstantiveLine("Here's what I found:\nThe src/core/signals.ts file handles scoring"),
    ).toBe('The src/core/signals.ts file handles scoring');
  });

  it('falls back to first non-empty line when all lines are short', () => {
    expect(extractSubstantiveLine('OK\nYes\nDone')).toBe('OK');
  });

  it('handles empty string', () => {
    expect(extractSubstantiveLine('')).toBe('');
  });

  it('skips "Done." standalone acknowledgments', () => {
    expect(
      extractSubstantiveLine("Done.\nAll 5 review issues fixed and merged via PR #28"),
    ).toBe('All 5 review issues fixed and merged via PR #28');
  });

  it('skips "Yes, ..." comma-style filler', () => {
    expect(
      extractSubstantiveLine("Yes, both are covered:\nThe JWT auth is required by team policy"),
    ).toBe('The JWT auth is required by team policy');
  });
});
