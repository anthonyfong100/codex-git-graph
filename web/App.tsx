import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@modelcontextprotocol/ext-apps";
import type { History } from "../src/git.js";
import { layout } from "../src/layout.js";
import "./style.css";
const colors = [
  "#8da4ff",
  "#63d6c2",
  "#ffc184",
  "#dca0ff",
  "#ff95b0",
  "#9edd91",
];
const bridge = new App({ name: "Git Graph", version: "0.1.0" });
const preview = window.parent === window;
async function call(name: string, args: Record<string, unknown>) {
  if (preview) {
    const r = await fetch(`/api/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    return data;
  }
  const r = await bridge.callServerTool({ name, arguments: args });
  if (r.isError) throw new Error("Git request failed");
  return r.structuredContent;
}
function GitGraph() {
  const [history, setHistory] = useState<History>();
  const [branch, setBranch] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>();
  const [detail, setDetail] = useState<{
    summary: string;
    patch: string;
    truncated: boolean;
  }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load(selectedBranch = branch, more = false) {
    setBusy(true);
    setError("");
    try {
      const data = (await call("git_history", {
        repository: history?.repository,
        limit: 100,
        offset: more ? (history?.commits.length ?? 0) : 0,
        branch: selectedBranch || undefined,
      })) as History;
      setHistory((old) =>
        more && old
          ? { ...data, commits: [...old.commits, ...data.commits] }
          : data,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load history");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (preview) {
      void load();
      return;
    }
    bridge.ontoolresult = (result) => {
      const data = result.structuredContent as unknown as History;
      if (data?.commits) setHistory(data);
    };
    bridge.connect().catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setDetail(undefined);
    call("git_commit", { hash: selected, repository: history?.repository })
      .then((data) => {
        if (!cancelled) setDetail(data as typeof detail);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);
  const rows = layout(history?.commits ?? []);
  const width = Math.max(72, ...rows.map((row) => row.lanes * 22 + 22));
  return (
    <main>
      <header>
        <div className="brand">
          <span className="mark">⑂</span>
          <div>
            <h1>Git Graph</h1>
            <p>
              {history?.repository.split("/").pop() ?? "Opening repository"}
            </p>
          </div>
        </div>
        <span className="readonly">Read only</span>
      </header>
      <div className="toolbar">
        <select
          aria-label="Branch"
          value={branch}
          onChange={(e) => {
            setBranch(e.target.value);
            void load(e.target.value);
          }}
        >
          <option value="">All branches</option>
          {history?.branches.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <input
          aria-label="Search loaded commits"
          placeholder="Search loaded commits..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button disabled={busy} onClick={() => void load()}>
          {busy ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </div>
      )}
      <div className="workspace">
        <section className="history" aria-label="Commit history">
          {rows.map(({ commit, lane, edges }) => {
            const matches = `${commit.subject} ${commit.author} ${commit.hash}`
              .toLowerCase()
              .includes(query.toLowerCase());
            return (
              <button
                key={commit.hash}
                className={`commit ${selected === commit.hash ? "selected" : ""} ${matches ? "" : "muted"}`}
                onClick={() => setSelected(commit.hash)}
                aria-label={`Inspect ${commit.subject}`}
                aria-pressed={selected === commit.hash}
              >
                <svg width={width} height="62" aria-hidden="true">
                  {edges.map((edge, i) => (
                    <path
                      key={i}
                      d={`M ${edge.from * 22 + 18} 0 L ${edge.from * 22 + 18} 31 C ${edge.from * 22 + 18} 48 ${edge.to * 22 + 18} 45 ${edge.to * 22 + 18} 62`}
                      stroke={colors[edge.from % colors.length]}
                      strokeWidth="2"
                      fill="none"
                    />
                  ))}
                  <circle
                    cx={lane * 22 + 18}
                    cy="31"
                    r="5"
                    fill={colors[lane % colors.length]}
                    stroke="#15171c"
                    strokeWidth="2"
                  />
                </svg>
                <div className="committext">
                  <div className="subject">{commit.subject}</div>
                  <div className="meta">
                    <code>{commit.hash.slice(0, 7)}</code>
                    <span>{commit.author}</span>
                    <time>{new Date(commit.date).toLocaleDateString()}</time>
                  </div>
                </div>
                <div className="refs">
                  {commit.refs.map((ref) => (
                    <span key={ref}>{ref}</span>
                  ))}
                </div>
              </button>
            );
          })}
          {!rows.length && (
            <div className="empty">
              {history ? "No commits yet." : "Loading Git history..."}
            </div>
          )}
          {history?.hasMore && (
            <button
              className="more"
              disabled={busy}
              onClick={() => void load(branch, true)}
            >
              Load more commits
            </button>
          )}
        </section>
        <aside aria-label="Commit details">
          {selected ? (
            <>
              <div className="detailhead">
                <h2>Commit details</h2>
                <button
                  onClick={() => {
                    setSelected(undefined);
                    setDetail(undefined);
                  }}
                >
                  Close
                </button>
              </div>
              {detail ? (
                <>
                  <pre>{detail.summary}</pre>
                  <h3>Changes</h3>
                  <pre className="patch">
                    {detail.patch || "No text changes"}
                  </pre>
                  {detail.truncated && (
                    <p>Patch shortened to 100,000 characters.</p>
                  )}
                </>
              ) : (
                <p>Loading commit...</p>
              )}
            </>
          ) : (
            <div className="empty">
              <span>↖</span>
              <h2>Explore your history</h2>
              <p>Select a commit to inspect its changes.</p>
            </div>
          )}
        </aside>
      </div>
      <footer>
        {history?.commits.length ?? 0} commits loaded
        <span>Local repository · No network requests</span>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<GitGraph />);
