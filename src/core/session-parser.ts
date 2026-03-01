import type { SessionData, SessionMessage } from '../models/index.js';
import { ParseError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('session-parser');

type SessionFormat = 'jsonl' | 'claude-code' | 'markdown' | 'auto';

export function parseSession(input: string, format: SessionFormat = 'auto'): SessionData {
  const detected = format === 'auto' ? detectFormat(input) : format;
  if (detected === 'claude-code') return parseClaudeCodeSession(input);
  return detected === 'jsonl' ? parseJsonlSession(input) : parseMarkdownSession(input);
}

export function detectFormat(input: string): 'jsonl' | 'claude-code' | 'markdown' {
  const firstLine = input.trimStart().split('\n')[0]?.trim() ?? '';
  if (!firstLine.startsWith('{')) return 'markdown';

  try {
    const parsed = JSON.parse(firstLine) as Record<string, unknown>;
    if (
      typeof parsed['type'] === 'string' &&
      [
        'user',
        'assistant',
        'queue-operation',
        'system',
        'progress',
        'file-history-snapshot',
      ].includes(parsed['type'])
    ) {
      return 'claude-code';
    }
  } catch {
    // Fall through to simple JSONL
  }

  return 'jsonl';
}

export function parseClaudeCodeSession(input: string): SessionData {
  const messages: SessionMessage[] = [];
  const lines = input.split('\n').filter((l) => l.trim().length > 0);

  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = JSON.parse(lines[i]!) as Record<string, unknown>;
      const lineType = parsed['type'];

      if (lineType !== 'user' && lineType !== 'assistant') continue;

      const message = parsed['message'] as Record<string, unknown> | undefined;
      if (!message) continue;

      const timestamp = typeof parsed['timestamp'] === 'string' ? parsed['timestamp'] : undefined;

      if (lineType === 'user') {
        if (typeof message['content'] !== 'string') continue;
        messages.push({
          role: 'human',
          content: message['content'],
          timestamp,
        });
      } else {
        const contentBlocks = message['content'];
        if (!Array.isArray(contentBlocks)) continue;

        const textParts: string[] = [];
        for (const block of contentBlocks) {
          if (
            typeof block === 'object' &&
            block !== null &&
            (block as Record<string, unknown>)['type'] === 'text' &&
            typeof (block as Record<string, unknown>)['text'] === 'string'
          ) {
            textParts.push((block as Record<string, unknown>)['text'] as string);
          }
        }

        if (textParts.length === 0) continue;

        messages.push({
          role: 'assistant',
          content: textParts.join('\n'),
          timestamp,
        });
      }
    } catch {
      logger.warn(`Skipping malformed Claude Code line ${i + 1}`);
    }
  }

  if (messages.length === 0 && lines.length > 0) {
    throw new ParseError(
      `No valid messages found in Claude Code session (${lines.length} lines scanned). ` +
        'The session file may use an unsupported format version.',
    );
  }

  return { messages };
}

export function parseJsonlSession(input: string): SessionData {
  const messages: SessionMessage[] = [];
  const lines = input.split('\n').filter((l) => l.trim().length > 0);

  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = JSON.parse(lines[i]!) as Record<string, unknown>;
      const role = parsed['role'];
      const content = parsed['content'];

      if (typeof role !== 'string' || typeof content !== 'string') {
        logger.warn(`Skipping malformed JSONL line ${i + 1}: missing role or content`);
        continue;
      }

      if (role !== 'human' && role !== 'assistant') {
        logger.warn(`Skipping JSONL line ${i + 1}: unknown role "${role}"`);
        continue;
      }

      messages.push({
        role,
        content,
        timestamp: typeof parsed['timestamp'] === 'string' ? parsed['timestamp'] : undefined,
      });
    } catch {
      logger.warn(`Skipping malformed JSONL line ${i + 1}`);
    }
  }

  if (messages.length === 0 && lines.length > 0) {
    throw new ParseError('No valid messages found in JSONL input');
  }

  return { messages };
}

export function parseMarkdownSession(input: string): SessionData {
  const messages: SessionMessage[] = [];
  const rolePattern = /^(Human|Assistant):\s*/i;

  let currentRole: 'human' | 'assistant' | null = null;
  let currentContent: string[] = [];

  for (const line of input.split('\n')) {
    const roleMatch = line.match(rolePattern);

    if (roleMatch) {
      if (currentRole !== null && currentContent.length > 0) {
        messages.push({
          role: currentRole,
          content: currentContent.join('\n').trim(),
        });
      }

      currentRole = roleMatch[1]!.toLowerCase() as 'human' | 'assistant';
      const remainder = line.slice(roleMatch[0].length);
      currentContent = remainder.length > 0 ? [remainder] : [];
    } else if (currentRole !== null) {
      currentContent.push(line);
    }
  }

  if (currentRole !== null && currentContent.length > 0) {
    messages.push({
      role: currentRole,
      content: currentContent.join('\n').trim(),
    });
  }

  return { messages };
}
