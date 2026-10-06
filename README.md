# Git Graph for Codex

An original, MIT-licensed local Git history explorer written in TypeScript and React. It uses the MCP SDK and MCP Apps UI standard. No code from mhutchie's VS Code extension is used.

## Prototype features

- Commit topology with branch lanes and merge edges
- Local and remote-tracking branch selection
- Search highlighting across loaded commits, authors, and hashes
- Commit metadata, file statistics, and bounded patches
- Incremental history loading and a responsive layout
- Read-only Git tools over stdio, plus an optional local browser preview

## Develop

Requires Node.js 22+ and Git.

```sh
npm ci
npm run check
npm run build
npm test
GIT_GRAPH_REPO=/absolute/path/to/repository npm run preview
```

Open http://127.0.0.1:4317. The preview binds only to loopback. It rejects API calls from other origins. No Git fetches, writes, hosted service, accounts, telemetry, or model API keys are used.

## Use the MCP server in Codex

```sh
codex mcp add git-graph --env GIT_GRAPH_REPO=/absolute/path/to/repository -- node /absolute/path/to/codex-git-graph/dist/server.js
```

Start a new chat after registering the server. Ask: "Show the Git graph for this repository." The tools also work in clients that cannot render the UI. Set GIT_GRAPH_REPO explicitly when the client does not launch the server from the target repository.

## Local plugin package

`plugins/git-graph/` contains the compatibility manifest, MCP configuration, bundled server/UI, and skill. `npm run build` regenerates its `dist/` directory. The server bundle includes its runtime dependencies.

```sh
codex plugin marketplace add /absolute/path/to/codex-git-graph
codex plugin add git-graph@git-graph-local
```

The bundled MCP launches from its installed plugin directory. Pass the target checkout as the `repository` argument to `git_history`; the UI passes that repository to subsequent tools. Ask: "Show the Git graph for /absolute/path/to/repository." Local marketplace installation and the installed server bundle are verified. Native MCP Apps rendering in a fresh Codex chat remains unverified. The browser preview is a separate tested surface.

## Public directory

OpenAI's current packaging documentation requires a public HTTPS MCP endpoint for public submission, or separate support for local MCP servers. This local stdio prototype is not ready for directory submission. A hosted version would need an authenticated repository provider or an explicit local bridge; a hosted server cannot directly read a user's local checkout.

See https://developers.openai.com/plugins/build/plugins and https://developers.openai.com/plugins/build/chatgpt-ui.

## Limits

Remote-tracking refs reflect local state and may be stale. Search highlights matches in loaded history rather than searching every commit. Pagination is offset-based; a changing repository can shift rows. Git operations have a 10-second timeout and an 8 MiB output limit. Patches above 100,000 characters are shortened; commands exceeding the output limit report an error. Merge details use Git's default merge diff presentation. The graph is an on-demand app view, not a permanent Codex sidebar extension.

## Validation

`npm test` exercises a real merge fixture, pagination, custom remote branches, detached HEAD, invalid inputs, and an MCP stdio handshake/tool/resource integration. The MCP test uses `GIT_GRAPH_TEST_REPO` when supplied, otherwise creates an isolated repository fixture. Browser interaction verification covers commit details, branch selection, search highlighting, and loading more commits.
