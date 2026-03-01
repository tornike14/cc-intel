import { Command } from 'commander';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_MEMORY_BUDGET, type CcIntelConfig } from '../../models/index.js';
import { parseSession } from '../../core/session-parser.js';
import { llmExtractSnapshot, resolveApiKey } from '../../core/llm-extractor.js';
import { parseMemoryDocument } from '../../core/memory-parser.js';
import { serializeMemoryDocument } from '../../core/memory-serializer.js';
import { mergeIntoMemory } from '../../core/memory-merger.js';
import {
  discoverLatestSession,
  discoverProjectMemoryPath,
  memoryPathFromSession,
} from '../../core/session-discovery.js';
import { safeWriteFile, safeReadFile, ensureDir } from '../../utils/safe-fs.js';
import { createLogger } from '../../utils/logger.js';
import { LlmExtractionError } from '../../utils/errors.js';
import { formatApiKeyHelp } from '../api-key-help.js';
import { createSpinner } from '../spinner.js';

const logger = createLogger('preserve');

export function createPreserveCommand(config?: CcIntelConfig): Command {
  const defaultMaxLines = config?.memoryBudget?.maxLines?.toString() ?? '200';

  return new Command('preserve')
    .description('Merge session knowledge into MEMORY.md with deduplication')
    .argument('[file]', 'Session file (default: latest from current project)')
    .option('-i, --input <path>', 'Session file path')
    .option('-f, --format <fmt>', 'Input format: auto, jsonl, markdown', 'auto')
    .option('-m, --memory <path>', 'MEMORY.md path (default: project-specific)')
    .option('--dry-run', 'Preview changes without writing')
    .option('--max-lines <n>', 'Max MEMORY.md lines', defaultMaxLines)
    .action(
      async (
        file: string | undefined,
        options: {
          input?: string;
          format: string;
          memory?: string;
          dryRun?: boolean;
          maxLines: string;
        },
      ) => {
        const resolved = await resolveInput(file, options.input);
        if (!resolved.content) return;

        const apiKey = resolveApiKey();
        if (!apiKey) {
          process.stderr.write(formatApiKeyHelp());
          process.exitCode = 1;
          return;
        }

        const session = parseSession(
          resolved.content,
          options.format as 'auto' | 'jsonl' | 'markdown',
        );

        const spinner = createSpinner('Extracting knowledge...');
        let snapshot;
        try {
          spinner.start();
          snapshot = await llmExtractSnapshot(session.messages, apiKey);
          spinner.stop();
        } catch (error: unknown) {
          spinner.stop();
          if (error instanceof LlmExtractionError) {
            process.stderr.write(`Error: ${error.message}\n`);
            process.exitCode = 1;
            return;
          }
          throw error;
        }

        const memoryPath = await resolveMemoryPath(options.memory, resolved.sessionPath);

        let existingContent = '';
        let existingMtime: number | undefined;
        try {
          const fileSnapshot = await safeReadFile(memoryPath);
          existingContent = fileSnapshot.content;
          existingMtime = fileSnapshot.mtime;
        } catch {
          logger.info(`No existing MEMORY.md at ${memoryPath}, will create new`);
        }

        const existingDoc = parseMemoryDocument(existingContent);

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

        const serialized = serializeMemoryDocument(updatedDoc);

        if (options.dryRun) {
          const indent = (text: string) =>
            text
              .split('\n')
              .map((l) => '    ' + l)
              .join('\n');

          process.stdout.write('\n  === DRY RUN - No files will be written ===\n');
          process.stdout.write('  ' + '-'.repeat(50) + '\n\n');
          process.stdout.write(indent(serialized));
          process.stdout.write('\n\n  ' + '-'.repeat(50) + '\n');
          process.stdout.write(`  Entries added: ${entriesAdded}\n`);
          process.stdout.write(`  Entries deduplicated: ${entriesDeduplicated}\n`);
          process.stdout.write(`  Overflow actions: ${overflowActions.length}\n`);
          process.stdout.write(`  Total lines: ${updatedDoc.totalLines}\n\n`);
          return;
        }

        await ensureDir(path.dirname(memoryPath));
        await safeWriteFile(memoryPath, serialized, existingMtime);
        logger.info(`Updated ${memoryPath}`);

        if (overflowActions.length > 0) {
          const memoryDir = path.dirname(memoryPath);
          for (const action of overflowActions) {
            const overflowPath = path.join(memoryDir, action.topicFileLink);
            await ensureDir(memoryDir);
            await safeWriteFile(overflowPath, action.originalContent);
            logger.info(`Overflow written to ${overflowPath}`);
          }
        }

        process.stdout.write(`Preserved ${entriesAdded} entries to ${memoryPath}\n`);
        if (entriesDeduplicated > 0) {
          process.stdout.write(`Deduplicated ${entriesDeduplicated} entries\n`);
        }
        if (overflowActions.length > 0) {
          process.stdout.write(`${overflowActions.length} overflow file(s) created\n`);
        }
      },
    );
}

interface ResolvedInput {
  content: string;
  sessionPath?: string;
}

async function resolveInput(file?: string, inputFlag?: string): Promise<ResolvedInput> {
  const filePath = file ?? inputFlag;
  if (filePath) {
    const resolved = path.resolve(filePath);
    return { content: await fs.readFile(resolved, 'utf-8'), sessionPath: resolved };
  }

  const discovered = await discoverLatestSession();
  if (discovered) {
    process.stderr.write(`Using session: ${discovered}\n`);
    return { content: await fs.readFile(discovered, 'utf-8'), sessionPath: discovered };
  }

  if (process.stdin.isTTY) {
    process.stderr.write(
      'No Claude Code sessions found for this project.\n' +
        'Run from inside a project directory, or use:\n' +
        '  cc-intel projects          # pick a project interactively\n' +
        '  cc-intel preserve <file>   # provide a session file directly\n',
    );
    process.exitCode = 1;
    return { content: '' };
  }

  return { content: await readStdin() };
}

async function resolveMemoryPath(explicitPath?: string, sessionPath?: string): Promise<string> {
  if (explicitPath) return explicitPath;

  if (sessionPath) {
    const projectsRoot = path.join(os.homedir(), '.claude', 'projects');
    if (sessionPath.startsWith(projectsRoot + path.sep)) {
      return memoryPathFromSession(sessionPath);
    }
  }

  const projectMemory = await discoverProjectMemoryPath();
  if (projectMemory) return projectMemory;

  return path.join(os.homedir(), '.claude', 'MEMORY.md');
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}
