export interface Memo {
  id: string;
  target: string;
  heading: string;
  body: string;
  tags: string[];
  author: string;
  commitSHA: string; // short 7-char SHA
  commitMessage: string; // full commit message
  createdAt: string;
}

export class MemoNotFoundError extends Error {
  constructor(id: string) {
    super(`Memo not found: ${id}`);
    this.name = 'MemoNotFoundError';
  }
}
