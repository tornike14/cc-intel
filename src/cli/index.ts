import { Command } from 'commander';
import { loadConfig } from '../core/config-loader.js';
import { createSnapshotCommand } from './commands/snapshot.js';
import { createRiskCommand } from './commands/risk.js';
import { createPreserveCommand } from './commands/preserve.js';
import { createStatusCommand } from './commands/status.js';
import { createProjectsCommand } from './commands/projects.js';
import { HELP_HEADER, HELP_FOOTER } from './branding.js';

const config = await loadConfig();

const program = new Command();

program.name('cc-intel').description('Context guardian for Claude Code sessions').version('0.2.0');

program.addHelpText('before', HELP_HEADER);
program.addHelpText('after', HELP_FOOTER);

program.addCommand(createSnapshotCommand());
program.addCommand(createRiskCommand(config));
program.addCommand(createPreserveCommand(config));
program.addCommand(createStatusCommand());
program.addCommand(createProjectsCommand(config));

program.parse();
