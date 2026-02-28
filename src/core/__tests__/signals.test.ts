import { describe, it, expect } from 'vitest';
import { detectSignals, scoreMessage } from '../signals.js';
import { SignalCategory, DEFAULT_SIGNAL_WEIGHTS } from '../../models/index.js';

describe('detectSignals', () => {
  it('detects decision signals', () => {
    const matches = detectSignals('We decided to use TypeScript for the project');
    const decisions = matches.filter((m) => m.category === SignalCategory.Decision);
    expect(decisions.length).toBeGreaterThan(0);
  });

  it('detects constraint signals', () => {
    const matches = detectSignals('This must not break backward compatibility');
    const constraints = matches.filter((m) => m.category === SignalCategory.Constraint);
    expect(constraints.length).toBeGreaterThan(0);
  });

  it('detects artifact signals - file paths', () => {
    const matches = detectSignals('Modified src/core/signals.ts to add patterns');
    const artifacts = matches.filter((m) => m.category === SignalCategory.Artifact);
    expect(artifacts.length).toBeGreaterThan(0);
  });

  it('detects artifact signals - code blocks', () => {
    const matches = detectSignals('Use this: ```const x = 1;```');
    const artifacts = matches.filter((m) => m.category === SignalCategory.Artifact);
    expect(artifacts.length).toBeGreaterThan(0);
  });

  it('detects todo signals', () => {
    const matches = detectSignals('TODO: add validation for edge cases');
    const todos = matches.filter((m) => m.category === SignalCategory.Todo);
    expect(todos.length).toBeGreaterThan(0);
  });

  it('returns empty array for plain text', () => {
    const matches = detectSignals('Hello, how are you today?');
    expect(matches.length).toBe(0);
  });

  it('returns empty array for empty input', () => {
    const matches = detectSignals('');
    expect(matches.length).toBe(0);
  });

  it('uses custom weights', () => {
    const weights = { ...DEFAULT_SIGNAL_WEIGHTS, [SignalCategory.Decision]: 10 };
    const matches = detectSignals('We decided to use TypeScript', weights);
    const decisions = matches.filter((m) => m.category === SignalCategory.Decision);
    for (const d of decisions) {
      expect(d.weight).toBe(10);
    }
  });

  it('detects multiple signal types in one text', () => {
    const text =
      'We decided to use src/core/signals.ts because it is required. TODO: add more tests';
    const matches = detectSignals(text);
    const categories = new Set(matches.map((m) => m.category));
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });
});

describe('scoreMessage', () => {
  it('computes importance score from signal weights', () => {
    const scored = scoreMessage({
      role: 'assistant',
      content: 'We decided to use TypeScript. It is required for type safety.',
    });
    expect(scored.importanceScore).toBeGreaterThan(0);
    expect(scored.signals.length).toBeGreaterThan(0);
  });

  it('returns zero score for plain text', () => {
    const scored = scoreMessage({
      role: 'human',
      content: 'Can you help me with something?',
    });
    expect(scored.importanceScore).toBe(0);
    expect(scored.signals).toHaveLength(0);
  });

  it('preserves message fields', () => {
    const scored = scoreMessage({
      role: 'assistant',
      content: 'We decided to use ESM',
      timestamp: '2026-01-01T00:00:00Z',
    });
    expect(scored.role).toBe('assistant');
    expect(scored.content).toBe('We decided to use ESM');
    expect(scored.timestamp).toBe('2026-01-01T00:00:00Z');
  });

  it('scores artifacts higher than decisions', () => {
    const artifactMessage = scoreMessage({
      role: 'assistant',
      content: 'Modified src/core/signals.ts and src/utils/text.ts',
    });
    const decisionMessage = scoreMessage({
      role: 'assistant',
      content: 'We decided to use TypeScript',
    });
    expect(artifactMessage.importanceScore).toBeGreaterThanOrEqual(decisionMessage.importanceScore);
  });
});
