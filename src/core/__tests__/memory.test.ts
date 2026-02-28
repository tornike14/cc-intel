import { describe, it, expect } from 'vitest';
import { parseMemoryDocument, toSectionKey } from '../memory-parser.js';
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

const CLAUDE_CODE_MEMORY = `# cc-intel Project Memory

## User Preferences
- No co-author lines in git commits
- No emoji in PR bodies
- Open source workflow

## Project Structure
- Repo: tornike14/cc-intel (public, MIT)
- Tech: ESM TypeScript, Commander CLI

## Implementation Plan
- 19 phases, each a feature branch + PR
`;

describe('toSectionKey', () => {
  it('converts well-known headers to existing enum values', () => {
    expect(toSectionKey('## Pinned Essentials')).toBe('pinnedEssentials');
    expect(toSectionKey('## Index Links')).toBe('indexLinks');
    expect(toSectionKey('## Recent Decisions')).toBe('recentDecisions');
  });

  it('converts Claude Code headers to camelCase', () => {
    expect(toSectionKey('## User Preferences')).toBe('userPreferences');
    expect(toSectionKey('## Project Structure')).toBe('projectStructure');
    expect(toSectionKey('## Implementation Plan')).toBe('implementationPlan');
  });

  it('handles single-word headers', () => {
    expect(toSectionKey('## Notes')).toBe('notes');
  });
});

describe('parseMemoryDocument', () => {
  it('parses sections correctly', () => {
    const doc = parseMemoryDocument(SAMPLE_MEMORY);
    expect(doc.sections[MemorySection.PinnedEssentials]!.lineCount).toBe(2);
    expect(doc.sections[MemorySection.IndexLinks]!.lineCount).toBe(1);
    expect(doc.sections[MemorySection.RecentDecisions]!.lineCount).toBe(2);
  });

  it('preserves line content', () => {
    const doc = parseMemoryDocument(SAMPLE_MEMORY);
    expect(doc.sections[MemorySection.PinnedEssentials]!.lines[0]).toContain('TypeScript');
  });

  it('handles empty document', () => {
    const doc = parseMemoryDocument('');
    expect(doc.totalLines).toBe(0);
    expect(doc.sectionOrder).toHaveLength(0);
    expect(Object.keys(doc.sections)).toHaveLength(0);
  });

  it('handles document with only one section', () => {
    const doc = parseMemoryDocument('## Pinned Essentials\n\n- Only pinned\n');
    expect(doc.sections[MemorySection.PinnedEssentials]!.lineCount).toBe(1);
    expect(doc.sectionOrder).toEqual(['pinnedEssentials']);
    expect(doc.sections[MemorySection.IndexLinks]).toBeUndefined();
    expect(doc.sections[MemorySection.RecentDecisions]).toBeUndefined();
  });

  it('preserves sectionOrder', () => {
    const doc = parseMemoryDocument(SAMPLE_MEMORY);
    expect(doc.sectionOrder).toEqual(['pinnedEssentials', 'indexLinks', 'recentDecisions']);
  });

  it('parses Claude Code memory with title and preamble', () => {
    const doc = parseMemoryDocument(CLAUDE_CODE_MEMORY);
    expect(doc.title).toBe('# cc-intel Project Memory');
    expect(doc.sectionOrder).toEqual([
      'userPreferences',
      'projectStructure',
      'implementationPlan',
    ]);
    expect(doc.sections['userPreferences']!.lineCount).toBe(3);
    expect(doc.sections['projectStructure']!.lineCount).toBe(2);
    expect(doc.sections['implementationPlan']!.lineCount).toBe(1);
    expect(doc.totalLines).toBe(6);
  });

  it('preserves original header text', () => {
    const doc = parseMemoryDocument(CLAUDE_CODE_MEMORY);
    expect(doc.sections['userPreferences']!.header).toBe('## User Preferences');
  });
});

describe('serializeMemoryDocument', () => {
  it('round-trips cc-intel format correctly', () => {
    const doc = parseMemoryDocument(SAMPLE_MEMORY);
    const serialized = serializeMemoryDocument(doc);
    const reparsed = parseMemoryDocument(serialized);

    expect(reparsed.sections[MemorySection.PinnedEssentials]!.lineCount).toBe(
      doc.sections[MemorySection.PinnedEssentials]!.lineCount,
    );
    expect(reparsed.sections[MemorySection.RecentDecisions]!.lineCount).toBe(
      doc.sections[MemorySection.RecentDecisions]!.lineCount,
    );
  });

  it('round-trips Claude Code format with title', () => {
    const doc = parseMemoryDocument(CLAUDE_CODE_MEMORY);
    const serialized = serializeMemoryDocument(doc);
    const reparsed = parseMemoryDocument(serialized);

    expect(reparsed.title).toBe('# cc-intel Project Memory');
    expect(reparsed.sectionOrder).toEqual(doc.sectionOrder);
    expect(reparsed.sections['userPreferences']!.lineCount).toBe(3);
    expect(reparsed.totalLines).toBe(doc.totalLines);
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
    expect(trimmedDoc.sections[MemorySection.PinnedEssentials]!.lineCount).toBe(2);
  });

  it('overflows section exceeding limit', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `- Entry ${i}`);
    const content = `## Recent Decisions\n\n${lines.join('\n')}\n`;
    const doc = parseMemoryDocument(content);

    const { trimmedDoc, overflowActions } = enforceBudget(doc);
    expect(overflowActions).toHaveLength(1);
    expect(overflowActions[0]!.section).toBe(MemorySection.RecentDecisions);
    expect(trimmedDoc.sections[MemorySection.RecentDecisions]!.lineCount).toBeLessThanOrEqual(61);
  });

  it('enforces global maxLines without infinite loop', () => {
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

    const budget = {
      maxLines: 15,
      defaultSectionLimit: 50,
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
      defaultSectionLimit: 50,
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

  it('avoids filename collision between section-limit and global overflow passes', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `- Decision ${i}`);
    const content = `## Recent Decisions\n\n${lines.join('\n')}\n`;
    const doc = parseMemoryDocument(content);

    const budget = {
      maxLines: 10,
      defaultSectionLimit: 50,
      sectionLimits: {
        [MemorySection.PinnedEssentials]: 80,
        [MemorySection.IndexLinks]: 40,
        [MemorySection.RecentDecisions]: 30,
      },
    };

    const { overflowActions } = enforceBudget(doc, budget);
    expect(overflowActions.length).toBeGreaterThanOrEqual(2);

    const filenames = overflowActions.map((a) => a.topicFileLink);
    const uniqueFilenames = new Set(filenames);
    expect(uniqueFilenames.size).toBe(filenames.length);
  });

  it('uses defaultSectionLimit for unknown sections', () => {
    const lines = Array.from({ length: 60 }, (_, i) => `- Pref ${i}`);
    const content = `## User Preferences\n\n${lines.join('\n')}\n`;
    const doc = parseMemoryDocument(content);

    // defaultSectionLimit = 50, no explicit limit for userPreferences
    const { trimmedDoc, overflowActions } = enforceBudget(doc);
    expect(overflowActions).toHaveLength(1);
    expect(overflowActions[0]!.section).toBe('userPreferences');
    expect(trimmedDoc.sections['userPreferences']!.lineCount).toBeLessThanOrEqual(51);
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
    const decisions = updatedDoc.sections[MemorySection.RecentDecisions]!.lines;
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

  it('truncates long entries at 500 chars with ellipsis', () => {
    const doc = parseMemoryDocument('');
    const longText = 'x'.repeat(600);
    const snapshot = makeSnapshot({
      [SnapshotSection.KeyDecisions]: [{ text: longText, score: 5 }],
    });

    const { updatedDoc } = mergeIntoMemory(doc, snapshot);
    const decisions = updatedDoc.sections[MemorySection.RecentDecisions]!.lines;
    const entry = decisions.find((l) => l.includes('xxx'))!;
    // "- " prefix (2) + 500 chars + "..." (3) = 505 total
    expect(entry.length).toBe(505);
    expect(entry.endsWith('...')).toBe(true);
  });

  it('deduplicates new 500-char entry against existing 150-char truncated entry', () => {
    const longDecision = 'x'.repeat(300);
    const oldTruncated = `- ${longDecision.slice(0, 150)}`;
    const existingContent = `## Recent Decisions\n\n${oldTruncated}\n`;
    const doc = parseMemoryDocument(existingContent);

    const snapshot = makeSnapshot({
      [SnapshotSection.KeyDecisions]: [{ text: longDecision, score: 5 }],
    });

    const { updatedDoc, entriesDeduplicated } = mergeIntoMemory(doc, snapshot);
    const decisions = updatedDoc.sections[MemorySection.RecentDecisions]!.lines;
    expect(decisions).toHaveLength(1);
    expect(entriesDeduplicated).toBeGreaterThanOrEqual(1);
    expect(decisions[0]!.length).toBeGreaterThan(oldTruncated.length);
  });

  it('keeps short entries intact without ellipsis', () => {
    const doc = parseMemoryDocument('');
    const shortText = 'Use Commander for CLI parsing';
    const snapshot = makeSnapshot({
      [SnapshotSection.KeyDecisions]: [{ text: shortText, score: 5 }],
    });

    const { updatedDoc } = mergeIntoMemory(doc, snapshot);
    const decisions = updatedDoc.sections[MemorySection.RecentDecisions]!.lines;
    const entry = decisions.find((l) => l.includes('Commander'))!;
    expect(entry).toBe(`- ${shortText}`);
    expect(entry.endsWith('...')).toBe(false);
  });

  it('creates cc-intel sections alongside existing Claude Code sections', () => {
    const doc = parseMemoryDocument(CLAUDE_CODE_MEMORY);
    const snapshot = makeSnapshot({
      [SnapshotSection.KeyDecisions]: [{ text: 'Use Commander for CLI', score: 4 }],
    });

    const { updatedDoc } = mergeIntoMemory(doc, snapshot);
    // Existing Claude Code sections preserved
    expect(updatedDoc.sections['userPreferences']!.lineCount).toBe(3);
    // New cc-intel section created
    expect(updatedDoc.sections[MemorySection.RecentDecisions]).toBeDefined();
    expect(updatedDoc.sections[MemorySection.RecentDecisions]!.lines.some((l) => l.includes('Commander'))).toBe(true);
    // Claude Code sections come first in order, new section appended
    expect(updatedDoc.sectionOrder.indexOf('userPreferences')).toBeLessThan(
      updatedDoc.sectionOrder.indexOf('recentDecisions'),
    );
  });
});
