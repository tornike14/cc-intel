import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, CONFIG_FILENAME } from '../config-loader.js';
import { DEFAULT_CONFIG } from '../../models/index.js';

describe('config-loader', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-intel-cfg-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    delete process.env['CC_INTEL_LOG_LEVEL'];
    delete process.env['CC_INTEL_MAX_CONTEXT'];
  });

  it('returns defaults when no config file exists', async () => {
    const config = await loadConfig(tmpDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('loads config from cwd', async () => {
    const configPath = path.join(tmpDir, CONFIG_FILENAME);
    await fs.writeFile(
      configPath,
      JSON.stringify({ maxContext: 100_000, logLevel: 'debug' }),
      'utf-8',
    );

    const config = await loadConfig(tmpDir);
    expect(config.maxContext).toBe(100_000);
    expect(config.logLevel).toBe('debug');
    // Other defaults remain
    expect(config.signalWeights).toEqual(DEFAULT_CONFIG.signalWeights);
  });

  it('deep merges nested config objects', async () => {
    const configPath = path.join(tmpDir, CONFIG_FILENAME);
    await fs.writeFile(
      configPath,
      JSON.stringify({
        riskThresholds: { medium: 0.6 },
        memoryBudget: { maxLines: 150, sectionLimits: { pinnedEssentials: 50 } },
      }),
      'utf-8',
    );

    const config = await loadConfig(tmpDir);
    expect(config.riskThresholds.medium).toBe(0.6);
    expect(config.riskThresholds.high).toBe(DEFAULT_CONFIG.riskThresholds.high);
    expect(config.memoryBudget.maxLines).toBe(150);
    expect(config.memoryBudget.sectionLimits.pinnedEssentials).toBe(50);
    expect(config.memoryBudget.sectionLimits.indexLinks).toBe(
      DEFAULT_CONFIG.memoryBudget.sectionLimits.indexLinks,
    );
  });

  it('applies env var overrides on top of file config', async () => {
    const configPath = path.join(tmpDir, CONFIG_FILENAME);
    await fs.writeFile(configPath, JSON.stringify({ logLevel: 'debug' }), 'utf-8');

    process.env['CC_INTEL_LOG_LEVEL'] = 'error';
    process.env['CC_INTEL_MAX_CONTEXT'] = '50000';

    const config = await loadConfig(tmpDir);
    expect(config.logLevel).toBe('error'); // env overrides file
    expect(config.maxContext).toBe(50000);
  });

  it('ignores invalid JSON gracefully', async () => {
    const configPath = path.join(tmpDir, CONFIG_FILENAME);
    await fs.writeFile(configPath, '{ broken json', 'utf-8');

    const config = await loadConfig(tmpDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it('ignores invalid env values', async () => {
    process.env['CC_INTEL_LOG_LEVEL'] = 'banana';
    process.env['CC_INTEL_MAX_CONTEXT'] = 'not-a-number';

    const config = await loadConfig(tmpDir);
    expect(config.logLevel).toBe(DEFAULT_CONFIG.logLevel);
    expect(config.maxContext).toBe(DEFAULT_CONFIG.maxContext);
  });

  it('deep merges defaultSectionLimit override', async () => {
    const configPath = path.join(tmpDir, CONFIG_FILENAME);
    await fs.writeFile(
      configPath,
      JSON.stringify({
        memoryBudget: { defaultSectionLimit: 100 },
      }),
      'utf-8',
    );

    const config = await loadConfig(tmpDir);
    expect(config.memoryBudget.defaultSectionLimit).toBe(100);
    // Other budget values remain default
    expect(config.memoryBudget.maxLines).toBe(DEFAULT_CONFIG.memoryBudget.maxLines);
    expect(config.memoryBudget.sectionLimits).toEqual(DEFAULT_CONFIG.memoryBudget.sectionLimits);
  });
});
