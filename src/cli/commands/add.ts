import { input, editor } from '@inquirer/prompts';
import ora from 'ora';
import chalk from 'chalk';
import type { MemoRepository, GitPort } from '../../domain/ports.js';
import { AddMemoUseCase } from '../../usecases/add-memo.js';
import { logger } from '../../logger.js';

const STARTER_TEMPLATE = `# Feature Name

## Summary
What does it do?

## Technical Overview
How does it work?

## Components
Important files/services involved.

## API/Function Details
Inputs, outputs, examples.

## Flow
Step-by-step execution.

## Edge Cases
Special handling.

## Dependencies
External/internal dependencies.

## Security Notes
Authentication, authorization, validation.

## Limitations
Known constraints.

## Testing
How it was verified.

## Future Improvements
Possible enhancements.
`;

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
          // Target
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

          // Heading
          const heading = jsonMode
            ? (() => {
                console.error(
                  chalk.red(
                    'Error: --json mode for add requires piping body via stdin',
                  ),
                );
                process.exit(1);
              })()
            : await input({ message: 'Decision heading (short summary):' });

          // Body (via editor)
          let body: string;
          if (jsonMode) {
            // Not supported in JSON mode, exit (as before)
            console.error(
              chalk.red(
                'Error: --json mode for add requires piping body via stdin',
              ),
            );
            process.exit(1);
          } else {
            body = await editor({
              message:
                'Describe the decision, context, and optionally an example.\n' +
                '  (Save and close editor to continue)',
              default: STARTER_TEMPLATE,
            });
          }

          // Tags
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
          const memo = await useCase.execute({ target, heading, body, tags });
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
