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

        const termWidth = process.stdout.columns || 80;
        const cardWidth = Math.min(termWidth, 80);  

        memos.forEach((memo: Memo) => {
          const date = new Date(memo.createdAt).toISOString().slice(0, 10);
          const header = `${memo.target}  •  ${memo.commitSHA}  •  ${date}`;
          const tagsLine = `Tags: ${memo.tags.join(', ')}`;

          // Top border
          console.log('┌' + '─'.repeat(cardWidth - 2) + '┐');
          console.log(`│ ${chalk.bold(header.padEnd(cardWidth - 4))} │`);
          console.log(`│ ${tagsLine.padEnd(cardWidth - 4)} │`);
          console.log('├' + '─'.repeat(cardWidth - 2) + '┤');

          // Body: split into lines that fit inside the card (leave 2 chars for borders + space)
          const maxLineLength = cardWidth - 4;
          const bodyLines = memo.body.split('\n');
          for (const line of bodyLines) {
            // Word-wrap each line manually
            let remaining = line;
            while (remaining.length > maxLineLength) {
              const chunk = remaining.slice(0, maxLineLength);
              remaining = remaining.slice(maxLineLength);
              console.log(`│ ${chunk.padEnd(maxLineLength)} │`);
            }
            if (remaining.length > 0) {
              console.log(`│ ${remaining.padEnd(maxLineLength)} │`);
            }
          }

          // Bottom border
          console.log('└' + '─'.repeat(cardWidth - 2) + '┘');
        });

      } catch (err: any) {
        logger.error(err, 'Explain command failed');
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
