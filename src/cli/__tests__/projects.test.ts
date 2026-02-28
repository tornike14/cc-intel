import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { listProjects } from '../../core/session-discovery.js';

describe('projects --json output shape', () => {
  let tmpDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cc-intel-projects-cli-'));
    originalHome = process.env['HOME'];
    process.env['HOME'] = tmpDir;
  });

  afterEach(async () => {
    process.env['HOME'] = originalHome;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('produces valid JSON structure from listProjects', async () => {
    const projectsRoot = path.join(tmpDir, '.claude', 'projects');
    const projDir = path.join(projectsRoot, '-tmp-test-myapp');
    await fs.mkdir(projDir, { recursive: true });
    await fs.writeFile(path.join(projDir, 'sess.jsonl'), '{}');

    const projects = await listProjects();
    expect(projects).toHaveLength(1);

    // Simulate the --json output transformation (same as projects.ts)
    const output = projects.map((p) => ({
      name: p.name,
      path: p.decodedPath,
      dirName: p.dirName,
      sessionCount: p.sessionCount,
      lastModified: new Date(p.lastModifiedMs).toISOString(),
    }));

    expect(output[0]).toMatchObject({
      dirName: '-tmp-test-myapp',
      sessionCount: 1,
    });
    expect(output[0]!.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns empty array when no projects', async () => {
    const projectsRoot = path.join(tmpDir, '.claude', 'projects');
    await fs.mkdir(projectsRoot, { recursive: true });

    const projects = await listProjects();
    expect(projects).toEqual([]);
  });
});
