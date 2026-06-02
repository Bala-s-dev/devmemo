import type { Memo } from '../domain/memo.js';
import type { MemoRepository } from '../domain/ports.js';

export type SearchMemosInput = {
  query: string;
  limit?: number;
};

export class SearchMemosUseCase {
  constructor(private readonly repo: MemoRepository) {}

  async execute(input: SearchMemosInput): Promise<Memo[]> {
    return this.repo.search(input.query, input.limit ?? 10);
  }
}
