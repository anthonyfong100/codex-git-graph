import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
test("MCP handshake, tools, UI resource, and real history work over stdio", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "git-graph-mcp-"));
  execFileSync("git", ["init", "-b", "main", fixture]);
  await writeFile(join(fixture, "README.md"), "MCP fixture");
  execFileSync("git", ["-C", fixture, "add", "."]);
  execFileSync("git", [
    "-C",
    fixture,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-m",
    "Fixture",
  ]);
  const client = new Client({ name: "git-graph-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/server.js"],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (pair): pair is [string, string] => pair[1] !== undefined,
        ),
      ),
      GIT_GRAPH_REPO: process.env.GIT_GRAPH_TEST_REPO || fixture,
    },
  });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((t) => t.name).sort(), [
      "git_commit",
      "git_history",
    ]);
    const result = await client.callTool({
      name: "git_history",
      arguments: { limit: 5 },
    });
    assert.equal(result.isError, undefined);
    assert.ok(
      (result.structuredContent as { commits: unknown[] }).commits.length > 0,
    );
    const resource = await client.readResource({
      uri: "ui://git-graph/v1.html",
    });
    assert.ok(
      "text" in resource.contents[0] &&
        resource.contents[0].text.includes('<div id="root">'),
    );
    const invalid = await client.callTool({
      name: "git_commit",
      arguments: { hash: "--help" },
    });
    assert.equal(invalid.isError, true);
  } finally {
    await client.close();
    await rm(fixture, { recursive: true, force: true });
  }
});
