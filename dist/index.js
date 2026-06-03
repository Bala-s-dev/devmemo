#!/usr/bin/env node

// src/cli/index.ts
import { Command } from "commander";

// src/infra/git-adapter.ts
import simpleGit from "simple-git";

// src/logger.ts
import pino from "pino";
var level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info");
var logger = pino({ level });

// src/infra/git-adapter.ts
var GitAdapter = class {
  git = simpleGit();
  async author() {
    try {
      const name = await this.git.raw(["config", "user.name"]);
      return name.trim() || "unknown";
    } catch {
      logger.warn("Could not read git user.name, using 'unknown'");
      return "unknown";
    }
  }
  async commitSHA() {
    try {
      const sha = await this.git.revparse(["--short", "HEAD"]);
      return sha.trim() || "no-commit";
    } catch {
      logger.warn("Could not read git HEAD SHA, using 'no-commit'");
      return "no-commit";
    }
  }
  async repoRoot() {
    try {
      const root = await this.git.revparse(["--show-toplevel"]);
      return root.trim();
    } catch {
      logger.warn("Could not determine repo root, using cwd");
      return process.cwd();
    }
  }
};

// src/infra/json-repo.ts
import { readFile, writeFile, rename, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { homedir } from "os";

// src/domain/memo.ts
var MemoNotFoundError = class extends Error {
  constructor(id) {
    super(`Memo not found: ${id}`);
    this.name = "MemoNotFoundError";
  }
};

// src/infra/json-repo.ts
var DEFAULT_STORAGE_DIR = join(homedir(), ".devmemo");
var STORAGE_FILE = "memos.json";
var JsonMemoRepository = class _JsonMemoRepository {
  memos = [];
  filePath;
  constructor(storageDir) {
    this.filePath = join(storageDir, STORAGE_FILE);
  }
  /**
   * Creates a new JsonMemoRepository, loading data from disk.
   * @param storageDir - optional custom directory (used in tests)
   */
  static async create(storageDir = DEFAULT_STORAGE_DIR) {
    const repo2 = new _JsonMemoRepository(storageDir);
    await repo2.load();
    return repo2;
  }
  async load() {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      this.memos = JSON.parse(raw);
    } catch (err) {
      if (err.code === "ENOENT") {
        this.memos = [];
      } else {
        logger.error(err, "Failed to load memos file");
        this.memos = [];
      }
    }
  }
  async persist() {
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    const tmpPath = this.filePath + ".tmp";
    const content = JSON.stringify(this.memos, null, 2);
    await writeFile(tmpPath, content, "utf-8");
    await rename(tmpPath, this.filePath);
  }
  async save(memo) {
    this.memos.push(memo);
    await this.persist();
  }
  async findByTarget(target) {
    return Promise.resolve(this.memos.filter((m) => m.target === target));
  }
  async search(query, limit) {
    const lowerQuery = query.toLowerCase();
    const scored = this.memos.map((memo) => {
      const haystack = `${memo.body} ${memo.tags.join(" ")} ${memo.target}`.toLowerCase();
      const count = (haystack.match(new RegExp(lowerQuery, "g")) || []).length;
      return { memo, score: count };
    }).filter(({ score }) => score > 0).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.memo.createdAt).getTime() - new Date(a.memo.createdAt).getTime();
    }).slice(0, limit).map(({ memo }) => memo);
    return Promise.resolve(scored);
  }
  async listAll() {
    const sorted = [...this.memos].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return Promise.resolve(sorted);
  }
  async delete(id) {
    const index = this.memos.findIndex((m) => m.id === id);
    if (index === -1) throw new MemoNotFoundError(id);
    this.memos.splice(index, 1);
    await this.persist();
  }
};

// src/cli/commands/add.ts
import { input, editor } from "@inquirer/prompts";
import ora from "ora";
import chalk from "chalk";

// src/usecases/add-memo.ts
import { nanoid } from "nanoid";
var AddMemoUseCase = class {
  constructor(repo2, git2) {
    this.repo = repo2;
    this.git = git2;
  }
  repo;
  git;
  async execute(input3) {
    const [author, commitSHA] = await Promise.all([
      this.git.author(),
      this.git.commitSHA()
    ]);
    const memo = {
      id: nanoid(10),
      target: input3.target,
      body: input3.body,
      tags: input3.tags,
      author,
      commitSHA,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.repo.save(memo);
    return memo;
  }
};

// src/cli/commands/add.ts
function registerAddCommand(program2, repo2, git2) {
  program2.command("add [target]").description("Add a new decision memo").option("--json", "Output raw JSON").action(
    async (targetArg, options) => {
      const jsonMode = options.json ?? false;
      try {
        let target = targetArg;
        if (!target) {
          if (jsonMode) {
            console.error(
              chalk.red("Error: target is required in --json mode")
            );
            process.exit(1);
          }
          target = await input({ message: "File or symbol?" });
        }
        let body;
        if (jsonMode) {
          console.error(
            chalk.red(
              "Error: --json mode for add requires piping body via stdin"
            )
          );
          process.exit(1);
        } else {
          body = await editor({
            message: "What decision was made? (save and close editor to continue)"
          });
        }
        const tagsRaw = await input({
          message: "Tags? (comma-separated, optional)",
          default: ""
        });
        const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
        const spinner = jsonMode ? null : ora("Saving memo\u2026").start();
        const useCase = new AddMemoUseCase(repo2, git2);
        const memo = await useCase.execute({ target, body, tags });
        spinner?.stop();
        if (jsonMode) {
          console.log(JSON.stringify(memo));
        } else {
          console.log(chalk.green(`\u2713 Memo saved [${memo.id}]`));
        }
      } catch (err) {
        logger.error(err, "Add command failed");
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    }
  );
}

// src/cli/commands/explain.ts
import ora2 from "ora";
import chalk2 from "chalk";

// src/usecases/explain-target.ts
var ExplainTargetUseCase = class {
  constructor(repo2) {
    this.repo = repo2;
  }
  repo;
  async execute(input3) {
    const memos = await this.repo.findByTarget(input3.target);
    memos.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return memos;
  }
};

// src/cli/commands/explain.ts
function registerExplainCommand(program2, repo2) {
  program2.command("explain <target>").description("Show all memos for a target").option("--json", "Output raw JSON").action(async (target, options) => {
    const jsonMode = options.json ?? false;
    try {
      const spinner = jsonMode ? null : ora2("Fetching memos\u2026").start();
      const useCase = new ExplainTargetUseCase(repo2);
      const memos = await useCase.execute({ target });
      spinner?.stop();
      if (jsonMode) {
        console.log(JSON.stringify(memos));
        return;
      }
      if (memos.length === 0) {
        console.log(
          chalk2.yellow(
            `No memos for '${target}'. Add one with: devmemo add ${target}`
          )
        );
        return;
      }
      memos.forEach((memo) => {
        const date = new Date(memo.createdAt).toISOString().slice(0, 10);
        console.log("\u250C" + "\u2500".repeat(40) + "\u2510");
        console.log(
          `\u2502 ${chalk2.bold(memo.target)}  \u2022  ${memo.commitSHA}  \u2022  ${date}`
        );
        console.log(`\u2502 Tags: ${memo.tags.join(", ")}`);
        console.log("\u251C" + "\u2500".repeat(40) + "\u2524");
        const body = memo.body.length > 36 ? memo.body.slice(0, 36) + "\u2026" : memo.body;
        console.log(`\u2502 ${body.padEnd(36)} \u2502`);
        console.log("\u2514" + "\u2500".repeat(40) + "\u2518");
      });
    } catch (err) {
      logger.error(err, "Explain command failed");
      console.error(chalk2.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
}

// src/cli/commands/search.ts
import ora3 from "ora";
import chalk3 from "chalk";

// src/usecases/search-memos.ts
var SearchMemosUseCase = class {
  constructor(repo2) {
    this.repo = repo2;
  }
  repo;
  async execute(input3) {
    return this.repo.search(input3.query, input3.limit ?? 10);
  }
};

// src/cli/commands/search.ts
function registerSearchCommand(program2, repo2) {
  program2.command("search <query>").description("Search memos by text").option("--json", "Output raw JSON").action(async (query, options) => {
    const jsonMode = options.json ?? false;
    try {
      const spinner = jsonMode ? null : ora3("Searching\u2026").start();
      const useCase = new SearchMemosUseCase(repo2);
      const memos = await useCase.execute({ query });
      spinner?.stop();
      if (jsonMode) {
        console.log(JSON.stringify(memos));
        return;
      }
      if (memos.length === 0) {
        console.log(chalk3.yellow("No memos found."));
        return;
      }
      memos.forEach((memo, idx) => {
        const preview = memo.body.slice(0, 80).replace(/\n/g, " ");
        console.log(
          `${chalk3.dim(`${idx + 1}.`)} ${chalk3.bold(memo.target)} \u2013 ${preview}`
        );
      });
      console.log(
        chalk3.dim(
          `
${memos.length} results  \u2022  run \`devmemo explain <target>\` for details`
        )
      );
    } catch (err) {
      logger.error(err, "Search command failed");
      console.error(chalk3.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
}

// src/cli/commands/list.ts
import ora4 from "ora";
import chalk4 from "chalk";

// src/usecases/list-memos.ts
var ListMemosUseCase = class {
  constructor(repo2) {
    this.repo = repo2;
  }
  repo;
  async execute(_input = {}) {
    const memos = await this.repo.listAll();
    memos.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return memos;
  }
};

// src/cli/commands/list.ts
function registerListCommand(program2, repo2) {
  program2.command("list").description("List all memos grouped by target").option("--json", "Output raw JSON").action(async (options) => {
    const jsonMode = options.json ?? false;
    try {
      const spinner = jsonMode ? null : ora4("Loading memos\u2026").start();
      const useCase = new ListMemosUseCase(repo2);
      const memos = await useCase.execute();
      spinner?.stop();
      if (jsonMode) {
        console.log(JSON.stringify(memos));
        return;
      }
      if (memos.length === 0) {
        console.log(
          chalk4.yellow("No memos yet. Add one with: devmemo add <target>")
        );
        return;
      }
      const grouped = /* @__PURE__ */ new Map();
      for (const memo of memos) {
        const existing = grouped.get(memo.target) || [];
        existing.push(memo);
        grouped.set(memo.target, existing);
      }
      for (const [target, targetMemos] of grouped) {
        console.log(chalk4.bold(`
${target}`));
        for (const memo of targetMemos) {
          const date = new Date(memo.createdAt).toISOString().slice(0, 10);
          const preview = memo.body.slice(0, 60).replace(/\n/g, " ");
          console.log(
            `  ${chalk4.dim(memo.id)}  ${chalk4.dim(date)}  ${preview}`
          );
        }
      }
    } catch (err) {
      logger.error(err, "List command failed");
      console.error(chalk4.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
}

// src/cli/commands/delete.ts
import { input as input2 } from "@inquirer/prompts";
import ora5 from "ora";
import chalk5 from "chalk";

// src/usecases/delete-memo.ts
var DeleteMemoUseCase = class {
  constructor(repo2) {
    this.repo = repo2;
  }
  repo;
  async execute(input3) {
    await this.repo.delete(input3.id);
  }
};

// src/cli/commands/delete.ts
function registerDeleteCommand(program2, repo2) {
  program2.command("delete <id>").description("Delete a memo by id").option("--json", "Output raw JSON").action(async (id, options) => {
    const jsonMode = options.json ?? false;
    try {
      if (!jsonMode) {
        const answer = await input2({
          message: `Delete memo [${id}]? (y/N)`,
          default: "n"
        });
        if (answer.toLowerCase() !== "y") {
          console.log(chalk5.yellow("Aborted."));
          return;
        }
      }
      const spinner = jsonMode ? null : ora5("Deleting\u2026").start();
      const useCase = new DeleteMemoUseCase(repo2);
      await useCase.execute({ id });
      spinner?.stop();
      if (jsonMode) {
        console.log(JSON.stringify({ deleted: id }));
      } else {
        console.log(chalk5.red("\u2713 Memo deleted"));
      }
    } catch (err) {
      logger.error(err, "Delete command failed");
      console.error(chalk5.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });
}

// src/cli/index.ts
var program = new Command();
program.name("devmemo").description("Capture and retrieve developer decision memory").version("1.0.0");
var repo = await JsonMemoRepository.create();
var git = new GitAdapter();
registerAddCommand(program, repo, git);
registerExplainCommand(program, repo);
registerSearchCommand(program, repo);
registerListCommand(program, repo);
registerDeleteCommand(program, repo);
program.option("--json", "Output raw JSON", false);
program.parseAsync(process.argv).catch((err) => {
  logger.error(err, "CLI execution failed");
  process.exit(1);
});
