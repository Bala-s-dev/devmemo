import { describe, it, expect, beforeEach } from 'vitest';
import type { Memo } from '../../src/domain/memo.js';
import type { MemoRepository, GitPort } from '../../src/domain/ports.js';
import { AddMemoUseCase } from '../../src/usecases/add-memo.js';
import { ExplainTargetUseCase } from '../../src/usecases/explain-target.js';
import { SearchMemosUseCase } from '../../src/usecases/search-memos.js';
import { ListMemosUseCase } from '../../src/usecases/list-memos.js';
import { DeleteMemoUseCase } from '../../src/usecases/delete-memo.js';

// ---- Mocks ----

class InMemoryMemoRepo implements MemoRepository {
  private memos: Map<string, Memo> = new Map();

  async save(memo: Memo): Promise<void> {
    this.memos.set(memo.id, memo);
  }

  async findByTarget(target: string): Promise<Memo[]> {
    return Array.from(this.memos.values()).filter((m) => m.target === target);
  }

  async search(query: string, limit: number): Promise<Memo[]> {
    const lower = query.toLowerCase();
    const results = Array.from(this.memos.values()).filter((m) => {
      const haystack =
        `${m.body} ${m.tags.join(' ')} ${m.target}`.toLowerCase();
      return haystack.includes(lower);
    });
    results.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return results.slice(0, limit);
  }

  async listAll(): Promise<Memo[]> {
    const all = Array.from(this.memos.values());
    all.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return all;
  }

  async delete(id: string): Promise<void> {
    if (!this.memos.has(id)) {
      const { MemoNotFoundError } = await import('../../src/domain/memo.js');
      throw new MemoNotFoundError(id);
    }
    this.memos.delete(id);
  }
}

const stubGit: GitPort = {
  author: async () => 'test author',
  commitSHA: async () => 'abc1234',
  repoRoot: async () => '/fake/repo',
};

describe('Use Cases', () => {
  let repo: InMemoryMemoRepo;

  beforeEach(() => {
    repo = new InMemoryMemoRepo();
  });

  describe('AddMemo', () => {
    it('should create a memo with correct fields', async () => {
      const useCase = new AddMemoUseCase(repo, stubGit);
      const input = {
        target: 'src/auth.ts',
        heading: 'Add JWT auth',
        body: 'Added JWT',
        tags: ['security'],
      };

      const memo = await useCase.execute(input);

      expect(memo.id).toHaveLength(10);
      expect(memo.target).toBe('src/auth.ts');
      expect(memo.heading).toBe('Add JWT auth');
      expect(memo.body).toBe('Added JWT');
      expect(memo.tags).toEqual(['security']);
      expect(memo.author).toBe('test author');
      expect(memo.commitSHA).toBe('abc1234');
      expect(new Date(memo.createdAt).getTime()).toBeLessThanOrEqual(
        Date.now(),
      );

      const saved = await repo.findByTarget('src/auth.ts');
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe(memo.id);
    });
  });

  describe('ExplainTarget', () => {
    it('should return memos for the target sorted by newest first', async () => {
      const memos: Memo[] = [
        {
          id: '1',
          target: 'f.ts',
          heading: 'Old decision',
          body: 'old',
          tags: [],
          author: 'x',
          commitSHA: 'a',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: '2',
          target: 'f.ts',
          heading: 'New decision',
          body: 'new',
          tags: [],
          author: 'x',
          commitSHA: 'a',
          createdAt: '2024-06-01T00:00:00.000Z',
        },
      ];
      await repo.save(memos[0]);
      await repo.save(memos[1]);

      const useCase = new ExplainTargetUseCase(repo);
      const result = await useCase.execute({ target: 'f.ts' });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('2');
      expect(result[1].id).toBe('1');
    });

    it('should return empty array for unknown target', async () => {
      const useCase = new ExplainTargetUseCase(repo);
      const result = await useCase.execute({ target: 'noop' });
      expect(result).toEqual([]);
    });
  });

  describe('SearchMemos', () => {
    it('should return memos that match query', async () => {
      const memo1: Memo = {
        id: '1',
        target: 'x.ts',
        heading: 'Cache layer',
        body: 'redis cache',
        tags: ['performance'],
        author: 'a',
        commitSHA: 'b',
        createdAt: new Date().toISOString(),
      };
      const memo2: Memo = {
        id: '2',
        target: 'y.ts',
        heading: 'DB tuning',
        body: 'db tuning',
        tags: [],
        author: 'a',
        commitSHA: 'b',
        createdAt: new Date().toISOString(),
      };
      await repo.save(memo1);
      await repo.save(memo2);

      const useCase = new SearchMemosUseCase(repo);
      const res = await useCase.execute({ query: 'redis' });
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('1');
    });

    it('should respect limit', async () => {
      for (let i = 0; i < 5; i++) {
        await repo.save({
          id: String(i),
          target: 'a',
          heading: 'Match ' + i,
          body: 'match',
          tags: [],
          author: 'a',
          commitSHA: 'a',
          createdAt: new Date().toISOString(),
        });
      }
      const useCase = new SearchMemosUseCase(repo);
      const res = await useCase.execute({ query: 'match', limit: 2 });
      expect(res).toHaveLength(2);
    });
  });

  describe('ListMemos', () => {
    it('should return all memos sorted by createdAt desc', async () => {
      const oldMemo: Memo = {
        id: 'old',
        target: 'a',
        heading: 'Old',
        body: 'old',
        tags: [],
        author: 'a',
        commitSHA: 'a',
        createdAt: '2023-01-01T00:00:00.000Z',
      };
      const newMemo: Memo = {
        id: 'new',
        target: 'b',
        heading: 'New',
        body: 'new',
        tags: [],
        author: 'a',
        commitSHA: 'a',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      await repo.save(oldMemo);
      await repo.save(newMemo);

      const useCase = new ListMemosUseCase(repo);
      const result = await useCase.execute();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('new');
      expect(result[1].id).toBe('old');
    });
  });

  describe('DeleteMemo', () => {
    it('should delete an existing memo', async () => {
      const memo: Memo = {
        id: 'del',
        target: 't',
        heading: 'Delete me',
        body: 'b',
        tags: [],
        author: 'a',
        commitSHA: 'a',
        createdAt: new Date().toISOString(),
      };
      await repo.save(memo);

      const useCase = new DeleteMemoUseCase(repo);
      await useCase.execute({ id: 'del' });

      const all = await repo.listAll();
      expect(all).toHaveLength(0);
    });

    it('should throw MemoNotFoundError for missing id', async () => {
      const useCase = new DeleteMemoUseCase(repo);
      await expect(useCase.execute({ id: 'nope' })).rejects.toThrow(
        'Memo not found',
      );
    });
  });
});
