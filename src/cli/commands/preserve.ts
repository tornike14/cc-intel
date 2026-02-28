import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_MEMORY_BUDGET, type CcIntelConfig } from '../../models/index.js';
import { parseSession } from '../../core/session-parser.js';
import { segmentSession } from '../../core/segmenter.js';
import { extractSnapshot } from '../../core/snapshot.js';
import { parseMemoryDocument } from '../../core/memory-parser.js';
import { serializeMemoryDocument } from '../../core/memory-serializer.js';
import { mergeIntoMemory } from '../../core/memory-merger.js';
import { discoverLatestSession } from '../../core/session-discovery.js';
import { safeWriteFile, safeReadFile, ensureDir } from '../../utils/safe-fs.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('preserve');

export function createPreserveCommand(config?: CcIntelConfig): Command {
  const defaultMaxLines = config?.memoryBudget?.maxLines?.toString() ?? '200';

  return new Command('preserve')
    .description('Merge session knowledge into MEMORY.md with deduplication')
    .argument('[file]', 'Session file (default: latest from current project)')
    .option('-i, --input <path>', 'Session file path')
    .option('-f, --format <fmt>', 'Input format: auto, jsonl, markdown', 'auto')
    .option('-m, --memory <path>', 'MEMORY.md path', resolveDefaultMemoryPath())
    .option('--dry-run', 'Preview changes without writing')
    .option('--max-lines <n>', 'Max MEMORY.md lines', defaultMaxLines)
    .action(
      async (
        file: string | undefined,
        options: {
          input?: string;
          format: string;
          memory: string;
          dryRun?: boolean;
          maxLines: string;
        },
      ) => {
        // 1. Read session input
        const input = await resolveInput(file, options.input);
        if (!input) return;

        // 2. Parse and extract snapshot
        const session = parseSession(input, options.format as 'auto' | 'jsonl' | 'markdown');
        const segmented = segmentSession(session.messages);
        const snapshot = extractSnapshot(segmented);

        // 3. Read existing MEMORY.md (or create empty)
        let existingContent = '';
        let existingMtime: number | undefined;
        try {
          const fileSnapshot = await safeReadFile(options.memory);
          existingContent = fileSnapshot.content;
          existingMtime = fileSnapshot.mtime;
        } catch {
          logger.info(`No existing MEMORY.md at ${options.memory}, will create new`);
        }

        const existingDoc = parseMemoryDocument(existingContent);

        // 4. Merge
        const maxLines = parseInt(options.maxLines, 10);
        const baseBudget = config?.memoryBudget ?? DEFAULT_MEMORY_BUDGET;
        const budget = {
          ...baseBudget,
          maxLines: Number.isNaN(maxLines) ? baseBudget.maxLines : maxLines,
        };
        const { updatedDoc, overflowActions, entriesAdded, entriesDeduplicated } = mergeIntoMemory(
          existingDoc,
          snapshot,
          budget,
        );

        // 5. Output results
        const serialized = serializeMemoryDocument(updatedDoc);

        if (options.dryRun) {
          process.stdout.write('=== DRY RUN - No files will be written ===\n\n');
          process.stdout.write(serialized);
          process.stdout.write(`\n--- Stats ---\n`);
          process.stdout.write(`Entries added: ${entriesAdded}\n`);
          process.stdout.write(`Entries deduplicated: ${entriesDeduplicated}\n`);
          process.stdout.write(`Overflow actions: ${overflowActions.length}\n`);
          process.stdout.write(`Total lines: ${updatedDoc.totalLines}\n`);
          return;
        }

        // 6. Write MEMORY.md
        await safeWriteFile(options.memory, serialized, existingMtime);
        logger.info(`Updated ${options.memory}`);

        // 7. Handle overflow
        if (overflowActions.length > 0) {
          const memoryDir = path.dirname(options.memory);
          for (const action of overflowActions) {
            const overflowPath = path.join(memoryDir, action.topicFileLink);
            await ensureDir(memoryDir);
            await safeWriteFile(overflowPath, action.originalContent);
            logger.info(`Overflow written to ${overflowPath}`);
          }
        }

        // 8. Report
        process.stdout.write(`Preserved ${entriesAdded} entries to ${options.memory}\n`);
        if (entriesDeduplicated > 0) {
          process.stdout.write(`Deduplicated ${entriesDeduplicated} entries\n`);
        }
        if (overflowActions.length > 0) {
          process.stdout.write(`${overflowActions.length} overflow file(s) created\n`);
        }
      },
    );
}

function resolveDefaultMemoryPath(): string {
  const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '.';
  return path.join(home, '.claude', 'MEMORY.md');
}

async function resolveInput(file?: string, inputFlag?: string): Promise<string> {
  const filePath = file ?? inputFlag;
  if (filePath) return fs.readFile(filePath, 'utf-8');

  const discovered = await discoverLatestSession();
  if (discovered) {
    process.stderr.write(`Using session: ${discovered}\n`);
    return fs.readFile(discovered, 'utf-8');
  }

  if (process.stdin.isTTY) {
    process.stderr.write(
      'No Claude Code sessions found for this project.\n' +
        'Run from inside a project directory, or use:\n' +
        '  cc-intel projects          # pick a project interactively\n' +
        '  cc-intel preserve <file>   # provide a session file directly\n',
    );
    process.exitCode = 1;
    return '';
  }

  return readStdin();
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}
