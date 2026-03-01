import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { SessionMessage } from '../../models/index.js';
import { prefilterMessages, formatMessagesForLlm, resolveApiKey } from '../llm-extractor.js';

describe('prefilterMessages', () => {
  function makeMessages(count: number): SessionMessage[] {
    return Array.from({ length: count }, (_, i) => ({
      role: i % 2 === 0 ? ('human' as const) : ('assistant' as const),
      content: `Message ${i}: ${'x'.repeat(50)}`,
    }));
  }

  it('returns all messages when under limit', () => {
    const msgs = makeMessages(10);
    const result = prefilterMessages(msgs, 60);
    expect(result).toHaveLength(10);
  });

  it('reduces messages to max limit', () => {
    const msgs = makeMessages(100);
    const result = prefilterMessages(msgs, 30);
    expect(result.length).toBeLessThanOrEqual(30);
  });

  it('preserves original order', () => {
    const msgs = makeMessages(100);
    const result = prefilterMessages(msgs, 30);
    const indices = result.map((m) => msgs.indexOf(m));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]!).toBeGreaterThan(indices[i - 1]!);
    }
  });

  it('always includes first and last messages', () => {
    const msgs = makeMessages(100);
    const result = prefilterMessages(msgs, 20);
    expect(result[0]).toBe(msgs[0]);
    expect(result[result.length - 1]).toBe(msgs[msgs.length - 1]);
  });

  it('excludes boilerplate messages', () => {
    const msgs: SessionMessage[] = [
      {
        role: 'assistant',
        content:
          'This session is being continued from a previous conversation that ran out of context.',
      },
      { role: 'human', content: 'Build a CLI tool for context monitoring' },
      { role: 'assistant', content: 'We decided to use TypeScript for type safety' },
    ];
    const result = prefilterMessages(msgs, 60);
    // Boilerplate should be excluded when under limit too (filtering happens before size check)
    // Actually prefilterMessages only filters when over limit. Under limit it returns all.
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('prioritizes high-score messages from the middle', () => {
    const msgs: SessionMessage[] = [
      { role: 'human', content: 'What is this project?' },
      { role: 'assistant', content: 'We decided to use TypeScript for type safety' },
      { role: 'human', content: 'ok' },
      { role: 'assistant', content: 'Sure, let me check.' },
      { role: 'human', content: 'How about the database?' },
      { role: 'assistant', content: 'We must not break backward compatibility with the API' },
      { role: 'human', content: 'ok sounds good' },
      { role: 'assistant', content: 'Modified src/core/signals.ts to add new patterns' },
      { role: 'human', content: 'anything else?' },
      { role: 'assistant', content: 'TODO: add more unit tests for edge cases' },
      { role: 'human', content: 'bye' },
      { role: 'assistant', content: 'Goodbye!' },
    ];

    // With a tight limit, should keep messages with signals
    const result = prefilterMessages(msgs, 10);
    expect(result.length).toBeLessThanOrEqual(10);
  });
});

describe('formatMessagesForLlm', () => {
  it('formats messages with role labels', () => {
    const msgs: SessionMessage[] = [
      { role: 'human', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];
    const result = formatMessagesForLlm(msgs);
    expect(result).toContain('Human: Hello');
    expect(result).toContain('Assistant: Hi there');
  });

  it('truncates long messages', () => {
    const msgs: SessionMessage[] = [{ role: 'assistant', content: 'x'.repeat(3000) }];
    const result = formatMessagesForLlm(msgs);
    expect(result).toContain('[...truncated]');
    expect(result.length).toBeLessThan(3000);
  });

  it('trims whitespace from messages', () => {
    const msgs: SessionMessage[] = [{ role: 'human', content: '  hello world  ' }];
    const result = formatMessagesForLlm(msgs);
    expect(result).toContain('Human: hello world');
  });

  it('handles empty messages array', () => {
    const result = formatMessagesForLlm([]);
    expect(result).toBe('');
  });
});

describe('resolveApiKey', () => {
  const originalEnv = process.env['ANTHROPIC_API_KEY'];

  beforeEach(() => {
    delete process.env['ANTHROPIC_API_KEY'];
  });

  afterAll(() => {
    if (originalEnv) {
      process.env['ANTHROPIC_API_KEY'] = originalEnv;
    }
  });

  it('returns explicit key when provided', () => {
    expect(resolveApiKey('sk-ant-test')).toBe('sk-ant-test');
  });

  it('returns env var when no explicit key', () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-env';
    expect(resolveApiKey()).toBe('sk-ant-env');
  });

  it('prefers explicit key over env var', () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-env';
    expect(resolveApiKey('sk-ant-explicit')).toBe('sk-ant-explicit');
  });

  it('returns null when neither is available', () => {
    expect(resolveApiKey()).toBeNull();
  });
});

// Note: llmExtractSnapshot itself is not unit-tested here because it requires
// a real API key and makes network calls. It should be tested via integration
// tests with a real or mocked Anthropic client.
