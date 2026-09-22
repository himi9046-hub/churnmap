#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs, HELP, UsageError } from '../src/args.js';
import { GitError, readLog, repoRoot } from '../src/git.js';
import { DEFAULT_EXCLUDES, makeMatcher } from '../src/glob.js';
import { hotspots, coupling } from '../src/analyze.js';
import { makeStyle, renderHotspots, renderCoupling } from '../src/render.js';

function main(argv) {
  const opts = parseArgs(argv);

  if (opts.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (opts.version) {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    process.stdout.write(pkg.version + '\n');
    return 0;
  }

  const cwd = resolve(opts.cwd ?? '.');
  const root = repoRoot(cwd);
  const skip = makeMatcher([...(opts.defaultExcludes ? DEFAULT_EXCLUDES : []), ...opts.exclude]);

  const commits = readLog({ cwd, since: opts.since, path: opts.path });
  const all = hotspots(commits, { root, skip });
  const top = all.slice(0, opts.top);

  let pairs = [];
  if (opts.coupling) {
    const alive = new Set(all.map((r) => r.path));
    pairs = coupling(commits, { keep: (p) => alive.has(p), minShared: opts.minShared }).slice(0, opts.top);
  }

  if (opts.json) {
    const iso = (t) => new Date(t * 1000).toISOString();
    const out = {
      commits: commits.length,
      files: all.length,
      hotspots: top.map((r) => ({ ...r, first: iso(r.first), last: iso(r.last) })),
    };
    if (opts.coupling) out.coupling = pairs;
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return 0;
  }

  const style = makeStyle(process.stdout.isTTY && !process.env.NO_COLOR);
  const columns = process.stdout.columns || 100;

  if (commits.length === 0) {
    process.stdout.write('No commits found' + (opts.since ? ` since ${opts.since}` : '') + '.\n');
    return 0;
  }

  let text = '\n' + renderHotspots(top, { style, columns });
  if (opts.coupling) {
    text += '\n' + style.bold('  Change together') + '\n' + renderCoupling(pairs, { style, columns });
  }
  const scope = [opts.path, opts.since && `since ${opts.since}`].filter(Boolean).join(', ');
  text +=
    '\n' +
    style.dim(
      `  ${commits.length} commits, ${all.length} files${scope ? ` (${scope})` : ''}. ` +
        'score = commits x sqrt(lines), 100 is the worst file.',
    ) +
    '\n\n';
  process.stdout.write(text);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  if (err instanceof UsageError) {
    process.stderr.write(`churnmap: ${err.message}\nRun "churnmap --help" for usage.\n`);
    process.exitCode = 2;
  } else if (err instanceof GitError) {
    process.stderr.write(`churnmap: ${err.message}\n`);
    process.exitCode = 1;
  } else {
    throw err;
  }
}
