import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function countLines(file) {
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    return null;
  }
  if (buf.subarray(0, 8000).includes(0)) return null;
  if (buf.length === 0) return 0;
  let n = 0;
  for (const byte of buf) if (byte === 10) n++;
  return buf[buf.length - 1] === 10 ? n : n + 1;
}

// A hotspot is a file that is both large and frequently changed. Neither alone is
// interesting: a 3000-line file nobody touches is fine, so is a config file edited daily.
// score = commits * sqrt(lines), scaled so the worst file is 100.
export function hotspots(commits, { root, skip = () => false, lines = (p) => countLines(join(root, p)) }) {
  const stats = new Map();

  for (const commit of commits) {
    for (const f of commit.files) {
      if (skip(f.path)) continue;
      let s = stats.get(f.path);
      if (!s) {
        s = { path: f.path, commits: 0, churn: 0, binary: false, authors: new Map(), first: commit.time, last: commit.time };
        stats.set(f.path, s);
      }
      s.commits++;
      if (f.added === null) s.binary = true;
      else s.churn += f.added + f.deleted;
      s.authors.set(commit.author, (s.authors.get(commit.author) || 0) + 1);
      if (commit.time < s.first) s.first = commit.time;
      if (commit.time > s.last) s.last = commit.time;
    }
  }

  const rows = [];
  for (const s of stats.values()) {
    if (s.binary) continue;
    const n = lines(s.path);
    if (n === null || n === 0) continue;

    let owner = { name: '', share: 0 };
    for (const [name, count] of s.authors) {
      if (count > owner.share) owner = { name, share: count };
    }
    owner.share /= s.commits;

    rows.push({
      path: s.path,
      raw: s.commits * Math.sqrt(n),
      commits: s.commits,
      lines: n,
      churn: s.churn,
      authors: s.authors.size,
      owner,
      first: s.first,
      last: s.last,
    });
  }

  const max = Math.max(0, ...rows.map((r) => r.raw));
  for (const r of rows) {
    r.score = max ? Math.round((r.raw / max) * 100) : 0;
  }
  rows.sort((a, b) => b.raw - a.raw || b.commits - a.commits || a.path.localeCompare(b.path));
  for (const r of rows) delete r.raw;
  return rows;
}

// Temporal coupling: pairs of files that keep showing up in the same commits.
// Huge commits (reformatting, renames, vendoring) say nothing about design, so they're ignored.
export function coupling(commits, { keep = () => true, minShared = 5, maxFiles = 30 } = {}) {
  const seen = new Map();
  const pairs = new Map();

  for (const commit of commits) {
    const paths = [...new Set(commit.files.map((f) => f.path))].filter(keep).sort();
    if (paths.length > maxFiles) continue;
    for (const p of paths) seen.set(p, (seen.get(p) || 0) + 1);
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const key = paths[i] + '\0' + paths[j];
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }
  }

  const rows = [];
  for (const [key, shared] of pairs) {
    if (shared < minShared) continue;
    const [a, b] = key.split('\0');
    const degree = (2 * shared) / (seen.get(a) + seen.get(b));
    rows.push({ a, b, shared, degree: Math.round(degree * 100) });
  }
  rows.sort((x, y) => y.degree - x.degree || y.shared - x.shared || x.a.localeCompare(y.a));
  return rows;
}
