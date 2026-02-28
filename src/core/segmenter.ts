import {
  SessionPhase,
  type SessionMessage,
  type ScoredMessage,
  type SnapshotConfig,
  DEFAULT_SNAPSHOT_CONFIG,
} from '../models/index.js';
import { scoreMessage } from './signals.js';

export type ScorerFn = (message: SessionMessage) => ScoredMessage;

export type SegmentedSession = Record<SessionPhase, ScoredMessage[]>;

export function segmentSession(
  messages: SessionMessage[],
  scorer: ScorerFn = scoreMessage,
  config: SnapshotConfig = DEFAULT_SNAPSHOT_CONFIG,
): SegmentedSession {
  const result: SegmentedSession = {
    [SessionPhase.Goal]: [],
    [SessionPhase.Exploration]: [],
    [SessionPhase.Implementation]: [],
    [SessionPhase.WrapUp]: [],
  };

  if (messages.length === 0) return result;

  const [goalEnd, implStart, wrapUpStart] = config.phaseThresholds;
  const total = messages.length;

  for (let i = 0; i < total; i++) {
    const position = total === 1 ? 0 : i / (total - 1);
    const scored = scorer(messages[i]!);

    let phase: SessionPhase;
    if (position < goalEnd) {
      phase = SessionPhase.Goal;
    } else if (position < implStart) {
      phase = SessionPhase.Exploration;
    } else if (position < wrapUpStart) {
      phase = SessionPhase.Implementation;
    } else {
      phase = SessionPhase.WrapUp;
    }

    result[phase].push(scored);
  }

  // Sort each phase by importance score descending
  for (const phase of Object.values(SessionPhase)) {
    result[phase].sort((a, b) => b.importanceScore - a.importanceScore);
  }

  return result;
}
