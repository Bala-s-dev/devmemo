import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonMemoRepository } from '../../src/infra/json-repo.js';
import type { Memo } from '../../src/domain/memo.js';
import { MemoNotFoundError } from '../../src/domain/memo.js';

describe('JsonMemoRepository', () => {
  let repo: JsonMemoRepository;
  let testDir: string;

  const makeMemo = (
    id: string,
    target: string,
    heading: string,
    body: string,
    tags: string[] = [],
  ): Memo => ({
    id,
    target,
    heading,
    body,
    tags,
    author: 'test',
    commitSHA: 'abc1234',
    createdAt: new Date().toISOString(),
  });

  beforeEach(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'devmemo-test-'));
    repo = await JsonMemoRepository.create(testDir);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should save and retrieve memos by target', async () => {
    const memo = makeMemo('1', 'src/app.ts', 'App setup', 'added app');
    await repo.save(memo);

    const found = await repo.findByTarget('src/app.ts');
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('1');
  });

  it('should search memos case-insensitively', async () => {
    await repo.save(
      makeMemo('1', 'f1.ts', 'Redis cache', 'Redis cache layer', [
        'performance',
      ]),
    );
    await repo.save(
      makeMemo('2', 'f2.ts', 'DB tuning', 'database tuning', ['db']),
    );

    const results = await repo.search('redis', 10);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('should return memos sorted by score then date', async () => {
    await repo.save({
      ...makeMemo('high', 'a.ts', 'High score', 'redis redis cache'),
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    await repo.save({
      ...makeMemo('low', 'b.ts', 'Low score', 'redis cache'),
      createdAt: '2024-06-01T00:00:00.000Z',
    });

    const results = await repo.search('redis', 10);
    expect(results.map((m) => m.id)).toEqual(['high', 'low']);
  });

  it('should delete a memo and throw for missing id', async () => {
    await repo.save(makeMemo('del', 't.ts', 'Delete me', 'something'));
    await repo.delete('del');
    const all = await repo.listAll();
    expect(all).toHaveLength(0);

    await expect(repo.delete('nope')).rejects.toThrow(MemoNotFoundError);
  });

  it('should persist data across reloads', async () => {
    await repo.save(makeMemo('1', 'x.ts', 'Persist', 'hello'));
    const repo2 = await JsonMemoRepository.create(testDir);
    const memos = await repo2.listAll();
    expect(memos).toHaveLength(1);
    expect(memos[0].id).toBe('1');
  });

  it('should handle atomic write (no corruption)', async () => {
    for (let i = 0; i < 10; i++) {
      await repo.save(makeMemo(String(i), 'f.ts', 'Title ' + i, 'data'));
    }
    const repo2 = await JsonMemoRepository.create(testDir);
    const all = await repo2.listAll();
    expect(all).toHaveLength(10);
  });
});
