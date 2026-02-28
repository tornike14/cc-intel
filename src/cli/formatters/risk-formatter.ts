import { RiskLevel, type ContextMetrics } from '../../models/index.js';

const RISK_LABELS: Record<RiskLevel, string> = {
  [RiskLevel.Low]: 'LOW',
  [RiskLevel.Medium]: 'MEDIUM',
  [RiskLevel.High]: 'HIGH',
  [RiskLevel.Critical]: 'CRITICAL',
};

export function formatRiskAsMarkdown(metrics: ContextMetrics): string {
  const pct = (metrics.utilizationPercent * 100).toFixed(1);
  const bar = makeBar(metrics.utilizationPercent);

  const lines = [
    '# Context Risk Assessment',
    '',
    `Risk Level: **${RISK_LABELS[metrics.riskLevel]}**`,
    '',
    `Utilization: ${pct}% ${bar}`,
    `Estimated tokens: ${metrics.tokenEstimate.toLocaleString()} / ${metrics.maxContext.toLocaleString()}`,
    `Messages: ${metrics.messageCount}`,
    '',
  ];

  return lines.join('\n');
}

function makeBar(percent: number): string {
  const filled = Math.round(Math.min(percent, 1) * 20);
  const empty = 20 - filled;
  return `[${'#'.repeat(filled)}${'.'.repeat(empty)}]`;
}

export function formatRiskAsJson(metrics: ContextMetrics): string {
  return JSON.stringify(metrics, null, 2);
}
