import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { GitAdapter } from '../infra/git-adapter.js';
import { JsonMemoRepository } from '../infra/json-repo.js';
import { registerAddCommand } from './commands/add.js';
import { registerExplainCommand } from './commands/explain.js';
import { registerSearchCommand } from './commands/search.js';
import { registerListCommand } from './commands/list.js';
import { registerDeleteCommand } from './commands/delete.js';
import { logger } from '../logger.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('devmemo')
  .description('Capture and retrieve developer decision memory')
  .version('1.0.0');

// Create infrastructure
const git = new GitAdapter();

let storageDir: string | undefined;

try {
  const root = await git.repoRoot();
  storageDir = path.join(root, '.devmemo');
} catch {
  // Fallback to default (global ~/.devmemo)
  storageDir = undefined;
}

const repo = await JsonMemoRepository.create(storageDir);

// Warn if memos are stored inside a Git repository
if (storageDir && fs.existsSync(path.join(storageDir, '.git'))) {
  // storageDir is the .devmemo folder; its parent might be the git root
  const gitRoot = path.dirname(storageDir);

  if (fs.existsSync(path.join(gitRoot, '.git'))) {
    console.warn(
      chalk.yellow(
        '⚠️  Your memos are stored inside a Git repo and could be committed.',
      ),
    );
    console.warn(
      chalk.yellow(
        '   Consider adding .devmemo/ to .gitignore if they contain sensitive info.',
      ),
    );
  }
}

// Register commands
registerAddCommand(program, repo, git);
registerExplainCommand(program, repo);
registerSearchCommand(program, repo);
registerListCommand(program, repo);
registerDeleteCommand(program, repo);

program.option('--json', 'Output raw JSON', false);

program.parseAsync(process.argv).catch((err) => {
  logger.error(err, 'CLI execution failed');
  process.exit(1);
});
