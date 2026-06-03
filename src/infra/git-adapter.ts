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

  async commitMessage(): Promise<string> {
    try {
      const msg = await this.git.log({ maxCount: 1 });
      if (msg.latest) {
        return msg.latest.message.trim();
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
