import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSession } from '../../core/session-parser.js';
import { segmentSession } from '../../core/segmenter.js';
import { extractSnapshot } from '../../core/snapshot.js';
import { parseMemoryDocument } from '../../core/memory-parser.js';
import { serializeMemoryDocument } from '../../core/memory-serializer.js';
import { mergeIntoMemory } from '../../core/memory-merger.js';
import { safeWriteFile, safeReadFile, ensureDir } from '../../utils/safe-fs.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('preserve');

export function createPreserveCommand(): Command {
  return new Command('preserve')
    .description('Merge session knowledge into MEMORY.md with deduplication')
    .option('-i, --input <path>', 'Session file path (default: stdin)')
    .option('-f, --format <fmt>', 'Input format: auto, jsonl, markdown', 'auto')
    .option('-m, --memory <path>', 'MEMORY.md path', resolveDefaultMemoryPath())
    .option('--dry-run', 'Preview changes without writing')
    .option('--max-lines <n>', 'Max MEMORY.md lines', '200')
    .action(
      async (options: {
        input?: string;
        format: string;
        memory: string;
        dryRun?: boolean;
        maxLines: string;
      }) => {
        // 1. Read session input
        const input = options.input ? await fs.readFile(options.input, 'utf-8') : await readStdin();

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
        const budget = {
          maxLines,
          sectionLimits: existingDoc.sections,
        };
        const { updatedDoc, overflowActions, entriesAdded, entriesDeduplicated } = mergeIntoMemory(
          existingDoc,
          snapshot,
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
          // Suppress unused variable warnings
          void budget;
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

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}
