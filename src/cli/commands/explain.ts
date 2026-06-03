import ora from 'ora';
import chalk from 'chalk';
import type { Memo } from '../../domain/memo.js';
import type { MemoRepository } from '../../domain/ports.js';
import { ExplainTargetUseCase } from '../../usecases/explain-target.js';
import { logger } from '../../logger.js';

export function registerExplainCommand(
  program: import('commander').Command,
  repo: MemoRepository,
) {
  program
    .command('explain <target>')
    .description('Show all memos for a target')
    .option('--json', 'Output raw JSON')
    .action(async (target: string, options: { json?: boolean }) => {
      const jsonMode = options.json ?? false;

      try {
        const spinner = jsonMode ? null : ora('Fetching memos…').start();
        const useCase = new ExplainTargetUseCase(repo);
        const memos = await useCase.execute({ target });
        spinner?.stop();

        if (jsonMode) {
          console.log(JSON.stringify(memos));
          return;
        }

        if (memos.length === 0) {
          console.log(
            chalk.yellow(
              `No memos for '${target}'. Add one with: devmemo add ${target}`,
            ),
          );
          return;
        }

        memos.forEach((memo: Memo) => {
          const date = new Date(memo.createdAt).toISOString().slice(0, 10);
          console.log('┌' + '─'.repeat(40) + '┐');
          console.log(
            `│ ${chalk.bold(memo.target)}  •  ${memo.commitSHA}  •  ${date}`,
          );
          console.log(`│ Tags: ${memo.tags.join(', ')}`);
          console.log('├' + '─'.repeat(40) + '┤');
          const body =
            memo.body.length > 36 ? memo.body.slice(0, 36) + '…' : memo.body;
          console.log(`│ ${body.padEnd(36)} │`);
          console.log('└' + '─'.repeat(40) + '┘');
        });
      } catch (err: any) {
        logger.error(err, 'Explain command failed');
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
