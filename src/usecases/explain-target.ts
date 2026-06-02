import type { Memo } from '../domain/memo.js';
import type { MemoRepository } from '../domain/ports.js';

export type ExplainTargetInput = {
  target: string;
};

export class ExplainTargetUseCase {
  constructor(private readonly repo: MemoRepository) {}

  async execute(input: ExplainTargetInput): Promise<Memo[]> {
    const memos = await this.repo.findByTarget(input.target);
    // Sort by createdAt descending (newest first)
    memos.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return memos;
  }
}
