import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  encodeProjectPath,
  decodeProjectPath,
  listProjects,
  discoverLatestSessionInProject,
  memoryPathFromSession,
} from '../session-discovery.js';

describe('encodeProjectPath', () => {
  it('encodes Unix absolute path', () => {
    expect(encodeProjectPath('/Users/foo/myproject')).toBe('-Users-foo-myproject');
  });

  it('encodes macOS path with leading slash', () => {
    expect(encodeProjectPath('/Users/nizhara/Desktop/cc-intel')).toBe(
      '-Users-nizhara-Desktop-cc-intel',
    );
  });

  it('encodes Linux home path', () => {
    expect(encodeProjectPath('/home/olduser/project-a')).toBe('-home-olduser-project-a');
  });

  it('encodes Windows path with drive letter', () => {
    expect(encodeProjectPath('C:\\Users\\foo\\myproject')).toBe('C--Users-foo-myproject');
  });

  it('encodes Windows path with different drive letter', () => {
    expect(encodeProjectPath('D:\\git\\MyRepo')).toBe('D--git-MyRepo');
  });

  it('handles Windows drive root', () => {
    expect(encodeProjectPath('Z:\\')).toBe('Z--');
  });

  it('handles forward slashes on Windows-style paths', () => {
    expect(encodeProjectPath('C:/Users/foo/myproject')).toBe('C--Users-foo-myproject');
  });
});

describe('decodeProjectPath', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-intel-decode-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('decodes simple Unix path when directory exists', async () => {
    // Create /tmp/.../Users/foo/bar
    const targetDir = path.join(tmpDir, 'Users', 'foo', 'bar');
    await fs.mkdir(targetDir, { recursive: true });

    // Encode the path, then decode
    const fullPath = path.join(tmpDir, 'Users', 'foo', 'bar');
    const encoded = encodeProjectPath(fullPath);
    const decoded = await decodeProjectPath(encoded);
    expect(decoded).toBe(fullPath);
  });

  it('resolves hyphenated directory names via filesystem probing', async () => {
    // Create /tmp/.../app/my-project (with hyphen in name)
    const targetDir = path.join(tmpDir, 'app', 'my-project');
    await fs.mkdir(targetDir, { recursive: true });

    const encoded = encodeProjectPath(targetDir);
    // encoded would be something like "-tmp-xxx-app-my-project"
    // naive decode would give .../app/my/project (wrong)

    const decoded = await decodeProjectPath(encoded);
    expect(decoded).toBe(targetDir);
  });

  it('handles real cc-intel style path', async () => {
    // Simulate: /tmp/.../Desktop/cc-intel
    const targetDir = path.join(tmpDir, 'Desktop', 'cc-intel');
    await fs.mkdir(targetDir, { recursive: true });

    const encoded = encodeProjectPath(targetDir);
    const decoded = await decodeProjectPath(encoded);
    expect(decoded).toBe(targetDir);
  });

  it('falls back to naive decode when path does not exist on disk', async () => {
    const decoded = await decodeProjectPath('-nonexistent-path-here');
    // Naive decode: /nonexistent/path/here
    expect(decoded).toBe('/nonexistent/path/here');
  });

  it('returns unknown format as-is', async () => {
    const decoded = await decodeProjectPath('no-leading-separator');
    expect(decoded).toBe('no-leading-separator');
  });
});

describe('listProjects', () => {
  let tmpDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-intel-projects-'));
    originalHome = process.env['HOME'];
    const projectsRoot = path.join(tmpDir, '.claude', 'projects');
    await fs.mkdir(projectsRoot, { recursive: true });
    process.env['HOME'] = tmpDir;
  });

  afterEach(async () => {
    process.env['HOME'] = originalHome;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when no projects exist', async () => {
    const projects = await listProjects();
    expect(projects).toEqual([]);
  });

  it('returns empty array when projects dir does not exist', async () => {
    process.env['HOME'] = path.join(tmpDir, 'nonexistent');
    const projects = await listProjects();
    expect(projects).toEqual([]);
  });

  it('discovers projects with session files', async () => {
    const projectsRoot = path.join(tmpDir, '.claude', 'projects');
    const projDir = path.join(projectsRoot, '-tmp-foo-bar');
    await fs.mkdir(projDir, { recursive: true });
    await fs.writeFile(path.join(projDir, 'abc123.jsonl'), '{}');

    const projects = await listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]!.dirName).toBe('-tmp-foo-bar');
    expect(projects[0]!.sessionCount).toBe(1);
  });

  it('counts multiple session files', async () => {
    const projectsRoot = path.join(tmpDir, '.claude', 'projects');
    const projDir = path.join(projectsRoot, '-tmp-myapp');
    await fs.mkdir(projDir, { recursive: true });
    await fs.writeFile(path.join(projDir, 'session1.jsonl'), '{}');
    await fs.writeFile(path.join(projDir, 'session2.jsonl'), '{}');
    await fs.writeFile(path.join(projDir, 'session3.jsonl'), '{}');

    const projects = await listProjects();
    expect(projects[0]!.sessionCount).toBe(3);
  });

  it('skips directories with no session files', async () => {
    const projectsRoot = path.join(tmpDir, '.claude', 'projects');
    const projDir = path.join(projectsRoot, '-tmp-empty');
    await fs.mkdir(path.join(projDir, 'memory'), { recursive: true });

    const projects = await listProjects();
    expect(projects).toHaveLength(0);
  });

  it('sorts projects by last modified descending', async () => {
    const projectsRoot = path.join(tmpDir, '.claude', 'projects');

    const oldDir = path.join(projectsRoot, '-tmp-old');
    await fs.mkdir(oldDir, { recursive: true });
    await fs.writeFile(path.join(oldDir, 'old.jsonl'), '{}');

    // Small delay to get different mtimes
    await new Promise((r) => setTimeout(r, 50));

    const newDir = path.join(projectsRoot, '-tmp-new');
    await fs.mkdir(newDir, { recursive: true });
    await fs.writeFile(path.join(newDir, 'new.jsonl'), '{}');

    const projects = await listProjects();
    expect(projects).toHaveLength(2);
    expect(projects[0]!.dirName).toBe('-tmp-new');
    expect(projects[1]!.dirName).toBe('-tmp-old');
  });

  it('ignores non-jsonl files in session count', async () => {
    const projectsRoot = path.join(tmpDir, '.claude', 'projects');
    const projDir = path.join(projectsRoot, '-tmp-mixed');
    await fs.mkdir(projDir, { recursive: true });
    await fs.writeFile(path.join(projDir, 'session.jsonl'), '{}');
    await fs.writeFile(path.join(projDir, 'sessions-index.json'), '{}');
    await fs.writeFile(path.join(projDir, 'notes.txt'), 'hi');

    const projects = await listProjects();
    expect(projects[0]!.sessionCount).toBe(1);
  });
});

describe('discoverLatestSessionInProject', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-intel-discover-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns latest session file by mtime', async () => {
    await fs.writeFile(path.join(tmpDir, 'old.jsonl'), '{}');
    await new Promise((r) => setTimeout(r, 50));
    await fs.writeFile(path.join(tmpDir, 'new.jsonl'), '{}');

    const latest = await discoverLatestSessionInProject(tmpDir);
    expect(latest).toBe(path.join(tmpDir, 'new.jsonl'));
  });

  it('returns null when no jsonl files exist', async () => {
    await fs.writeFile(path.join(tmpDir, 'notes.txt'), 'hi');

    const latest = await discoverLatestSessionInProject(tmpDir);
    expect(latest).toBeNull();
  });

  it('returns null for non-existent directory', async () => {
    const latest = await discoverLatestSessionInProject('/nonexistent/path');
    expect(latest).toBeNull();
  });
});

describe('memoryPathFromSession', () => {
  it('derives memory path from session file path', () => {
    const sessionPath = '/home/user/.claude/projects/-Users-foo-bar/abc123.jsonl';
    expect(memoryPathFromSession(sessionPath)).toBe(
      '/home/user/.claude/projects/-Users-foo-bar/memory/MEMORY.md',
    );
  });

  it('handles nested project directories', () => {
    const sessionPath = '/Users/nizhara/.claude/projects/-Users-nizhara-Desktop-cc-intel/cd063.jsonl';
    expect(memoryPathFromSession(sessionPath)).toBe(
      '/Users/nizhara/.claude/projects/-Users-nizhara-Desktop-cc-intel/memory/MEMORY.md',
    );
  });
});
