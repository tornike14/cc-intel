import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { safeWriteFile } from '../../utils/safe-fs.js';
import { parseMemoryDocument } from '../../core/memory-parser.js';
import { MemorySection, DEFAULT_MEMORY_BUDGET } from '../../models/index.js';

describe('status helpers', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-intel-status-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('parses MEMORY.md and reports correct line counts', async () => {
    const memoryPath = path.join(tmpDir, 'MEMORY.md');
    const content = [
      '## Pinned Essentials',
      '',
      '- Line 1',
      '- Line 2',
      '- Line 3',
      '',
      '## Index Links',
      '',
      '- Link 1',
      '',
      '## Recent Decisions',
      '',
      '- Decision 1',
      '- Decision 2',
      '',
    ].join('\n');

    await safeWriteFile(memoryPath, content);
    const snapshot = await fs.readFile(memoryPath, 'utf-8');
    const doc = parseMemoryDocument(snapshot);

    expect(doc.sections[MemorySection.PinnedEssentials].lineCount).toBe(3);
    expect(doc.sections[MemorySection.IndexLinks].lineCount).toBe(1);
    expect(doc.sections[MemorySection.RecentDecisions].lineCount).toBe(2);
    expect(doc.totalLines).toBe(6);
  });

  it('computes budget percentages correctly', () => {
    const budget = DEFAULT_MEMORY_BUDGET;
    const lineCount = 40;
    const limit = budget.sectionLimits[MemorySection.PinnedEssentials];
    const percent = Math.round((lineCount / limit) * 100);
    expect(percent).toBe(50);
  });
});
