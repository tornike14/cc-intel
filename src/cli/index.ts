import { Command } from 'commander';
import { createSnapshotCommand } from './commands/snapshot.js';

const program = new Command();

program.name('cc-intel').description('Context guardian for Claude Code sessions').version('0.0.0');

program.addCommand(createSnapshotCommand());

program.parse();
