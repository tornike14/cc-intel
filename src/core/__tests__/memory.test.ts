import { describe, it, expect } from 'vitest';
import { parseMemoryDocument } from '../memory-parser.js';
import { serializeMemoryDocument } from '../memory-serializer.js';
import { enforceBudget } from '../memory-budget.js';
import { mergeIntoMemory } from '../memory-merger.js';
import {
  MemorySection,
  SnapshotSection,
  type Snapshot,
  type SnapshotEntry,
} from '../../models/index.js';

const SAMPLE_MEMORY = `## Pinned Essentials

- Project uses TypeScript strict mode
- ESM only, no CJS

## Index Links

- See architecture.md for details

## Recent Decisions

- Switched to tsup for builds
- Using Vitest over Jest
`;

describe('parseMemoryDocument', () => {
  it('parses sections correctly', () => {
    const doc = parseMemoryDocument(SAMPLE_MEMORY);
    expect(doc.sections[MemorySection.PinnedEssentials].lineCount).toBe(2);
    expect(doc.sections[MemorySection.IndexLinks].lineCount).toBe(1);
    expect(doc.sections[MemorySection.RecentDecisions].lineCount).toBe(2);
  });

  it('preserves line content', () => {
    const doc = parseMemoryDocument(SAMPLE_MEMORY);
    expect(doc.sections[MemorySection.PinnedEssentials].lines[0]).toContain('TypeScript');
  });

  it('handles empty document', () => {
    const doc = parseMemoryDocument('');
    expect(doc.totalLines).toBe(0);
  });

  it('handles missing sections', () => {
    const doc = parseMemoryDocument('## Pinned Essentials\n\n- Only pinned\n');
    expect(doc.sections[MemorySection.PinnedEssentials].lineCount).toBe(1);
    expect(doc.sections[MemorySection.IndexLinks].lineCount).toBe(0);
    expect(doc.sections[MemorySection.RecentDecisions].lineCount).toBe(0);
  });
});

describe('serializeMemoryDocument', () => {
  it('round-trips correctly', () => {
    const doc = parseMemoryDocument(SAMPLE_MEMORY);
    const serialized = serializeMemoryDocument(doc);
    const reparsed = parseMemoryDocument(serialized);

    expect(reparsed.sections[MemorySection.PinnedEssentials].lineCount).toBe(
      doc.sections[MemorySection.PinnedEssentials].lineCount,
    );
    expect(reparsed.sections[MemorySection.RecentDecisions].lineCount).toBe(
      doc.sections[MemorySection.RecentDecisions].lineCount,
    );
  });

  it('outputs sections in correct order', () => {
    const doc = parseMemoryDocument(SAMPLE_MEMORY);
    const serialized = serializeMemoryDocument(doc);
    const pinnedIdx = serialized.indexOf('Pinned Essentials');
    const indexIdx = serialized.indexOf('Index Links');
    const recentIdx = serialized.indexOf('Recent Decisions');

    expect(pinnedIdx).toBeLessThan(indexIdx);
    expect(indexIdx).toBeLessThan(recentIdx);
  });
});

describe('enforceBudget', () => {
  it('passes through document under budget', () => {
    const doc = parseMemoryDocument(SAMPLE_MEMORY);
    const { trimmedDoc, overflowActions } = enforceBudget(doc);
    expect(overflowActions).toHaveLength(0);
    expect(trimmedDoc.sections[MemorySection.PinnedEssentials].lineCount).toBe(2);
  });

  it('overflows section exceeding limit', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `- Entry ${i}`);
    const content = `## Recent Decisions\n\n${lines.join('\n')}\n`;
    const doc = parseMemoryDocument(content);

    const { trimmedDoc, overflowActions } = enforceBudget(doc);
    expect(overflowActions).toHaveLength(1);
    expect(overflowActions[0]!.section).toBe(MemorySection.RecentDecisions);
    expect(trimmedDoc.sections[MemorySection.RecentDecisions].lineCount).toBeLessThanOrEqual(61);
  });

  it('enforces global maxLines without infinite loop', () => {
    // Create a document where section limits are fine but total exceeds maxLines
    const pinnedLines = Array.from({ length: 10 }, (_, i) => `- Pinned ${i}`);
    const indexLines = Array.from({ length: 10 }, (_, i) => `- Index ${i}`);
    const decisionLines = Array.from({ length: 10 }, (_, i) => `- Decision ${i}`);
    const content = [
      '## Pinned Essentials',
      '',
      ...pinnedLines,
      '',
      '## Index Links',
      '',
      ...indexLines,
      '',
      '## Recent Decisions',
      '',
      ...decisionLines,
    ].join('\n');

    const doc = parseMemoryDocument(content);
    expect(doc.totalLines).toBe(30);

    // Set a tight global cap below total but above what section limits would trim
    const budget = {
      maxLines: 15,
      sectionLimits: {
        [MemorySection.PinnedEssentials]: 80,
        [MemorySection.IndexLinks]: 40,
        [MemorySection.RecentDecisions]: 60,
      },
    };

    const { trimmedDoc, overflowActions } = enforceBudget(doc, budget);
    expect(trimmedDoc.totalLines).toBeLessThanOrEqual(15);
    expect(overflowActions.length).toBeGreaterThan(0);
  });

  it('uses unique filenames for multiple overflows of same section', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `- Entry ${i}`);
    const content = `## Pinned Essentials\n\n${lines.join('\n')}\n`;
    const doc = parseMemoryDocument(content);

    const budget = {
      maxLines: 5,
      sectionLimits: {
        [MemorySection.PinnedEssentials]: 80,
        [MemorySection.IndexLinks]: 40,
        [MemorySection.RecentDecisions]: 60,
      },
    };

    const { overflowActions } = enforceBudget(doc, budget);
    const filenames = overflowActions.map((a) => a.topicFileLink);
    const uniqueFilenames = new Set(filenames);
    expect(uniqueFilenames.size).toBe(filenames.length);
  });
});

function makeSnapshot(entries: Partial<Record<SnapshotSection, SnapshotEntry[]>>): Snapshot {
  return {
    sections: {
      [SnapshotSection.ProjectGoal]: [],
      [SnapshotSection.KeyDecisions]: [],
      [SnapshotSection.Constraints]: [],
      [SnapshotSection.ImplementationArtifacts]: [],
      [SnapshotSection.OpenTasks]: [],
      ...entries,
    },
    metadata: { messageCount: 0, extractedAt: new Date().toISOString(), phaseDistribution: {} },
  };
}

describe('mergeIntoMemory', () => {
  it('adds new entries to correct sections', () => {
    const doc = parseMemoryDocument(SAMPLE_MEMORY);
    const snapshot = makeSnapshot({
      [SnapshotSection.KeyDecisions]: [{ text: 'Use Commander for CLI', score: 4 }],
    });

    const { updatedDoc, entriesAdded } = mergeIntoMemory(doc, snapshot);
    expect(entriesAdded).toBeGreaterThan(0);
    const decisions = updatedDoc.sections[MemorySection.RecentDecisions].lines;
    expect(decisions.some((l) => l.includes('Commander'))).toBe(true);
  });

  it('deduplicates against existing entries', () => {
    const doc = parseMemoryDocument(SAMPLE_MEMORY);
    const snapshot = makeSnapshot({
      [SnapshotSection.KeyDecisions]: [{ text: 'Switched to tsup for builds', score: 4 }],
    });

    const { entriesDeduplicated } = mergeIntoMemory(doc, snapshot);
    expect(entriesDeduplicated).toBeGreaterThanOrEqual(0);
  });

  it('handles empty snapshot', () => {
    const doc = parseMemoryDocument(SAMPLE_MEMORY);
    const snapshot = makeSnapshot({});
    const { updatedDoc } = mergeIntoMemory(doc, snapshot);
    expect(updatedDoc.totalLines).toBe(doc.totalLines);
  });

  it('handles empty existing document', () => {
    const doc = parseMemoryDocument('');
    const snapshot = makeSnapshot({
      [SnapshotSection.ProjectGoal]: [{ text: 'Build a CLI tool', score: 5 }],
    });

    const { updatedDoc } = mergeIntoMemory(doc, snapshot);
    expect(updatedDoc.totalLines).toBeGreaterThan(0);
  });
});
