import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseSession,
  detectFormat,
  parseJsonlSession,
  parseMarkdownSession,
  parseClaudeCodeSession,
} from '../session-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../../test/fixtures');

describe('detectFormat', () => {
  it('detects simple JSONL', () => {
    expect(detectFormat('{"role":"human","content":"hi"}\n')).toBe('jsonl');
  });

  it('detects markdown', () => {
    expect(detectFormat('Human: Hello\nAssistant: Hi\n')).toBe('markdown');
  });

  it('handles leading whitespace', () => {
    expect(detectFormat('  {"role":"human","content":"hi"}')).toBe('jsonl');
  });

  it('detects native Claude Code format (user type)', () => {
    const line = '{"type":"user","message":{"role":"user","content":"hello"},"version":"2.1.49"}';
    expect(detectFormat(line)).toBe('claude-code');
  });

  it('detects native Claude Code format (system type)', () => {
    const line = '{"type":"system","message":{"role":"system","content":"init"}}';
    expect(detectFormat(line)).toBe('claude-code');
  });

  it('detects native Claude Code format (queue-operation)', () => {
    const line = '{"type":"queue-operation","operation":"enqueue","taskId":"t1"}';
    expect(detectFormat(line)).toBe('claude-code');
  });
});

describe('parseClaudeCodeSession', () => {
  it('parses user text messages', () => {
    const input = [
      '{"type":"user","message":{"role":"user","content":"Hello"},"timestamp":"2026-01-01T00:00:00Z"}',
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi there"}]},"timestamp":"2026-01-01T00:00:01Z"}',
    ].join('\n');

    const session = parseClaudeCodeSession(input);
    expect(session.messages).toHaveLength(2);
    expect(session.messages[0]!.role).toBe('human');
    expect(session.messages[0]!.content).toBe('Hello');
    expect(session.messages[1]!.role).toBe('assistant');
    expect(session.messages[1]!.content).toBe('Hi there');
  });

  it('preserves timestamps', () => {
    const input =
      '{"type":"user","message":{"role":"user","content":"Hi"},"timestamp":"2026-01-01T00:00:00Z"}';
    const session = parseClaudeCodeSession(input);
    expect(session.messages[0]!.timestamp).toBe('2026-01-01T00:00:00Z');
  });

  it('skips user messages with array content (tool results)', () => {
    const input = [
      '{"type":"user","message":{"role":"user","content":"Hello"}}',
      '{"type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"ok"}]}}',
    ].join('\n');

    const session = parseClaudeCodeSession(input);
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]!.content).toBe('Hello');
  });

  it('extracts text from assistant content blocks', () => {
    const input = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'First paragraph.' },
          { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'foo.ts' } },
          { type: 'text', text: 'Second paragraph.' },
        ],
      },
    });

    const session = parseClaudeCodeSession(input);
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]!.content).toBe('First paragraph.\nSecond paragraph.');
  });

  it('skips assistant messages with only tool_use blocks', () => {
    const input = [
      '{"type":"user","message":{"role":"user","content":"Hello"}}',
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'foo.ts' } }],
        },
      }),
    ].join('\n');

    const session = parseClaudeCodeSession(input);
    // Only the user message survives; tool_use-only assistant is skipped
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]!.role).toBe('human');
  });

  it('skips non-message line types', () => {
    const input = [
      '{"type":"system","message":{"role":"system","content":"init"}}',
      '{"type":"queue-operation","operation":"enqueue","taskId":"t1"}',
      '{"type":"progress","data":{"percent":50}}',
      '{"type":"user","message":{"role":"user","content":"Hello"}}',
    ].join('\n');

    const session = parseClaudeCodeSession(input);
    expect(session.messages).toHaveLength(1);
  });

  it('skips malformed lines gracefully', () => {
    const input = [
      'not json at all',
      '{"type":"user","message":{"role":"user","content":"Hello"}}',
      '{"type":"assistant"}',
      '{"type":"assistant","message":{}}',
    ].join('\n');

    const session = parseClaudeCodeSession(input);
    expect(session.messages).toHaveLength(1);
  });

  it('throws ParseError when no valid messages found in non-empty input', () => {
    const input = [
      '{"type":"system","message":{"role":"system","content":"init"}}',
      '{"type":"queue-operation","operation":"enqueue"}',
    ].join('\n');

    expect(() => parseClaudeCodeSession(input)).toThrow('No valid messages');
  });

  it('parses fixture file correctly', async () => {
    const content = await fs.readFile(path.join(fixturesDir, 'native-session.jsonl'), 'utf-8');
    const session = parseClaudeCodeSession(content);

    // Should extract: 3 user text messages + 4 assistant messages with text
    // Lines: system(skip), user, assistant, user, assistant(text+tool_use), user(tool_result skip),
    //        assistant(tool_use only skip), user(tool_result skip), queue-op(skip),
    //        assistant(text), user, assistant(text)
    expect(session.messages.length).toBeGreaterThanOrEqual(5);

    // First user message
    expect(session.messages[0]!.role).toBe('human');
    expect(session.messages[0]!.content).toContain('REST API');

    // Check that tool results were skipped (no tool_result content in messages)
    const allContent = session.messages.map((m) => m.content).join(' ');
    expect(allContent).not.toContain('tool_result');
    expect(allContent).not.toContain('File written successfully');
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
  it('auto-detects simple JSONL format', () => {
    const input = '{"role":"human","content":"test"}\n';
    const session = parseSession(input);
    expect(session.messages).toHaveLength(1);
  });

  it('auto-detects markdown format', () => {
    const input = 'Human: test\nAssistant: response\n';
    const session = parseSession(input);
    expect(session.messages).toHaveLength(2);
  });

  it('auto-detects native Claude Code format', () => {
    const input = [
      '{"type":"user","message":{"role":"user","content":"test"}}',
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"response"}]}}',
    ].join('\n');
    const session = parseSession(input);
    expect(session.messages).toHaveLength(2);
    expect(session.messages[0]!.role).toBe('human');
    expect(session.messages[1]!.role).toBe('assistant');
  });

  it('respects explicit format', () => {
    const input = 'Human: test\n';
    const session = parseSession(input, 'markdown');
    expect(session.messages).toHaveLength(1);
  });
});
