import type { Commit } from "./git.js";
export interface GraphRow {
  commit: Commit;
  lane: number;
  edges: { from: number; to: number; parent: string }[];
  lanes: number;
}
export function layout(commits: Commit[]): GraphRow[] {
  const active: string[] = [];
  return commits.map((commit) => {
    let lane = active.indexOf(commit.hash);
    if (lane < 0) {
      lane = active.length;
      active.push(commit.hash);
    }
    const before = [...active];
    active.splice(lane, 1);
    commit.parents.forEach((parent, index) => {
      if (!active.includes(parent))
        active.splice(Math.min(lane + index, active.length), 0, parent);
    });
    const edges = before.flatMap((hash, from) =>
      hash === commit.hash
        ? commit.parents.map((parent) => ({
            from,
            to: active.indexOf(parent),
            parent,
          }))
        : [{ from, to: active.indexOf(hash), parent: hash }],
    );
    return {
      commit,
      lane,
      edges,
      lanes: Math.max(before.length, active.length, 1),
    };
  });
}
