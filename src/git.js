import { execFileSync } from 'node:child_process';

export class GitError extends Error {}

export function git(args, cwd) {
  try {
    return execFileSync('git', ['-c', 'core.quotepath=off', ...args], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    if (err.code === 'ENOENT') throw new GitError('git is not installed or not on PATH');
    const msg = String(err.stderr || err.message).trim().split('\n')[0];
    throw new GitError(msg.replace(/^fatal: /, ''));
  }
}

export function repoRoot(cwd) {
  return git(['rev-parse', '--show-toplevel'], cwd).trim();
}

export function readLog({ cwd, since, path }) {
  const args = ['log', '--no-merges', '--no-renames', '--numstat', '--format=%x00%H%x1f%aN%x1f%at'];
  if (since) args.push(`--since=${since}`);
  args.push('--');
  if (path) args.push(path);
  return parseLog(git(args, cwd));
}

// Input is `git log` with a NUL-prefixed header per commit, followed by numstat lines.
export function parseLog(raw) {
  const commits = [];
  for (const chunk of raw.split('\0')) {
    if (!chunk.trim()) continue;
    const nl = chunk.indexOf('\n');
    const header = nl === -1 ? chunk : chunk.slice(0, nl);
    const body = nl === -1 ? '' : chunk.slice(nl + 1);
    const [hash, author, time] = header.split('\x1f');

    const files = [];
    for (const line of body.split('\n')) {
      const parts = line.replace(/\r$/, '').split('\t');
      if (parts.length < 3) continue;
      const [added, deleted, ...rest] = parts;
      files.push({
        path: rest.join('\t'),
        added: added === '-' ? null : Number(added),
        deleted: deleted === '-' ? null : Number(deleted),
      });
    }
    commits.push({ hash, author, time: Number(time), files });
  }
  return commits;
}
