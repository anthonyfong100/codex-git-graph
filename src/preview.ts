import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { GitRepository } from "./git.js";
const repo = await GitRepository.open(
  process.env.GIT_GRAPH_REPO || process.cwd(),
);
const port = Number(process.env.PORT || 4317);
const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end(await readFile(new URL("./graph.html", import.meta.url)));
      return;
    }
    if (
      req.method !== "POST" ||
      !["/api/git_history", "/api/git_commit"].includes(req.url ?? "")
    ) {
      res.writeHead(404);
      res.end();
      return;
    }
    if (
      req.headers.host !== `127.0.0.1:${port}` ||
      (req.headers.origin && req.headers.origin !== `http://127.0.0.1:${port}`)
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 4096) throw new Error("Request too large");
    }
    const args = JSON.parse(body);
    const data =
      req.url === "/api/git_history"
        ? await repo.history(args.limit, args.offset, args.branch)
        : await repo.detail(args.hash);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Unable to read Git data. Check the request and repository.",
      }),
    );
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Git Graph preview: http://127.0.0.1:${port}`),
);
