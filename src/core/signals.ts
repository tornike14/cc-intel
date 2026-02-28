import {
  SignalCategory,
  DEFAULT_SIGNAL_WEIGHTS,
  type SignalWeights,
  type SignalMatch,
  type ScoredMessage,
  type SessionMessage,
} from '../models/index.js';
import { DEFAULT_SIGNAL_PATTERNS } from './signal-patterns.js';

export function detectSignals(
  text: string,
  weights: SignalWeights = DEFAULT_SIGNAL_WEIGHTS,
  patterns: Record<SignalCategory, RegExp[]> = DEFAULT_SIGNAL_PATTERNS,
): SignalMatch[] {
  const matches: SignalMatch[] = [];

  for (const category of Object.values(SignalCategory)) {
    const categoryPatterns = patterns[category];
    if (!categoryPatterns) continue;

    for (const pattern of categoryPatterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        matches.push({
          category,
          weight: weights[category],
          pattern: pattern.source,
          matchedText: match[0].trim(),
        });

        if (!regex.global) break;
      }
    }
  }

  return matches;
}

export function scoreMessage(
  message: SessionMessage,
  weights: SignalWeights = DEFAULT_SIGNAL_WEIGHTS,
): ScoredMessage {
  const signals = detectSignals(message.content, weights);
  const importanceScore = signals.reduce((sum, s) => sum + s.weight, 0);

  return {
    content: message.content,
    role: message.role,
    signals,
    importanceScore,
    timestamp: message.timestamp,
  };
}
