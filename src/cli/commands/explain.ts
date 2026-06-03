import ora from 'ora';
import chalk from 'chalk';
import type { Memo } from '../../domain/memo.js';
import type { MemoRepository } from '../../domain/ports.js';
import { logger } from '../../logger.js';

export function registerExplainCommand(
  program: import('commander').Command,
  repo: MemoRepository,
) {
  program
    .command('explain <query>')
    .description(
      'Show full details of memos matching query (id, heading, commit SHA, or target)',
    )
    .option('--json', 'Output raw JSON')
    .action(async (query: string, options: { json?: boolean }) => {
      const jsonMode = options.json ?? false;

      try {
        const spinner = jsonMode ? null : ora('Fetching memo details…').start();

        // 1. Try exact ID match
        let memos: Memo[] = [];
        const all = await repo.listAll();

        // Exact ID match first
        const byId = all.find((m) => m.id === query);
        if (byId) {
          memos = [byId];
        } else {
          // Search by commitSHA (exact), heading (contains), target (contains)
          const lower = query.toLowerCase();
          memos = all.filter(
            (m) =>
              m.commitSHA === query ||
              m.heading.toLowerCase().includes(lower) ||
              m.target.toLowerCase().includes(lower),
          );
          // If many, sort by relevance: heading match > target match, then by date
          memos.sort((a, b) => {
            const aHeading = a.heading.toLowerCase().includes(lower) ? 0 : 1;
            const bHeading = b.heading.toLowerCase().includes(lower) ? 0 : 1;
            if (aHeading !== bHeading) return aHeading - bHeading;
            const aTarget = a.target.toLowerCase().includes(lower) ? 0 : 1;
            const bTarget = b.target.toLowerCase().includes(lower) ? 0 : 1;
            if (aTarget !== bTarget) return aTarget - bTarget;
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        }

        spinner?.stop();

        if (jsonMode) {
          console.log(JSON.stringify(memos));
          return;
        }

        if (memos.length === 0) {
          console.log(chalk.yellow(`No memos found for query '${query}'.`));
          return;
        }

        const termWidth = process.stdout.columns || 80;
        const cardWidth = Math.min(termWidth, 80);

        memos.forEach((memo) => {
          const date = new Date(memo.createdAt).toISOString().slice(0, 10);
          const header = `${memo.target}  •  ${memo.commitSHA}  •  ${date}`;
          const tagsLine = `Tags: ${memo.tags.join(', ') || 'none'}`;
          const headingLine = `# ${memo.heading}`;

          console.log('┌' + '─'.repeat(cardWidth - 2) + '┐');
          console.log(`│ ${chalk.bold(header.padEnd(cardWidth - 4))} │`);
          console.log(`│ ${headingLine.padEnd(cardWidth - 4)} │`);
          console.log(`│ ${tagsLine.padEnd(cardWidth - 4)} │`);
          if (memo.commitMessage) {
            const commitMsgLine =
              'Commit: ' +
              memo.commitMessage.split('\n')[0].slice(0, cardWidth - 10);
            console.log(
              `│ ${chalk.dim(commitMsgLine.padEnd(cardWidth - 4))} │`,
            );
          }
          console.log('├' + '─'.repeat(cardWidth - 2) + '┤');

          // Body (word wrap)
          const maxLineLen = cardWidth - 4;
          const bodyLines = memo.body.split('\n');
          for (const line of bodyLines) {
            let remaining = line;
            while (remaining.length > maxLineLen) {
              console.log(
                `│ ${remaining.slice(0, maxLineLen).padEnd(maxLineLen)} │`,
              );
              remaining = remaining.slice(maxLineLen);
            }
            if (remaining.length > 0) {
              console.log(`│ ${remaining.padEnd(maxLineLen)} │`);
            }
          }

          console.log('└' + '─'.repeat(cardWidth - 2) + '┘\n');
        });
      } catch (err: any) {
        logger.error(err, 'Explain command failed');
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
