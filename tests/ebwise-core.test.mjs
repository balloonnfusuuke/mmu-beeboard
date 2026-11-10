/* assets/js/ebwise.js の core を、window の無い最小の context で読み込んで試す。
   DOM も localStorage も使わない。 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const source = readFileSync(join(root, 'assets/js/ebwise.js'), 'utf8');
const sampleText = readFileSync(join(here, 'fixtures/ebwise-feed.sample.json'), 'utf8');
const sample = JSON.parse(sampleText);

/* URL だけは core が使うので渡す。window は渡さない。 */
function loadCore() {
  const context = vm.createContext({ URL });
  vm.runInContext(source, context, { filename: 'assets/js/ebwise.js' });
  return context.BB.ebwise.core;
}

const core = loadCore();
const courseOf = (code) => sample.courses.find((course) => course.code === code);
/* vm の context で作られた object は prototype が違うので、比較の前に素の値へ戻す。 */
const plain = (value) => JSON.parse(JSON.stringify(value));

/* ---------- parseFeed ---------- */

test('parseFeed は見本を通す', () => {
  const result = core.parseFeed(sampleText, Buffer.byteLength(sampleText));
  assert.equal(result.ok, true);
  assert.equal(result.reason, '');
  assert.equal(result.dropped, 0);
  assert.equal(result.feed.schema, 'ebwise-feed/1');
  assert.equal(result.feed.site, sample.site);
  assert.equal(result.feed.materials.length, sample.materials.length);
  assert.equal(result.feed.deadlines.length, sample.deadlines.length);
});

test('parseFeed は schema 違いを落とす', () => {
  const text = JSON.stringify({ ...sample, schema: 'ebwise-feed/2' });
  const result = core.parseFeed(text, text.length);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'bad_schema');
  assert.equal(result.feed, null);
});

test('parseFeed は 1MB 超を落とす', () => {
  const result = core.parseFeed(sampleText, 1024 * 1024 + 1);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'too_large');
  assert.equal(result.feed, null);
});

test('parseFeed は壊れた JSON を落とす', () => {
  const result = core.parseFeed('{ "schema": "ebwise-feed/1", ', 32);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid_json');
});

test('parseFeed は http の site を落とす', () => {
  const text = JSON.stringify({ ...sample, site: 'http://ebwise.mmu.edu.my' });
  const result = core.parseFeed(text, text.length);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'bad_site');
});

test('parseFeed は必須項目の欠けた項目を数えて捨てる', () => {
  const broken = {
    ...sample,
    materials: [...sample.materials, { id: 'ebw:file:deadbeefdeadbeef', course: 'CMA6114' }],
    deadlines: [...sample.deadlines, { id: 'ebw:assign:9999', course: 'CMA6114', name: 'No due date' }]
  };
  const text = JSON.stringify(broken);
  const result = core.parseFeed(text, text.length);
  assert.equal(result.ok, true);
  assert.equal(result.dropped, 2);
  assert.equal(result.feed.materials.length, sample.materials.length);
  assert.equal(result.feed.deadlines.length, sample.deadlines.length);
});

test('parseFeed は materials 300 件・deadlines 200 件で打ち切る', () => {
  const many = (count, make) => Array.from({ length: count }, (_, index) => make(index));
  const text = JSON.stringify({
    ...sample,
    materials: many(301, (index) => ({
      id: 'ebw:file:' + String(index).padStart(16, '0'),
      course: 'CMA6114',
      title: 'Material ' + index,
      changedAt: '2026-11-10T00:00:00+08:00'
    })),
    deadlines: many(201, (index) => ({
      id: 'ebw:assign:' + index,
      course: 'CMA6114',
      name: 'Deadline ' + index,
      dueDate: '2026-11-20'
    }))
  });
  const result = core.parseFeed(text, text.length);
  assert.equal(result.ok, true);
  assert.equal(result.feed.materials.length, 300);
  assert.equal(result.feed.deadlines.length, 200);
});

/* ---------- safeUrl ---------- */

test('safeUrl は同じ origin の https だけ通す', () => {
  const site = sample.site;
  const ok = 'https://ebwise.mmu.edu.my/mod/resource/view.php?id=1';
  assert.equal(core.safeUrl(ok, site), ok);
  assert.equal(core.safeUrl('javascript:alert(1)', site), '');
  assert.equal(core.safeUrl('http://ebwise.mmu.edu.my/x', site), '');
  assert.equal(core.safeUrl('//evil.example.com/x', site), '');
  assert.equal(core.safeUrl('', site), '');
  assert.equal(core.safeUrl(null, site), '');
  assert.equal(core.safeUrl(ok, 'not a url'), '');
});

test('safeUrl は見本の Sample Lab 1（別 origin）を落とす', () => {
  const lab = sample.materials.find((item) => item.title === 'Sample Lab 1');
  assert.ok(lab, 'fixture に Sample Lab 1 がある');
  assert.notEqual(new URL(lab.url).origin, new URL(sample.site).origin);
  assert.equal(core.safeUrl(lab.url, sample.site), '');
});

/* ---------- mapCourses ---------- */

test('mapCourses はコードの一致で対応づける', () => {
  const result = core.mapCourses([{ id: 'CMA6114', name: 'Artificial Intelligence' }], [courseOf('CMA6114')], {});
  assert.deepEqual(plain(result.map), { CMA6114: 'CMA6114' });
  assert.equal(result.how.CMA6114, 'auto');
  assert.deepEqual(plain(result.unmatched), []);
  assert.deepEqual(plain(result.ambiguous), []);
});

test('mapCourses は shortname の語の一致で対応づける', () => {
  const result = core.mapCourses([{ id: 'TMA2002', name: 'Discrete Mathematics' }], [courseOf('X9001')], {});
  assert.deepEqual(plain(result.map), { X9001: 'TMA2002' });
  assert.equal(result.how.X9001, 'auto');
});

test('mapCourses は fullname の包含で対応づける', () => {
  const result = core.mapCourses([{ id: 'DS01', name: 'Data Structures' }], [courseOf('F9004')], {});
  assert.deepEqual(plain(result.map), { F9004: 'DS01' });
  assert.equal(result.how.F9004, 'auto');
});

test('mapCourses は manual を最優先する', () => {
  const result = core.mapCourses(
    [
      { id: 'CMA6114', name: 'Artificial Intelligence' },
      { id: 'CCP6114', name: 'Compiler Construction' }
    ],
    [courseOf('CMA6114')],
    { CMA6114: 'CCP6114' }
  );
  assert.deepEqual(plain(result.map), { CMA6114: 'CCP6114' });
  assert.equal(result.how.CMA6114, 'manual');
});

test("mapCourses は manual の '' を「つながない」として扱う", () => {
  const result = core.mapCourses(
    [{ id: 'CMA6114', name: 'Artificial Intelligence' }],
    [courseOf('CMA6114')],
    { CMA6114: '' }
  );
  assert.deepEqual(plain(result.map), {});
  assert.equal(result.how.CMA6114, 'off');
  assert.deepEqual(plain(result.unmatched), []);
  assert.deepEqual(plain(result.ambiguous), []);
});

test('mapCourses は manual のキーを消すと自動に戻る', () => {
  const subjects = [
    { id: 'CMA6114', name: 'Artificial Intelligence' },
    { id: 'CCP6114', name: 'Compiler Construction' }
  ];
  const courses = [courseOf('CMA6114')];
  const manual = { CMA6114: 'CCP6114' };
  assert.deepEqual(plain(core.mapCourses(subjects, courses, manual).map), { CMA6114: 'CCP6114' });
  /* setMapping('auto') はキーを消す。消したあとは自動の結果に戻る。 */
  delete manual.CMA6114;
  const back = core.mapCourses(subjects, courses, manual);
  assert.deepEqual(plain(back.map), { CMA6114: 'CMA6114' });
  assert.equal(back.how.CMA6114, 'auto');
});

test('mapCourses は 2 科目に当たる場合に対応させない', () => {
  const result = core.mapCourses(
    [
      { id: 'SE01', name: 'Software Engineering' },
      { id: 'SE02', name: 'Software Engineering' }
    ],
    [courseOf('F9002')],
    {}
  );
  assert.deepEqual(plain(result.map), {});
  assert.deepEqual(plain(result.ambiguous), ['F9002']);
  assert.deepEqual(plain(result.unmatched), []);
});

test('mapCourses は ZZZ9999 を unmatched にする', () => {
  const result = core.mapCourses(
    [{ id: 'CMA6114', name: 'Artificial Intelligence' }],
    [courseOf('ZZZ9999')],
    {}
  );
  assert.deepEqual(plain(result.map), {});
  assert.deepEqual(plain(result.unmatched), ['ZZZ9999']);
  assert.deepEqual(plain(result.ambiguous), []);
});

/* ---------- materialsFor ---------- */

test('materialsFor は changedAt の新しい順に返す', () => {
  const list = core.materialsFor(sample, { CMA6114: 'CMA6114' }, 'CMA6114', '');
  assert.deepEqual(
    plain(list.map((item) => item.id)),
    ['ebw:mod:55501', 'ebw:file:0123456789abcdef', 'ebw:file:fedcba9876543210']
  );
});

test('materialsFor は seenAt より新しいものだけ unread にする', () => {
  const list = core.materialsFor(sample, { CMA6114: 'CMA6114' }, 'CMA6114', '2026-11-09T12:00:00+08:00');
  assert.deepEqual(
    plain(list.map((item) => item.unread)),
    [true, false, false]
  );
});

test('materialsFor は seenAt が空なら全部 unread にする', () => {
  const list = core.materialsFor(sample, { CMA6114: 'CMA6114' }, 'CMA6114', '');
  assert.deepEqual(
    plain(list.map((item) => item.unread)),
    [true, true, true]
  );
});

test('materialsFor は feed を書き換えない', () => {
  core.materialsFor(sample, { CMA6114: 'CMA6114' }, 'CMA6114', '');
  assert.equal(sample.materials.some((item) => 'unread' in item), false);
});

test('materialsFor は対応の無い科目で空を返す', () => {
  assert.deepEqual(plain(core.materialsFor(sample, { CMA6114: 'CMA6114' }, 'ZZZ9999', '')), []);
});

/* ---------- termRange ---------- */

test('termRange は開始日と週数から学期の末日を返す', () => {
  assert.deepEqual(plain(core.termRange({ startDate: '2026-11-09', weeks: 14 })), {
    start: '2026-11-09',
    end: '2027-02-21'
  });
});

test('termRange は開始日が無ければ空を返す', () => {
  assert.deepEqual(plain(core.termRange({ startDate: '', weeks: 14 })), { start: '', end: '' });
  assert.deepEqual(plain(core.termRange({ startDate: '2026-02-31', weeks: 14 })), { start: '', end: '' });
});

/* ---------- loader ---------- */

test('window が無い context では読み込みを動かさない', () => {
  const context = vm.createContext({ URL });
  vm.runInContext(source, context, { filename: 'assets/js/ebwise.js' });
  const ebwise = context.BB.ebwise;
  assert.equal(typeof ebwise.core.parseFeed, 'function');
  /* 読み込みは document があるページでだけ登録する。 */
  if (typeof ebwise.feed === 'function') {
    assert.equal(ebwise.feed(), null);
  } else {
    assert.equal(ebwise.feed, undefined);
  }
});
