import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hotspots, coupling, countLines } from '../src/analyze.js';

const commit = (author, time, ...paths) => ({
  hash: String(time),
  author,
  time,
  files: paths.map((p) => (typeof p === 'string' ? { path: p, added: 1, deleted: 1 } : p)),
});

const sizes = { 'big.js': 900, 'small.js': 100, 'huge.js': 5000, 'gone.js': null };
const lines = (p) => (p in sizes ? sizes[p] : 10);

test('ranks by commits x sqrt(lines)', () => {
  const log = [
    ...Array.from({ length: 10 }, (_, i) => commit('ada', i, 'small.js')),
    ...Array.from({ length: 5 }, (_, i) => commit('ada', 100 + i, 'big.js')),
    commit('ada', 200, 'huge.js'),
  ];
  const rows = hotspots(log, { lines });
  assert.deepEqual(rows.map((r) => r.path), ['big.js', 'small.js', 'huge.js']);
  assert.equal(rows[0].score, 100);
  assert.equal(rows[1].score, Math.round(((10 * 10) / (5 * 30)) * 100));
});

test('drops deleted and binary files', () => {
  const log = [commit('ada', 1, 'gone.js', 'small.js', { path: 'logo.png', added: null, deleted: null })];
  const rows = hotspots(log, { lines });
  assert.deepEqual(rows.map((r) => r.path), ['small.js']);
});

test('tracks authors, ownership and dates', () => {
  const log = [commit('ada', 5, 'a'), commit('ada', 9, 'a'), commit('ada', 2, 'a'), commit('lin', 7, 'a')];
  const [row] = hotspots(log, { lines });
  assert.equal(row.authors, 2);
  assert.deepEqual(row.owner, { name: 'ada', share: 0.75 });
  assert.equal(row.first, 2);
  assert.equal(row.last, 9);
  assert.equal(row.churn, 8);
});

test('respects skip', () => {
  const log = [commit('ada', 1, 'a', 'package-lock.json')];
  const rows = hotspots(log, { lines, skip: (p) => p.endsWith('.json') });
  assert.deepEqual(rows.map((r) => r.path), ['a']);
});

test('finds files that change together', () => {
  const log = [
    ...Array.from({ length: 6 }, (_, i) => commit('ada', i, 'api.ts', 'client.ts')),
    commit('ada', 10, 'api.ts'),
    commit('ada', 11, 'api.ts', 'readme.md'),
  ];
  const rows = coupling(log, { minShared: 2 });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { a: 'api.ts', b: 'client.ts', shared: 6, degree: Math.round((12 / 14) * 100) });
});

test('ignores sweeping commits when measuring coupling', () => {
  const many = Array.from({ length: 40 }, (_, i) => `f${i}.js`);
  const log = Array.from({ length: 10 }, (_, i) => commit('ada', i, ...many));
  assert.deepEqual(coupling(log, { minShared: 1 }), []);
});

test('countLines handles trailing newlines, empty and binary files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'churnmap-'));
  try {
    writeFileSync(join(dir, 'a'), 'one\ntwo\n');
    writeFileSync(join(dir, 'b'), 'one\r\ntwo');
    writeFileSync(join(dir, 'c'), '');
    writeFileSync(join(dir, 'd'), Buffer.from([1, 0, 2]));
    assert.equal(countLines(join(dir, 'a')), 2);
    assert.equal(countLines(join(dir, 'b')), 2);
    assert.equal(countLines(join(dir, 'c')), 0);
    assert.equal(countLines(join(dir, 'd')), null);
    assert.equal(countLines(join(dir, 'missing')), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
