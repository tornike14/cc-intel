import { Command } from 'commander';
import fs from 'node:fs/promises';
import { parseSession } from '../../core/session-parser.js';
import { segmentSession } from '../../core/segmenter.js';
import { extractSnapshot } from '../../core/snapshot.js';
import { discoverLatestSession } from '../../core/session-discovery.js';
import {
  formatSnapshotAsMarkdown,
  formatSnapshotAsJson,
} from '../formatters/snapshot-formatter.js';

export function createSnapshotCommand(): Command {
  return new Command('snapshot')
    .description('Extract structured knowledge from a session transcript')
    .argument('[file]', 'Session file (default: latest from current project)')
    .option('-i, --input <path>', 'Session file path')
    .option('-f, --format <fmt>', 'Input format: auto, jsonl, markdown', 'auto')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--json', 'Output as JSON instead of markdown')
    .action(
      async (
        file: string | undefined,
        options: { input?: string; format: string; output?: string; json?: boolean },
      ) => {
        const input = await resolveInput(file, options.input);

        const session = parseSession(input, options.format as 'auto' | 'jsonl' | 'markdown');
        const segmented = segmentSession(session.messages);
        const snapshot = extractSnapshot(segmented);

        const formatted = options.json
          ? formatSnapshotAsJson(snapshot)
          : formatSnapshotAsMarkdown(snapshot);

        if (options.output) {
          await fs.writeFile(options.output, formatted, 'utf-8');
        } else {
          process.stdout.write(formatted);
        }
      },
    );
}

async function resolveInput(file?: string, inputFlag?: string): Promise<string> {
  // Priority: positional arg > --input flag > auto-discover > stdin
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
        '  cc-intel snapshot <file>   # provide a session file directly\n',
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
