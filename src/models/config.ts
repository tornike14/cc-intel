import type { SignalWeights } from './scoring.js';
import type { MemoryBudget } from './memory.js';
import type { RiskThresholds } from './risk.js';
import type { SnapshotConfig } from './snapshot.js';
import { DEFAULT_SIGNAL_WEIGHTS } from './scoring.js';
import { DEFAULT_MEMORY_BUDGET } from './memory.js';
import { DEFAULT_RISK_THRESHOLDS } from './risk.js';
import { DEFAULT_SNAPSHOT_CONFIG } from './snapshot.js';

export interface CcIntelConfig {
  signalWeights: SignalWeights;
  memoryBudget: MemoryBudget;
  riskThresholds: RiskThresholds;
  snapshotConfig: SnapshotConfig;
  maxContext: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const DEFAULT_CONFIG: CcIntelConfig = {
  signalWeights: DEFAULT_SIGNAL_WEIGHTS,
  memoryBudget: DEFAULT_MEMORY_BUDGET,
  riskThresholds: DEFAULT_RISK_THRESHOLDS,
  snapshotConfig: DEFAULT_SNAPSHOT_CONFIG,
  maxContext: 200_000,
  logLevel: 'info',
};
