export class StaleWriteError extends Error {
  constructor(path: string) {
    super(`File was modified externally: ${path}`);
    this.name = 'StaleWriteError';
  }
}

export class LockAcquisitionError extends Error {
  constructor(path: string) {
    super(`Failed to acquire lock for: ${path}`);
    this.name = 'LockAcquisitionError';
  }
}

export class BudgetExceededError extends Error {
  constructor(section: string, current: number, limit: number) {
    super(`Budget exceeded for ${section}: ${current} lines > ${limit} limit`);
    this.name = 'BudgetExceededError';
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export class LlmExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmExtractionError';
  }
}
