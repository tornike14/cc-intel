import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('session-discovery');

/**
 * Convert a filesystem path to the Claude projects directory name.
 *
 * Claude Code encodes project paths by replacing path separators with hyphens.
 * On Windows, the colon after the drive letter is also removed:
 *   /Users/foo/bar      → -Users-foo-bar
 *   C:\Users\foo\bar    → C--Users-foo-bar
 *
 * @internal Exported for testing only.
 */
export function encodeProjectPath(projectRoot: string): string {
  // Replace Windows drive colon with hyphen (C:\... → C-\...)
  // Then replace both forward and back slashes with hyphens
  // Result: C:\Users\foo → C-\Users\foo → C--Users-foo
  return projectRoot.replace(/^([A-Za-z]):/, '$1-').replace(/[\\/]/g, '-');
}

/**
 * Discover the most recent Claude Code session file for the current project.
 *
 * Resolution:
 * 1. Find git repo root (or fall back to cwd)
 * 2. Convert path to Claude projects directory name
 * 3. Find *.jsonl files in ~/.claude/projects/<dir>/
 * 4. Return the most recently modified one
 */
export async function discoverLatestSession(cwd?: string): Promise<string | null> {
  const workDir = cwd ?? process.cwd();

  // Resolve to git root if possible
  let projectRoot: string;
  try {
    projectRoot = await getGitRoot(workDir);
  } catch {
    projectRoot = workDir;
  }

  // Convert path to Claude projects directory name
  const dirName = encodeProjectPath(projectRoot);
  const projectsDir = path.join(os.homedir(), '.claude', 'projects', dirName);

  try {
    await fs.access(projectsDir);
  } catch {
    logger.info(`No Claude projects directory found at ${projectsDir}`);
    return null;
  }

  // Find all JSONL session files
  const entries = await fs.readdir(projectsDir, { withFileTypes: true });
  const jsonlFiles: { path: string; mtime: number }[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
    const filePath = path.join(projectsDir, entry.name);
    try {
      const stat = await fs.stat(filePath);
      jsonlFiles.push({ path: filePath, mtime: stat.mtimeMs });
    } catch {
      // Skip files we can't stat
    }
  }

  if (jsonlFiles.length === 0) {
    logger.info(`No session files found in ${projectsDir}`);
    return null;
  }

  // Sort by mtime descending, return the most recent
  jsonlFiles.sort((a, b) => b.mtime - a.mtime);
  const latest = jsonlFiles[0]!.path;
  logger.info(`Discovered session: ${latest}`);
  return latest;
}

function getGitRoot(cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['rev-parse', '--show-toplevel'], { cwd }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}
