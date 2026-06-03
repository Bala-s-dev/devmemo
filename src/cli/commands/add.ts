import { input, editor } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import type { MemoRepository, GitPort } from '../../domain/ports.js';
import { AddMemoUseCase } from '../../usecases/add-memo.js';
import { logger } from '../../logger.js';

export function registerAddCommand(
  program: import('commander').Command,
  repo: MemoRepository,
  git: GitPort,
) {
  program
    .command('add [target]')
    .description('Add a new decision memo')
    .option('--json', 'Output raw JSON')
    .action(
      async (targetArg: string | undefined, options: { json?: boolean }) => {
        const jsonMode = options.json ?? false;

        try {
          let target = targetArg;
          if (!target) {
            if (jsonMode) {
              console.error(
                chalk.red('Error: target is required in --json mode'),
              );
              process.exit(1);
            }
            target = await input({ message: 'File or symbol?' });
          }

          let body: string;
          if (jsonMode) {
            console.error(
              chalk.red(
                'Error: --json mode for add requires piping body via stdin',
              ),
            );
            process.exit(1);
          } else {
            body = await editor({
              message:
                'What decision was made? (save and close editor to continue)',
            });
          }

          const tagsRaw = await input({
            message: 'Tags? (comma-separated, optional)',
            default: '',
          });
          const tags = tagsRaw
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

          const spinner = jsonMode ? null : ora('Saving memo…').start();
          const useCase = new AddMemoUseCase(repo, git);
          const memo = await useCase.execute({ target, body, tags });
          spinner?.stop();

          if (jsonMode) {
            console.log(JSON.stringify(memo));
          } else {
            console.log(chalk.green(`✓ Memo saved [${memo.id}]`));
          }
        } catch (err: any) {
          logger.error(err, 'Add command failed');
          console.error(chalk.red(`Error: ${err.message}`));
          process.exit(1);
        }
      },
    );
}
