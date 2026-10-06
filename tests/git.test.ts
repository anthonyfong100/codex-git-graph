import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { GitRepository } from "../src/git.js";
import { layout } from "../src/layout.js";
function git(root: string, ...args: string[]) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
  }).trim();
}
test("reads merges, pagination, remote branches, details, and rejects invalid input", async () => {
  const root = await mkdtemp(join(tmpdir(), "git-graph-test-"));
  try {
    git(root, "init", "-b", "main");
    git(root, "config", "user.name", "Test Author");
    git(root, "config", "user.email", "test@example.invalid");
    const repo = await GitRepository.open(root);
    assert.equal((await repo.history()).commits.length, 0);
    await writeFile(join(root, "base.txt"), "base");
    git(root, "add", ".");
    git(root, "commit", "-m", "Initial <script>");
    git(root, "checkout", "-b", "feature");
    await writeFile(join(root, "feature.txt"), "feature");
    git(root, "add", ".");
    git(root, "commit", "-m", "Feature");
    git(root, "checkout", "main");
    await writeFile(join(root, "main.txt"), "main");
    git(root, "add", ".");
    git(root, "commit", "-m", "Main");
    git(root, "merge", "--no-ff", "feature", "-m", "Merge feature");
    git(root, "update-ref", "refs/remotes/upstream/main", "HEAD");
    const history = await repo.history();
    assert.equal(history.commits.length, 4);
    assert.equal(history.commits[0].parents.length, 2);
    const page = await repo.history(2);
    assert.equal(page.hasMore, true);
    assert.deepEqual(
      (await repo.history(2, 2)).commits,
      history.commits.slice(2),
    );
    assert.equal(
      (await repo.history(100, 0, "upstream/main")).commits.length,
      4,
    );
    assert.equal((await repo.history(100, 0, "feature")).commits.length, 2);
    const detail = await repo.detail(history.commits[1].hash);
    assert.ok(detail.summary);
    assert.ok(detail.patch);
    await assert.rejects(repo.history(301));
    await assert.rejects(repo.history(100, 0, "--all"));
    await assert.rejects(repo.detail("--output=/tmp/oops"));
    const rows = layout(history.commits);
    assert.equal(rows[0].edges.length, 2);
    assert.ok(
      rows.every((row) =>
        row.edges.every((edge) => edge.from >= 0 && edge.to >= 0),
      ),
    );
    git(root, "checkout", "--detach", "HEAD");
    assert.equal((await repo.history()).commits.length, 4);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
