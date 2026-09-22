import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLog } from '../src/git.js';

test('parses headers and numstat lines', () => {
  const raw =
    '\0aaa\x1fAda\x1f1700000000\n\n3\t1\tsrc/a.js\n-\t-\tlogo.png\n' +
    '\0bbb\x1fGrace\x1f1700000100\n\n10\t0\tsrc/b js/c.js\n';
  const commits = parseLog(raw);
  assert.equal(commits.length, 2);
  assert.deepEqual(commits[0], {
    hash: 'aaa',
    author: 'Ada',
    time: 1700000000,
    files: [
      { path: 'src/a.js', added: 3, deleted: 1 },
      { path: 'logo.png', added: null, deleted: null },
    ],
  });
  assert.equal(commits[1].files[0].path, 'src/b js/c.js');
});

test('keeps commits that touched no files', () => {
  const commits = parseLog('\0ccc\x1fLin\x1f1\n');
  assert.equal(commits.length, 1);
  assert.deepEqual(commits[0].files, []);
});

test('tolerates CRLF output', () => {
  const commits = parseLog('\0ddd\x1fLin\x1f1\r\n\r\n2\t2\ta.txt\r\n');
  assert.deepEqual(commits[0].files, [{ path: 'a.txt', added: 2, deleted: 2 }]);
});
