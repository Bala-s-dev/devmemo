import { nanoid } from 'nanoid';
import type { Memo } from '../domain/memo.js';
import type { MemoRepository, GitPort } from '../domain/ports.js';

export type AddMemoInput = {
  target: string;
  body: string;
  tags: string[];
};

export class AddMemoUseCase {
  constructor(
    private readonly repo: MemoRepository,
    private readonly git: GitPort,
  ) {}

  async execute(input: AddMemoInput): Promise<Memo> {
    const [author, commitSHA] = await Promise.all([
      this.git.author(),
      this.git.commitSHA(),
    ]);

    const memo: Memo = {
      id: nanoid(10),
      target: input.target,
      body: input.body,
      tags: input.tags,
      author,
      commitSHA,
      createdAt: new Date().toISOString(),
    };

    await this.repo.save(memo);
    return memo;
  }
}
