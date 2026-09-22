import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globToRegExp, makeMatcher, DEFAULT_EXCLUDES } from '../src/glob.js';

const m = (glob, path) => globToRegExp(glob).test(path);

test('patterns without a slash match at any depth', () => {
  assert.ok(m('*.min.js', 'vendor/jquery.min.js'));
  assert.ok(m('yarn.lock', 'packages/web/yarn.lock'));
  assert.ok(!m('*.js', 'src/app.jsx'));
});

test('patterns with a slash are anchored to the repo root', () => {
  assert.ok(m('src/*.js', 'src/app.js'));
  assert.ok(!m('src/*.js', 'lib/src/app.js'));
  assert.ok(!m('src/*.js', 'src/deep/app.js'));
});

test('double star crosses directories', () => {
  assert.ok(m('src/**/*.test.ts', 'src/a.test.ts'));
  assert.ok(m('src/**/*.test.ts', 'src/x/y/a.test.ts'));
  assert.ok(m('**/fixtures/**', 'a/fixtures/b/c.json'));
});

test('trailing slash means a directory', () => {
  assert.ok(m('docs/', 'docs/intro.md'));
  assert.ok(m('dist/', 'packages/ui/dist/index.js'));
  assert.ok(!m('docs/', 'docs.md'));
});

test('dots and brackets are literal', () => {
  assert.ok(!m('a.b', 'aXb'));
  assert.ok(m('[x].txt', '[x].txt'));
});

test('default excludes catch lockfiles', () => {
  const skip = makeMatcher(DEFAULT_EXCLUDES);
  assert.ok(skip('package-lock.json'));
  assert.ok(skip('rust/Cargo.lock'));
  assert.ok(!skip('src/lock.js'));
});
