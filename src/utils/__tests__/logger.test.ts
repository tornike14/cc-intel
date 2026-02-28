import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from '../logger.js';

describe('createLogger', () => {
  const originalWrite = process.stderr.write;
  let output: string[];

  beforeEach(() => {
    output = [];
    process.stderr.write = vi.fn((chunk: string | Uint8Array) => {
      output.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stderr.write = originalWrite;
    delete process.env['CC_INTEL_LOG_LEVEL'];
  });

  it('writes to stderr, not stdout', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write');
    const logger = createLogger('test');
    logger.info('hello');
    expect(output.length).toBe(1);
    expect(stdoutSpy).not.toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });

  it('formats messages with timestamp, level, and name', () => {
    const logger = createLogger('mymodule');
    logger.info('test message');
    expect(output[0]).toMatch(/\[\d{4}-.*\] \[INFO\] \[mymodule\] test message/);
  });

  it('respects log level from env', () => {
    process.env['CC_INTEL_LOG_LEVEL'] = 'error';
    const logger = createLogger('test');
    logger.info('should not appear');
    logger.warn('should not appear');
    logger.error('should appear');
    expect(output.length).toBe(1);
    expect(output[0]).toContain('[ERROR]');
  });

  it('defaults to info level', () => {
    const logger = createLogger('test');
    logger.debug('should not appear');
    logger.info('should appear');
    expect(output.length).toBe(1);
    expect(output[0]).toContain('[INFO]');
  });
});
