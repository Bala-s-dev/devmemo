export interface Memo {
  id: string; // nanoid(10)
  target: string; // file path or symbol e.g. "src/auth/jwt.ts"
  body: string; // the decision explanation
  tags: string[]; // e.g. ["performance", "security"]
  author: string; // from git config user.name
  commitSHA: string; // current HEAD sha (short, 7 chars)
  createdAt: string; // ISO 8601
}

export class MemoNotFoundError extends Error {
  constructor(id: string) {
    super(`Memo not found: ${id}`);
    this.name = 'MemoNotFoundError';
  }
}
