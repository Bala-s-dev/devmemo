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
    .command('list [target]')
    .description('List all memos, optionally filtered by target')
    .option('--json', 'Output raw JSON')
    .action(
      async (targetArg: string | undefined, options: { json?: boolean }) => {
        const jsonMode = options.json ?? false;

        try {
          const spinner = jsonMode ? null : ora('Loading memos…').start();
          let memos = await repo.listAll();

          if (targetArg) {
            memos = memos.filter((m) => m.target === targetArg);
          }

          spinner?.stop();

          if (jsonMode) {
            console.log(JSON.stringify(memos));
            return;
          }

          if (memos.length === 0) {
            console.log(chalk.yellow('No memos found.'));
            return;
          }

          // Group by target only if no target filter
          if (!targetArg) {
            const grouped = new Map<string, typeof memos>();
            for (const memo of memos) {
              const existing = grouped.get(memo.target) || [];
              existing.push(memo);
              grouped.set(memo.target, existing);
            }
            for (const [target, targetMemos] of grouped) {
              console.log(chalk.bold(`\n${target}`));
              for (const memo of targetMemos) {
                printMemo(memo);
              }
            }
          } else {
            // Single target, just list
            for (const memo of memos) {
              printMemo(memo);
            }
          }
        } catch (err: any) {
          logger.error(err, 'List command failed');
          console.error(chalk.red(`Error: ${err.message}`));
          process.exit(1);
        }
      },
    );
}

function printMemo(memo: import('../../domain/memo.js').Memo) {
  const date = new Date(memo.createdAt).toISOString().slice(0, 10);
  const commitMsgLine = memo.commitMessage.split('\n')[0].slice(0, 60);
  const snippet = memo.body.replace(/\n/g, ' ').slice(0, 80);

  console.log(`  ${chalk.bold(memo.heading)}`);
  console.log(
    `    ${chalk.dim(memo.id)}  ${chalk.dim(memo.commitSHA)}  ${chalk.dim(date)}`,
  );
  if (commitMsgLine) {
    console.log(`    ${chalk.dim('Commit: ' + commitMsgLine)}`);
  }
  console.log(`    ${snippet}`);
}
