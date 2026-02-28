import type { SessionData, SessionMessage } from '../models/index.js';
import { ParseError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('session-parser');

type SessionFormat = 'jsonl' | 'markdown' | 'auto';

export function parseSession(input: string, format: SessionFormat = 'auto'): SessionData {
  const detected = format === 'auto' ? detectFormat(input) : format;
  return detected === 'jsonl' ? parseJsonlSession(input) : parseMarkdownSession(input);
}

export function detectFormat(input: string): 'jsonl' | 'markdown' {
  const firstLine = input.trimStart().split('\n')[0]?.trim() ?? '';
  return firstLine.startsWith('{') ? 'jsonl' : 'markdown';
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
      // Flush previous message
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

  // Flush last message
  if (currentRole !== null && currentContent.length > 0) {
    messages.push({
      role: currentRole,
      content: currentContent.join('\n').trim(),
    });
  }

  return { messages };
}
