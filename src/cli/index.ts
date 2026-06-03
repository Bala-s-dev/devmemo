import { Command } from 'commander';
import { GitAdapter } from '../infra/git-adapter.js';
import { JsonMemoRepository } from '../infra/json-repo.js';
import { registerAddCommand } from './commands/add.js';
import { registerExplainCommand } from './commands/explain.js';
import { registerSearchCommand } from './commands/search.js';
import { registerListCommand } from './commands/list.js';
import { registerDeleteCommand } from './commands/delete.js';
import { logger } from '../logger.js';

const program = new Command();

program
  .name('devmemo')
  .description('Capture and retrieve developer decision memory')
  .version('1.0.0');

// Create the infrastructure (top-level await)
const repo = await JsonMemoRepository.create();
const git = new GitAdapter();

// Register all commands
registerAddCommand(program, repo, git);
registerExplainCommand(program, repo);
registerSearchCommand(program, repo);
registerListCommand(program, repo);
registerDeleteCommand(program, repo);

// Global --json flag (Commander will handle it per command if we defined it there)
// We can also set a global option that all commands inherit:
program.option('--json', 'Output raw JSON', false);

// Parse and run
program.parseAsync(process.argv).catch((err) => {
  logger.error(err, 'CLI execution failed');
  process.exit(1);
});
