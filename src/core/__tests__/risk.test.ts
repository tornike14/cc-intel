import { describe, it, expect } from 'vitest';
import { estimateTokens, classifyRisk, assessRisk } from '../risk.js';
import { RiskLevel } from '../../models/index.js';

describe('estimateTokens', () => {
  it('estimates prose tokens at ~4 chars per token', () => {
    const text = 'a'.repeat(400);
    expect(estimateTokens(text)).toBe(100);
  });

  it('estimates code blocks with higher density', () => {
    const code = '```\n' + 'x'.repeat(330) + '\n```';
    const estimate = estimateTokens(code);
    // 337 chars of code / 3.3 ≈ 102
    expect(estimate).toBeGreaterThan(100);
  });

  it('handles mixed prose and code', () => {
    const text = 'Hello world\n```\nconst x = 1;\n```\nGoodbye';
    const estimate = estimateTokens(text);
    expect(estimate).toBeGreaterThan(0);
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('classifyRisk', () => {
  it('returns Low for utilization below 40%', () => {
    expect(classifyRisk(0.3)).toBe(RiskLevel.Low);
  });

  it('returns Medium for utilization at 40%', () => {
    expect(classifyRisk(0.4)).toBe(RiskLevel.Medium);
  });

  it('returns High for utilization at 70%', () => {
    expect(classifyRisk(0.7)).toBe(RiskLevel.High);
  });

  it('returns Critical for utilization at 90%', () => {
    expect(classifyRisk(0.9)).toBe(RiskLevel.Critical);
  });

  it('respects custom thresholds', () => {
    expect(classifyRisk(0.5, { medium: 0.6, high: 0.8, critical: 0.95 })).toBe(RiskLevel.Low);
  });
});

describe('assessRisk', () => {
  it('returns Low risk for empty session', () => {
    const metrics = assessRisk([]);
    expect(metrics.riskLevel).toBe(RiskLevel.Low);
    expect(metrics.tokenEstimate).toBe(0);
    expect(metrics.messageCount).toBe(0);
  });

  it('returns correct message count', () => {
    const messages = [
      { role: 'human' as const, content: 'Hello' },
      { role: 'assistant' as const, content: 'Hi there' },
    ];
    const metrics = assessRisk(messages);
    expect(metrics.messageCount).toBe(2);
  });

  it('returns Critical for very large session', () => {
    const bigContent = 'x'.repeat(800_000); // ~200k tokens
    const metrics = assessRisk([{ role: 'assistant', content: bigContent }]);
    expect(metrics.riskLevel).toBe(RiskLevel.Critical);
  });

  it('includes utilization and max context', () => {
    const metrics = assessRisk([{ role: 'human', content: 'test' }], 100_000);
    expect(metrics.maxContext).toBe(100_000);
    expect(metrics.utilizationPercent).toBeGreaterThan(0);
  });

  it('accounts for reservedTokens in utilization', () => {
    // 400 chars = 100 tokens prose. maxContext=200, reserved=0 → 50% utilization
    const noReserve = assessRisk([{ role: 'human', content: 'a'.repeat(400) }], 200, undefined, 0);
    expect(noReserve.utilizationPercent).toBeCloseTo(0.5, 1);

    // Same tokens, maxContext=200, reserved=100 → effective max=100 → 100% utilization
    const withReserve = assessRisk(
      [{ role: 'human', content: 'a'.repeat(400) }],
      200,
      undefined,
      100,
    );
    expect(withReserve.utilizationPercent).toBeCloseTo(1.0, 1);
    expect(withReserve.riskLevel).toBe(RiskLevel.Critical);
  });
});
