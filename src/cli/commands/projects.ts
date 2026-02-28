import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  listProjects,
  discoverLatestSessionInProject,
  type ProjectInfo,
} from '../../core/session-discovery.js';
import { parseSession } from '../../core/session-parser.js';
import { segmentSession } from '../../core/segmenter.js';
import { extractSnapshot } from '../../core/snapshot.js';
import { assessRisk } from '../../core/risk.js';
import { parseMemoryDocument } from '../../core/memory-parser.js';
import { serializeMemoryDocument } from '../../core/memory-serializer.js';
import { mergeIntoMemory } from '../../core/memory-merger.js';
import { DEFAULT_MEMORY_BUDGET, RiskLevel, type CcIntelConfig } from '../../models/index.js';
import { safeWriteFile, safeReadFile } from '../../utils/safe-fs.js';
import {
  formatSnapshotAsMarkdown,
} from '../formatters/snapshot-formatter.js';
import {
  formatRiskAsMarkdown,
} from '../formatters/risk-formatter.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('projects');

export function createProjectsCommand(config?: CcIntelConfig): Command {
  return new Command('projects')
    .description('List Claude Code projects and run a command on a selected one')
    .option('--json', 'Output project list as JSON (non-interactive)')
    .action(async (options: { json?: boolean }) => {
      const projects = await listProjects();

      if (projects.length === 0) {
        process.stdout.write('No Claude Code projects found.\n');
        return;
      }

      // Non-interactive JSON mode
      if (options.json) {
        const output = projects.map((p) => ({
          name: p.name,
          path: p.decodedPath,
          dirName: p.dirName,
          sessionCount: p.sessionCount,
          lastModified: new Date(p.lastModifiedMs).toISOString(),
        }));
        process.stdout.write(JSON.stringify(output, null, 2) + '\n');
        return;
      }

      // Interactive mode — dynamic import to avoid loading inquirer in CI
      const { default: select } = await import('@inquirer/select');

      // Step 1: Select a project
      const selectedProject = await select<ProjectInfo>({
        message: 'Select a project:',
        choices: projects.map((p) => ({
          name: formatProjectChoice(p),
          value: p,
        })),
      });

      // Step 2: Select a command
      const selectedCommand = await select<string>({
        message: 'Which command?',
        choices: [
          { name: 'snapshot  - extract structured knowledge', value: 'snapshot' },
          { name: 'risk      - assess compaction risk', value: 'risk' },
          { name: 'preserve  - save knowledge to MEMORY.md', value: 'preserve' },
        ],
      });

      // Step 3: Discover the latest session and run
      const sessionPath = await discoverLatestSessionInProject(selectedProject.projectDir);
      if (!sessionPath) {
        process.stderr.write(`No session files found in ${selectedProject.projectDir}\n`);
        process.exitCode = 1;
        return;
      }

      process.stderr.write(`\nUsing session: ${sessionPath}\n\n`);
      const input = await fs.readFile(sessionPath, 'utf-8');

      await runSubcommand(selectedCommand, input, config);
    });
}

async function runSubcommand(
  command: string,
  input: string,
  config?: CcIntelConfig,
): Promise<void> {
  switch (command) {
    case 'snapshot': {
      const session = parseSession(input);
      const segmented = segmentSession(session.messages);
      const snapshot = extractSnapshot(segmented);
      process.stdout.write(formatSnapshotAsMarkdown(snapshot));
      break;
    }
    case 'risk': {
      const session = parseSession(input);
      const maxContext = config?.maxContext ?? 200_000;
      const metrics = assessRisk(session.messages, maxContext, config?.riskThresholds);
      process.stdout.write(formatRiskAsMarkdown(metrics));
      if (metrics.riskLevel === RiskLevel.High || metrics.riskLevel === RiskLevel.Critical) {
        process.exitCode = 1;
      }
      break;
    }
    case 'preserve': {
      const session = parseSession(input);
      const segmented = segmentSession(session.messages);
      const snapshot = extractSnapshot(segmented);

      const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '.';
      const memoryPath = path.join(home, '.claude', 'MEMORY.md');

      let existingContent = '';
      let existingMtime: number | undefined;
      try {
        const fileSnapshot = await safeReadFile(memoryPath);
        existingContent = fileSnapshot.content;
        existingMtime = fileSnapshot.mtime;
      } catch {
        logger.info('No existing MEMORY.md, will create new');
      }

      const existingDoc = parseMemoryDocument(existingContent);
      const budget = config?.memoryBudget ?? DEFAULT_MEMORY_BUDGET;
      const { updatedDoc, entriesAdded, entriesDeduplicated } = mergeIntoMemory(
        existingDoc,
        snapshot,
        budget,
      );

      const serialized = serializeMemoryDocument(updatedDoc);
      await safeWriteFile(memoryPath, serialized, existingMtime);
      process.stdout.write(`Preserved ${entriesAdded} entries to ${memoryPath}\n`);
      if (entriesDeduplicated > 0) {
        process.stdout.write(`Deduplicated ${entriesDeduplicated} entries\n`);
      }
      break;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      process.exitCode = 1;
  }
}

function formatProjectChoice(project: ProjectInfo): string {
  const age = formatRelativeTime(project.lastModifiedMs);
  const sessions =
    project.sessionCount === 1 ? '1 session' : `${project.sessionCount} sessions`;
  return `${project.name} (${project.decodedPath})    ${sessions}, last: ${age}`;
}

function formatRelativeTime(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
