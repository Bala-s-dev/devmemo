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
        const all = await repo.listAll();

        let memos: Memo[] = [];

        // Exact ID match first
        const byId = all.find((m) => m.id === query);
        if (byId) {
          memos = [byId];
        } else {
          const lower = query.toLowerCase();
          memos = all.filter(
            (m) =>
              m.commitSHA === query ||
              m.heading.toLowerCase().includes(lower) ||
              m.target.toLowerCase().includes(lower),
          );
          // Sort: heading match first, then target match, then date desc
          memos.sort((a, b) => {
            const aHead = a.heading.toLowerCase().includes(lower) ? 0 : 1;
            const bHead = b.heading.toLowerCase().includes(lower) ? 0 : 1;
            if (aHead !== bHead) return aHead - bHead;
            const aTgt = a.target.toLowerCase().includes(lower) ? 0 : 1;
            const bTgt = b.target.toLowerCase().includes(lower) ? 0 : 1;
            if (aTgt !== bTgt) return aTgt - bTgt;
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
        const cardWidth = Math.min(termWidth - 2, 80);

        memos.forEach((memo) => {
          const date = new Date(memo.createdAt).toISOString().slice(0, 10);
          const header = `${memo.target}  •  ${memo.commitSHA}  •  ${date}`;
          const tagsLine = `Tags: ${memo.tags.join(', ') || 'none'}`;

          // Top border
          console.log(chalk.blue('┌' + '─'.repeat(cardWidth) + '┐'));
          console.log(`│ ${chalk.bold.white(header.padEnd(cardWidth - 2))} │`);
          // Heading in bold cyan
          const headingStr = `# ${memo.heading}`;
          console.log(
            `│ ${chalk.bold.cyan(headingStr.padEnd(cardWidth - 2))} │`,
          );
          // Tags in magenta
          console.log(`│ ${chalk.magenta(tagsLine.padEnd(cardWidth - 2))} │`);
          // Commit message (first line) dimmed
          if (memo.commitMessage) {
            const commitLine =
              'Commit: ' +
              memo.commitMessage.split('\n')[0].slice(0, cardWidth - 10);
            console.log(`│ ${chalk.dim(commitLine.padEnd(cardWidth - 2))} │`);
          }
          // Separator
          console.log(chalk.blue('├' + '─'.repeat(cardWidth) + '┤'));

          // Body with blank lines before section headings
          const maxLineLen = cardWidth - 2;
          let previousLineWasContent = false;

          for (const line of memo.body.split('\n')) {
            const isHeading = line.trimStart().startsWith('## ');

            // Insert a blank line before a heading (unless it's the very first content)
            if (isHeading && previousLineWasContent) {
              console.log(`│ ${' '.repeat(maxLineLen)} │`);
            }

            let remaining = line;
            let isFirstChunk = true;

            while (remaining.length > maxLineLen) {
              const chunk = remaining.slice(0, maxLineLen);
              remaining = remaining.slice(maxLineLen);

              if (isFirstChunk && isHeading) {
                console.log(`│ ${chalk.yellow(chunk.padEnd(maxLineLen))} │`);
              } else {
                console.log(`│ ${chunk.padEnd(maxLineLen)} │`);
              }
              isFirstChunk = false;
            }

            if (remaining.length > 0) {
              if (isFirstChunk && isHeading) {
                console.log(
                  `│ ${chalk.yellow(remaining.padEnd(maxLineLen))} │`,
                );
              } else {
                console.log(`│ ${remaining.padEnd(maxLineLen)} │`);
              }
            }

            previousLineWasContent = true; // any line (even heading) is content
          }

          // Bottom border
          console.log(chalk.blue('└' + '─'.repeat(cardWidth) + '┘\n'));
        });
      } catch (err: any) {
        logger.error(err, 'Explain command failed');
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    });
}
