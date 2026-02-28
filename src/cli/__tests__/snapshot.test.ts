import { describe, it, expect } from 'vitest';
import {
  formatSnapshotAsMarkdown,
  formatSnapshotAsJson,
} from '../formatters/snapshot-formatter.js';
import { SnapshotSection, type Snapshot } from '../../models/index.js';

function makeSnapshot(): Snapshot {
  return {
    sections: {
      [SnapshotSection.ProjectGoal]: [{ text: 'Build a CLI tool', score: 5 }],
      [SnapshotSection.KeyDecisions]: [{ text: 'Use TypeScript', score: 4 }],
      [SnapshotSection.Constraints]: [],
      [SnapshotSection.ImplementationArtifacts]: [{ text: 'src/core/signals.ts', score: 6 }],
      [SnapshotSection.OpenTasks]: [{ text: 'Add more tests', score: 3 }],
    },
    metadata: {
      messageCount: 10,
      extractedAt: '2026-01-01T00:00:00.000Z',
      phaseDistribution: { goal: 2, exploration: 3, implementation: 3, wrapup: 2 },
    },
  };
}

describe('formatSnapshotAsMarkdown', () => {
  it('includes all section headers', () => {
    const output = formatSnapshotAsMarkdown(makeSnapshot());
    expect(output).toContain('## Project Goal');
    expect(output).toContain('## Key Decisions');
    expect(output).toContain('## Constraints');
    expect(output).toContain('## Implementation Artifacts');
    expect(output).toContain('## Open Tasks');
  });

  it('includes entry text', () => {
    const output = formatSnapshotAsMarkdown(makeSnapshot());
    expect(output).toContain('Build a CLI tool');
    expect(output).toContain('Use TypeScript');
  });

  it('shows _No entries_ for empty sections', () => {
    const output = formatSnapshotAsMarkdown(makeSnapshot());
    expect(output).toContain('_No entries_');
  });

  it('includes metadata', () => {
    const output = formatSnapshotAsMarkdown(makeSnapshot());
    expect(output).toContain('10 messages');
  });
});

describe('formatSnapshotAsJson', () => {
  it('returns valid JSON', () => {
    const output = formatSnapshotAsJson(makeSnapshot());
    const parsed = JSON.parse(output) as Snapshot;
    expect(parsed.metadata.messageCount).toBe(10);
  });

  it('preserves all sections', () => {
    const output = formatSnapshotAsJson(makeSnapshot());
    const parsed = JSON.parse(output) as Snapshot;
    expect(parsed.sections.projectGoal).toHaveLength(1);
  });
});
