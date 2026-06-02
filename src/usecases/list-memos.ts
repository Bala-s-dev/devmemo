import type { Memo } from '../domain/memo.js';
import type { MemoRepository } from '../domain/ports.js';

export type ListMemosInput = {
  groupByTarget?: boolean;
};

export class ListMemosUseCase {
  constructor(private readonly repo: MemoRepository) {}

  async execute(_input: ListMemosInput = {}): Promise<Memo[]> {
    // Note: grouping will be done at the CLI level, not here.
    // The use case simply returns all memos sorted by createdAt desc.
    const memos = await this.repo.listAll();
    // Already sorted by repo (desc by createdAt). If repo doesn't guarantee order,
    // we'll sort here too for safety.
    memos.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return memos;
  }
}
