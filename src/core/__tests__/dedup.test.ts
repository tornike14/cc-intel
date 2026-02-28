import { describe, it, expect } from 'vitest';
import { deduplicate, computeSimilarity } from '../dedup.js';

describe('computeSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(computeSimilarity('hello world', 'hello world')).toBe(1);
  });

  it('returns 1 for strings differing only in whitespace/case', () => {
    expect(computeSimilarity('Hello  World', 'hello world')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    const sim = computeSimilarity('abcdef', 'xyz123');
    expect(sim).toBeLessThan(0.3);
  });

  it('returns high similarity for near-duplicates', () => {
    const sim = computeSimilarity(
      'We decided to use TypeScript for the project',
      'We decided to use TypeScript for this project',
    );
    expect(sim).toBeGreaterThan(0.85);
  });

  it('returns 0 for very short strings', () => {
    expect(computeSimilarity('a', 'b')).toBe(0);
  });
});

describe('deduplicate', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicate([])).toHaveLength(0);
  });

  it('returns single entry unchanged', () => {
    const result = deduplicate([{ text: 'hello' }]);
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe('hello');
  });

  it('removes exact duplicates', () => {
    const result = deduplicate([{ text: 'hello world' }, { text: 'hello world' }]);
    expect(result).toHaveLength(1);
  });

  it('removes near-duplicates above threshold', () => {
    const result = deduplicate([
      { text: 'We decided to use TypeScript for the project' },
      { text: 'We decided to use TypeScript for this project' },
    ]);
    expect(result).toHaveLength(1);
  });

  it('preserves distinct entries', () => {
    const result = deduplicate([
      { text: 'Use TypeScript for type safety' },
      { text: 'Set up CI/CD with GitHub Actions' },
    ]);
    expect(result).toHaveLength(2);
  });

  it('keeps the most recent entry by timestamp', () => {
    const result = deduplicate([
      { text: 'We decided to use TypeScript', timestamp: '2026-01-01' },
      { text: 'We decided to use TypeScript', timestamp: '2026-02-01' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.timestamp).toBe('2026-02-01');
  });

  it('keeps the later entry when no timestamps', () => {
    const result = deduplicate([
      { text: 'We decided to use TypeScript for the project codebase' },
      { text: 'We decided to use TypeScript for the project codebase now' },
    ]);
    expect(result).toHaveLength(1);
  });

  it('is idempotent', () => {
    const entries = [
      { text: 'Use TypeScript' },
      { text: 'Set up CI/CD' },
      { text: 'Use TypeScript for safety' },
    ];
    const first = deduplicate(entries);
    const second = deduplicate(first);
    expect(first).toEqual(second);
  });

  it('respects custom threshold', () => {
    const entries = [{ text: 'hello world foo' }, { text: 'hello world bar' }];
    // With threshold 1.0, only exact matches are deduped
    const strict = deduplicate(entries, 1.0);
    expect(strict).toHaveLength(2);

    // With threshold 0.0, everything dedupes
    const loose = deduplicate(entries, 0.0);
    expect(loose).toHaveLength(1);
  });
});
