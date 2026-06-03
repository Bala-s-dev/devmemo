import ora from 'ora';
import chalk from 'chalk';
import type { MemoRepository } from '../../domain/ports.js';
import { ListMemosUseCase } from '../../usecases/list-memos.js';
import { logger } from '../../logger.js';

export function registerListCommand(
  program: import('commander').Command,
  repo: MemoRepository,
) {
  program
    .command('list')
    .description('List all memos grouped by target')
    .option('--json', 'Output raw JSON')
    .action(async (options: { json?: boolean }) => {
      const jsonMode = options.json ?? false;

      try {
        const spinner = jsonMode ? null : ora('Loading memos…').start();
        const useCase = new ListMemosUseCase(repo);
        const memos = await useCase.execute();
        spinner?.stop();

        if (jsonMode) {
          console.log(JSON.stringify(memos));
          return;
        }

        if (memos.length === 0) {
          console.log(
            chalk.yellow('No memos yet. Add one with: devmemo add <target>'),
          );
          return;
        }

        // Group by target
        const grouped = new Map<string, typeof memos>();
        for (const memo of memos) {
          const existing = grouped.get(memo.target) || [];
          existing.push(memo);
          grouped.set(memo.target, existing);
        }

        for (const [target, targetMemos] of grouped) {
          console.log(chalk.bold(`\n${target}`));
          for (const memo of targetMemos) {
            const date = new Date(memo.createdAt).toISOString().slice(0, 10);
            const snippet = memo.body.replace(/\n/g, ' ').slice(0, 60);
            console.log(
              `  ${chalk.dim(memo.id)}  ${chalk.dim(date)}  ${chalk.bold(memo.heading)}`,
            );
            console.log(`    ${chalk.dim(snippet)}`);
          }
        }
      } catch (err: any) {
        logger.error(err, 'List command failed');
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
