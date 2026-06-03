import { input } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import type { MemoRepository } from '../../domain/ports.js';
import { DeleteMemoUseCase } from '../../usecases/delete-memo.js';
import { logger } from '../../logger.js';

export function registerDeleteCommand(
  program: import('commander').Command,
  repo: MemoRepository,
) {
  program
    .command('delete <id>')
    .description('Delete a memo by id')
    .option('--json', 'Output raw JSON')
    .action(async (id: string, options: { json?: boolean }) => {
      const jsonMode = options.json ?? false;

      try {
        if (!jsonMode) {
          const answer = await input({
            message: `Delete memo [${id}]? (y/N)`,
            default: 'n',
          });
          if (answer.toLowerCase() !== 'y') {
            console.log(chalk.yellow('Aborted.'));
            return;
          }
        }

        const spinner = jsonMode ? null : ora('Deleting…').start();
        const useCase = new DeleteMemoUseCase(repo);
        await useCase.execute({ id });
        spinner?.stop();

        if (jsonMode) {
          console.log(JSON.stringify({ deleted: id }));
        } else {
          console.log(chalk.red('✓ Memo deleted'));
        }
      } catch (err: any) {
        logger.error(err, 'Delete command failed');
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
