import { describe, it, expect } from 'vitest';
import { normalizeWhitespace, countLines, truncateToLines } from '../text.js';

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
