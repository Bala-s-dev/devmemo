import simpleGit from 'simple-git';
import type { GitPort } from '../domain/ports.js';
import { logger } from '../logger.js';

export class GitAdapter implements GitPort {
  private git = simpleGit();

  async author(): Promise<string> {
    try {
      const name = await this.git.raw(['config', 'user.name']);
      return name.trim() || 'unknown';
    } catch {
      logger.warn("Could not read git user.name, using 'unknown'");
      return 'unknown';
    }
  }

  async commitSHA(): Promise<string> {
    try {
      const sha = await this.git.revparse(['--short', 'HEAD']);
      return sha.trim() || 'no-commit';
    } catch {
      logger.warn("Could not read git HEAD SHA, using 'no-commit'");
      return 'no-commit';
    }
  }

  async commitMessage(): Promise<string> {
    try {
      const log = await this.git.log({ maxCount: 1 });
      if (log.latest) {
        return log.latest.message.trim();
      }
      return 'no message';
    } catch {
      logger.warn("Could not read git commit message, using 'no message'");
      return 'no message';
    }
  }

  async repoRoot(): Promise<string> {
    try {
      const root = await this.git.revparse(['--show-toplevel']);
      return root.trim();
    } catch {
      logger.warn('Could not determine repo root, using cwd');
      return process.cwd();
    }
  }
}
