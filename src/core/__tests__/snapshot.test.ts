import { describe, it, expect } from 'vitest';
import { extractSnapshot } from '../snapshot.js';
import {
  SessionPhase,
  SnapshotSection,
  SignalCategory,
  type ScoredMessage,
} from '../../models/index.js';
import type { SegmentedSession } from '../segmenter.js';

function emptySegmented(): SegmentedSession {
  return {
    [SessionPhase.Goal]: [],
    [SessionPhase.Exploration]: [],
    [SessionPhase.Implementation]: [],
    [SessionPhase.WrapUp]: [],
  };
}

function makeScoredMessage(
  content: string,
  score: number,
  categories: SignalCategory[] = [],
): ScoredMessage {
  return {
    content,
    role: 'assistant',
    signals: categories.map((c) => ({
      category: c,
      weight: score,
      pattern: '',
      matchedText: content,
    })),
    importanceScore: score,
  };
}

describe('extractSnapshot', () => {
  it('returns empty sections for empty session', () => {
    const snapshot = extractSnapshot(emptySegmented());
    for (const section of Object.values(SnapshotSection)) {
      expect(snapshot.sections[section]).toHaveLength(0);
    }
    expect(snapshot.metadata.messageCount).toBe(0);
  });

  it('places goal phase messages in ProjectGoal section', () => {
    const segmented = emptySegmented();
    segmented[SessionPhase.Goal] = [makeScoredMessage('Build a CLI tool', 5)];

    const snapshot = extractSnapshot(segmented);
    expect(snapshot.sections[SnapshotSection.ProjectGoal]).toHaveLength(1);
    expect(snapshot.sections[SnapshotSection.ProjectGoal][0]!.text).toBe('Build a CLI tool');
  });

  it('extracts decisions into KeyDecisions section', () => {
    const segmented = emptySegmented();
    segmented[SessionPhase.Exploration] = [
      makeScoredMessage('We decided to use TypeScript', 4, [SignalCategory.Decision]),
    ];

    const snapshot = extractSnapshot(segmented);
    expect(snapshot.sections[SnapshotSection.KeyDecisions]).toHaveLength(1);
  });

  it('extracts constraints into Constraints section', () => {
    const segmented = emptySegmented();
    segmented[SessionPhase.Implementation] = [
      makeScoredMessage('Must not break backward compatibility', 4, [SignalCategory.Constraint]),
    ];

    const snapshot = extractSnapshot(segmented);
    expect(snapshot.sections[SnapshotSection.Constraints]).toHaveLength(1);
  });

  it('extracts artifacts into ImplementationArtifacts section', () => {
    const segmented = emptySegmented();
    segmented[SessionPhase.Implementation] = [
      makeScoredMessage('Modified src/core/signals.ts', 6, [SignalCategory.Artifact]),
    ];

    const snapshot = extractSnapshot(segmented);
    expect(snapshot.sections[SnapshotSection.ImplementationArtifacts]).toHaveLength(1);
  });

  it('extracts todos into OpenTasks section', () => {
    const segmented = emptySegmented();
    segmented[SessionPhase.WrapUp] = [
      makeScoredMessage('TODO: add more tests', 3, [SignalCategory.Todo]),
    ];

    const snapshot = extractSnapshot(segmented);
    expect(snapshot.sections[SnapshotSection.OpenTasks]).toHaveLength(1);
  });

  it('respects maxItemsPerSection', () => {
    const segmented = emptySegmented();
    segmented[SessionPhase.Goal] = Array.from({ length: 20 }, (_, i) =>
      makeScoredMessage(`Goal ${i}`, 20 - i),
    );

    const snapshot = extractSnapshot(segmented, {
      phaseThresholds: [0.15, 0.5, 0.85],
      maxItemsPerSection: 3,
    });
    expect(snapshot.sections[SnapshotSection.ProjectGoal]).toHaveLength(3);
  });

  it('includes correct metadata', () => {
    const segmented = emptySegmented();
    segmented[SessionPhase.Goal] = [makeScoredMessage('Goal', 1)];
    segmented[SessionPhase.Implementation] = [
      makeScoredMessage('Impl 1', 2),
      makeScoredMessage('Impl 2', 3),
    ];

    const snapshot = extractSnapshot(segmented);
    expect(snapshot.metadata.messageCount).toBe(3);
    expect(snapshot.metadata.phaseDistribution[SessionPhase.Goal]).toBe(1);
    expect(snapshot.metadata.phaseDistribution[SessionPhase.Implementation]).toBe(2);
    expect(snapshot.metadata.extractedAt).toBeTruthy();
  });

  it('excludes boilerplate messages from snapshot entries', () => {
    const segmented = emptySegmented();
    const boilerplate =
      'This session is being continued from a previous conversation that ran out of context. We decided to use TypeScript and must keep backward compatibility.';

    segmented[SessionPhase.Goal] = [
      makeScoredMessage(boilerplate, 10, [SignalCategory.Decision, SignalCategory.Constraint]),
      makeScoredMessage('Build a CLI tool for context monitoring', 5),
    ];

    const snapshot = extractSnapshot(segmented);
    // Boilerplate excluded from entries despite high score and signals
    expect(snapshot.sections[SnapshotSection.ProjectGoal]).toHaveLength(1);
    expect(snapshot.sections[SnapshotSection.ProjectGoal][0]!.text).toContain('CLI tool');
    expect(snapshot.sections[SnapshotSection.KeyDecisions]).toHaveLength(0);
    expect(snapshot.sections[SnapshotSection.Constraints]).toHaveLength(0);
    // But metadata still counts all messages (including boilerplate)
    expect(snapshot.metadata.messageCount).toBe(2);
  });
});
