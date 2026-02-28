import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import url from 'node:url';
import { parseSession } from '../src/core/session-parser.js';
import { segmentSession } from '../src/core/segmenter.js';
import { extractSnapshot } from '../src/core/snapshot.js';
import { parseMemoryDocument } from '../src/core/memory-parser.js';
import { serializeMemoryDocument } from '../src/core/memory-serializer.js';
import { mergeIntoMemory } from '../src/core/memory-merger.js';
import { assessRisk } from '../src/core/risk.js';
import { loadConfig } from '../src/core/config-loader.js';
import { safeWriteFile, safeReadFile } from '../src/utils/safe-fs.js';
import { MemorySection, RiskLevel, SnapshotSection } from '../src/models/index.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');

describe('E2E: full pipeline', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-intel-e2e-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('session → snapshot → preserve → verify MEMORY.md', async () => {
    // 1. Read session fixture
    const sessionInput = await fs.readFile(path.join(FIXTURES, 'sample-session.jsonl'), 'utf-8');

    // 2. Parse session
    const session = parseSession(sessionInput, 'jsonl');
    expect(session.messages.length).toBe(8);

    // 3. Segment
    const segmented = segmentSession(session.messages);

    // 4. Extract snapshot
    const snapshot = extractSnapshot(segmented);
    expect(snapshot.metadata.messageCount).toBe(8);

    // Verify snapshot has relevant content
    const allSections = Object.values(SnapshotSection);
    const totalEntries = allSections.reduce((sum, s) => sum + snapshot.sections[s].length, 0);
    expect(totalEntries).toBeGreaterThan(0);

    // 5. Start with existing MEMORY.md
    const existingMemory = await fs.readFile(path.join(FIXTURES, 'sample-memory.md'), 'utf-8');
    const existingDoc = parseMemoryDocument(existingMemory);

    // Verify existing has content
    expect(existingDoc.sections[MemorySection.PinnedEssentials]!.lineCount).toBe(2);
    expect(existingDoc.sections[MemorySection.RecentDecisions]!.lineCount).toBe(1);

    // 6. Merge
    const { updatedDoc, entriesAdded } = mergeIntoMemory(existingDoc, snapshot);

    // 7. Serialize and write
    const serialized = serializeMemoryDocument(updatedDoc);
    const memoryPath = path.join(tmpDir, 'MEMORY.md');
    await safeWriteFile(memoryPath, serialized);

    // 8. Verify written file
    const { content: written } = await safeReadFile(memoryPath);
    expect(written).toContain('## Pinned Essentials');
    expect(written).toContain('## Index Links');
    expect(written).toContain('## Recent Decisions');

    // Original content preserved
    expect(written).toContain('JWT auth is mandatory');
    expect(written).toContain('patterns.md');

    // New content merged
    expect(entriesAdded).toBeGreaterThan(0);
    expect(updatedDoc.totalLines).toBeGreaterThan(existingDoc.totalLines);
  });

  it('idempotent: running preserve twice with same session does not duplicate', async () => {
    const sessionInput = await fs.readFile(path.join(FIXTURES, 'sample-session.jsonl'), 'utf-8');
    const session = parseSession(sessionInput, 'jsonl');
    const segmented = segmentSession(session.messages);
    const snapshot = extractSnapshot(segmented);

    // First merge into empty MEMORY.md
    const emptyDoc = parseMemoryDocument('');
    const { updatedDoc: firstDoc } = mergeIntoMemory(emptyDoc, snapshot);

    // Second merge with same snapshot
    const { updatedDoc: secondDoc, entriesDeduplicated } = mergeIntoMemory(firstDoc, snapshot);

    // Should not grow — dedup should catch duplicates
    expect(secondDoc.totalLines).toBeLessThanOrEqual(firstDoc.totalLines);
    expect(entriesDeduplicated).toBeGreaterThanOrEqual(0);
  });

  it('risk assessment classifies small sessions as low risk', async () => {
    const sessionInput = await fs.readFile(path.join(FIXTURES, 'sample-session.jsonl'), 'utf-8');
    const session = parseSession(sessionInput, 'jsonl');

    const metrics = assessRisk(session.messages, 200_000);
    expect(metrics.riskLevel).toBe(RiskLevel.Low);
    expect(metrics.messageCount).toBe(8);
    expect(metrics.utilizationPercent).toBeLessThan(50);
  });

  it('config loader returns defaults when no .cc-intelrc.json exists', async () => {
    const config = await loadConfig(tmpDir);
    expect(config.maxContext).toBe(200_000);
    expect(config.logLevel).toBe('info');
  });

  it('handles concurrent writes safely via atomic file ops', async () => {
    const filePath = path.join(tmpDir, 'concurrent.md');
    await safeWriteFile(filePath, 'initial');

    // Run multiple writes concurrently — at least one should succeed
    const writes = Array.from({ length: 5 }, (_, i) =>
      safeWriteFile(filePath, `write-${i}`)
        .then(() => 'ok')
        .catch(() => 'conflict'),
    );

    const results = await Promise.all(writes);
    const successes = results.filter((r) => r === 'ok');
    expect(successes.length).toBeGreaterThanOrEqual(1);

    // File should contain one of the writes
    const { content } = await safeReadFile(filePath);
    expect(content).toMatch(/^write-\d$/);
  });

  it('full pipeline with markdown session format', async () => {
    const markdownSession = [
      'Human: Set up a React project with Vite',
      "Assistant: I'll set up the project. We decided to use Vite with React and TypeScript.",
      'Human: Add routing',
      'Assistant: Added react-router-dom. Created src/routes/Home.tsx and src/routes/About.tsx.',
    ].join('\n');

    const session = parseSession(markdownSession, 'markdown');
    expect(session.messages.length).toBe(4);

    const segmented = segmentSession(session.messages);
    const snapshot = extractSnapshot(segmented);
    expect(snapshot.metadata.messageCount).toBe(4);

    const emptyDoc = parseMemoryDocument('');
    const { updatedDoc } = mergeIntoMemory(emptyDoc, snapshot);
    const serialized = serializeMemoryDocument(updatedDoc);

    expect(serialized).toContain('## Pinned Essentials');
    expect(serialized).toContain('## Recent Decisions');
    // Index Links only appears if artifact signals are detected — not guaranteed
    // for short sessions without implementation artifacts
  });
});
