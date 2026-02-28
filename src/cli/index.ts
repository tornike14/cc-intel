import { Command } from 'commander';
import { createSnapshotCommand } from './commands/snapshot.js';
import { createRiskCommand } from './commands/risk.js';
import { createPreserveCommand } from './commands/preserve.js';
import { createStatusCommand } from './commands/status.js';
import { HELP_HEADER, HELP_FOOTER } from './branding.js';

const program = new Command();

program.name('cc-intel').description('Context guardian for Claude Code sessions').version('0.2.0');

program.addHelpText('before', HELP_HEADER);
program.addHelpText('after', HELP_FOOTER);

program.addCommand(createSnapshotCommand());
program.addCommand(createRiskCommand());
program.addCommand(createPreserveCommand());
program.addCommand(createStatusCommand());

program.parse();
