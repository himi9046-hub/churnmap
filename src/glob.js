export const DEFAULT_EXCLUDES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'Cargo.lock',
  'Gemfile.lock',
  'composer.lock',
  'poetry.lock',
  'uv.lock',
  'go.sum',
  '*.min.js',
  '*.min.css',
  '*.map',
  '*.snap',
];

export function globToRegExp(glob) {
  let pattern = glob.replace(/\\/g, '/');
  const dirOnly = pattern.endsWith('/');
  if (dirOnly) pattern = pattern.slice(0, -1);
  const rooted = pattern.startsWith('/');
  if (rooted) pattern = pattern.slice(1);
  const anchored = rooted || pattern.includes('/');

  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '*' && pattern[i + 1] === '*') {
      i++;
      if (pattern[i + 1] === '/') {
        i++;
        re += '(?:.*/)?';
      } else {
        re += '.*';
      }
    } else if (ch === '*') {
      re += '[^/]*';
    } else if (ch === '?') {
      re += '[^/]';
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }

  const prefix = anchored ? '^' : '(?:^|/)';
  const suffix = dirOnly ? '/' : '(?:/|$)';
  return new RegExp(prefix + re + suffix);
}

export function makeMatcher(globs) {
  const res = globs.map(globToRegExp);
  return (path) => res.some((re) => re.test(path));
}
