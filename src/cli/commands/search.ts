import ora from 'ora';
import chalk from 'chalk';
import type { MemoRepository } from '../../domain/ports.js';
import { SearchMemosUseCase } from '../../usecases/search-memos.js';
import { logger } from '../../logger.js';

export function registerSearchCommand(
  program: import('commander').Command,
  repo: MemoRepository,
) {
  program
    .command('search <query>')
    .description('Search memos by text')
    .option('--json', 'Output raw JSON')
    .action(async (query: string, options: { json?: boolean }) => {
      const jsonMode = options.json ?? false;

      try {
        const spinner = jsonMode ? null : ora('Searching…').start();
        const useCase = new SearchMemosUseCase(repo);
        const memos = await useCase.execute({ query });
        spinner?.stop();

        if (jsonMode) {
          console.log(JSON.stringify(memos));
          return;
        }

        if (memos.length === 0) {
          console.log(chalk.yellow('No memos found.'));
          return;
        }

        memos.forEach((memo, idx) => {
          const preview = memo.body.slice(0, 80).replace(/\n/g, ' ');
          console.log(
            `${chalk.dim(`${idx + 1}.`)} ${chalk.bold(memo.target)} – ${preview}`,
          );
        });

        console.log(
          chalk.dim(
            `\n${memos.length} results  •  run \`devmemo explain <target>\` for details`,
          ),
        );
      } catch (err: any) {
        logger.error(err, 'Search command failed');
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
