import { Command } from 'commander';
import fs from 'node:fs/promises';
import { parseSession } from '../../core/session-parser.js';
import { segmentSession } from '../../core/segmenter.js';
import { extractSnapshot } from '../../core/snapshot.js';
import {
  formatSnapshotAsMarkdown,
  formatSnapshotAsJson,
} from '../formatters/snapshot-formatter.js';

export function createSnapshotCommand(): Command {
  return new Command('snapshot')
    .description('Extract structured knowledge from a session transcript')
    .option('-i, --input <path>', 'Session file path (default: stdin)')
    .option('-f, --format <fmt>', 'Input format: auto, jsonl, markdown', 'auto')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--json', 'Output as JSON instead of markdown')
    .action(
      async (options: { input?: string; format: string; output?: string; json?: boolean }) => {
        const input = options.input ? await fs.readFile(options.input, 'utf-8') : await readStdin();

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

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}
