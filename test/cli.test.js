import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, appendFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/churnmap.js', import.meta.url));
let repo;

function commitAs(name, message) {
  const env = { ...process.env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: `${name}@example.com`, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: `${name}@example.com` };
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-q', '--no-gpg-sign', '-m', message], { cwd: repo, env });
}

function run(...args) {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd: repo, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

before(() => {
  repo = mkdtempSync(join(tmpdir(), 'churnmap-repo-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, 'src'));
  writeFileSync(join(repo, 'src/core.js'), 'x\n'.repeat(400));
  writeFileSync(join(repo, 'src/api.js'), 'x\n'.repeat(50));
  writeFileSync(join(repo, 'README.md'), '# demo\n');
  writeFileSync(join(repo, 'package-lock.json'), '{}\n');
  commitAs('ada', 'init');
  for (let i = 0; i < 6; i++) {
    appendFileSync(join(repo, 'src/core.js'), `change ${i}\n`);
    appendFileSync(join(repo, 'src/api.js'), `change ${i}\n`);
    appendFileSync(join(repo, 'package-lock.json'), `\n`);
    commitAs(i % 3 ? 'ada' : 'lin', `work ${i}`);
  }
});

after(() => rmSync(repo, { recursive: true, force: true }));

test('prints a ranked table', () => {
  const { code, out } = run();
  assert.equal(code, 0);
  const rows = out.split('\n').filter((l) => /^\s+\d+\s/.test(l));
  assert.match(rows[0], /src\/core\.js$/);
  assert.match(rows[1], /src\/api\.js$/);
  assert.ok(!out.includes('package-lock.json'));
  assert.match(out, /7 commits, 3 files/);
});

test('json output', () => {
  const { code, out } = run('--json', '--coupling');
  assert.equal(code, 0);
  const data = JSON.parse(out);
  assert.equal(data.hotspots[0].path, 'src/core.js');
  assert.equal(data.hotspots[0].commits, 7);
  assert.equal(data.hotspots[0].authors, 2);
  assert.deepEqual(data.coupling[0], { a: 'src/api.js', b: 'src/core.js', shared: 7, degree: 100 });
});

test('path filter', () => {
  const data = JSON.parse(run('--json', 'README.md').out);
  assert.deepEqual(data.hotspots.map((h) => h.path), ['README.md']);
});

test('fails cleanly outside a repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'churnmap-empty-'));
  try {
    const r = spawnSync(process.execPath, [bin, '-C', dir], { encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /not a git repository/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('usage errors exit with 2', () => {
  const r = run('--top', 'lots');
  assert.equal(r.code, 2);
  assert.match(r.err, /--top expects a positive whole number/);
});
