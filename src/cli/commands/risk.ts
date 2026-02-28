import { Command } from 'commander';
import fs from 'node:fs/promises';
import { RiskLevel, type CcIntelConfig } from '../../models/index.js';
import { parseSession } from '../../core/session-parser.js';
import { assessRisk } from '../../core/risk.js';
import { discoverLatestSession } from '../../core/session-discovery.js';
import { formatRiskAsMarkdown, formatRiskAsJson } from '../formatters/risk-formatter.js';

export function createRiskCommand(config?: CcIntelConfig): Command {
  const defaultThreshold = config?.maxContext?.toString() ?? '200000';

  return new Command('risk')
    .description('Assess context window usage and compaction risk')
    .argument('[file]', 'Session file (default: latest from current project)')
    .option('-i, --input <path>', 'Session file path')
    .option('-f, --format <fmt>', 'Input format: auto, jsonl, markdown', 'auto')
    .option('--json', 'Output as JSON')
    .option('--threshold <n>', 'Max context tokens', defaultThreshold)
    .action(
      async (
        file: string | undefined,
        options: { input?: string; format: string; json?: boolean; threshold: string },
      ) => {
        const input = await resolveInput(file, options.input);
        if (!input) return;

        const session = parseSession(input, options.format as 'auto' | 'jsonl' | 'markdown');
        const maxContext = parseInt(options.threshold, 10);
        if (Number.isNaN(maxContext) || maxContext <= 0) {
          process.stderr.write(
            `Error: invalid threshold "${options.threshold}". Must be a positive integer.\n`,
          );
          process.exitCode = 1;
          return;
        }
        const metrics = assessRisk(session.messages, maxContext, config?.riskThresholds);

        const formatted = options.json ? formatRiskAsJson(metrics) : formatRiskAsMarkdown(metrics);

        process.stdout.write(formatted);

        // Exit with 1 for High/Critical risk (useful in CI)
        if (metrics.riskLevel === RiskLevel.High || metrics.riskLevel === RiskLevel.Critical) {
          process.exitCode = 1;
        }
      },
    );
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
        '  cc-intel risk <file>       # provide a session file directly\n',
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
