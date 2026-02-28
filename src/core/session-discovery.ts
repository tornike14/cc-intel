import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('session-discovery');

// ---------------------------------------------------------------------------
// Path encoding / decoding
// ---------------------------------------------------------------------------

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
 * Reverse a Claude projects directory name back to a filesystem path.
 *
 * The encoding is lossy — hyphens in original directory names (e.g., "cc-intel")
 * are indistinguishable from path separator hyphens. This function does a naive
 * decode first, then probes the filesystem to resolve ambiguous segments.
 *
 * If the path cannot be resolved on disk (e.g., project was deleted), the naive
 * decode is returned as a best-effort display value.
 */
export async function decodeProjectPath(dirName: string): Promise<string> {
  const isWindows = /^[A-Za-z]--/.test(dirName);

  let segments: string[];
  if (isWindows) {
    // "C--Users-foo-bar" → drive="C", rest segments ["Users","foo","bar"]
    const drive = dirName[0]!;
    const rest = dirName.slice(3); // skip "X--"
    segments = rest.length > 0 ? rest.split('-') : [];
    const naivePath = `${drive}:\\${segments.join('\\')}`;

    const resolved = await resolveSegments(segments, `${drive}:\\`);
    return resolved ?? naivePath;
  }

  // Unix: "-Users-foo-bar" → segments ["Users","foo","bar"]
  if (dirName.startsWith('-')) {
    segments = dirName.slice(1).split('-');
    const naivePath = `/${segments.join('/')}`;

    const resolved = await resolveSegments(segments, '/');
    return resolved ?? naivePath;
  }

  // Unknown format
  return dirName;
}

/**
 * Walk path segments left-to-right, greedily merging adjacent segments with
 * hyphens when the simple separator-split doesn't resolve to a real directory.
 *
 * For "-Users-nizhara-Desktop-cc-intel":
 *   segments = ["Users", "nizhara", "Desktop", "cc", "intel"]
 *   /Users exists → consume "Users"
 *   /Users/nizhara exists → consume "nizhara"
 *   /Users/nizhara/Desktop exists → consume "Desktop"
 *   /Users/nizhara/Desktop/cc does NOT exist →
 *     try /Users/nizhara/Desktop/cc-intel → exists! consume "cc-intel"
 *   Result: /Users/nizhara/Desktop/cc-intel
 */
async function resolveSegments(
  segments: string[],
  root: string,
): Promise<string | null> {
  if (segments.length === 0) return root;

  let current = root;
  let i = 0;

  while (i < segments.length) {
    let found = false;

    // Try merging from longest possible (all remaining) down to single segment
    for (let end = segments.length; end > i; end--) {
      const candidate = segments.slice(i, end).join('-');
      const testPath = path.join(current, candidate);

      try {
        await fs.access(testPath);
        current = testPath;
        i = end;
        found = true;
        break;
      } catch {
        // Try shorter merge
      }
    }

    if (!found) {
      // No merge resolved — give up, return null to use naive fallback
      return null;
    }
  }

  return current;
}

// ---------------------------------------------------------------------------
// Project listing
// ---------------------------------------------------------------------------

export interface ProjectInfo {
  /** Encoded directory name (e.g., "-Users-foo-bar") */
  dirName: string;
  /** Best-effort decoded filesystem path */
  decodedPath: string;
  /** Short display name (basename of decoded path) */
  name: string;
  /** Number of .jsonl session files */
  sessionCount: number;
  /** Timestamp (ms) of the most recently modified session */
  lastModifiedMs: number;
  /** Absolute path to the project directory under ~/.claude/projects/ */
  projectDir: string;
}

/**
 * List all Claude Code projects that have session files.
 * Returns projects sorted by last modified (most recent first).
 */
export async function listProjects(): Promise<ProjectInfo[]> {
  const projectsRoot = path.join(os.homedir(), '.claude', 'projects');

  try {
    await fs.access(projectsRoot);
  } catch {
    logger.info(`No Claude projects directory found at ${projectsRoot}`);
    return [];
  }

  const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
  const projects: ProjectInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const projectDir = path.join(projectsRoot, entry.name);
    const { sessionCount, lastModifiedMs } = await scanSessionFiles(projectDir);

    if (sessionCount === 0) continue;

    const decodedPath = await decodeProjectPath(entry.name);
    projects.push({
      dirName: entry.name,
      decodedPath,
      name: path.basename(decodedPath),
      sessionCount,
      lastModifiedMs,
      projectDir,
    });
  }

  projects.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs);
  return projects;
}

// ---------------------------------------------------------------------------
// Session discovery
// ---------------------------------------------------------------------------

/**
 * Find the latest session file within a specific project directory.
 */
export async function discoverLatestSessionInProject(
  projectDir: string,
): Promise<string | null> {
  const { files } = await scanSessionFilesWithPaths(projectDir);

  if (files.length === 0) {
    logger.info(`No session files found in ${projectDir}`);
    return null;
  }

  files.sort((a, b) => b.mtime - a.mtime);
  const latest = files[0]!.path;
  logger.info(`Discovered session in project: ${latest}`);
  return latest;
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

  return discoverLatestSessionInProject(projectsDir);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function scanSessionFiles(
  dir: string,
): Promise<{ sessionCount: number; lastModifiedMs: number }> {
  const { files } = await scanSessionFilesWithPaths(dir);
  const lastModifiedMs = files.reduce((max, f) => Math.max(max, f.mtime), 0);
  return { sessionCount: files.length, lastModifiedMs };
}

async function scanSessionFilesWithPaths(
  dir: string,
): Promise<{ files: { path: string; mtime: number }[] }> {
  try {
    await fs.access(dir);
  } catch {
    return { files: [] };
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: { path: string; mtime: number }[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
    const filePath = path.join(dir, entry.name);
    try {
      const stat = await fs.stat(filePath);
      files.push({ path: filePath, mtime: stat.mtimeMs });
    } catch {
      // Skip files we can't stat
    }
  }

  return { files };
}

function getGitRoot(cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['rev-parse', '--show-toplevel'], { cwd }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}
