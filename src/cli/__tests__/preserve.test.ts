import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseSession } from '../../core/session-parser.js';
import { segmentSession } from '../../core/segmenter.js';
import { extractSnapshot } from '../../core/snapshot.js';
import { parseMemoryDocument } from '../../core/memory-parser.js';
import { serializeMemoryDocument } from '../../core/memory-serializer.js';
import { mergeIntoMemory } from '../../core/memory-merger.js';
import { safeWriteFile, safeReadFile } from '../../utils/safe-fs.js';

describe('preserve integration', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-intel-preserve-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates MEMORY.md from session data', async () => {
    const sessionInput = [
      '{"role":"human","content":"We decided to use TypeScript for type safety"}',
      '{"role":"assistant","content":"Good choice. TODO: add linting configuration"}',
    ].join('\n');

    const session = parseSession(sessionInput);
    const segmented = segmentSession(session.messages);
    const snapshot = extractSnapshot(segmented);

    const emptyDoc = parseMemoryDocument('');
    const { updatedDoc } = mergeIntoMemory(emptyDoc, snapshot);
    const serialized = serializeMemoryDocument(updatedDoc);

    const memoryPath = path.join(tmpDir, 'MEMORY.md');
    await safeWriteFile(memoryPath, serialized);

    const written = await fs.readFile(memoryPath, 'utf-8');
    expect(written).toContain('Pinned Essentials');
    expect(written).toContain('Recent Decisions');
  });

  it('merges into existing MEMORY.md without duplicates', async () => {
    const memoryPath = path.join(tmpDir, 'MEMORY.md');
    const initialContent = [
      '## Pinned Essentials',
      '',
      '- Project uses TypeScript strict mode',
      '',
      '## Index Links',
      '',
      '## Recent Decisions',
      '',
      '- Switched to tsup for builds',
      '',
    ].join('\n');

    await safeWriteFile(memoryPath, initialContent);

    const sessionInput =
      '{"role":"assistant","content":"We decided to use ESM. TODO: update docs"}';
    const session = parseSession(sessionInput);
    const segmented = segmentSession(session.messages);
    const snapshot = extractSnapshot(segmented);

    const { content, mtime } = await safeReadFile(memoryPath);
    const existingDoc = parseMemoryDocument(content);
    const { updatedDoc } = mergeIntoMemory(existingDoc, snapshot);
    const serialized = serializeMemoryDocument(updatedDoc);

    await safeWriteFile(memoryPath, serialized, mtime);

    const written = await fs.readFile(memoryPath, 'utf-8');
    expect(written).toContain('TypeScript strict mode');
    expect(written).toContain('tsup');
  });

  it('creates backup before write', async () => {
    const memoryPath = path.join(tmpDir, 'MEMORY.md');
    await safeWriteFile(memoryPath, 'original content');

    const { mtime } = await safeReadFile(memoryPath);
    await safeWriteFile(memoryPath, 'updated content', mtime);

    const backup = await fs.readFile(memoryPath + '.bak', 'utf-8');
    expect(backup).toBe('original content');
  });
});
