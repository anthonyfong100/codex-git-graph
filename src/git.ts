import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";
const exec = promisify(execFile);
export interface Commit {
  hash: string;
  parents: string[];
  author: string;
  date: string;
  subject: string;
  refs: string[];
}
export interface History {
  repository: string;
  commits: Commit[];
  branches: string[];
  hasMore: boolean;
  offset: number;
}
export class GitRepository {
  private constructor(readonly root: string) {}
  static async open(path: string) {
    const root = await realpath(path);
    const repo = new GitRepository(root);
    const top = (await repo.run(["rev-parse", "--show-toplevel"])).trim();
    return new GitRepository(await realpath(top));
  }
  private async run(args: string[]) {
    const { stdout } = await exec(
      "git",
      ["--no-pager", "-c", "core.quotePath=true", "-C", this.root, ...args],
      {
        encoding: "utf8",
        timeout: 10000,
        maxBuffer: 8 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_OPTIONAL_LOCKS: "0",
          GIT_TERMINAL_PROMPT: "0",
        },
      },
    );
    return stdout;
  }
  async history(limit = 100, offset = 0, branch?: string): Promise<History> {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 300 ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 100000
    )
      throw new Error("Invalid history window");
    const refs = (
      await this.run([
        "for-each-ref",
        "--format=%(refname:short)%09%(refname)",
        "refs/heads",
        "refs/remotes",
      ])
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split("\t"));
    const branches = refs.map(([name]) => name);
    if (branch && !branches.includes(branch))
      throw new Error("Choose an existing branch");
    const base = { repository: this.root, branches, offset };
    let head = false;
    try {
      await this.run(["rev-parse", "--verify", "HEAD"]);
      head = true;
    } catch {}
    if (!head && !branches.length)
      return { ...base, commits: [], hasMore: false };
    const args = [
      "log",
      "--topo-order",
      "-z",
      "--format=%H%x00%P%x00%an%x00%aI%x00%s%x00%D",
      `--max-count=${limit + 1}`,
      `--skip=${offset}`,
    ];
    if (branch) args.push(refs.find(([name]) => name === branch)![1]);
    else {
      args.push("--all");
      if (head) args.push("HEAD");
    }
    args.push("--");
    const raw = (await this.run(args)).split("\0");
    const commits: Commit[] = [];
    for (let i = 0; i + 5 < raw.length; i += 6) {
      const [hash, parents, author, date, subject, refs] = raw.slice(i, i + 6);
      commits.push({
        hash,
        parents: parents.split(" ").filter(Boolean),
        author,
        date,
        subject,
        refs: refs.split(", ").filter(Boolean),
      });
    }
    return {
      ...base,
      commits: commits.slice(0, limit),
      hasMore: commits.length > limit,
    };
  }
  async detail(hash: string) {
    if (!/^[a-f0-9]{40}$|^[a-f0-9]{64}$/.test(hash))
      throw new Error("A full commit hash is required");
    const summary = await this.run([
      "show",
      "--no-ext-diff",
      "--no-textconv",
      "--format=fuller",
      "--stat",
      hash,
      "--",
    ]);
    const patch = await this.run([
      "show",
      "--no-ext-diff",
      "--no-textconv",
      "--format=",
      "--patch",
      "--unified=3",
      hash,
      "--",
    ]);
    return {
      hash,
      summary,
      patch: patch.slice(0, 100000),
      truncated: patch.length > 100000,
    };
  }
}
