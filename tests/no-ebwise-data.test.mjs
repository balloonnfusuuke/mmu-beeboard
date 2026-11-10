/* 実データと資料の直リンクがリポジトリに入っていないことを確かめる。
   git が使えない環境では skip する。 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* 実データのファイル名と、資料の直リンクの断片。このテスト自身が tracked になっても
   引っかからないよう、断片は実行時に組み立てる。 */
const FORBIDDEN_FILES = ['ebwise-feed.json', 'ebwise-snapshot.json'];
const FORBIDDEN_TEXT = ['ebwise.mmu.edu.my', 'pluginfile'].join('/');

function trackedFiles() {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return out.split('\0').filter(Boolean);
  } catch (e) {
    return null;
  }
}

const files = trackedFiles();

test('git ls-files に実データのファイルが無い', (t) => {
  if (!files) return t.skip('git が使えないため確認しません');
  const names = files.map((path) => path.split('/').pop());
  for (const name of FORBIDDEN_FILES) {
    assert.equal(names.includes(name), false, name + ' が tracked です');
  }
});

test('tracked なファイルに資料の直リンクが無い', (t) => {
  if (!files) return t.skip('git が使えないため確認しません');
  const needle = Buffer.from(FORBIDDEN_TEXT, 'utf8');
  const hits = files.filter((path) => {
    try {
      return readFileSync(join(root, path)).includes(needle);
    } catch (e) {
      return false;
    }
  });
  assert.deepEqual(hits, []);
});
