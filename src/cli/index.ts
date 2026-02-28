import { Command } from 'commander';
import { createSnapshotCommand } from './commands/snapshot.js';
import { createRiskCommand } from './commands/risk.js';
import { createPreserveCommand } from './commands/preserve.js';

const program = new Command();

program.name('cc-intel').description('Context guardian for Claude Code sessions').version('0.0.0');

program.addCommand(createSnapshotCommand());
program.addCommand(createRiskCommand());
program.addCommand(createPreserveCommand());

program.parse();
