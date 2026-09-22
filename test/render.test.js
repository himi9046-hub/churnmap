import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ago, clip, makeStyle, renderHotspots, renderCoupling } from '../src/render.js';

const plain = makeStyle(false);
const day = 86400;

test('ago picks a readable unit', () => {
  assert.equal(ago(0, 100), 'today');
  assert.equal(ago(0, 3 * day), '3d');
  assert.equal(ago(0, 21 * day), '3w');
  assert.equal(ago(0, 200 * day), '6mo');
  assert.equal(ago(0, 1000 * day), '2y');
});

test('clip keeps the end of a path', () => {
  assert.equal(clip('src/short.js', 20), 'src/short.js');
  assert.equal(clip('packages/server/src/router.ts', 12), '…c/router.ts');
});

test('renders a table without colour codes when disabled', () => {
  const rows = [
    { path: 'src/router.ts', score: 100, commits: 42, lines: 1200, authors: 3, owner: { name: 'a', share: 0.9 }, last: 0 },
    { path: 'src/util.ts', score: 20, commits: 8, lines: 300, authors: 1, owner: { name: 'a', share: 1 }, last: 0 },
  ];
  const out = renderHotspots(rows, { style: plain, columns: 120, now: 2 * day });
  assert.ok(!out.includes('\x1b'));
  const lines = out.trimEnd().split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /██████████ 100\s+42\s+1200\s+3\s+90%\s+2d\s+src\/router\.ts$/);
  assert.match(lines[2], /██········\s+20\s+8\s+300\s+1\s+100%\s+2d\s+src\/util\.ts$/);
});

test('narrow terminals clip the path instead of wrapping', () => {
  const rows = [
    { path: 'a/very/long/path/that/goes/on/forever/file.ts', score: 50, commits: 1, lines: 1, authors: 1, owner: { name: 'a', share: 1 }, last: 0 },
  ];
  const out = renderHotspots(rows, { style: plain, columns: 80, now: 0 });
  assert.match(out, /…/);
  for (const line of out.trimEnd().split('\n')) assert.ok(line.length <= 80, `${line.length}: ${line}`);
});

test('renders coupling pairs', () => {
  const out = renderCoupling([{ a: 'api.ts', b: 'client.ts', shared: 12, degree: 85 }], { style: plain });
  assert.equal(out, '   85%  12x  api.ts <-> client.ts\n');
});
