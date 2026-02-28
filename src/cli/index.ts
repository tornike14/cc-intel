import { Command } from 'commander';

const program = new Command();

program.name('cc-intel').description('Context guardian for Claude Code sessions').version('0.0.0');

program.parse();
