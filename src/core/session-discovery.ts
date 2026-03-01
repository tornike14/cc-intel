import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('session-discovery');

/** Convert a filesystem path to the Claude projects directory name. */
export function encodeProjectPath(projectRoot: string): string {
  return projectRoot.replace(/^([A-Za-z]):/, '$1-').replace(/[\\/]/g, '-');
}

/** Reverse a Claude projects directory name back to a filesystem path. */
export async function decodeProjectPath(dirName: string): Promise<string> {
  const isWindows = /^[A-Za-z]--/.test(dirName);

  let segments: string[];
  if (isWindows) {
    const drive = dirName[0]!;
    const rest = dirName.slice(3);
    segments = rest.length > 0 ? rest.split('-') : [];
    const naivePath = `${drive}:\\${segments.join('\\')}`;

    const resolved = await resolveSegments(segments, `${drive}:\\`);
    return resolved ?? naivePath;
  }

  if (dirName.startsWith('-')) {
    segments = dirName.slice(1).split('-');
    const naivePath = `/${segments.join('/')}`;

    const resolved = await resolveSegments(segments, '/');
    return resolved ?? naivePath;
  }

  return dirName;
}

/** Resolve ambiguous segments by probing the filesystem with greedy hyphen merging. */
async function resolveSegments(
  segments: string[],
  root: string,
): Promise<string | null> {
  if (segments.length === 0) return root;

  let current = root;
  let i = 0;

  while (i < segments.length) {
    let found = false;

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
        // not found, try shorter merge
      }
    }

    if (!found) {
      return null;
    }
  }

  return current;
}

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

export async function listProjects(): Promise<ProjectInfo[]> {
  const projectsRoot = path.join(os.homedir(), '.claude', 'projects');

  try {
    await fs.access(projectsRoot);
  } catch {
    logger.info(`No Claude projects directory found at ${projectsRoot}`);
    return [];
  }

  const entries = await fs.readdir(projectsRoot, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());

  const results = await Promise.all(
    dirs.map(async (entry): Promise<ProjectInfo | null> => {
      const projectDir = path.join(projectsRoot, entry.name);
      const [{ sessionCount, lastModifiedMs }, decodedPath] = await Promise.all([
        scanSessionFiles(projectDir),
        decodeProjectPath(entry.name),
      ]);

      if (sessionCount === 0) return null;

      return {
        dirName: entry.name,
        decodedPath,
        name: path.basename(decodedPath),
        sessionCount,
        lastModifiedMs,
        projectDir,
      };
    }),
  );

  const projects = results.filter((p): p is ProjectInfo => p !== null);
  projects.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs);
  return projects;
}

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

export async function discoverLatestSession(cwd?: string): Promise<string | null> {
  const workDir = cwd ?? process.cwd();

  let projectRoot: string;
  try {
    projectRoot = await getGitRoot(workDir);
  } catch {
    projectRoot = workDir;
  }

  const dirName = encodeProjectPath(projectRoot);
  const projectsDir = path.join(os.homedir(), '.claude', 'projects', dirName);

  return discoverLatestSessionInProject(projectsDir);
}

export async function discoverProjectMemoryPath(cwd?: string): Promise<string | null> {
  const workDir = cwd ?? process.cwd();

  let projectRoot: string;
  try {
    projectRoot = await getGitRoot(workDir);
  } catch {
    projectRoot = workDir;
  }

  const dirName = encodeProjectPath(projectRoot);
  const memoryPath = path.join(
    os.homedir(),
    '.claude',
    'projects',
    dirName,
    'memory',
    'MEMORY.md',
  );

  try {
    await fs.access(memoryPath);
    return memoryPath;
  } catch {
    return null;
  }
}

export function memoryPathFromSession(sessionPath: string): string {
  return path.join(path.dirname(sessionPath), 'memory', 'MEMORY.md');
}

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
