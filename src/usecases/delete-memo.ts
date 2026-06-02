import type { MemoRepository } from '../domain/ports.js';

export type DeleteMemoInput = {
  id: string;
};

export class DeleteMemoUseCase {
  constructor(private readonly repo: MemoRepository) {}

  async execute(input: DeleteMemoInput): Promise<void> {
    await this.repo.delete(input.id);
  }
}
