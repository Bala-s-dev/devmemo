import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { Memo } from '../domain/memo.js';
import { MemoNotFoundError } from '../domain/memo.js';
import type { MemoRepository } from '../domain/ports.js';
import { logger } from '../logger.js';

const DEFAULT_STORAGE_DIR = join(homedir(), '.devmemo');
const STORAGE_FILE = 'memos.json';

export class JsonMemoRepository implements MemoRepository {
  private memos: Memo[] = [];
  private filePath: string;

  private constructor(storageDir: string) {
    this.filePath = join(storageDir, STORAGE_FILE);
  }

  /**
   * Creates a new JsonMemoRepository, loading data from disk.
   * @param storageDir - optional custom directory (used in tests)
   */
  static async create(
    storageDir: string = DEFAULT_STORAGE_DIR,
  ): Promise<JsonMemoRepository> {
    const repo = new JsonMemoRepository(storageDir);
    await repo.load();
    return repo;
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      this.memos = JSON.parse(raw) as Memo[];
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // file not found → start fresh
        this.memos = [];
      } else {
        logger.error(err, 'Failed to load memos file');
        this.memos = [];
      }
    }
  }

  private async persist(): Promise<void> {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true }); // ensure ~/.devmemo exists

    const tmpPath = this.filePath + '.tmp';
    const content = JSON.stringify(this.memos, null, 2);
    await writeFile(tmpPath, content, 'utf-8');
    await rename(tmpPath, this.filePath); // atomic replace
  }

  async save(memo: Memo): Promise<void> {
    this.memos.push(memo);
    await this.persist();
  }

  async findByTarget(target: string): Promise<Memo[]> {
    return Promise.resolve(this.memos.filter((m) => m.target === target));
  }

  async search(query: string, limit: number): Promise<Memo[]> {
    const lowerQuery = query.toLowerCase();
    const scored = this.memos
      .map((memo) => {
        const haystack =
          `${memo.body} ${memo.tags.join(' ')} ${memo.target}`.toLowerCase();
        const count = (haystack.match(new RegExp(lowerQuery, 'g')) || [])
          .length;
        return { memo, score: count };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (
          new Date(b.memo.createdAt).getTime() -
          new Date(a.memo.createdAt).getTime()
        );
      })
      .slice(0, limit)
      .map(({ memo }) => memo);

    return Promise.resolve(scored);
  }

  async listAll(): Promise<Memo[]> {
    // Return a copy sorted by createdAt desc
    const sorted = [...this.memos].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return Promise.resolve(sorted);
  }

  async delete(id: string): Promise<void> {
    const index = this.memos.findIndex((m) => m.id === id);
    if (index === -1) throw new MemoNotFoundError(id);
    this.memos.splice(index, 1);
    await this.persist();
  }
}
