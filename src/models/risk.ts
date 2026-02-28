export enum RiskLevel {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export interface RiskThresholds {
  medium: number;
  high: number;
  critical: number;
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  medium: 0.4,
  high: 0.7,
  critical: 0.9,
};

export interface ContextMetrics {
  tokenEstimate: number;
  messageCount: number;
  riskLevel: RiskLevel;
  utilizationPercent: number;
  maxContext: number;
}
