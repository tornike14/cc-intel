import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { safeReadFile, safeWriteFile, ensureDir } from '../safe-fs.js';
import { StaleWriteError } from '../errors.js';

describe('safe-fs', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-intel-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('ensureDir', () => {
    it('creates nested directories', async () => {
      const nested = path.join(tmpDir, 'a', 'b', 'c');
      await ensureDir(nested);
      const stat = await fs.stat(nested);
      expect(stat.isDirectory()).toBe(true);
    });

    it('is idempotent', async () => {
      const dir = path.join(tmpDir, 'exists');
      await ensureDir(dir);
      await ensureDir(dir); // no error
    });
  });

  describe('safeReadFile', () => {
    it('reads content and captures mtime', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      await fs.writeFile(filePath, 'hello world', 'utf-8');
      const snapshot = await safeReadFile(filePath);
      expect(snapshot.content).toBe('hello world');
      expect(snapshot.mtime).toBeGreaterThan(0);
      expect(snapshot.path).toBe(filePath);
    });
  });

  describe('safeWriteFile', () => {
    it('creates a new file', async () => {
      const filePath = path.join(tmpDir, 'new.txt');
      await safeWriteFile(filePath, 'new content');
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('new content');
    });

    it('creates backup before overwrite', async () => {
      const filePath = path.join(tmpDir, 'existing.txt');
      await fs.writeFile(filePath, 'original', 'utf-8');

      await safeWriteFile(filePath, 'updated');

      const backup = await fs.readFile(filePath + '.bak', 'utf-8');
      expect(backup).toBe('original');

      const current = await fs.readFile(filePath, 'utf-8');
      expect(current).toBe('updated');
    });

    it('throws StaleWriteError on mtime mismatch', async () => {
      const filePath = path.join(tmpDir, 'stale.txt');
      await fs.writeFile(filePath, 'original', 'utf-8');

      const fakeMtime = Date.now() - 100_000;
      await expect(safeWriteFile(filePath, 'new', fakeMtime)).rejects.toThrow(StaleWriteError);
    });

    it('succeeds with correct mtime', async () => {
      const filePath = path.join(tmpDir, 'correct.txt');
      await fs.writeFile(filePath, 'original', 'utf-8');

      const snapshot = await safeReadFile(filePath);
      await safeWriteFile(filePath, 'updated', snapshot.mtime);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('updated');
    });

    it('creates parent directories if needed', async () => {
      const filePath = path.join(tmpDir, 'deep', 'nested', 'file.txt');
      await safeWriteFile(filePath, 'content');
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('content');
    });

    it('does not leave temp files on success', async () => {
      const filePath = path.join(tmpDir, 'clean.txt');
      await safeWriteFile(filePath, 'content');
      const files = await fs.readdir(tmpDir);
      const tmpFiles = files.filter((f) => f.includes('.tmp.'));
      expect(tmpFiles).toHaveLength(0);
    });
  });
});
