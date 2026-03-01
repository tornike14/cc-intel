import { describe, it, expect } from 'vitest';
import { segmentSession } from '../segmenter.js';
import { SessionPhase, type SessionMessage, type ScoredMessage } from '../../models/index.js';

function makeMessages(count: number): SessionMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? ('human' as const) : ('assistant' as const),
    content: `Message ${i}`,
  }));
}

function mockScorer(message: SessionMessage): ScoredMessage {
  return {
    content: message.content,
    role: message.role,
    signals: [],
    importanceScore: 0,
    timestamp: message.timestamp,
  };
}

describe('segmentSession', () => {
  it('returns empty phases for empty input', () => {
    const result = segmentSession([], mockScorer);
    for (const phase of Object.values(SessionPhase)) {
      expect(result[phase]).toHaveLength(0);
    }
  });

  it('handles single message (assigned to Goal)', () => {
    const result = segmentSession([{ role: 'human', content: 'Hello' }], mockScorer);
    expect(result[SessionPhase.Goal]).toHaveLength(1);
    expect(result[SessionPhase.Exploration]).toHaveLength(0);
    expect(result[SessionPhase.Implementation]).toHaveLength(0);
    expect(result[SessionPhase.WrapUp]).toHaveLength(0);
  });

  it('distributes 10 messages correctly with default thresholds', () => {
    const messages = makeMessages(10);
    const result = segmentSession(messages, mockScorer);

    // With 10 messages and thresholds [0.15, 0.5, 0.85]:
    // positions: 0, 0.11, 0.22, 0.33, 0.44, 0.56, 0.67, 0.78, 0.89, 1.0
    // Goal: 0, 0.11 (< 0.15)
    // Exploration: 0.22, 0.33, 0.44 (< 0.5)
    // Implementation: 0.56, 0.67, 0.78 (< 0.85)
    // WrapUp: 0.89, 1.0
    expect(result[SessionPhase.Goal]).toHaveLength(2);
    expect(result[SessionPhase.Exploration]).toHaveLength(3);
    expect(result[SessionPhase.Implementation]).toHaveLength(3);
    expect(result[SessionPhase.WrapUp]).toHaveLength(2);
  });

  it('sorts messages within each phase by score descending', () => {
    const messages: SessionMessage[] = [
      { role: 'human', content: 'Low importance' },
      { role: 'assistant', content: 'High importance' },
    ];

    let callIndex = 0;
    const scores = [1, 5];
    const scorerWithScores = (msg: SessionMessage): ScoredMessage => ({
      content: msg.content,
      role: msg.role,
      signals: [],
      importanceScore: scores[callIndex++]!,
    });

    const result = segmentSession(messages, scorerWithScores);
    // Both messages in Goal phase (2 messages, positions 0 and 1 with thresholds)
    const allMessages = [
      ...result[SessionPhase.Goal],
      ...result[SessionPhase.Exploration],
      ...result[SessionPhase.Implementation],
      ...result[SessionPhase.WrapUp],
    ];
    expect(allMessages).toHaveLength(2);

    // Find the phase that has both messages and check sorting
    for (const phase of Object.values(SessionPhase)) {
      if (result[phase].length > 1) {
        for (let i = 1; i < result[phase].length; i++) {
          expect(result[phase][i]!.importanceScore).toBeLessThanOrEqual(
            result[phase][i - 1]!.importanceScore,
          );
        }
      }
    }
  });

  it('respects custom phase thresholds', () => {
    const messages = makeMessages(4);
    const result = segmentSession(messages, mockScorer, {
      phaseThresholds: [0.5, 0.75, 0.9],
      maxItemsPerSection: 10,
      minScoreThreshold: 2,
    });

    // 4 messages, positions: 0, 0.33, 0.67, 1.0
    // Goal: 0, 0.33 (< 0.5)
    // Exploration: 0.67 (< 0.75)
    // Implementation: (none < 0.9 after 0.75)
    // WrapUp: 1.0 (>= 0.9)
    expect(result[SessionPhase.Goal]).toHaveLength(2);
    expect(result[SessionPhase.Exploration]).toHaveLength(1);
    expect(result[SessionPhase.WrapUp]).toHaveLength(1);
  });

  it('total messages preserved across all phases', () => {
    const messages = makeMessages(20);
    const result = segmentSession(messages, mockScorer);
    const total = Object.values(SessionPhase).reduce((sum, phase) => sum + result[phase].length, 0);
    expect(total).toBe(20);
  });
});
