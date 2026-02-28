import {
  RiskLevel,
  DEFAULT_RISK_THRESHOLDS,
  type RiskThresholds,
  type ContextMetrics,
  type SessionMessage,
} from '../models/index.js';

const CODE_FENCE_REGEX = /```[\s\S]*?```/g;

export function estimateTokens(text: string): number {
  const codeFences = text.match(CODE_FENCE_REGEX) ?? [];
  let codeChars = 0;
  for (const fence of codeFences) {
    codeChars += fence.length;
  }
  const proseChars = text.length - codeChars;

  // Prose: ~4 chars/token, Code: ~3.3 chars/token (higher density)
  return Math.ceil(proseChars / 4 + codeChars / 3.3);
}

export function classifyRisk(
  utilizationPercent: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
): RiskLevel {
  if (utilizationPercent >= thresholds.critical) return RiskLevel.Critical;
  if (utilizationPercent >= thresholds.high) return RiskLevel.High;
  if (utilizationPercent >= thresholds.medium) return RiskLevel.Medium;
  return RiskLevel.Low;
}

/**
 * Assess context window usage and compaction risk.
 *
 * @param reservedTokens — tokens reserved for system prompt, MEMORY.md, and
 *   Claude Code framing overhead. Subtracted from maxContext before calculating
 *   utilization so the risk score reflects usable capacity, not raw limit.
 */
export function assessRisk(
  messages: SessionMessage[],
  maxContext = 200_000,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
  reservedTokens = 5_000,
): ContextMetrics {
  const totalText = messages.map((m) => m.content).join('\n');
  const tokenEstimate = estimateTokens(totalText);
  const effectiveMax = Math.max(1, maxContext - reservedTokens);
  const utilizationPercent = tokenEstimate / effectiveMax;
  const riskLevel = classifyRisk(utilizationPercent, thresholds);

  return {
    tokenEstimate,
    messageCount: messages.length,
    riskLevel,
    utilizationPercent,
    maxContext,
  };
}
