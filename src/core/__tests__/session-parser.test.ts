import { describe, it, expect } from 'vitest';
import {
  parseSession,
  detectFormat,
  parseJsonlSession,
  parseMarkdownSession,
} from '../session-parser.js';

describe('detectFormat', () => {
  it('detects JSONL', () => {
    expect(detectFormat('{"role":"human","content":"hi"}\n')).toBe('jsonl');
  });

  it('detects markdown', () => {
    expect(detectFormat('Human: Hello\nAssistant: Hi\n')).toBe('markdown');
  });

  it('handles leading whitespace', () => {
    expect(detectFormat('  {"role":"human","content":"hi"}')).toBe('jsonl');
  });
});

describe('parseJsonlSession', () => {
  it('parses valid JSONL', () => {
    const input = [
      '{"role":"human","content":"Hello"}',
      '{"role":"assistant","content":"Hi there"}',
    ].join('\n');

    const session = parseJsonlSession(input);
    expect(session.messages).toHaveLength(2);
    expect(session.messages[0]!.role).toBe('human');
    expect(session.messages[0]!.content).toBe('Hello');
    expect(session.messages[1]!.role).toBe('assistant');
  });

  it('preserves timestamps', () => {
    const input = '{"role":"human","content":"Hi","timestamp":"2026-01-01T00:00:00Z"}\n';
    const session = parseJsonlSession(input);
    expect(session.messages[0]!.timestamp).toBe('2026-01-01T00:00:00Z');
  });

  it('skips malformed lines without crashing', () => {
    const input = [
      '{"role":"human","content":"Hello"}',
      'not json at all',
      '{"role":"assistant","content":"World"}',
    ].join('\n');

    const session = parseJsonlSession(input);
    expect(session.messages).toHaveLength(2);
  });

  it('skips lines with unknown roles', () => {
    const input = '{"role":"system","content":"prompt"}\n{"role":"human","content":"Hi"}\n';
    const session = parseJsonlSession(input);
    expect(session.messages).toHaveLength(1);
  });

  it('returns empty session for empty input', () => {
    const session = parseJsonlSession('');
    expect(session.messages).toHaveLength(0);
  });
});

describe('parseMarkdownSession', () => {
  it('parses role markers', () => {
    const input = 'Human: Hello world\nAssistant: Hi there\n';
    const session = parseMarkdownSession(input);
    expect(session.messages).toHaveLength(2);
    expect(session.messages[0]!.role).toBe('human');
    expect(session.messages[0]!.content).toBe('Hello world');
  });

  it('handles multi-line messages', () => {
    const input = 'Human: First line\nSecond line\nThird line\nAssistant: Response\n';
    const session = parseMarkdownSession(input);
    expect(session.messages[0]!.content).toContain('Second line');
    expect(session.messages[0]!.content).toContain('Third line');
  });

  it('returns empty for empty input', () => {
    const session = parseMarkdownSession('');
    expect(session.messages).toHaveLength(0);
  });
});

describe('parseSession', () => {
  it('auto-detects JSONL format', () => {
    const input = '{"role":"human","content":"test"}\n';
    const session = parseSession(input);
    expect(session.messages).toHaveLength(1);
  });

  it('auto-detects markdown format', () => {
    const input = 'Human: test\nAssistant: response\n';
    const session = parseSession(input);
    expect(session.messages).toHaveLength(2);
  });

  it('respects explicit format', () => {
    const input = 'Human: test\n';
    const session = parseSession(input, 'markdown');
    expect(session.messages).toHaveLength(1);
  });
});
