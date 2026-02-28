import { describe, it, expect } from 'vitest';
import { formatRiskAsMarkdown, formatRiskAsJson } from '../formatters/risk-formatter.js';
import { RiskLevel, type ContextMetrics } from '../../models/index.js';

function makeMetrics(overrides: Partial<ContextMetrics> = {}): ContextMetrics {
  return {
    tokenEstimate: 50000,
    messageCount: 100,
    riskLevel: RiskLevel.Medium,
    utilizationPercent: 0.25,
    maxContext: 200000,
    ...overrides,
  };
}

describe('formatRiskAsMarkdown', () => {
  it('includes risk level', () => {
    const output = formatRiskAsMarkdown(makeMetrics());
    expect(output).toContain('MEDIUM');
  });

  it('includes utilization percentage', () => {
    const output = formatRiskAsMarkdown(makeMetrics());
    expect(output).toContain('25.0%');
  });

  it('includes token counts', () => {
    const output = formatRiskAsMarkdown(makeMetrics());
    expect(output).toContain('50,000');
    expect(output).toContain('200,000');
  });

  it('includes progress bar', () => {
    const output = formatRiskAsMarkdown(makeMetrics({ utilizationPercent: 0.5 }));
    expect(output).toContain('[');
    expect(output).toContain(']');
  });
});

describe('formatRiskAsJson', () => {
  it('returns valid JSON', () => {
    const output = formatRiskAsJson(makeMetrics());
    const parsed = JSON.parse(output) as ContextMetrics;
    expect(parsed.tokenEstimate).toBe(50000);
    expect(parsed.riskLevel).toBe('medium');
  });
});
