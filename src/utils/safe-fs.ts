import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import lockfile from 'proper-lockfile';
import { StaleWriteError, LockAcquisitionError } from './errors.js';
import { createLogger } from './logger.js';

const logger = createLogger('safe-fs');

export interface FileSnapshot {
  content: string;
  mtime: number;
  path: string;
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function readMtime(filePath: string): Promise<number> {
  const stat = await fs.stat(filePath);
  return stat.mtimeMs;
}

export async function safeReadFile(filePath: string): Promise<FileSnapshot> {
  const content = await fs.readFile(filePath, 'utf-8');
  const mtime = await readMtime(filePath);
  return { content, mtime, path: filePath };
}

export async function safeWriteFile(
  filePath: string,
  content: string,
  expectedMtime?: number,
): Promise<void> {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const exists = await fileExists(filePath);
  if (exists) {
    const backupPath = filePath + '.bak';
    await fs.copyFile(filePath, backupPath);
    logger.debug(`Backup created: ${backupPath}`);
  }

  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(filePath, {
      retries: { retries: 3, minTimeout: 100, maxTimeout: 1000 },
      realpath: false,
    });
  } catch {
    throw new LockAcquisitionError(filePath);
  }

  try {
    if (expectedMtime !== undefined && exists) {
      const currentMtime = await readMtime(filePath);
      if (Math.abs(currentMtime - expectedMtime) > 1) {
        throw new StaleWriteError(filePath);
      }
    }

    const tmpSuffix = crypto.randomBytes(6).toString('hex');
    const tmpPath = `${filePath}.tmp.${tmpSuffix}`;
    await fs.writeFile(tmpPath, content, 'utf-8');

    await fs.rename(tmpPath, filePath);
    logger.debug(`Atomic write completed: ${filePath}`);
  } finally {
    if (release) {
      await release();
    }
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
