import {
  SessionPhase,
  SnapshotSection,
  type Snapshot,
  type SnapshotEntry,
  type SnapshotConfig,
  type SignalCategory,
  type SignalMatch,
  type ScoredMessage,
  DEFAULT_SNAPSHOT_CONFIG,
} from '../models/index.js';
import type { SegmentedSession } from './segmenter.js';
import { isBoilerplate, extractSubstantiveLine } from '../utils/text.js';

/** Find the line in content that contains the most signal matches. */
function extractSignalLine(content: string, signals: SignalMatch[]): string {
  if (signals.length === 0) return extractSubstantiveLine(content);

  const lines = content.split('\n');
  let bestLine = '';
  let bestScore = -1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 10) continue;

    let lineScore = 0;
    const lower = trimmed.toLowerCase();
    for (const sig of signals) {
      if (lower.includes(sig.matchedText.toLowerCase())) {
        lineScore += sig.weight;
      }
    }

    if (lineScore > bestScore || (lineScore === bestScore && trimmed.length > bestLine.length)) {
      bestScore = lineScore;
      bestLine = trimmed;
    }
  }

  return bestLine || extractSubstantiveLine(content);
}

function toEntry(m: ScoredMessage): SnapshotEntry {
  return { text: extractSignalLine(m.content, m.signals), score: m.importanceScore };
}

function extractByCategory(
  messages: ScoredMessage[],
  category: SignalCategory,
  maxItems: number,
  usedTexts: Set<string>,
): SnapshotEntry[] {
  const entries: SnapshotEntry[] = [];
  for (const m of messages) {
    if (entries.length >= maxItems) break;
    if (!m.signals.some((s) => s.category === category)) continue;
    const entry = toEntry(m);
    if (usedTexts.has(entry.text)) continue;
    usedTexts.add(entry.text);
    entries.push(entry);
  }
  return entries;
}

function shouldExclude(m: ScoredMessage, minScore: number): boolean {
  if (m.role === 'human') return true;
  if (m.content.trim().length === 0) return true;
  if (isBoilerplate(m.content)) return true;
  if (m.importanceScore < minScore) return true;
  return false;
}

export function extractSnapshot(
  segmented: SegmentedSession,
  config: SnapshotConfig = DEFAULT_SNAPSHOT_CONFIG,
): Snapshot {
  const max = config.maxItemsPerSection;
  const minScore = config.minScoreThreshold;

  const filtered: SegmentedSession = {
    [SessionPhase.Goal]: segmented[SessionPhase.Goal].filter((m) => !shouldExclude(m, minScore)),
    [SessionPhase.Exploration]: segmented[SessionPhase.Exploration].filter(
      (m) => !shouldExclude(m, minScore),
    ),
    [SessionPhase.Implementation]: segmented[SessionPhase.Implementation].filter(
      (m) => !shouldExclude(m, minScore),
    ),
    [SessionPhase.WrapUp]: segmented[SessionPhase.WrapUp].filter(
      (m) => !shouldExclude(m, minScore),
    ),
  };

  const usedTexts = new Set<string>();

  const projectGoal: SnapshotEntry[] = [];
  for (const m of filtered[SessionPhase.Goal]) {
    if (projectGoal.length >= max) break;
    const entry = toEntry(m);
    if (usedTexts.has(entry.text)) continue;
    usedTexts.add(entry.text);
    projectGoal.push(entry);
  }

  const allMessages = [
    ...filtered[SessionPhase.Goal],
    ...filtered[SessionPhase.Exploration],
    ...filtered[SessionPhase.Implementation],
    ...filtered[SessionPhase.WrapUp],
  ].sort((a, b) => b.importanceScore - a.importanceScore);

  const keyDecisions = extractByCategory(allMessages, 'decision' as SignalCategory, max, usedTexts);

  const constraints = extractByCategory(
    allMessages,
    'constraint' as SignalCategory,
    max,
    usedTexts,
  );

  const implMessages = [
    ...filtered[SessionPhase.Implementation],
    ...filtered[SessionPhase.Exploration],
  ].sort((a, b) => b.importanceScore - a.importanceScore);

  const implementationArtifacts = extractByCategory(
    implMessages,
    'artifact' as SignalCategory,
    max,
    usedTexts,
  );

  const wrapUpFirst = [
    ...filtered[SessionPhase.WrapUp],
    ...filtered[SessionPhase.Implementation],
    ...filtered[SessionPhase.Exploration],
    ...filtered[SessionPhase.Goal],
  ];

  const openTasks = extractByCategory(wrapUpFirst, 'todo' as SignalCategory, max, usedTexts);

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
