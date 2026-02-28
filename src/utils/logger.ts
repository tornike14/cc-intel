type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getLogLevel(): LogLevel {
  const env = process.env['CC_INTEL_LOG_LEVEL']?.toLowerCase();
  if (env && env in LOG_LEVELS) return env as LogLevel;
  return 'info';
}

function formatMessage(level: LogLevel, name: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] [${name}] ${message}`;
}

export interface Logger {
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export function createLogger(name: string): Logger {
  const threshold = LOG_LEVELS[getLogLevel()];

  const log = (level: LogLevel, message: string) => {
    if (LOG_LEVELS[level] >= threshold) {
      process.stderr.write(formatMessage(level, name, message) + '\n');
    }
  };

  return {
    debug: (message: string) => log('debug', message),
    info: (message: string) => log('info', message),
    warn: (message: string) => log('warn', message),
    error: (message: string) => log('error', message),
  };
}
