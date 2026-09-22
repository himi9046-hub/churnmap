export class UsageError extends Error {}

export const HELP = `Usage: churnmap [options] [path]

Ranks files by how often they change and how big they are. The files at the
top are where bugs, merge conflicts and slow reviews tend to come from.

Options
  -n, --top <n>          how many files to show (default 15)
  -s, --since <when>     only look at history after this, e.g. "6 months ago"
  -x, --exclude <glob>   skip matching files, repeatable
      --no-default-excludes
                         don't skip lockfiles, source maps and minified files
  -c, --coupling         also list files that usually change together
      --min-shared <n>   minimum shared commits for a coupled pair (default 5)
  -C <dir>               run as if started in <dir>
      --json             machine-readable output
  -h, --help             show this help
  -v, --version          show version

Examples
  churnmap
  churnmap src --since "1 year ago" --top 25
  churnmap -c -x "*.test.ts" -x docs/
`;

function toInt(value, flag) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new UsageError(`${flag} expects a positive whole number, got "${value}"`);
  return n;
}

export function parseArgs(argv) {
  const opts = {
    top: 15,
    since: null,
    path: null,
    exclude: [],
    defaultExcludes: true,
    coupling: false,
    minShared: 5,
    json: false,
    cwd: null,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    let inline;
    const eq = arg.indexOf('=');
    if (arg.startsWith('--') && eq !== -1) {
      inline = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    const value = () => {
      if (inline !== undefined) return inline;
      if (i + 1 >= argv.length) throw new UsageError(`${arg} needs a value`);
      return argv[++i];
    };

    switch (arg) {
      case '-n':
      case '--top':
        opts.top = toInt(value(), arg);
        break;
      case '-s':
      case '--since':
        opts.since = value();
        break;
      case '-x':
      case '--exclude':
        opts.exclude.push(value());
        break;
      case '--no-default-excludes':
        opts.defaultExcludes = false;
        break;
      case '-c':
      case '--coupling':
        opts.coupling = true;
        break;
      case '--min-shared':
        opts.minShared = toInt(value(), arg);
        break;
      case '-C':
        opts.cwd = value();
        break;
      case '--json':
        opts.json = true;
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '-v':
      case '--version':
        opts.version = true;
        break;
      default:
        if (arg.startsWith('-') && arg !== '-') throw new UsageError(`unknown option ${arg}`);
        if (opts.path !== null) throw new UsageError(`only one path is supported, got "${opts.path}" and "${arg}"`);
        opts.path = arg;
    }
  }
  return opts;
}
