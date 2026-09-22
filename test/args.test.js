import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, UsageError } from '../src/args.js';

test('defaults', () => {
  const o = parseArgs([]);
  assert.equal(o.top, 15);
  assert.equal(o.path, null);
  assert.equal(o.coupling, false);
});

test('short, long and inline values', () => {
  const o = parseArgs(['-n', '5', '--since=6 months ago', '-x', '*.md', '--exclude', 'docs/', 'src', '-c']);
  assert.equal(o.top, 5);
  assert.equal(o.since, '6 months ago');
  assert.deepEqual(o.exclude, ['*.md', 'docs/']);
  assert.equal(o.path, 'src');
  assert.equal(o.coupling, true);
});

test('rejects bad input', () => {
  assert.throws(() => parseArgs(['--top', 'ten']), UsageError);
  assert.throws(() => parseArgs(['--top']), UsageError);
  assert.throws(() => parseArgs(['--wat']), UsageError);
  assert.throws(() => parseArgs(['a', 'b']), UsageError);
});
