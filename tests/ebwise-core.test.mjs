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
function loadModule() {
  const context = vm.createContext({ URL });
  vm.runInContext(source, context, { filename: 'assets/js/ebwise.js' });
  return context.BB.ebwise;
}

const ebwise = loadModule();
const core = ebwise.core;
const ui = ebwise.ui;
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

/* ---------- ui.materialRowsHtml ---------- */

const SITE = 'https://ebwise.mmu.edu.my';

test('materialRowsHtml は title をエスケープする', () => {
  const html = ui.materialRowsHtml(
    [{ id: 'ebw:file:1', title: '<script>alert(1)</script>', status: 'new', localPath: '' }],
    { site: SITE }
  );
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
});

test('materialRowsHtml は別の origin の url をリンクにしない', () => {
  const html = ui.materialRowsHtml(
    [
      {
        id: 'ebw:file:1',
        title: 'Sample Lab 1',
        status: 'new',
        url: 'https://labs.example.edu/lab1.pdf',
        localPath: ''
      }
    ],
    { site: SITE }
  );
  assert.equal(html.includes('href='), false);
  assert.equal(html.includes('labs.example.edu'), false);
  assert.equal(html.includes('Sample Lab 1'), true);
});

test('materialRowsHtml は同じ origin の url だけリンクにする', () => {
  const url = 'https://ebwise.mmu.edu.my/mod/resource/view.php?id=1';
  const html = ui.materialRowsHtml(
    [{ id: 'ebw:mod:1', title: 'Slides', status: 'updated', url, localPath: '' }],
    { site: SITE }
  );
  assert.equal(html.includes('href="' + url + '"'), true);
  assert.equal(html.includes('target="_blank"'), true);
  assert.equal(html.includes('rel="noopener noreferrer"'), true);
});

test('materialRowsHtml は localPath が空ならコピーのボタンを出さない', () => {
  const html = ui.materialRowsHtml(
    [{ id: 'ebw:file:1', title: 'Lab', status: 'new', localPath: '' }],
    { site: SITE }
  );
  assert.equal(html.includes('data-ebwise-copy'), false);
});

test('materialRowsHtml は localPath があれば id 付きのコピーのボタンを出す', () => {
  const html = ui.materialRowsHtml(
    [{ id: 'ebw:file:1', title: 'Lab', status: 'new', localPath: 'CMA6114/01 Topic 1/lab1.pdf' }],
    { site: SITE }
  );
  assert.equal(html.includes('data-ebwise-copy="ebw:file:1"'), true);
});

test('materialRowsHtml は changedAt の曜日を Date から出す', () => {
  const html = ui.materialRowsHtml(
    [{ id: 'ebw:file:1', title: 'Lab', status: 'new', changedAt: '2026-11-11T10:15:00+08:00', localPath: '' }],
    { site: SITE }
  );
  assert.equal(html.includes('11 Nov (Wed)'), true);
});

/* ---------- deadlineOps ---------- */

const TODAY = '2026-11-10';
const TERM = { id: 't1', startDate: '2026-11-09', weeks: 14 };

/* 見本の科目のうち CMA6114 だけを BeeBoard に持っている状態。 */
function deadlineState(overrides) {
  return Object.assign(
    {
      term: TERM,
      subjects: [{ id: 'CMA6114', name: 'Artificial Intelligence' }],
      customDeadlines: [],
      deadlineDetails: {},
      ebwise: { schema: 1, mapping: {}, suggested: {}, seenAt: {}, filesLinked: false }
    },
    overrides || {}
  );
}

function mapFor(state) {
  return core.mapCourses(state.subjects, sample.courses, {}).map;
}

test('deadlineOps は見本から import を 2 件だけ返す', () => {
  const state = deadlineState();
  const ops = plain(core.deadlineOps(sample, mapFor(state), state, TODAY));
  assert.equal(ops.length, 2);
  assert.deepEqual(
    ops.map((op) => op.args.ebwiseId),
    ['ebw:quiz:9002', 'ebw:event:9003']
  );
  assert.equal(
    ops.every((op) => op.type === 'ebwise.deadline.import'),
    true
  );
  assert.equal(ops[0].schema, 'beeboard-op/1');
  assert.deepEqual(ops[0].basis, { termId: 't1' });
  assert.equal(ops[0].args.subjectId, 'CMA6114');
  assert.equal(ops[0].args.name, 'Quiz 3');
  assert.equal(ops[0].args.date, '2026-11-25');
  assert.equal(ops[0].args.time, '10:00');
  assert.equal(ops[0].args.kind, 'testPrep');
  assert.equal(ops[0].args.course, 'CMA6114');
  assert.equal(ops[0].args.url, 'https://ebwise.mmu.edu.my/mod/quiz/view.php?id=9002');
  assert.equal(ops[1].args.kind, 'other');
});

test('deadlineOps は学期外と提出済みを候補にしない', () => {
  const feed = JSON.parse(JSON.stringify(sample));
  feed.deadlines.push({
    id: 'ebw:assign:9101',
    course: 'CMA6114',
    kind: 'assignment',
    name: 'Far away',
    dueDate: '2027-06-01',
    dueTime: '23:59',
    submission: null,
    url: 'https://ebwise.mmu.edu.my/mod/assign/view.php?id=9101'
  });
  feed.deadlines.push({
    id: 'ebw:assign:9102',
    course: 'CMA6114',
    kind: 'assignment',
    name: 'Already handed in',
    dueDate: '2026-11-21',
    dueTime: '23:59',
    submission: 'submitted',
    url: 'https://ebwise.mmu.edu.my/mod/assign/view.php?id=9102'
  });
  const state = deadlineState();
  const ops = plain(core.deadlineOps(feed, mapFor(state), state, TODAY));
  assert.equal(ops.length, 2);
  assert.deepEqual(
    ops.map((op) => op.args.ebwiseId),
    ['ebw:quiz:9002', 'ebw:event:9003']
  );
});

test('deadlineOps の opId は同じ入力なら毎回同じ', () => {
  const state = deadlineState();
  const map = mapFor(state);
  const first = plain(core.deadlineOps(sample, map, state, TODAY));
  const second = plain(core.deadlineOps(sample, map, state, TODAY));
  assert.deepEqual(
    first.map((op) => op.opId),
    second.map((op) => op.opId)
  );
  assert.equal(first[0].opId, 'ebw-ebw-quiz-9002-2026-11-25T1000');
});

test('deadlineOps は dismissed と pending を候補にしない', () => {
  const state = deadlineState({
    ebwise: {
      schema: 1,
      mapping: {},
      suggested: {
        'ebw:quiz:9002': { status: 'dismissed' },
        'ebw:event:9003': { status: 'pending', opId: 'ebw-ebw-event-9003-2026-11-18T0900' }
      },
      seenAt: {},
      filesLinked: false
    }
  });
  const ops = plain(core.deadlineOps(sample, mapFor(state), state, TODAY));
  assert.equal(ops.length, 0);
});

test('deadlineOps は取り込んだ締切の日付が変わったら update を返す', () => {
  const state = deadlineState({
    customDeadlines: [
      { id: 'cd-1', subjectId: 'CMA6114', name: 'Quiz 3', date: '2026-11-25', week: 3, kind: 'testPrep', weight: 0 }
    ],
    ebwise: {
      schema: 1,
      mapping: {},
      suggested: {
        'ebw:quiz:9002': { status: 'imported', deadlineId: 'cd-1', dueDate: '2026-11-25', dueTime: '10:00' }
      },
      seenAt: {},
      filesLinked: false
    }
  });
  const map = mapFor(state);

  /* 日時が変わっていなければ update は出ない。 */
  const same = plain(core.deadlineOps(sample, map, state, TODAY));
  assert.equal(
    same.some((op) => op.args.ebwiseId === 'ebw:quiz:9002'),
    false
  );

  const feed = JSON.parse(JSON.stringify(sample));
  feed.deadlines[1].dueDate = '2026-11-26';
  feed.deadlines[1].dueTime = '09:00';
  const ops = plain(core.deadlineOps(feed, map, state, TODAY));
  const update = ops.find((op) => op.type === 'ebwise.deadline.update');
  assert.ok(update);
  assert.equal(update.args.ebwiseId, 'ebw:quiz:9002');
  assert.equal(update.args.deadlineId, 'cd-1');
  assert.deepEqual(update.args.expect, { date: '2026-11-25' });
  assert.equal(update.args.date, '2026-11-26');
  assert.equal(update.args.time, '09:00');
  assert.notEqual(update.opId, 'ebw-ebw-quiz-9002-2026-11-25T1000');
});

test('deadlineOps は取り込んだ締切が消えていれば update を出さない', () => {
  const state = deadlineState({
    customDeadlines: [],
    ebwise: {
      schema: 1,
      mapping: {},
      suggested: {
        'ebw:quiz:9002': { status: 'imported', deadlineId: 'cd-1', dueDate: '2026-11-25', dueTime: '10:00' }
      },
      seenAt: {},
      filesLinked: false
    }
  });
  const feed = JSON.parse(JSON.stringify(sample));
  feed.deadlines[1].dueDate = '2026-11-26';
  const ops = plain(core.deadlineOps(feed, mapFor(state), state, TODAY));
  assert.equal(
    ops.some((op) => op.args.ebwiseId === 'ebw:quiz:9002'),
    false
  );
});

test('deadlineOps は 7 日以上前の締切を候補にしない', () => {
  const feed = JSON.parse(JSON.stringify(sample));
  feed.deadlines.push({
    id: 'ebw:event:9201',
    course: 'CMA6114',
    kind: 'event',
    name: 'Exactly a week ago',
    dueDate: '2026-11-03',
    dueTime: '09:00',
    submission: null,
    url: ''
  });
  feed.deadlines.push({
    id: 'ebw:event:9202',
    course: 'CMA6114',
    kind: 'event',
    name: 'Six days ago',
    dueDate: '2026-11-04',
    dueTime: '09:00',
    submission: null,
    url: ''
  });
  /* 学期の初日より前でも、7 日以内なら候補にする。 */
  const state = deadlineState({ term: { id: 't1', startDate: '2026-10-01', weeks: 14 } });
  const ops = plain(core.deadlineOps(feed, mapFor(state), state, TODAY));
  const ids = ops.map((op) => op.args.ebwiseId);
  assert.equal(ids.includes('ebw:event:9201'), false);
  assert.equal(ids.includes('ebw:event:9202'), true);
});

test('materialRowsHtml は資料フォルダをつないだときだけ資料名をボタンにする', () => {
  const items = [{ id: 'ebw:file:1', title: 'Lab', status: 'new', localPath: 'CMA6114/01 Topic 1/lab1.pdf' }];
  const linked = ui.materialRowsHtml(items, { site: SITE, files: true });
  assert.equal(linked.includes('data-ebwise-open="ebw:file:1"'), true);
  const plainRows = ui.materialRowsHtml(items, { site: SITE });
  assert.equal(plainRows.includes('data-ebwise-open'), false);
  /* localPath が無い資料は、つないでいても開くボタンにしない。 */
  const noPath = ui.materialRowsHtml([{ id: 'ebw:file:2', title: 'No path', status: 'new', localPath: '' }], {
    site: SITE,
    files: true
  });
  assert.equal(noPath.includes('data-ebwise-open'), false);
});
