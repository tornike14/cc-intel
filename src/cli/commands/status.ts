import { Command } from 'commander';
import os from 'node:os';
import path from 'node:path';
import { MemorySection, DEFAULT_MEMORY_BUDGET } from '../../models/index.js';
import { parseMemoryDocument } from '../../core/memory-parser.js';
import { discoverProjectMemoryPath } from '../../core/session-discovery.js';
import { safeReadFile } from '../../utils/safe-fs.js';

export function createStatusCommand(): Command {
  return new Command('status')
    .description('Show MEMORY.md health, budget utilization, and section breakdown')
    .option('-m, --memory <path>', 'MEMORY.md path (default: project-specific)')
    .option('--json', 'Output as JSON')
    .action(async (options: { memory?: string; json?: boolean }) => {
      const memoryPath = options.memory ?? (await resolveMemoryPath());

      let content: string;
      try {
        const snapshot = await safeReadFile(memoryPath);
        content = snapshot.content;
      } catch {
        process.stdout.write(`No MEMORY.md found at ${memoryPath}\n`);
        return;
      }

      const doc = parseMemoryDocument(content);
      const budget = DEFAULT_MEMORY_BUDGET;

      const status = {
        path: memoryPath,
        totalLines: doc.totalLines,
        maxLines: budget.maxLines,
        utilizationPercent: Math.round((doc.totalLines / budget.maxLines) * 100),
        sections: Object.values(MemorySection).map((section) => ({
          name: section,
          lines: doc.sections[section].lineCount,
          limit: budget.sectionLimits[section],
          percent: Math.round(
            (doc.sections[section].lineCount / budget.sectionLimits[section]) * 100,
          ),
        })),
      };

      if (options.json) {
        process.stdout.write(JSON.stringify(status, null, 2) + '\n');
        return;
      }

      process.stdout.write(`MEMORY.md Status: ${memoryPath}\n`);
      process.stdout.write(
        `Total: ${status.totalLines}/${status.maxLines} lines (${status.utilizationPercent}%)\n\n`,
      );

      for (const section of status.sections) {
        const bar = makeBar(section.percent / 100);
        process.stdout.write(
          `  ${section.name}: ${section.lines}/${section.limit} ${bar} ${section.percent}%\n`,
        );
      }
      process.stdout.write('\n');
    });
}

function makeBar(percent: number): string {
  const filled = Math.round(Math.min(percent, 1) * 15);
  const empty = 15 - filled;
  return `[${'#'.repeat(filled)}${'.'.repeat(empty)}]`;
}

async function resolveMemoryPath(): Promise<string> {
  const projectMemory = await discoverProjectMemoryPath();
  if (projectMemory) return projectMemory;
  return path.join(os.homedir(), '.claude', 'MEMORY.md');
}
