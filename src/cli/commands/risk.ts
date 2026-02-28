import { Command } from 'commander';
import fs from 'node:fs/promises';
import { RiskLevel, type CcIntelConfig } from '../../models/index.js';
import { parseSession } from '../../core/session-parser.js';
import { assessRisk } from '../../core/risk.js';
import { formatRiskAsMarkdown, formatRiskAsJson } from '../formatters/risk-formatter.js';

export function createRiskCommand(config?: CcIntelConfig): Command {
  const defaultThreshold = config?.maxContext?.toString() ?? '200000';

  return new Command('risk')
    .description('Assess context window usage and compaction risk')
    .option('-i, --input <path>', 'Session file path (default: stdin)')
    .option('-f, --format <fmt>', 'Input format: auto, jsonl, markdown', 'auto')
    .option('--json', 'Output as JSON')
    .option('--threshold <n>', 'Max context tokens', defaultThreshold)
    .action(
      async (options: { input?: string; format: string; json?: boolean; threshold: string }) => {
        const input = options.input ? await fs.readFile(options.input, 'utf-8') : await readStdin();

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

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}
