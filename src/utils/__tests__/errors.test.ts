import { describe, it, expect } from 'vitest';
import {
  StaleWriteError,
  LockAcquisitionError,
  BudgetExceededError,
  ParseError,
} from '../errors.js';

describe('StaleWriteError', () => {
  it('has correct name and message', () => {
    const err = new StaleWriteError('/path/to/file');
    expect(err.name).toBe('StaleWriteError');
    expect(err.message).toContain('/path/to/file');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('LockAcquisitionError', () => {
  it('has correct name and message', () => {
    const err = new LockAcquisitionError('/path/to/file');
    expect(err.name).toBe('LockAcquisitionError');
    expect(err.message).toContain('/path/to/file');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('BudgetExceededError', () => {
  it('has correct name and message', () => {
    const err = new BudgetExceededError('recentDecisions', 70, 60);
    expect(err.name).toBe('BudgetExceededError');
    expect(err.message).toContain('recentDecisions');
    expect(err.message).toContain('70');
    expect(err.message).toContain('60');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('ParseError', () => {
  it('has correct name and message', () => {
    const err = new ParseError('Invalid JSON at line 5');
    expect(err.name).toBe('ParseError');
    expect(err.message).toBe('Invalid JSON at line 5');
    expect(err).toBeInstanceOf(Error);
  });
});
