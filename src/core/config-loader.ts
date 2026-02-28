import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DEFAULT_CONFIG, type CcIntelConfig } from '../models/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('config-loader');

const CONFIG_FILENAME = '.cc-intelrc.json';

/**
 * Search order for config file:
 * 1. Current working directory
 * 2. Home directory
 */
async function findConfigFile(cwd: string = process.cwd()): Promise<string | null> {
  const candidates = [path.join(cwd, CONFIG_FILENAME), path.join(os.homedir(), CONFIG_FILENAME)];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // File doesn't exist, try next
    }
  }
  return null;
}

function applyEnvOverrides(config: CcIntelConfig): CcIntelConfig {
  const result = { ...config };

  const logLevel = process.env['CC_INTEL_LOG_LEVEL']?.toLowerCase();
  if (logLevel && ['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    result.logLevel = logLevel as CcIntelConfig['logLevel'];
  }

  const maxContext = process.env['CC_INTEL_MAX_CONTEXT'];
  if (maxContext !== undefined) {
    const parsed = parseInt(maxContext, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      result.maxContext = parsed;
    }
  }

  return result;
}

function deepMerge(defaults: CcIntelConfig, overrides: Record<string, unknown>): CcIntelConfig {
  const result = { ...defaults };

  if (overrides['signalWeights'] && typeof overrides['signalWeights'] === 'object') {
    result.signalWeights = { ...defaults.signalWeights, ...(overrides['signalWeights'] as object) };
  }

  if (overrides['memoryBudget'] && typeof overrides['memoryBudget'] === 'object') {
    const mb = overrides['memoryBudget'] as Record<string, unknown>;
    result.memoryBudget = { ...defaults.memoryBudget };
    if (typeof mb['maxLines'] === 'number') result.memoryBudget.maxLines = mb['maxLines'];
    if (mb['sectionLimits'] && typeof mb['sectionLimits'] === 'object') {
      result.memoryBudget.sectionLimits = {
        ...defaults.memoryBudget.sectionLimits,
        ...(mb['sectionLimits'] as object),
      };
    }
  }

  if (overrides['riskThresholds'] && typeof overrides['riskThresholds'] === 'object') {
    result.riskThresholds = {
      ...defaults.riskThresholds,
      ...(overrides['riskThresholds'] as object),
    };
  }

  if (overrides['snapshotConfig'] && typeof overrides['snapshotConfig'] === 'object') {
    result.snapshotConfig = {
      ...defaults.snapshotConfig,
      ...(overrides['snapshotConfig'] as object),
    };
  }

  if (typeof overrides['maxContext'] === 'number') {
    result.maxContext = overrides['maxContext'];
  }

  if (typeof overrides['logLevel'] === 'string') {
    const level = overrides['logLevel'];
    if (['debug', 'info', 'warn', 'error'].includes(level)) {
      result.logLevel = level as CcIntelConfig['logLevel'];
    }
  }

  return result;
}

export async function loadConfig(cwd?: string): Promise<CcIntelConfig> {
  let config = { ...DEFAULT_CONFIG };

  const configPath = await findConfigFile(cwd);
  if (configPath) {
    try {
      const raw = await fs.readFile(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      config = deepMerge(config, parsed);
      logger.info(`Loaded config from ${configPath}`);
    } catch (err) {
      logger.warn(`Failed to parse config at ${configPath}: ${(err as Error).message}`);
    }
  }

  config = applyEnvOverrides(config);

  return config;
}

export { findConfigFile, applyEnvOverrides, deepMerge, CONFIG_FILENAME };
