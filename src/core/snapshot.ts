import {
  SessionPhase,
  SnapshotSection,
  type Snapshot,
  type SnapshotEntry,
  type SnapshotConfig,
  type SignalCategory,
  DEFAULT_SNAPSHOT_CONFIG,
} from '../models/index.js';
import type { SegmentedSession } from './segmenter.js';

function toEntry(content: string, score: number): SnapshotEntry {
  return { text: content, score };
}

function extractByCategory(
  messages: { content: string; importanceScore: number; signals: { category: SignalCategory }[] }[],
  category: SignalCategory,
  maxItems: number,
): SnapshotEntry[] {
  return messages
    .filter((m) => m.signals.some((s) => s.category === category))
    .slice(0, maxItems)
    .map((m) => toEntry(m.content, m.importanceScore));
}

export function extractSnapshot(
  segmented: SegmentedSession,
  config: SnapshotConfig = DEFAULT_SNAPSHOT_CONFIG,
): Snapshot {
  const max = config.maxItemsPerSection;

  // Project goal from Goal phase — highest scored messages
  const projectGoal = segmented[SessionPhase.Goal]
    .slice(0, max)
    .map((m) => toEntry(m.content, m.importanceScore));

  // Key decisions — from all phases, filter by decision signals
  const allMessages = [
    ...segmented[SessionPhase.Goal],
    ...segmented[SessionPhase.Exploration],
    ...segmented[SessionPhase.Implementation],
    ...segmented[SessionPhase.WrapUp],
  ].sort((a, b) => b.importanceScore - a.importanceScore);

  const keyDecisions = extractByCategory(allMessages, 'decision' as SignalCategory, max);

  // Constraints — from all phases
  const constraints = extractByCategory(allMessages, 'constraint' as SignalCategory, max);

  // Implementation artifacts — primarily from Implementation phase
  const implMessages = [
    ...segmented[SessionPhase.Implementation],
    ...segmented[SessionPhase.Exploration],
  ].sort((a, b) => b.importanceScore - a.importanceScore);

  const implementationArtifacts = extractByCategory(
    implMessages,
    'artifact' as SignalCategory,
    max,
  );

  // Open tasks — from WrapUp and all phases
  const wrapUpFirst = [
    ...segmented[SessionPhase.WrapUp],
    ...segmented[SessionPhase.Implementation],
    ...segmented[SessionPhase.Exploration],
    ...segmented[SessionPhase.Goal],
  ];

  const openTasks = extractByCategory(wrapUpFirst, 'todo' as SignalCategory, max);

  const phaseDistribution: Record<string, number> = {};
  for (const phase of Object.values(SessionPhase)) {
    phaseDistribution[phase] = segmented[phase].length;
  }

  const totalMessages = Object.values(segmented).reduce((sum, msgs) => sum + msgs.length, 0);

  return {
    sections: {
      [SnapshotSection.ProjectGoal]: projectGoal,
      [SnapshotSection.KeyDecisions]: keyDecisions,
      [SnapshotSection.Constraints]: constraints,
      [SnapshotSection.ImplementationArtifacts]: implementationArtifacts,
      [SnapshotSection.OpenTasks]: openTasks,
    },
    metadata: {
      messageCount: totalMessages,
      extractedAt: new Date().toISOString(),
      phaseDistribution,
    },
  };
}
