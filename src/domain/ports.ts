import type { Memo } from './memo.js';

export interface MemoRepository {
  save(memo: Memo): Promise<void>;
  findByTarget(target: string): Promise<Memo[]>;
  search(query: string, limit: number): Promise<Memo[]>;
  listAll(): Promise<Memo[]>;
  delete(id: string): Promise<void>;
}

export interface GitPort {
  author(): Promise<string>;
  commitSHA(): Promise<string>;
  commitMessage(): Promise<string>;
  repoRoot(): Promise<string>;
}
