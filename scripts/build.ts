import { build } from "esbuild";
import { mkdir, readFile, writeFile, cp } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/server.ts", "src/preview.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});
await build({
  entryPoints: ["web/App.tsx"],
  outfile: "dist/app.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  minify: true,
});
const js = await readFile("dist/app.js", "utf8");
const css = await readFile("dist/app.css", "utf8");
await writeFile(
  "dist/graph.html",
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Git Graph</title><style>${css}</style></head><body><div id="root"></div><script>${js.replaceAll("</script", "<\\/script")}</script></body></html>`,
);
await cp("dist", "plugins/git-graph/dist", { recursive: true });
