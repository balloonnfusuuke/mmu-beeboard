/* MMU BeeBoard — local AI bridge.
   ローカルAIが置いた「操作ファイル」を inbox から取り込み、localStorage に反映する。
   クラウドもサーバーも使わない。動くのは、利用者が選んだフォルダの許可が
   'granted' のままで、かつこのタブがロックを持っているときだけ。

   操作ファイル（選択フォルダ/inbox/*.json）:
     { schema: 'beeboard-op/1', opId: '...', type: 'note.add',
       basis: { termId: '...' }, args: { ... } }

   受け付ける type は下の OPS 表がすべて。各 type は
     { policy: 'auto' | 'approval', validate(state, args), apply(state, args) }
   を持ち、apply は { after, undo } を返す。undo は「変更前の値」で、
   追加なら『この id を消す』、変更なら変更前の項目そのもの。

   結果は state.aiBridge.results に積み、beeboard-snapshot.json にも出る。
   同じフォルダの bridge-status.json に、ロックを持つタブが 20 秒ごとに生存を書く。
   書き出しが遅れても結果が消えないよう、処理のあとは必ずスナップショットの
   書き出しを予約し、ハートビートと前面復帰で追いつかせる。

   点検用: BB.bridge.status() / BB.bridge.dryRun(op)（どちらも保存しない）。 */
(function (global) {
  'use strict';

  var BB = global.BB;

  /* snapshot.js が無いページ（読み込み順が違う・古いキャッシュ）では何もしない。 */
  if (!BB || !BB.store || !BB.snapshot) return;

  var OP_SCHEMA = 'beeboard-op/1';
  var INBOX_DIR = 'inbox';
  var STATUS_FILE = 'bridge-status.json';
  var LOCK_NAME = 'mmu-beeboard-bridge';
  /* 1 ファイルの上限。これを超えるものは読まずに却下する。 */
  var MAX_BYTES = 64 * 1024;
  var MAX_TEXT = 2000;
  var MAX_MEMO = 4000;
  var MAX_LINKS = 20;
  var MAX_RESULTS = 100;
  /* 表示中は短く、裏に回ったら長く。focus / visibilitychange では即座に 1 回見る。 */
  var POLL_VISIBLE = 3000;
  var POLL_HIDDEN = 30000;
  var STATUS_INTERVAL = 20000;

  /* 時間割が描く範囲。外れる予定は保存してよいが warning を付ける。 */
  var GRID_START = '08:00';
  var GRID_END = '18:00';

  /* app.js の EVENT_COLORS と同じ並び。BB.dash.eventColors が無い版でも動くように持つ。 */
  var EVENT_COLORS = ['#475569', '#0F766E', '#7C3AED', '#B45309'];
  /* pages/deadlines.js の KINDS と同じ。あちらはページ専用なのでここにも持つ。 */
  var DEADLINE_KINDS = ['homework', 'assignment', 'testPrep', 'other'];
  var THEMES = ['light', 'dark', 'system'];
  var LANGS = ['en', 'ja'];
  var NOTE_FIELDS = ['text', 'kind', 'subjectCode', 'date', 'due'];
  var SESSION_FIELDS = ['day', 'start', 'end', 'type', 'room'];
  var SESSION_TYPES = ['LEC', 'TUT', 'LAB'];
  var ASSESSMENT_FIELDS = ['name', 'week', 'max', 'weight'];
  var DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  /* 承認待ちを置いておく期間。過ぎたら反映せずに取り下げる。 */
  var EXPIRE_MS = 14 * 24 * 60 * 60 * 1000;
  /* 作成からこれ以上たった操作ファイルは取り込まない。古い指示を今のデータに当てない。 */
  var STALE_MS = 7 * 24 * 60 * 60 * 1000;

  /* どの type でも触らせない項目。args のどこかに現れたら not_allowed。
     科目の追加・削除・コード・色・単位、学期の切替・復元、リセット、読み込みは
     専用の type を作らない限り通さない。 */
  var FORBIDDEN_KEYS = [
    'student',
    'term',
    'setupDone',
    'version',
    'archive',
    'subjects',
    'credits',
    'reset',
    'import',
    'restore',
    'switchTerm',
    'startTerm',
    'snapshot',
    'seed'
  ];

  var JA_DAYS = ['日', '月', '火', '水', '木', '金', '土'];
  var THEME_LABELS = { light: 'ライト', dark: 'ダーク', system: 'システム' };
  var LANG_LABELS = { en: 'English', ja: '日本語' };

  /* 却下理由ごとの日本語要約。results を読む人が理由を追えるように残す。 */
  var SUMMARY = {
    too_large: 'ファイルが大きすぎます（64KB まで）',
    invalid_json: 'JSON として読めませんでした',
    bad_schema: '操作ファイルの形式が違います',
    term_changed: '学期が変わっているため取り込みませんでした',
    not_supported: 'この操作にはまだ対応していません',
    invalid_args: '操作の内容が不正です',
    invalid_text: '本文が空か長すぎます',
    invalid_date: '日付が不正です',
    invalid_due: '締切が不正です',
    unknown_subject: '科目が見つかりません',
    not_found: '対象が見つかりません',
    conflict: '画面の値が変わっているため反映しませんでした',
    invalid_title: 'タイトルを入力してください',
    invalid_name: '名前を入力してください',
    invalid_weekday: '曜日が不正です',
    invalid_time: '時刻が不正です',
    invalid_week: '週が不正です',
    invalid_kind: '種別が不正です',
    invalid_weight: '配点が不正です',
    invalid_memo: 'メモが長すぎます（4000 文字まで）',
    invalid_link: 'リンクの URL が不正です',
    too_many_links: 'リンクが多すぎます（20 件まで）',
    unknown_deadline: '締切が見つかりません',
    invalid_theme: 'テーマが不正です',
    invalid_lang: '言語が不正です',
    not_applied: '取り消せる状態ではありません',
    already_undone: 'すでに取り消し済みです',
    not_undoable: 'この操作は取り消せません',
    pending_approval: '承認待ちです',
    rejected_by_user: '本人が却下しました',
    expired: '14 日を過ぎたため取り下げました',
    not_allowed: 'この操作は許可されていません',
    duplicate: '同じ回の記録がすでにあります',
    invalid_status: '出席の種別が不正です',
    invalid_session: 'コマが見つかりません',
    invalid_assessment: '評価項目が見つかりません',
    invalid_score: '点数が不正です',
    invalid_target: '振替先が不正です',
    invalid_url: 'URL は https:// で始まる必要があります',
    invalid_type: '種別が不正です',
    invalid_cgpa: 'CGPA 目標は 0〜4 です',
    invalid_threshold: '出席しきい値は 1〜100 です',
    invalid_study_target: '週間学習目標は 0〜80 時間です',
    invalid_max: '満点は 0 より大きい値にしてください',
    date_mismatch: 'そのコマの曜日と日付が合いません',
    out_of_term: '学期の範囲外の日付です',
    stale: '作成から 7 日を過ぎたため取り込みませんでした'
  };

  /* ---------- small helpers ---------- */

  function clone(value) {
    return value === undefined ? null : JSON.parse(JSON.stringify(value));
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function isInt(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
  }

  /* 'YYYY-MM-DD' が実在する日付か。BB.date.parse は 2/31 を 3/3 に丸めるので、
     作った日付を文字列に戻して一致を見る。 */
  function isRealDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var day = BB.date.parse(value);
    if (!day) return false;
    return day.getFullYear() + '-' + pad2(day.getMonth() + 1) + '-' + pad2(day.getDate()) === value;
  }

  /* 'YYYY-MM-DDTHH:mm' か ''。空文字は「締切なし」として通す。 */
  function isDue(value) {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
    return isRealDay(value.slice(0, 10)) && Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60;
  }

  function isTime(value) {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function hasSubject(state, id) {
    var subjects = state.subjects || [];
    for (var i = 0; i < subjects.length; i++) {
      if (subjects[i].id === id) return true;
    }
    return false;
  }

  function findById(list, id) {
    var items = list || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].id === id) return items[i];
    }
    return null;
  }

  function hasId(list, id) {
    return !!findById(list, id);
  }

  /* 'n' + Date.now() と同じ形。同じミリ秒に 2 件来ても id を重ねない。 */
  function nextId(state, collection, prefix) {
    var list = state[collection] || [];
    var stamp = Date.now();
    var id = prefix + stamp;
    while (hasId(list, id)) {
      stamp += 1;
      id = prefix + stamp;
    }
    return id;
  }

  function hasOp(list, opId) {
    if (!opId) return false;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].opId === opId) return true;
    }
    return false;
  }

  /* undefined と null は同じ「無い」として比べる。 */
  function sameValue(a, b) {
    var x = a === undefined ? null : a;
    var y = b === undefined ? null : b;
    if (x === y) return true;
    if (x === null || y === null) return false;
    if (typeof x === 'object' || typeof y === 'object') return JSON.stringify(x) === JSON.stringify(y);
    return false;
  }

  /* expect と今の値が 1 つでも違えば、比べた項目の今の値を返す。 */
  function conflictOf(item, expect) {
    if (!expect || typeof expect !== 'object') return null;
    var keys = Object.keys(expect);
    var current = {};
    var differs = false;
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      /* JSON から来た __proto__ などは読まない。 */
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      current[key] = item[key] === undefined ? null : item[key];
      if (!sameValue(item[key], expect[key])) differs = true;
    }
    return differs ? current : null;
  }

  function shortText(text) {
    var value = String(text === undefined || text === null ? '' : text).replace(/\s+/g, ' ').trim();
    return value.length > 24 ? value.slice(0, 24) + '…' : value;
  }

  /* 曜日は日付から Date で求める。数字の曜日から推測しない。 */
  function jaDay(iso) {
    var day = BB.date.parse(String(iso || '').slice(0, 10));
    if (!day) return String(iso || '');
    return day.getMonth() + 1 + '月' + day.getDate() + '日（' + JA_DAYS[day.getDay()] + '）';
  }

  function eventColors() {
    var list = BB.dash && BB.dash.eventColors;
    return Array.isArray(list) && list.length ? list : EVENT_COLORS;
  }

  /* summaryJa は承認待ちの一覧に出す 1 行。auto の type は apply 側が返すので空でよい。 */
  function ok(warning, summaryJa) {
    return { reason: '', summaryJa: summaryJa || '', warning: warning || '' };
  }

  function bad(reason) {
    return { reason: reason, summaryJa: SUMMARY[reason] || '' };
  }

  function conflict(current) {
    return { reason: 'conflict', summaryJa: SUMMARY.conflict, current: current };
  }

  /* ---------- shared rules ---------- */

  /* session-detail.js の termEnd と同じ。開始日が未設定なら null（範囲を見ない）。 */
  function termEndOf(state) {
    var start = BB.date.start();
    if (!start) return null;
    var weeks = (state.term && state.term.weeks) || 14;
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + weeks * 7 - 1);
  }

  /* session-detail.js の attendanceEntry と同じ照合。日付とコマ（開始・終了）で 1 件を探す。
     sessionMeta を持たない古い記録は日付だけで照合する。 */
  function attendanceEntryOf(subject, index, date) {
    var session = subject.sessions[index];
    if (!session) return null;
    var log = (subject.attendance && subject.attendance.log) || [];
    var match = null;
    for (var i = 0; i < log.length; i++) {
      var entry = log[i];
      if (String(entry.date).slice(0, 10) !== date) continue;
      var meta = entry.sessionMeta;
      if (meta) {
        if (String(meta.start) !== String(session.start)) continue;
        if (String(meta.end) !== String(session.end)) continue;
      }
      match = { entry: entry, index: i };
    }
    return match;
  }

  /* attendance.js の sessionLabel と同じ書式。ログの行が画面と揃う。 */
  function sessionLabelOf(session) {
    if (!session) return '';
    var day = session.day === undefined || session.day === null
      ? ''
      : BB.i18n.t('day.' + DAY_KEYS[Number(session.day)]) + ' ';
    return day + session.start + '–' + session.end + ' ' + session.type +
      (session.room ? ' · ' + session.room : '');
  }

  function overrideSummary(kind, subject, date) {
    var label = kind === 'cancel' ? '休講' : kind === 'transfer' ? '振替' : 'オンライン';
    return label + 'に設定: ' + subject.id + ' ' + jaDay(date);
  }

  /* args のどこかに禁止項目があれば true。深すぎる入れ子は見ない。 */
  function hasForbidden(value, depth) {
    if (!value || typeof value !== 'object' || (depth || 0) > 4) return false;
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      if (FORBIDDEN_KEYS.indexOf(keys[i]) >= 0) return true;
      if (hasForbidden(value[keys[i]], (depth || 0) + 1)) return true;
    }
    return false;
  }

  /* ---------- approval preview ---------- */

  /* undo の 1 段は「変更前の値」と「変更後の値」をそのまま持っている。
     承認画面の差分はそこから作るので、type を増やしても書き足さなくてよい。 */
  function previewLabel(step) {
    if (step.op === 'attendance') return '出席';
    if (step.op === 'mark') return '点数';
    if (step.op === 'session') return 'コマ';
    if (step.op === 'assessment') return '評価項目';
    if (step.op === 'set') return '設定';
    if (step.path === 'notes') return 'メモ';
    if (step.path === 'personalEvents') return '個人予定';
    if (step.path === 'studySessions') return '学習記録';
    if (step.path === 'customDeadlines') return '締切';
    if (step.path === 'deadlineDetails') return '締切の詳細';
    if (step.path === 'sessionOverrides') return '休講・振替';
    return step.path || '';
  }

  function previewValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value !== 'object') return String(value);
    if (Array.isArray(value)) return value.length + ' 件';
    if (value.text !== undefined) return shortText(value.text);
    if (value.title !== undefined) return shortText(value.title);
    if (value.name !== undefined) return shortText(value.name);
    if (value.minutes !== undefined) return value.minutes + '分';
    if (value.held !== undefined) return '出席 ' + value.attended + '/' + value.held;
    if (value.memo !== undefined || value.links !== undefined) {
      var memo = shortText(value.memo || '');
      var links = Array.isArray(value.links) ? value.links.length : 0;
      return memo || (links ? links + ' リンク' : '');
    }
    if (value.start !== undefined && value.end !== undefined) return value.start + '–' + value.end;
    if (value.kind !== undefined && value.date !== undefined) return value.kind + ' ' + value.date;
    return '';
  }

  /* state の複製に apply を流し、undo の段から「変更前 → 変更後」を作る。
     本物の state には触らない。 */
  function previewOf(state, spec, args) {
    var rows = [];
    try {
      var result = spec.apply(clone(state), args);
      var steps = result && result.undo && Array.isArray(result.undo.steps) ? result.undo.steps : [];
      steps.forEach(function (step) {
        rows.push({
          label: previewLabel(step),
          before: previewValue(step.value),
          after: previewValue(step.expect)
        });
      });
    } catch (e) {
      rows = [];
    }
    return { rows: rows };
  }

  /* ---------- operation registry ---------- */

  /* 個人予定が時間割に描かれるか。月〜金・8〜18 時の外は warning を付ける。 */
  function eventWarning(kind, date, start, end) {
    var outside = start < GRID_START || end > GRID_END;
    var weekend = false;
    if (kind === 'once') {
      var day = BB.date.parse(date);
      weekend = !!day && (day.getDay() === 0 || day.getDay() === 6);
    }
    return outside || weekend ? 'not_visible_on_grid' : '';
  }

  function eventSummary(verb, entry) {
    var when =
      entry.kind === 'weekly'
        ? '毎週 ' + JA_DAYS[entry.weekday] + '曜 ' + entry.start + '–' + entry.end
        : jaDay(entry.date) + entry.start + '–' + entry.end;
    return '個人予定を' + verb + ': ' + when;
  }

  function deadlineKeys() {
    var keys = {};
    try {
      (BB.dash.deadlineItems() || []).forEach(function (item) {
        if (item && item.key) keys[item.key] = true;
      });
    } catch (e) {
      /* 締切一覧が引けないページでも、key の検査だけ諦めて先へ進む */
    }
    return keys;
  }

  function deadlineName(key) {
    var name = '';
    try {
      (BB.dash.deadlineItems() || []).forEach(function (item) {
        if (item && item.key === key) name = (item.assessment && item.assessment.name) || '';
      });
    } catch (e) {
      name = '';
    }
    return name;
  }

  function validateNoteAdd(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var kind = args.kind === 'memo' ? 'memo' : args.kind === 'homework' ? 'homework' : null;
    if (!kind) return bad('invalid_args');
    var text = typeof args.text === 'string' ? args.text.trim() : '';
    if (!text || text.length > MAX_TEXT) return bad('invalid_text');
    if (!isRealDay(args.date)) return bad('invalid_date');
    if (!isDue(args.due)) return bad('invalid_due');
    var subjectCode = args.subjectCode;
    if (subjectCode === undefined || subjectCode === null || subjectCode === '') subjectCode = null;
    if (subjectCode !== null && !hasSubject(state, subjectCode)) return bad('unknown_subject');
    return ok();
  }

  function applyNoteAdd(state, args) {
    var kind = args.kind === 'memo' ? 'memo' : 'homework';
    var subjectCode = args.subjectCode;
    if (subjectCode === undefined || subjectCode === null || subjectCode === '') subjectCode = null;
    var note = {
      id: nextId(state, 'notes', 'n'),
      date: args.date,
      subjectCode: subjectCode,
      text: args.text.trim(),
      kind: kind,
      due: kind === 'homework' ? args.due || '' : '',
      done: false
    };
    state.notes = state.notes || [];
    state.notes.push(note);
    return {
      after: { ids: [note.id] },
      undo: { steps: [{ op: 'remove', path: 'notes', id: note.id, expect: clone(note) }] },
      /* 前回の受け入れ確認と同じ文言。トーストは「ローカルAI: 」+ これ。 */
      summaryJa: kind === 'memo' ? 'メモを追加しました' : '宿題を追加しました'
    };
  }

  function validateNoteUpdate(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var note = findById(state.notes, args.id);
    if (!note) return bad('not_found');
    if (!args.expect || typeof args.expect !== 'object') return bad('invalid_args');
    var differs = conflictOf(note, args.expect);
    if (differs) return conflict(differs);

    var fields = args.fields;
    if (!fields || typeof fields !== 'object') return bad('invalid_args');
    var keys = Object.keys(fields);
    if (!keys.length) return bad('invalid_args');
    for (var i = 0; i < keys.length; i++) {
      if (NOTE_FIELDS.indexOf(keys[i]) < 0) return bad('invalid_args');
    }
    if (fields.text !== undefined) {
      var text = typeof fields.text === 'string' ? fields.text.trim() : '';
      if (!text || text.length > MAX_TEXT) return bad('invalid_text');
    }
    if (fields.kind !== undefined && fields.kind !== 'memo' && fields.kind !== 'homework') return bad('invalid_args');
    if (fields.subjectCode !== undefined) {
      var code = fields.subjectCode;
      if (code !== null && code !== '' && !hasSubject(state, code)) return bad('unknown_subject');
    }
    if (fields.date !== undefined && !isRealDay(fields.date)) return bad('invalid_date');
    if (fields.due !== undefined && !isDue(fields.due)) return bad('invalid_due');
    return ok();
  }

  function applyNoteUpdate(state, args) {
    var note = findById(state.notes, args.id);
    var before = clone(note);
    var fields = args.fields;
    if (fields.text !== undefined) note.text = fields.text.trim();
    if (fields.kind !== undefined) note.kind = fields.kind;
    if (fields.subjectCode !== undefined) note.subjectCode = fields.subjectCode === '' ? null : fields.subjectCode;
    if (fields.date !== undefined) note.date = fields.date;
    if (fields.due !== undefined) note.due = fields.due;
    /* 画面のフォームと同じく、メモは締切を持たない。 */
    if (note.kind === 'memo') note.due = '';
    var after = clone(note);
    return {
      after: { ids: [note.id] },
      undo: { steps: [{ op: 'put', path: 'notes', id: note.id, expect: after, value: before }] },
      summaryJa: 'メモを更新: ' + shortText(note.text)
    };
  }

  function validateNoteSetDone(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    if (!findById(state.notes, args.id)) return bad('not_found');
    if (typeof args.done !== 'boolean') return bad('invalid_args');
    return ok();
  }

  function applyNoteSetDone(state, args) {
    var note = findById(state.notes, args.id);
    var before = clone(note);
    note.done = args.done;
    var after = clone(note);
    return {
      after: { ids: [note.id] },
      undo: { steps: [{ op: 'put', path: 'notes', id: note.id, expect: after, value: before }] },
      summaryJa: (args.done ? 'メモを完了: ' : 'メモを未完了に戻す: ') + shortText(note.text)
    };
  }

  function validateEventSave(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    if (args.id) {
      var existing = findById(state.personalEvents, args.id);
      if (!existing) return bad('not_found');
      if (!args.expect || typeof args.expect !== 'object') return bad('invalid_args');
      var differs = conflictOf(existing, args.expect);
      if (differs) return conflict(differs);
    }
    var title = typeof args.title === 'string' ? args.title.trim() : '';
    if (!title) return bad('invalid_title');
    var kind = args.kind === 'weekly' ? 'weekly' : args.kind === 'once' ? 'once' : null;
    if (!kind) return bad('invalid_args');
    if (kind === 'once') {
      if (!isRealDay(args.date)) return bad('invalid_date');
    } else {
      var weekday = Number(args.weekday);
      if (!isInt(weekday) || weekday < 1 || weekday > 5) return bad('invalid_weekday');
    }
    if (!isTime(args.start) || !isTime(args.end)) return bad('invalid_time');
    if (args.end <= args.start) return bad('invalid_time');
    return ok(eventWarning(kind, args.date, args.start, args.end));
  }

  function applyEventSave(state, args) {
    var kind = args.kind === 'weekly' ? 'weekly' : 'once';
    var colors = eventColors();
    var color = colors.indexOf(args.color) >= 0 ? args.color : colors[0];
    state.personalEvents = state.personalEvents || [];
    var entry = args.id ? findById(state.personalEvents, args.id) : null;
    var before = entry ? clone(entry) : null;
    if (!entry) {
      entry = { id: nextId(state, 'personalEvents', 'pe') };
      state.personalEvents.push(entry);
    }
    entry.title = args.title.trim();
    entry.kind = kind;
    entry.date = kind === 'once' ? args.date : '';
    entry.weekday = kind === 'weekly' ? Number(args.weekday) : 0;
    entry.start = args.start;
    entry.end = args.end;
    entry.color = color;
    entry.memo = typeof args.memo === 'string' ? args.memo.trim() : '';
    var after = clone(entry);
    return {
      after: { ids: [entry.id] },
      undo: {
        steps: [
          before
            ? { op: 'put', path: 'personalEvents', id: entry.id, expect: after, value: before }
            : { op: 'remove', path: 'personalEvents', id: entry.id, expect: after }
        ]
      },
      summaryJa: eventSummary(before ? '更新' : '追加', entry),
      warning: eventWarning(kind, entry.date, entry.start, entry.end)
    };
  }

  function validateStudyAdd(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    if (!hasSubject(state, args.subjectId)) return bad('unknown_subject');
    var minutes = Number(args.minutes);
    if (!isInt(minutes) || minutes < 1 || minutes > 720) return bad('invalid_args');
    if (!isRealDay(args.date)) return bad('invalid_date');
    if (args.note !== undefined && args.note !== null && typeof args.note !== 'string') return bad('invalid_args');
    return ok();
  }

  function applyStudyAdd(state, args) {
    var session = {
      id: nextId(state, 'studySessions', 's'),
      subjectId: args.subjectId,
      minutes: Number(args.minutes),
      /* 手入力と同じく正午で置く。時刻まで持たない日付を週に落とすため。 */
      startedAt: new Date(args.date + 'T12:00:00').toISOString(),
      note: typeof args.note === 'string' ? args.note.trim() : ''
    };
    state.studySessions = state.studySessions || [];
    state.studySessions.push(session);
    return {
      after: { ids: [session.id] },
      undo: { steps: [{ op: 'remove', path: 'studySessions', id: session.id, expect: clone(session) }] },
      summaryJa: '学習を記録: ' + jaDay(args.date) + session.minutes + '分'
    };
  }

  function validateDeadlineSave(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    if (args.id) {
      var existing = findById(state.customDeadlines, args.id);
      if (!existing) return bad('not_found');
      if (args.expect && typeof args.expect === 'object') {
        var differs = conflictOf(existing, args.expect);
        if (differs) return conflict(differs);
      }
    }
    if (!hasSubject(state, args.subjectId)) return bad('unknown_subject');
    var name = typeof args.name === 'string' ? args.name.trim() : '';
    if (!name) return bad('invalid_name');
    if (args.date !== undefined && args.date !== null && args.date !== '') {
      if (!isRealDay(args.date)) return bad('invalid_date');
    } else {
      var week = Number(args.week);
      var maxWeek = (state.term.weeks || 14) + 1;
      if (!isInt(week) || week < 1 || week > maxWeek) return bad('invalid_week');
    }
    if (DEADLINE_KINDS.indexOf(args.kind) < 0) return bad('invalid_kind');
    var weight = args.weight === undefined || args.weight === null || args.weight === '' ? 0 : Number(args.weight);
    if (!isFinite(weight) || weight < 0 || weight > 100) return bad('invalid_weight');
    if (typeof args.memo === 'string' && args.memo.length > MAX_MEMO) return bad('invalid_memo');
    return ok();
  }

  function applyDeadlineSave(state, args) {
    var date = typeof args.date === 'string' ? args.date : '';
    var week = date ? BB.dash.weekOf(BB.date.parse(date.slice(0, 10))) : Number(args.week);
    var weight = args.weight === undefined || args.weight === null || args.weight === '' ? 0 : Number(args.weight);
    state.customDeadlines = state.customDeadlines || [];
    var entry = args.id ? findById(state.customDeadlines, args.id) : null;
    var before = entry ? clone(entry) : null;
    if (!entry) {
      entry = { id: nextId(state, 'customDeadlines', 'cd-'), createdAt: new Date().toISOString() };
      state.customDeadlines.push(entry);
    }
    entry.subjectId = args.subjectId;
    entry.name = args.name.trim();
    entry.week = week;
    entry.date = date;
    entry.kind = args.kind;
    entry.weight = weight;
    entry.note = entry.note || '';
    var after = clone(entry);

    var steps = [
      before
        ? { op: 'put', path: 'customDeadlines', id: entry.id, expect: after, value: before }
        : { op: 'remove', path: 'customDeadlines', id: entry.id, expect: after }
    ];

    /* フォームで書いたメモは詳細画面のメモとして引き継ぐ（deadlines.js と同じ）。 */
    var detailKey = 'c:' + entry.id;
    var detailBefore = state.deadlineDetails && state.deadlineDetails[detailKey] ? clone(state.deadlineDetails[detailKey]) : null;
    if (typeof args.memo === 'string') {
      var memo = args.memo.trim();
      var links = detailBefore && Array.isArray(detailBefore.links) ? detailBefore.links : [];
      state.deadlineDetails = state.deadlineDetails || {};
      if (!memo && !links.length) delete state.deadlineDetails[detailKey];
      else state.deadlineDetails[detailKey] = { links: links, memo: memo };
      var detailAfter = state.deadlineDetails[detailKey] ? clone(state.deadlineDetails[detailKey]) : null;
      if (!sameValue(detailBefore, detailAfter)) {
        steps.push({ op: 'put', path: 'deadlineDetails', key: detailKey, expect: detailAfter, value: detailBefore });
      }
    }

    return {
      after: { ids: [entry.id] },
      undo: { steps: steps },
      summaryJa:
        '締切を' + (before ? '更新' : '追加') + ': ' + shortText(entry.name) + ' ' +
        (date ? jaDay(date) : 'Week ' + week)
    };
  }

  /* ---------- eBwise の締切（承認が必要） ---------- */

  /* state.ebwise.suggested を読み書きする。古い保存に無くても作る。 */
  function suggestedOf(state) {
    if (!state.ebwise || typeof state.ebwise !== 'object') {
      state.ebwise = { schema: 1, mapping: {}, suggested: {}, seenAt: {}, filesLinked: false };
    }
    if (!state.ebwise.suggested || typeof state.ebwise.suggested !== 'object') {
      state.ebwise.suggested = {};
    }
    return state.ebwise.suggested;
  }

  function suggestedRecord(state, ebwiseId) {
    var suggested = state.ebwise && state.ebwise.suggested ? state.ebwise.suggested : {};
    var record = suggested[ebwiseId];
    return record && typeof record === 'object' ? record : null;
  }

  function termStartIso() {
    var start = BB.date.start();
    if (!start) return '';
    return start.getFullYear() + '-' + pad2(start.getMonth() + 1) + '-' + pad2(start.getDate());
  }

  function termEndIso(state) {
    var end = termEndOf(state);
    if (!end) return '';
    return end.getFullYear() + '-' + pad2(end.getMonth() + 1) + '-' + pad2(end.getDate());
  }

  function ebwiseMemo(date, time) {
    return 'eBwise から取り込み（締切 ' + jaDay(date) + (time ? ' ' + time : '') + '）';
  }

  function ebwiseSummary(verb, name, date, time) {
    return 'eBwise の締切を' + verb + ': ' + shortText(name) + ' ' + jaDay(date) + (time || '');
  }

  function validateEbwiseDeadlineImport(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    if (!hasSubject(state, args.subjectId)) return bad('unknown_subject');
    var name = typeof args.name === 'string' ? args.name.trim() : '';
    if (!name || name.length > 200) return bad('invalid_name');
    if (!isRealDay(args.date)) return bad('invalid_date');
    if (DEADLINE_KINDS.indexOf(args.kind) < 0) return bad('invalid_kind');
    var start = termStartIso();
    var end = termEndIso(state);
    if (start && end && (args.date < start || args.date > end)) return bad('out_of_term');
    var record = suggestedRecord(state, args.ebwiseId);
    if (record && record.status === 'imported') return bad('duplicate');
    if (typeof args.url !== 'string') return bad('invalid_link');
    if (args.url !== '' && !/^https:\/\//i.test(args.url)) return bad('invalid_link');
    var time = typeof args.time === 'string' ? args.time : '';
    return ok('', ebwiseSummary('追加', name, args.date, time));
  }

  function applyEbwiseDeadlineImport(state, args) {
    var date = args.date;
    var time = typeof args.time === 'string' ? args.time : '';
    var week = BB.dash.weekOf(BB.date.parse(date));
    state.customDeadlines = state.customDeadlines || [];
    var entry = {
      id: nextId(state, 'customDeadlines', 'cd-'),
      createdAt: new Date().toISOString(),
      subjectId: args.subjectId,
      name: args.name.trim(),
      week: week,
      date: date,
      kind: args.kind,
      weight: 0,
      note: '',
      ebwiseId: args.ebwiseId,
      source: 'ebwise'
    };
    state.customDeadlines.push(entry);
    var after = clone(entry);

    var steps = [{ op: 'remove', path: 'customDeadlines', id: entry.id, expect: after }];

    var url = typeof args.url === 'string' ? args.url : '';
    if (url) {
      var detailKey = 'c:' + entry.id;
      state.deadlineDetails = state.deadlineDetails || {};
      var detailBefore = state.deadlineDetails[detailKey] ? clone(state.deadlineDetails[detailKey]) : null;
      state.deadlineDetails[detailKey] = {
        links: [{ label: 'eBwise', url: url }],
        memo: ebwiseMemo(date, time)
      };
      steps.push({
        op: 'put',
        path: 'deadlineDetails',
        key: detailKey,
        expect: clone(state.deadlineDetails[detailKey]),
        value: detailBefore
      });
    }

    /* 取り込んだ記録は undo に含めない。取り消したものを再び候補にしないため。 */
    suggestedOf(state)[args.ebwiseId] = {
      status: 'imported',
      deadlineId: entry.id,
      dueDate: date,
      dueTime: time,
      at: new Date().toISOString()
    };

    return {
      after: { ids: [entry.id] },
      undo: { steps: steps },
      summaryJa: ebwiseSummary('追加', entry.name, date, time)
    };
  }

  function validateEbwiseDeadlineUpdate(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var deadline = findById(state.customDeadlines, args.deadlineId);
    if (!deadline) return bad('not_found');
    if (args.expect && typeof args.expect === 'object') {
      var differs = conflictOf(deadline, args.expect);
      if (differs) return conflict(differs);
    }
    if (!isRealDay(args.date)) return bad('invalid_date');
    var start = termStartIso();
    var end = termEndIso(state);
    if (start && end && (args.date < start || args.date > end)) return bad('out_of_term');
    var time = typeof args.time === 'string' ? args.time : '';
    return ok('', ebwiseSummary('更新', deadline.name, args.date, time));
  }

  function applyEbwiseDeadlineUpdate(state, args) {
    var deadline = findById(state.customDeadlines, args.deadlineId);
    var before = clone(deadline);
    var date = args.date;
    var time = typeof args.time === 'string' ? args.time : '';
    deadline.date = date;
    deadline.week = BB.dash.weekOf(BB.date.parse(date));
    var after = clone(deadline);
    var steps = [{ op: 'put', path: 'customDeadlines', id: deadline.id, expect: after, value: before }];

    var detailKey = 'c:' + deadline.id;
    var detailBefore = state.deadlineDetails && state.deadlineDetails[detailKey]
      ? clone(state.deadlineDetails[detailKey])
      : null;
    if (detailBefore) {
      state.deadlineDetails[detailKey] = {
        links: Array.isArray(detailBefore.links) ? detailBefore.links : [],
        memo: ebwiseMemo(date, time)
      };
      steps.push({
        op: 'put',
        path: 'deadlineDetails',
        key: detailKey,
        expect: clone(state.deadlineDetails[detailKey]),
        value: detailBefore
      });
    }

    var record = suggestedOf(state)[args.ebwiseId];
    if (record && typeof record === 'object') {
      /* 承認されたので、次は「取り込み済み」として比べる。 */
      record.status = 'imported';
      record.deadlineId = deadline.id;
      record.dueDate = date;
      record.dueTime = time;
      record.at = new Date().toISOString();
    }

    return {
      after: { ids: [deadline.id] },
      undo: { steps: steps },
      summaryJa: ebwiseSummary('更新', deadline.name, date, time)
    };
  }

  function validateDeadlineDetailSet(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    if (typeof args.key !== 'string' || !args.key) return bad('invalid_args');
    if (!Object.prototype.hasOwnProperty.call(deadlineKeys(), args.key)) return bad('unknown_deadline');
    if (args.links !== undefined && args.links !== null) {
      if (!Array.isArray(args.links)) return bad('invalid_args');
      if (args.links.length > MAX_LINKS) return bad('too_many_links');
      for (var i = 0; i < args.links.length; i++) {
        var link = args.links[i];
        if (!link || typeof link !== 'object') return bad('invalid_link');
        if (link.url && !/^https?:\/\//i.test(String(link.url))) return bad('invalid_link');
      }
    }
    if (args.memo !== undefined && args.memo !== null && typeof args.memo !== 'string') return bad('invalid_args');
    if (typeof args.memo === 'string' && args.memo.length > MAX_MEMO) return bad('invalid_memo');
    return ok();
  }

  function applyDeadlineDetailSet(state, args) {
    var key = args.key;
    var mode = args.mode === 'append' ? 'append' : 'replace';
    state.deadlineDetails = state.deadlineDetails || {};
    var before = state.deadlineDetails[key] ? clone(state.deadlineDetails[key]) : null;
    var current = before || { links: [], memo: '' };

    var incoming = (args.links || [])
      .filter(function (link) {
        return link && (link.label || link.url);
      })
      .map(function (link) {
        return { label: String(link.label || ''), url: String(link.url || '') };
      });
    var incomingMemo = typeof args.memo === 'string' ? args.memo : '';

    var links;
    var memo;
    if (mode === 'append') {
      links = (current.links || []).concat(incoming).slice(0, MAX_LINKS);
      memo = [current.memo || '', incomingMemo]
        .filter(function (part) {
          return !!part;
        })
        .join('\n');
    } else {
      links = incoming.slice(0, MAX_LINKS);
      memo = incomingMemo;
    }

    /* setDeadlineDetail と同じく、リンクもメモも空なら項目ごと消す。 */
    if (!links.length && !memo) delete state.deadlineDetails[key];
    else state.deadlineDetails[key] = { links: links, memo: memo };

    var after = state.deadlineDetails[key] ? clone(state.deadlineDetails[key]) : null;
    var name = deadlineName(key);
    return {
      after: { ids: [key] },
      undo: { steps: [{ op: 'put', path: 'deadlineDetails', key: key, expect: after, value: before }] },
      summaryJa: '締切の詳細を更新: ' + shortText(name || key)
    };
  }

  function validateAppearance(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var hasTheme = args.theme !== undefined && args.theme !== null;
    var hasLang = args.lang !== undefined && args.lang !== null;
    if (!hasTheme && !hasLang) return bad('invalid_args');
    if (hasTheme && THEMES.indexOf(args.theme) < 0) return bad('invalid_theme');
    if (hasLang && LANGS.indexOf(args.lang) < 0) return bad('invalid_lang');
    return ok();
  }

  function applyAppearance(state, args) {
    state.settings = state.settings || {};
    var steps = [];
    var parts = [];
    if (args.theme) {
      var beforeTheme = state.settings.theme || 'light';
      if (beforeTheme !== args.theme) {
        state.settings.theme = args.theme;
        steps.push({ op: 'set', path: 'settings.theme', expect: args.theme, value: beforeTheme });
      }
      parts.push(THEME_LABELS[args.theme]);
    }
    if (args.lang) {
      /* 言語は i18n.js がキャッシュしているので、保存は mutate の外で setLang に任せる。 */
      var beforeLang = BB.i18n && BB.i18n.lang ? BB.i18n.lang() : state.settings.lang || 'en';
      if (beforeLang !== args.lang) {
        steps.push({ op: 'set', path: 'settings.lang', expect: args.lang, value: beforeLang });
      }
      parts.push(LANG_LABELS[args.lang]);
    }
    return {
      after: { ids: [] },
      /* 何も変わらなかったときは取り消すものが無い。 */
      undo: steps.length ? { steps: steps } : null,
      summaryJa: '表示を変更: ' + parts.join(' / ')
    };
  }

  function findResult(state, opId) {
    var bridge = state.aiBridge;
    if (!bridge || !Array.isArray(bridge.results) || !opId) return null;
    for (var i = bridge.results.length - 1; i >= 0; i--) {
      if (bridge.results[i] && bridge.results[i].opId === opId) return bridge.results[i];
    }
    return null;
  }

  /* undo の 1 段が指す「今の値」。 */
  function currentOf(state, step) {
    if (step.op === 'set') {
      if (step.path === 'settings.lang') {
        return BB.i18n && BB.i18n.lang ? BB.i18n.lang() : state.settings ? state.settings.lang : undefined;
      }
      if (step.path && step.path.indexOf('settings.') === 0) {
        var key = step.path.slice('settings.'.length);
        return state.settings ? state.settings[key] : undefined;
      }
      return undefined;
    }
    if (step.op === 'attendance') {
      var attended = findById(state.subjects, step.id);
      return attended && attended.attendance ? attended.attendance : null;
    }
    if (step.op === 'mark') {
      var marked = findById(state.subjects, step.id);
      var marks = marked && marked.marks ? marked.marks : {};
      return marks[step.key] === undefined ? null : marks[step.key];
    }
    if (step.op === 'session') {
      var sessionOwner = findById(state.subjects, step.id);
      return sessionOwner && sessionOwner.sessions ? sessionOwner.sessions[step.index] || null : null;
    }
    if (step.op === 'assessment') {
      var assessmentOwner = findById(state.subjects, step.id);
      return assessmentOwner ? findById(assessmentOwner.assessments, step.key) : null;
    }
    if (step.path === 'deadlineDetails') {
      var map = state.deadlineDetails || {};
      return map[step.key] === undefined ? null : map[step.key];
    }
    var found = findById(state[step.path], step.id);
    return found ? found : null;
  }

  function undoConflict(state, steps) {
    var current = {};
    var differs = false;
    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      var now = currentOf(state, step);
      if (sameValue(now, step.expect)) continue;
      differs = true;
      current[(step.path || step.op) + (step.id ? ':' + step.id : step.key ? ':' + step.key : '')] = now;
    }
    return differs ? current : null;
  }

  function validateUndo(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var target = findResult(state, args.targetOpId);
    if (!target) return bad('not_found');
    if (target.status !== 'applied') return bad('not_applied');
    if (target.undoneAt) return bad('already_undone');
    if (!target.undo || !Array.isArray(target.undo.steps) || !target.undo.steps.length) return bad('not_undoable');
    var differs = undoConflict(state, target.undo.steps);
    if (differs) return conflict(differs);
    return ok();
  }

  function applyStep(state, step) {
    if (step.op === 'set') {
      /* settings.lang は mutate の外で BB.i18n.setLang に通す。 */
      if (step.path === 'settings.lang') return;
      if (step.path && step.path.indexOf('settings.') === 0) {
        var key = step.path.slice('settings.'.length);
        state.settings = state.settings || {};
        state.settings[key] = step.value;
      }
      return;
    }
    if (step.op === 'attendance') {
      var attended = findById(state.subjects, step.id);
      if (!attended) return;
      if (step.value === null || step.value === undefined) delete attended.attendance;
      else attended.attendance = clone(step.value);
      return;
    }
    if (step.op === 'mark') {
      var marked = findById(state.subjects, step.id);
      if (!marked) return;
      marked.marks = marked.marks || {};
      if (step.value === null || step.value === undefined) delete marked.marks[step.key];
      else marked.marks[step.key] = step.value;
      return;
    }
    if (step.op === 'session') {
      var sessionOwner = findById(state.subjects, step.id);
      if (!sessionOwner || !sessionOwner.sessions) return;
      sessionOwner.sessions[step.index] = clone(step.value);
      return;
    }
    if (step.op === 'assessment') {
      var assessmentOwner = findById(state.subjects, step.id);
      if (!assessmentOwner || !assessmentOwner.assessments) return;
      for (var a = 0; a < assessmentOwner.assessments.length; a++) {
        if (assessmentOwner.assessments[a] && assessmentOwner.assessments[a].id === step.key) {
          assessmentOwner.assessments[a] = clone(step.value);
          return;
        }
      }
      return;
    }
    if (step.path === 'deadlineDetails') {
      state.deadlineDetails = state.deadlineDetails || {};
      if (step.value === null || step.value === undefined) delete state.deadlineDetails[step.key];
      else state.deadlineDetails[step.key] = clone(step.value);
      return;
    }
    if (!Array.isArray(state[step.path])) state[step.path] = [];
    var list = state[step.path];
    var index = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === step.id) index = i;
    }
    if (step.op === 'remove' || step.value === null || step.value === undefined) {
      if (index >= 0) list.splice(index, 1);
      return;
    }
    if (index >= 0) list[index] = clone(step.value);
    else list.push(clone(step.value));
  }

  function applyUndo(state, args) {
    var target = findResult(state, args.targetOpId);
    var steps = target.undo.steps;
    var ids = [];
    for (var i = 0; i < steps.length; i++) {
      applyStep(state, steps[i]);
      if (steps[i].id) ids.push(steps[i].id);
    }
    target.undoneAt = new Date().toISOString();
    return {
      after: { ids: ids },
      /* 取り消しの取り消しはしない。 */
      undo: null,
      /* 戻した内容。保存後に theme / lang を追随させるために呼び出し側が読む。 */
      appliedSteps: steps,
      summaryJa: '取り消しました: ' + (target.summaryJa || target.type || '')
    };
  }

  /* ---------- 削除（承認が必要） ---------- */

  function validateNoteDelete(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var note = findById(state.notes, args.id);
    if (!note) return bad('not_found');
    return ok('', 'メモを削除: ' + shortText(note.text));
  }

  function applyNoteDelete(state, args) {
    var note = findById(state.notes, args.id);
    var before = clone(note);
    state.notes = (state.notes || []).filter(function (item) {
      return item.id !== note.id;
    });
    return {
      after: { ids: [note.id] },
      undo: { steps: [{ op: 'put', path: 'notes', id: note.id, expect: null, value: before }] },
      summaryJa: 'メモを削除: ' + shortText(before.text)
    };
  }

  function validateEventDelete(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var entry = findById(state.personalEvents, args.id);
    if (!entry) return bad('not_found');
    return ok('', '個人予定を削除: ' + shortText(entry.title));
  }

  function applyEventDelete(state, args) {
    var entry = findById(state.personalEvents, args.id);
    var before = clone(entry);
    state.personalEvents = (state.personalEvents || []).filter(function (item) {
      return item.id !== entry.id;
    });
    return {
      after: { ids: [entry.id] },
      undo: { steps: [{ op: 'put', path: 'personalEvents', id: entry.id, expect: null, value: before }] },
      summaryJa: '個人予定を削除: ' + shortText(before.title)
    };
  }

  function validateStudyDelete(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var session = findById(state.studySessions, args.id);
    if (!session) return bad('not_found');
    return ok('', '学習記録を削除: ' + jaDay(String(session.startedAt).slice(0, 10)) + session.minutes + '分');
  }

  function applyStudyDelete(state, args) {
    var session = findById(state.studySessions, args.id);
    var before = clone(session);
    state.studySessions = (state.studySessions || []).filter(function (item) {
      return item.id !== session.id;
    });
    return {
      after: { ids: [session.id] },
      undo: { steps: [{ op: 'put', path: 'studySessions', id: session.id, expect: null, value: before }] },
      summaryJa: '学習記録を削除: ' + jaDay(String(before.startedAt).slice(0, 10)) + before.minutes + '分'
    };
  }

  /* 手動で足した締切だけ。評価項目の締切は科目ごと消さない限り残す。 */
  function validateDeadlineDelete(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var entry = findById(state.customDeadlines, args.id);
    if (!entry) return bad('not_found');
    return ok('', '締切を削除: ' + shortText(entry.name));
  }

  function applyDeadlineDelete(state, args) {
    var entry = findById(state.customDeadlines, args.id);
    var before = clone(entry);
    state.customDeadlines = (state.customDeadlines || []).filter(function (item) {
      return item.id !== entry.id;
    });
    var steps = [{ op: 'put', path: 'customDeadlines', id: entry.id, expect: null, value: before }];
    /* その締切に付けた詳細も一緒に消す。残すと孤児になる。 */
    var detailKey = 'c:' + entry.id;
    var detailBefore = state.deadlineDetails && state.deadlineDetails[detailKey]
      ? clone(state.deadlineDetails[detailKey])
      : null;
    if (detailBefore) {
      delete state.deadlineDetails[detailKey];
      steps.push({ op: 'put', path: 'deadlineDetails', key: detailKey, expect: null, value: detailBefore });
    }
    return {
      after: { ids: [entry.id] },
      undo: { steps: steps },
      summaryJa: '締切を削除: ' + shortText(before.name)
    };
  }

  function validateDeadlineDetailClear(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    if (typeof args.key !== 'string' || !args.key) return bad('invalid_args');
    if (!Object.prototype.hasOwnProperty.call(deadlineKeys(), args.key)) return bad('unknown_deadline');
    return ok('', '締切の詳細を消す: ' + shortText(deadlineName(args.key) || args.key));
  }

  function applyDeadlineDetailClear(state, args) {
    var key = args.key;
    state.deadlineDetails = state.deadlineDetails || {};
    var before = state.deadlineDetails[key] ? clone(state.deadlineDetails[key]) : null;
    delete state.deadlineDetails[key];
    return {
      after: { ids: [key] },
      undo: { steps: [{ op: 'put', path: 'deadlineDetails', key: key, expect: null, value: before }] },
      summaryJa: '締切の詳細を消す: ' + shortText(deadlineName(key) || key)
    };
  }

  /* ---------- 出席（承認が必要） ---------- */

  function validateAttendanceMark(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var subject = findById(state.subjects, args.subjectId);
    if (!subject) return bad('unknown_subject');
    var index = Number(args.sessionIndex);
    if (!isInt(index) || index < 0 || index >= subject.sessions.length) return bad('invalid_session');
    var session = subject.sessions[index];
    if (!isRealDay(args.date)) return bad('invalid_date');
    var day = BB.date.parse(args.date);
    /* そのコマの曜日と違う日付は「存在しない回」。 */
    if (Number(session.day) !== day.getDay()) return bad('date_mismatch');
    var start = BB.date.start();
    var end = termEndOf(state);
    if (start && end && (day.getTime() < start.getTime() || day.getTime() > end.getTime())) {
      return bad('out_of_term');
    }
    if (args.status !== 'present' && args.status !== 'absent') return bad('invalid_status');
    if (attendanceEntryOf(subject, index, args.date)) return bad('duplicate');
    return ok('', '出席を記録: ' + subject.id + ' ' + jaDay(args.date) + ' ' +
      (args.status === 'present' ? '出席' : '欠席'));
  }

  function applyAttendanceMark(state, args) {
    var subject = findById(state.subjects, args.subjectId);
    var index = Number(args.sessionIndex);
    var session = subject.sessions[index];
    var before = subject.attendance ? clone(subject.attendance) : null;
    /* 画面と同じ関数で記録する。sessionMeta の形も画面と揃う。 */
    BB.attendance.markIn(state, subject.id, args.status, {
      date: args.date,
      session: sessionLabelOf(session),
      sessionMeta: {
        day: session.day,
        start: session.start,
        end: session.end,
        type: session.type,
        room: session.room
      }
    });
    var after = clone(subject.attendance);
    return {
      after: { ids: [subject.id] },
      undo: { steps: [{ op: 'attendance', id: subject.id, expect: after, value: before }] },
      summaryJa: '出席を記録: ' + subject.id + ' ' + jaDay(args.date) + ' ' +
        (args.status === 'present' ? '出席' : '欠席')
    };
  }

  function validateAttendanceUnmark(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var subject = findById(state.subjects, args.subjectId);
    if (!subject) return bad('unknown_subject');
    var index = Number(args.sessionIndex);
    if (!isInt(index) || index < 0 || index >= subject.sessions.length) return bad('invalid_session');
    if (!isRealDay(args.date)) return bad('invalid_date');
    if (!attendanceEntryOf(subject, index, args.date)) return bad('not_found');
    return ok('', '出席を取り消す: ' + subject.id + ' ' + jaDay(args.date));
  }

  function applyAttendanceUnmark(state, args) {
    var subject = findById(state.subjects, args.subjectId);
    var found = attendanceEntryOf(subject, Number(args.sessionIndex), args.date);
    var before = clone(subject.attendance);
    BB.attendance.unmarkIn(state, subject.id, found.index);
    var after = clone(subject.attendance);
    return {
      after: { ids: [subject.id] },
      undo: { steps: [{ op: 'attendance', id: subject.id, expect: after, value: before }] },
      summaryJa: '出席を取り消す: ' + subject.id + ' ' + jaDay(args.date)
    };
  }

  /* ---------- 休講・振替（承認が必要） ---------- */

  function validateOverrideSet(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var subject = findById(state.subjects, args.subjectId);
    if (!subject) return bad('unknown_subject');
    var index = Number(args.sessionIndex);
    if (!isInt(index) || index < 0 || index >= subject.sessions.length) return bad('invalid_session');
    if (!isRealDay(args.date)) return bad('invalid_date');
    if (args.kind !== 'cancel' && args.kind !== 'transfer' && args.kind !== 'online') return bad('invalid_kind');
    if (args.kind === 'transfer') {
      var target = args.target;
      if (!target || typeof target !== 'object') return bad('invalid_target');
      if (!isRealDay(target.date)) return bad('invalid_date');
      if (!isTime(target.start) || !isTime(target.end)) return bad('invalid_time');
      if (target.end <= target.start) return bad('invalid_time');
    }
    if (args.kind === 'online') {
      var url = args.target && args.target.url ? String(args.target.url) : '';
      /* 画面は url をそのまま href に入れる。ブリッジ側で https だけに絞る。 */
      if (!/^https:\/\//i.test(url)) return bad('invalid_url');
    }
    return ok('', overrideSummary(args.kind, subject, args.date));
  }

  function applyOverrideSet(state, args) {
    var subject = findById(state.subjects, args.subjectId);
    var index = Number(args.sessionIndex);
    var before = null;
    (state.sessionOverrides || []).forEach(function (entry) {
      if (entry.subjectId === subject.id && entry.sessionIndex === index && entry.date === args.date) {
        before = clone(entry);
      }
    });
    var target = null;
    if (args.kind === 'transfer') {
      target = {
        date: args.target.date,
        start: args.target.start,
        end: args.target.end,
        room: args.target.room || ''
      };
    } else if (args.kind === 'online') {
      target = { url: String(args.target.url) };
    }
    var saved = BB.attendance.setOverrideIn(state, subject.id, index, args.date, args.kind, target);
    var after = clone(saved);
    return {
      after: { ids: [saved.id] },
      undo: {
        steps: [
          before
            ? { op: 'put', path: 'sessionOverrides', id: saved.id, expect: after, value: before }
            : { op: 'remove', path: 'sessionOverrides', id: saved.id, expect: after }
        ]
      },
      summaryJa: overrideSummary(args.kind, subject, args.date)
    };
  }

  function validateOverrideClear(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var subject = findById(state.subjects, args.subjectId);
    if (!subject) return bad('unknown_subject');
    var index = Number(args.sessionIndex);
    if (!isInt(index) || index < 0 || index >= subject.sessions.length) return bad('invalid_session');
    if (!isRealDay(args.date)) return bad('invalid_date');
    var found = null;
    (state.sessionOverrides || []).forEach(function (entry) {
      if (entry.subjectId === subject.id && entry.sessionIndex === index && entry.date === args.date) {
        found = entry;
      }
    });
    if (!found) return bad('not_found');
    return ok('', '休講・振替を解除: ' + subject.id + ' ' + jaDay(args.date));
  }

  function applyOverrideClear(state, args) {
    var subject = findById(state.subjects, args.subjectId);
    var index = Number(args.sessionIndex);
    var before = null;
    (state.sessionOverrides || []).forEach(function (entry) {
      if (entry.subjectId === subject.id && entry.sessionIndex === index && entry.date === args.date) {
        before = clone(entry);
      }
    });
    BB.attendance.removeOverrideIn(state, before.id);
    return {
      after: { ids: [before.id] },
      undo: { steps: [{ op: 'put', path: 'sessionOverrides', id: before.id, expect: null, value: before }] },
      summaryJa: '休講・振替を解除: ' + subject.id + ' ' + jaDay(args.date)
    };
  }

  /* ---------- 点数・目標（承認が必要） ---------- */

  function validateMarkSet(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var subject = findById(state.subjects, args.subjectId);
    if (!subject) return bad('unknown_subject');
    var assessment = findById(subject.assessments, args.assessmentId);
    if (!assessment) return bad('invalid_assessment');
    if (args.score !== null && args.score !== undefined) {
      if (!isFinite(Number(args.score))) return bad('invalid_score');
    }
    return ok('', '点数を' + (args.score === null || args.score === undefined ? '消す' : '記録') + ': ' +
      subject.id + ' ' + shortText(assessment.name));
  }

  function applyMarkSet(state, args) {
    var subject = findById(state.subjects, args.subjectId);
    var assessment = findById(subject.assessments, args.assessmentId);
    subject.marks = subject.marks || {};
    var before = subject.marks[assessment.id] === undefined ? null : subject.marks[assessment.id];
    var clamped = null;
    if (args.score === null || args.score === undefined) {
      delete subject.marks[assessment.id];
    } else {
      /* saveMark と同じく 0〜満点に丸める。丸めたら結果に残す。 */
      var value = Number(args.score);
      var max = Number(assessment.max);
      var upper = isFinite(max) && max > 0 ? max : Infinity;
      var bounded = Math.max(0, Math.min(upper, value));
      if (bounded !== value) clamped = { from: value, to: bounded };
      subject.marks[assessment.id] = bounded;
    }
    var after = subject.marks[assessment.id] === undefined ? null : subject.marks[assessment.id];
    return {
      after: { ids: [subject.id] },
      undo: { steps: [{ op: 'mark', id: subject.id, key: assessment.id, expect: after, value: before }] },
      clamped: clamped,
      summaryJa: '点数を' + (after === null ? '消す' : '記録') + ': ' + subject.id + ' ' +
        shortText(assessment.name) + (after === null ? '' : ' ' + after + '/' + assessment.max)
    };
  }

  function validateGoals(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var parts = [];
    if (args.cgpaTarget !== undefined) {
      var cgpa = Number(args.cgpaTarget);
      if (!isFinite(cgpa) || cgpa < 0 || cgpa > 4) return bad('invalid_cgpa');
      parts.push('CGPA ' + cgpa);
    }
    if (args.attendanceThreshold !== undefined) {
      var threshold = Number(args.attendanceThreshold);
      if (!isFinite(threshold) || threshold < 1 || threshold > 100) return bad('invalid_threshold');
      parts.push('出席 ' + threshold + '%');
    }
    if (args.weeklyStudyTarget !== undefined) {
      var weekly = Number(args.weeklyStudyTarget);
      if (!isInt(weekly) || weekly < 0 || weekly > 80) return bad('invalid_study_target');
      parts.push('週 ' + weekly + ' 時間');
    }
    if (!parts.length) return bad('invalid_args');
    return ok('', '目標を変更: ' + parts.join(' / '));
  }

  function applyGoals(state, args) {
    state.settings = state.settings || {};
    var steps = [];
    var parts = [];
    if (args.cgpaTarget !== undefined) {
      var beforeCgpa = state.settings.cgpaTarget;
      state.settings.cgpaTarget = Number(args.cgpaTarget);
      steps.push({ op: 'set', path: 'settings.cgpaTarget', expect: state.settings.cgpaTarget, value: beforeCgpa });
      parts.push('CGPA ' + state.settings.cgpaTarget);
    }
    if (args.attendanceThreshold !== undefined) {
      var beforeThreshold = state.settings.attendanceThreshold;
      state.settings.attendanceThreshold = Number(args.attendanceThreshold);
      steps.push({
        op: 'set',
        path: 'settings.attendanceThreshold',
        expect: state.settings.attendanceThreshold,
        value: beforeThreshold
      });
      parts.push('出席 ' + state.settings.attendanceThreshold + '%');
    }
    if (args.weeklyStudyTarget !== undefined) {
      var beforeWeekly = state.settings.weeklyStudyTarget;
      state.settings.weeklyStudyTarget = Number(args.weeklyStudyTarget);
      steps.push({
        op: 'set',
        path: 'settings.weeklyStudyTarget',
        expect: state.settings.weeklyStudyTarget,
        value: beforeWeekly
      });
      parts.push('週 ' + state.settings.weeklyStudyTarget + ' 時間');
    }
    return {
      after: { ids: [] },
      undo: { steps: steps },
      summaryJa: '目標を変更: ' + parts.join(' / ')
    };
  }

  /* ---------- 科目の中身（承認が必要） ---------- */

  function validateSessionPatch(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var subject = findById(state.subjects, args.subjectId);
    if (!subject) return bad('unknown_subject');
    var index = Number(args.sessionIndex);
    if (!isInt(index) || index < 0 || index >= subject.sessions.length) return bad('invalid_session');
    var fields = args.fields;
    if (!fields || typeof fields !== 'object') return bad('invalid_args');
    var keys = Object.keys(fields);
    if (!keys.length) return bad('invalid_args');
    for (var i = 0; i < keys.length; i++) {
      if (SESSION_FIELDS.indexOf(keys[i]) < 0) return bad('invalid_args');
    }
    if (fields.day !== undefined) {
      var day = Number(fields.day);
      if (!isInt(day) || day < 1 || day > 5) return bad('invalid_weekday');
    }
    if (fields.start !== undefined && !isTime(fields.start)) return bad('invalid_time');
    if (fields.end !== undefined && !isTime(fields.end)) return bad('invalid_time');
    if (fields.type !== undefined && SESSION_TYPES.indexOf(fields.type) < 0) return bad('invalid_type');
    if (fields.room !== undefined && typeof fields.room !== 'string') return bad('invalid_args');
    return ok('', 'コマを変更: ' + subject.id + ' ' + (index + 1) + '番目');
  }

  function applySessionPatch(state, args) {
    var subject = findById(state.subjects, args.subjectId);
    var index = Number(args.sessionIndex);
    var session = subject.sessions[index];
    var before = clone(session);
    var fields = args.fields;
    if (fields.day !== undefined) session.day = Number(fields.day);
    if (fields.start !== undefined) session.start = fields.start;
    if (fields.end !== undefined) session.end = fields.end;
    if (fields.type !== undefined) session.type = fields.type;
    if (fields.room !== undefined) session.room = String(fields.room).trim();
    var after = clone(session);
    return {
      after: { ids: [subject.id] },
      undo: { steps: [{ op: 'session', id: subject.id, index: index, expect: after, value: before }] },
      summaryJa: 'コマを変更: ' + subject.id + ' ' + (index + 1) + '番目 ' + after.start + '–' + after.end
    };
  }

  function validateAssessmentPatch(state, args) {
    if (!args || typeof args !== 'object') return bad('invalid_args');
    var subject = findById(state.subjects, args.subjectId);
    if (!subject) return bad('unknown_subject');
    var assessment = findById(subject.assessments, args.assessmentId);
    if (!assessment) return bad('invalid_assessment');
    var fields = args.fields;
    if (!fields || typeof fields !== 'object') return bad('invalid_args');
    var keys = Object.keys(fields);
    if (!keys.length) return bad('invalid_args');
    for (var i = 0; i < keys.length; i++) {
      if (ASSESSMENT_FIELDS.indexOf(keys[i]) < 0) return bad('invalid_args');
    }
    if (fields.name !== undefined) {
      var name = typeof fields.name === 'string' ? fields.name.trim() : '';
      if (!name) return bad('invalid_name');
    }
    if (fields.week !== undefined) {
      var week = Number(fields.week);
      var maxWeek = (state.term.weeks || 14) + 1;
      if (!isInt(week) || week < 1 || week > maxWeek) return bad('invalid_week');
    }
    if (fields.max !== undefined) {
      var max = Number(fields.max);
      if (!isFinite(max) || max <= 0) return bad('invalid_max');
    }
    if (fields.weight !== undefined) {
      var weight = Number(fields.weight);
      if (!isFinite(weight) || weight < 0 || weight > 100) return bad('invalid_weight');
      /* 配点は、変更後の合計が 100 になるときだけ動かせる。 */
      var total = 0;
      subject.assessments.forEach(function (item) {
        total += item.id === assessment.id ? weight : Number(item.weight) || 0;
      });
      if (total !== 100) return bad('invalid_weight');
    }
    return ok('', '評価項目を変更: ' + subject.id + ' ' + shortText(assessment.name));
  }

  function applyAssessmentPatch(state, args) {
    var subject = findById(state.subjects, args.subjectId);
    var assessment = findById(subject.assessments, args.assessmentId);
    var before = clone(assessment);
    var fields = args.fields;
    if (fields.name !== undefined) assessment.name = fields.name.trim();
    if (fields.week !== undefined) assessment.week = Number(fields.week);
    if (fields.max !== undefined) assessment.max = Number(fields.max);
    if (fields.weight !== undefined) assessment.weight = Number(fields.weight);
    var after = clone(assessment);
    return {
      after: { ids: [subject.id] },
      undo: { steps: [{ op: 'assessment', id: subject.id, key: assessment.id, expect: after, value: before }] },
      summaryJa: '評価項目を変更: ' + subject.id + ' ' + shortText(after.name)
    };
  }

  var OPS = {
    'note.add': { policy: 'auto', validate: validateNoteAdd, apply: applyNoteAdd },
    'note.update': { policy: 'auto', validate: validateNoteUpdate, apply: applyNoteUpdate },
    'note.setDone': { policy: 'auto', validate: validateNoteSetDone, apply: applyNoteSetDone },
    'event.save': { policy: 'auto', validate: validateEventSave, apply: applyEventSave },
    'study.add': { policy: 'auto', validate: validateStudyAdd, apply: applyStudyAdd },
    'deadline.save': { policy: 'auto', validate: validateDeadlineSave, apply: applyDeadlineSave },
    'deadlineDetail.set': { policy: 'auto', validate: validateDeadlineDetailSet, apply: applyDeadlineDetailSet },
    'settings.appearance': { policy: 'auto', validate: validateAppearance, apply: applyAppearance },
    undo: { policy: 'auto', validate: validateUndo, apply: applyUndo },

    /* ここから下は本人の承認が要る。検査だけ通して pending に積む。 */
    'note.delete': { policy: 'approval', validate: validateNoteDelete, apply: applyNoteDelete },
    'event.delete': { policy: 'approval', validate: validateEventDelete, apply: applyEventDelete },
    'study.delete': { policy: 'approval', validate: validateStudyDelete, apply: applyStudyDelete },
    'deadline.delete': { policy: 'approval', validate: validateDeadlineDelete, apply: applyDeadlineDelete },
    'deadlineDetail.clear': {
      policy: 'approval',
      validate: validateDeadlineDetailClear,
      apply: applyDeadlineDetailClear
    },
    'attendance.mark': { policy: 'approval', validate: validateAttendanceMark, apply: applyAttendanceMark },
    'attendance.unmark': { policy: 'approval', validate: validateAttendanceUnmark, apply: applyAttendanceUnmark },
    'class.override.set': { policy: 'approval', validate: validateOverrideSet, apply: applyOverrideSet },
    'class.override.clear': { policy: 'approval', validate: validateOverrideClear, apply: applyOverrideClear },
    'mark.set': { policy: 'approval', validate: validateMarkSet, apply: applyMarkSet },
    'settings.goals': { policy: 'approval', validate: validateGoals, apply: applyGoals },
    'subject.session.patch': { policy: 'approval', validate: validateSessionPatch, apply: applySessionPatch },
    'subject.assessment.patch': {
      policy: 'approval',
      validate: validateAssessmentPatch,
      apply: applyAssessmentPatch
    },
    /* eBwise の候補。アプリの中から submitInternal で積むだけで、inbox からは入れない。 */
    'ebwise.deadline.import': {
      policy: 'approval',
      validate: validateEbwiseDeadlineImport,
      apply: applyEbwiseDeadlineImport
    },
    'ebwise.deadline.update': {
      policy: 'approval',
      validate: validateEbwiseDeadlineUpdate,
      apply: applyEbwiseDeadlineUpdate
    }
  };

  /* ---------- results ---------- */

  /* aiBridge は初回の取り込みで作る。古い保存に無くても壊れないようにここで揃える。 */
  function bridgeOf(state) {
    if (!state.aiBridge || typeof state.aiBridge !== 'object') {
      state.aiBridge = { schema: 1, paused: false, results: [], pending: [] };
    }
    var bridge = state.aiBridge;
    if (!Array.isArray(bridge.results)) bridge.results = [];
    if (!Array.isArray(bridge.pending)) bridge.pending = [];
    return bridge;
  }

  /* 最後に取り込んだ時刻。設定画面とスナップショットが読む。 */
  function touchImport(bridge) {
    bridge.lastImportAt = new Date().toISOString();
  }

  /* 反映・承認待ち・却下のどれでも、結果がスナップショットに出るように書き出しを予約する。
     snapshot.js が無いページでは何もしない。 */
  function scheduleSnapshot() {
    if (BB.snapshot && typeof BB.snapshot.scheduleAutoWrite === 'function') {
      BB.snapshot.scheduleAutoWrite();
    }
  }

  function resultEntry(opId, type, status, reason, summaryJa, ids) {
    return {
      opId: opId || null,
      type: type || null,
      status: status,
      reason: reason || '',
      at: new Date().toISOString(),
      summaryJa: summaryJa || '',
      after: { ids: ids || [] }
    };
  }

  /* 古いものから捨てて 100 件に保つ。 */
  function pushResult(bridge, entry) {
    bridge.results.push(entry);
    if (bridge.results.length > MAX_RESULTS) {
      bridge.results = bridge.results.slice(bridge.results.length - MAX_RESULTS);
    }
  }

  /* ---------- apply ---------- */

  /* 保存のあとで初めて意味を持つ処理。mutate の中では呼ばない。 */
  function hooksFor(type, args, result) {
    var hooks = [];
    if (type === 'settings.appearance') {
      if (args.theme) hooks.push({ theme: args.theme });
      if (args.lang) hooks.push({ lang: args.lang });
    }
    /* undo は「戻した内容」の theme / lang を追随させる。 */
    var steps = type === 'undo' && result && Array.isArray(result.appliedSteps) ? result.appliedSteps : [];
    steps.forEach(function (step) {
      if (step.op !== 'set') return;
      if (step.path === 'settings.theme') hooks.push({ theme: step.value });
      if (step.path === 'settings.lang') hooks.push({ lang: step.value });
    });
    return hooks;
  }

  function runHooks(hooks) {
    hooks.forEach(function (hook) {
      if (hook.theme && BB.theme) BB.theme.apply(hook.theme);
      if (hook.lang && BB.i18n && BB.i18n.setLang) BB.i18n.setLang(hook.lang);
    });
  }

  /* 1 件を、保存直前の最新状態に対して適用する。
     mutate の中から BB.store.update や BB.dash.setDeadlineDetail を呼ばない
     （保存が二重になる）。state を直接書く。 */
  function applyOp(op, source) {
    var outcome = {
      applied: false,
      pending: false,
      duplicate: false,
      reason: '',
      ids: [],
      summaryJa: '',
      warning: '',
      undoable: false,
      opId: typeof op.opId === 'string' ? op.opId : ''
    };
    var type = typeof op.type === 'string' ? op.type : '';
    var args = op.args && typeof op.args === 'object' ? op.args : {};
    var hooks = [];

    BB.store.applyExternal(function (state) {
      var bridge = bridgeOf(state);

      /* 同じ opId は二重に適用しない。ファイルを消せなかったときの保険でもある。 */
      if (hasOp(bridge.results, outcome.opId) || hasOp(bridge.pending, outcome.opId)) {
        outcome.duplicate = true;
        return;
      }

      touchImport(bridge);

      /* 学生情報・学期・リセット・読み込みは、type に関係なく触らせない。 */
      if (hasForbidden(args)) {
        outcome.reason = 'not_allowed';
        pushResult(bridge, resultEntry(outcome.opId, type, 'rejected', 'not_allowed', SUMMARY.not_allowed, []));
        return;
      }

      var spec = OPS[type];
      if (!spec) {
        outcome.reason = 'not_supported';
        pushResult(bridge, resultEntry(outcome.opId, type, 'rejected', 'not_supported', SUMMARY.not_supported, []));
        return;
      }

      /* 操作ファイルは「どの学期向けに作られたか」を持つ。学期が変わっていたら入れない。 */
      if (!op.basis || op.basis.termId !== state.term.id) {
        outcome.reason = 'term_changed';
        pushResult(bridge, resultEntry(outcome.opId, type, 'rejected', 'term_changed', SUMMARY.term_changed, []));
        return;
      }

      /* 承認待ちの種別は適用せず、検査だけ通して pending に積む。 */
      if (spec.policy === 'approval') {
        var pendingVerdict = spec.validate(state, args);
        if (pendingVerdict.reason) {
          outcome.reason = pendingVerdict.reason;
          var pendingRejected = resultEntry(
            outcome.opId,
            type,
            'rejected',
            pendingVerdict.reason,
            pendingVerdict.summaryJa,
            []
          );
          if (pendingVerdict.current) pendingRejected.current = pendingVerdict.current;
          pushResult(bridge, pendingRejected);
          return;
        }
        var pendingItem = {
          opId: outcome.opId,
          type: type,
          args: clone(args),
          summaryJa: pendingVerdict.summaryJa || '',
          preview: previewOf(state, spec, args),
          receivedAt: new Date().toISOString()
        };
        /* どこから来た候補かは、eBwise のときだけ書く（既存の形は変えない）。 */
        if (source) pendingItem.source = source;
        bridge.pending.push(pendingItem);
        if (source === 'ebwise' && typeof args.ebwiseId === 'string' && args.ebwiseId) {
          suggestedOf(state)[args.ebwiseId] = {
            status: 'pending',
            opId: outcome.opId,
            dueDate: typeof args.date === 'string' ? args.date : '',
            dueTime: typeof args.time === 'string' ? args.time : '',
            at: new Date().toISOString()
          };
        }
        pushResult(
          bridge,
          resultEntry(outcome.opId, type, 'pending_approval', '', pendingVerdict.summaryJa, [])
        );
        outcome.reason = 'pending_approval';
        outcome.pending = true;
        return;
      }

      var verdict = spec.validate(state, args);
      if (verdict.reason) {
        outcome.reason = verdict.reason;
        var rejected = resultEntry(outcome.opId, type, 'rejected', verdict.reason, verdict.summaryJa, []);
        if (verdict.current) rejected.current = verdict.current;
        pushResult(bridge, rejected);
        return;
      }

      var result = spec.apply(state, args);
      var entry = resultEntry(outcome.opId, type, 'applied', '', result.summaryJa, result.after.ids);
      if (result.warning) entry.warning = result.warning;
      entry.undo = result.undo || null;
      pushResult(bridge, entry);

      outcome.applied = true;
      outcome.ids = result.after.ids;
      outcome.summaryJa = result.summaryJa;
      outcome.warning = result.warning || '';
      outcome.undoable = !!result.undo;
      hooks = hooksFor(type, args, result);
    });

    if (outcome.applied) runHooks(hooks);
    /* 反映・承認待ち・却下のどれでも、結果をスナップショットに出す。 */
    if (outcome.applied || outcome.pending || outcome.reason) scheduleSnapshot();
    return outcome;
  }

  /* eBwise の候補を承認待ちに積む。inbox のファイルとは別経路で、
     'ebwise.' で始まる type だけを受け付ける。自動では反映しない。 */
  function submitInternal(op) {
    if (isPaused()) return { skipped: 'paused' };
    var type = op && typeof op.type === 'string' ? op.type : '';
    if (type.indexOf('ebwise.') !== 0) return { skipped: 'not_allowed' };
    return applyOp(op, 'ebwise');
  }

  /* 読めなかったファイルの記録。opId が分からないものは null で残す。 */
  function recordRejection(opId, type, reason) {
    BB.store.applyExternal(function (state) {
      var bridge = bridgeOf(state);
      if (hasOp(bridge.results, opId) || hasOp(bridge.pending, opId)) return;
      touchImport(bridge);
      pushResult(bridge, resultEntry(opId, type, 'rejected', reason, SUMMARY[reason] || '', []));
    });
    scheduleSnapshot();
  }

  function alreadyHandled(opId) {
    var bridge = BB.store.get().aiBridge;
    if (!bridge) return false;
    return hasOp(bridge.results || [], opId) || hasOp(bridge.pending || [], opId);
  }

  /* ---------- toast ---------- */

  function toastPrefix() {
    return BB.i18n ? BB.i18n.t('bridge.toast.prefix') : '';
  }

  function notifyApplied(outcome) {
    if (!BB.ui || typeof BB.ui.toast !== 'function') return;
    var message = toastPrefix() + outcome.summaryJa;
    if (outcome.undoable && outcome.opId) {
      BB.ui.toast(message, {
        actionLabel: BB.i18n ? BB.i18n.t('bridge.toast.undo') : 'Undo',
        onAction: function () {
          undoNow(outcome.opId);
        }
      });
      return;
    }
    BB.ui.toast(message);
  }

  /* 承認待ちが積まれたことを知らせる。反映はまだしていない。 */
  function notifyPending() {
    if (!BB.ui || typeof BB.ui.toast !== 'function') return;
    BB.ui.toast(toastPrefix() + (BB.i18n ? BB.i18n.t('ai.pending.toast') : ''));
  }

  /* トーストの「元に戻す」から呼ぶ。undo と同じ処理をその場で流す。 */
  function undoNow(targetOpId) {
    var state = BB.store.get();
    var outcome = applyOp({
      schema: OP_SCHEMA,
      opId: 'undo:' + targetOpId,
      type: 'undo',
      basis: { termId: state.term.id },
      args: { targetOpId: targetOpId }
    });
    if (outcome.applied) {
      notifyApplied(outcome);
      return outcome;
    }
    if (outcome.reason && BB.ui && typeof BB.ui.toast === 'function') {
      BB.ui.toast(toastPrefix() + (SUMMARY[outcome.reason] || outcome.reason));
    }
    return outcome;
  }

  /* ---------- approval ---------- */

  function pendingIndexOf(bridge, opId) {
    for (var i = 0; i < bridge.pending.length; i++) {
      if (bridge.pending[i] && bridge.pending[i].opId === opId) return i;
    }
    return -1;
  }

  /* 承認待ちを 1 件、その時点の最新状態で検査し直してから反映する。
     画面の値が変わっていれば validate が conflict を返し、何も変えない。 */
  function approve(opId) {
    var outcome = { applied: false, reason: '', summaryJa: '', ids: [], undoable: false };
    var hooks = [];
    var current = BB.store.get().aiBridge;
    if (!current || pendingIndexOf(current, opId) < 0) {
      outcome.reason = 'not_found';
      return outcome;
    }

    BB.store.applyExternal(function (state) {
      var bridge = bridgeOf(state);
      var index = pendingIndexOf(bridge, opId);
      if (index < 0) {
        outcome.reason = 'not_found';
        return;
      }
      var item = bridge.pending[index];
      var spec = OPS[item.type];
      if (!spec) {
        bridge.pending.splice(index, 1);
        pushResult(bridge, resultEntry(item.opId, item.type, 'rejected', 'not_supported', SUMMARY.not_supported, []));
        outcome.reason = 'not_supported';
        return;
      }

      var verdict = spec.validate(state, item.args);
      if (verdict.reason) {
        bridge.pending.splice(index, 1);
        var rejected = resultEntry(item.opId, item.type, 'rejected', verdict.reason, verdict.summaryJa, []);
        if (verdict.current) rejected.current = verdict.current;
        pushResult(bridge, rejected);
        outcome.reason = verdict.reason;
        return;
      }

      var result = spec.apply(state, item.args);
      bridge.pending.splice(index, 1);
      var entry = resultEntry(item.opId, item.type, 'applied', '', result.summaryJa, result.after.ids);
      if (result.warning) entry.warning = result.warning;
      if (result.clamped) entry.clamped = result.clamped;
      entry.undo = result.undo || null;
      pushResult(bridge, entry);

      outcome.applied = true;
      outcome.summaryJa = result.summaryJa;
      outcome.ids = result.after.ids;
      outcome.undoable = !!result.undo;
      hooks = hooksFor(item.type, item.args, result);
    });

    if (outcome.applied) runHooks(hooks);
    scheduleSnapshot();
    return outcome;
  }

  function reject(opId) {
    var current = BB.store.get().aiBridge;
    if (!current || pendingIndexOf(current, opId) < 0) return false;
    BB.store.applyExternal(function (state) {
      var bridge = bridgeOf(state);
      var index = pendingIndexOf(bridge, opId);
      if (index < 0) return;
      var item = bridge.pending[index];
      bridge.pending.splice(index, 1);
      pushResult(
        bridge,
        resultEntry(item.opId, item.type, 'rejected', 'rejected_by_user', SUMMARY.rejected_by_user, [])
      );
      /* 却下した eBwise の候補は、もう一度出さない。 */
      if (String(item.type).indexOf('ebwise.') === 0 && item.args && item.args.ebwiseId) {
        var dismissed = suggestedOf(state)[item.args.ebwiseId];
        if (dismissed && typeof dismissed === 'object') {
          dismissed.status = 'dismissed';
          dismissed.at = new Date().toISOString();
        } else {
          suggestedOf(state)[item.args.ebwiseId] = {
            status: 'dismissed',
            dueDate: typeof item.args.date === 'string' ? item.args.date : '',
            dueTime: typeof item.args.time === 'string' ? item.args.time : '',
            at: new Date().toISOString()
          };
        }
      }
    });
    scheduleSnapshot();
    return true;
  }

  /* 14 日を過ぎた承認待ちを外す。何も無ければ保存しない。 */
  function expire() {
    var bridge = BB.store.get().aiBridge;
    if (!bridge || !Array.isArray(bridge.pending) || !bridge.pending.length) return false;
    var now = Date.now();
    var stale = bridge.pending.some(function (item) {
      var at = Date.parse(item && item.receivedAt ? item.receivedAt : '');
      return isFinite(at) && now - at > EXPIRE_MS;
    });
    if (!stale) return false;

    BB.store.applyExternal(function (state) {
      var target = bridgeOf(state);
      var keep = [];
      target.pending.forEach(function (item) {
        var at = Date.parse(item && item.receivedAt ? item.receivedAt : '');
        if (isFinite(at) && now - at > EXPIRE_MS) {
          pushResult(target, resultEntry(item.opId, item.type, 'rejected', 'expired', SUMMARY.expired, []));
          /* 取り下げた eBwise の候補は記録ごと消す。次の feed でまた候補になる。 */
          if (String(item.type).indexOf('ebwise.') === 0 && item.args && item.args.ebwiseId) {
            delete suggestedOf(state)[item.args.ebwiseId];
          }
          return;
        }
        keep.push(item);
      });
      target.pending = keep;
    });
    scheduleSnapshot();
    return true;
  }

  function isPaused() {
    var bridge = BB.store.get().aiBridge;
    return !!(bridge && bridge.paused);
  }

  function setPaused(value) {
    BB.store.applyExternal(function (state) {
      bridgeOf(state).paused = !!value;
    });
    scheduleSnapshot();
  }

  function pendingList() {
    var bridge = BB.store.get().aiBridge;
    return bridge && Array.isArray(bridge.pending) ? bridge.pending : [];
  }

  /* ---------- inbox ---------- */

  var rootHandle = null;
  var inboxHandle = null;
  var observer = null;

  /* 許可が 'granted' のときだけ inbox を返す。requestPermission は自動で呼ばない
     （ユーザー操作の無いところでプロンプトを出さないため）。 */
  function openInbox(dir) {
    return dir.queryPermission({ mode: 'readwrite' }).then(function (permission) {
      if (permission !== 'granted') return null;
      return dir.getDirectoryHandle(INBOX_DIR, { create: true }).then(function (inbox) {
        rootHandle = dir;
        inboxHandle = inbox;
        return inbox;
      });
    });
  }

  function resolveInbox() {
    return BB.snapshot
      .readDirHandle()
      .then(function (dir) {
        if (!dir) return null;
        if (!rootHandle || !inboxHandle) return openInbox(dir);
        /* 設定でフォルダを選び直したら、古い inbox ではなく新しいほうを見る。 */
        return rootHandle
          .isSameEntry(dir)
          .then(function (same) {
            return same ? inboxHandle : openInbox(dir);
          })
          .catch(function () {
            return openInbox(dir);
          });
      })
      .catch(function () {
        rootHandle = null;
        inboxHandle = null;
        return null;
      });
  }

  /* inbox 直下の .json だけを、作成時刻の古い順に返す。.tmp は拡張子が違うので自然に外れる。
     FileSystemHandle に作成時刻は無いので、getFile() の lastModified を使う。
     タブを閉じている間に溜まった分も、置かれた順に近い順で当てる。 */
  function listFiles(inbox) {
    var entries = [];
    var iterator = inbox.entries()[Symbol.asyncIterator]();

    function step() {
      return iterator.next().then(function (result) {
        if (result.done) {
          entries.sort(function (a, b) {
            if (a.lastModified !== b.lastModified) return a.lastModified - b.lastModified;
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
          });
          return entries;
        }
        var name = result.value[0];
        var handle = result.value[1];
        if (!handle || handle.kind !== 'file' || !/\.json$/i.test(name)) return step();
        return handle.getFile().then(
          function (file) {
            entries.push({ name: name, file: file, lastModified: file.lastModified || 0 });
            return step();
          },
          function () {
            /* 読めないファイルは、この段では黙って飛ばす（次の走査で拾える）。 */
            return step();
          }
        );
      });
    }

    return step();
  }

  function drop(inbox, name) {
    return inbox.removeEntry(name).catch(function () {
      /* 消せなくても opId の記録で二重適用は起きない。 */
      return null;
    });
  }

  /* 1 件処理したら true。二重適用で何もしなかったら false。 */
  function handleFile(inbox, entry) {
    var file = entry.file;
    if (file.size > MAX_BYTES) {
      recordRejection(null, null, 'too_large');
      return drop(inbox, entry.name).then(function () {
        return true;
      });
    }

    return file.text().then(function (raw) {
      var op = null;
      try {
        op = JSON.parse(raw);
      } catch (e) {
        op = null;
      }

      if (!op || typeof op !== 'object' || Array.isArray(op)) {
        recordRejection(null, null, 'invalid_json');
        return drop(inbox, entry.name).then(function () {
          return true;
        });
      }

      var opId = typeof op.opId === 'string' ? op.opId : '';
      var type = typeof op.type === 'string' ? op.type : '';

      if (op.schema !== OP_SCHEMA) {
        recordRejection(opId, type, 'bad_schema');
        return drop(inbox, entry.name).then(function () {
          return true;
        });
      }

      /* eBwise の候補はアプリの中から積む。inbox のファイルからは入れない。 */
      if (type.indexOf('ebwise.') === 0) {
        recordRejection(opId, type, 'not_allowed');
        return drop(inbox, entry.name).then(function () {
          return true;
        });
      }

      /* 作成から 7 日を過ぎたものは、今のデータに当てない。 */
      if (entry.lastModified && Date.now() - entry.lastModified > STALE_MS) {
        recordRejection(opId, type, 'stale');
        return drop(inbox, entry.name).then(function () {
          return true;
        });
      }

      /* 取り込み済みなら何もしない。ファイルを消せなかったときの再読込を止める。 */
      if (opId && alreadyHandled(opId)) {
        return drop(inbox, entry.name).then(function () {
          return false;
        });
      }

      var outcome = applyOp(op);
      if (outcome.applied) notifyApplied(outcome);
      else if (outcome.pending) notifyPending();
      return drop(inbox, entry.name).then(function () {
        return !outcome.duplicate;
      });
    });
  }

  function processAll(inbox, entries) {
    var handled = 0;
    return entries
      .reduce(function (chain, entry) {
        return chain.then(function () {
          return handleFile(inbox, entry).then(
            function (did) {
              if (did) handled += 1;
            },
            function () {
              /* 読めない・消せないは静かに諦める。画面の編集は壊さない。 */
            }
          );
        });
      }, Promise.resolve())
      .then(function () {
        return handled;
      });
  }

  /* ---------- watching ---------- */

  var active = false;
  var scanning = false;
  var rescan = false;
  var timer = null;
  var statusTimer = null;

  function interval() {
    return global.document && global.document.visibilityState === 'hidden' ? POLL_HIDDEN : POLL_VISIBLE;
  }

  function scan() {
    /* 古い承認待ちは、フォルダの許可が無くても片付ける。 */
    expire();
    /* 一時停止中は inbox を読まない。置かれたファイルはそのまま残す。 */
    if (isPaused()) return Promise.resolve(null);
    return resolveInbox()
      .then(function (inbox) {
        if (!inbox) return null;
        watchInbox(inbox);
        return listFiles(inbox).then(function (entries) {
          return processAll(inbox, entries);
        });
      })
      .then(function (handled) {
        /* 1 件でも処理したら、結果がスナップショットに出るように書き出しを予約する。 */
        if (handled) scheduleSnapshot();
        return handled;
      })
      .catch(function () {
        return null;
      });
  }

  function schedule(delay) {
    if (!active) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      run();
    }, delay === undefined ? interval() : delay);
  }

  function run() {
    if (!active) return;
    if (scanning) {
      rescan = true;
      return;
    }
    scanning = true;
    scan().then(function () {
      scanning = false;
      if (rescan) {
        rescan = false;
        run();
        return;
      }
      schedule();
    });
  }

  /* FileSystemObserver があれば変更をそのまま受け取る。無ければポーリングだけ。 */
  function watchInbox(inbox) {
    if (observer || typeof global.FileSystemObserver !== 'function') return;
    try {
      observer = new global.FileSystemObserver(function () {
        schedule(0);
      });
      var started = observer.observe(inbox);
      if (started && typeof started.catch === 'function') {
        started.catch(function () {
          observer = null;
        });
      }
    } catch (e) {
      observer = null;
    }
  }

  /* ---------- bridge-status.json ---------- */

  function cacheName() {
    if (!global.caches || typeof global.caches.keys !== 'function') return Promise.resolve(null);
    return global.caches
      .keys()
      .then(function (keys) {
        for (var i = 0; i < keys.length; i++) {
          if (/^mmu-beeboard-v\d+$/.test(keys[i])) return keys[i];
        }
        return null;
      })
      .catch(function () {
        return null;
      });
  }

  function writeJson(dir, name, value) {
    return dir.getFileHandle(name, { create: true }).then(function (handle) {
      return handle.createWritable().then(function (writable) {
        return writable
          .write(JSON.stringify(value, null, 2))
          .then(function () {
            return writable.close();
          });
      });
    });
  }

  /* ロックを持つタブだけが書く。許可が無ければ何も書かない。
     フォルダの解決を待たずに呼ばれることがあるので、ここでも解決してから書く。
     ハートビートのついでに、保存内容が最後の書き出しより新しければ書き出す。 */
  function writeStatus() {
    if (!active) return Promise.resolve(null);
    return flushSnapshot()
      .then(function () {
        return resolveInbox();
      })
      .then(function () {
        if (!rootHandle) return null;
        return rootHandle.queryPermission({ mode: 'readwrite' }).then(function (permission) {
          if (permission !== 'granted') return null;
          return cacheName().then(function (cache) {
            var bridge = BB.store.get().aiBridge || {};
            var snap = snapshotStatus();
            return writeJson(rootHandle, STATUS_FILE, {
              schema: 1,
              heartbeatAt: new Date().toISOString(),
              visible: !global.document || global.document.visibilityState !== 'hidden',
              holder: true,
              permission: permission,
              pending: Array.isArray(bridge.pending) ? bridge.pending.length : 0,
              cache: cache,
              /* スナップショットが黙って古いままにならないよう、成否をここに残す。 */
              snapshotWrittenAt: snap.writtenAt || null,
              snapshotError: snap.error || ''
            });
          });
        });
      })
      .catch(function () {
        return null;
      });
  }

  function snapshotStatus() {
    if (BB.snapshot && typeof BB.snapshot.status === 'function') return BB.snapshot.status();
    return { writtenAt: null, error: '', errorDetail: '', dirty: false };
  }

  /* 保存内容が最後の書き出しより新しければ、待たずに書く。 */
  function flushSnapshot() {
    if (BB.snapshot && typeof BB.snapshot.flush === 'function') return BB.snapshot.flush();
    return Promise.resolve(null);
  }

  /* ---------- status / dry run ---------- */

  /* フォルダの許可・ロック・最後の取り込み・承認待ち件数。設定画面と点検用。
     フォルダを読むので Promise を返す。 */
  function status() {
    var bridge = BB.store.get().aiBridge || {};
    var info = {
      folder: false,
      permission: 'unknown',
      holder: !!active,
      paused: !!bridge.paused,
      pending: Array.isArray(bridge.pending) ? bridge.pending.length : 0,
      lastImportAt: bridge.lastImportAt || '',
      statusFile: null,
      snapshot: snapshotStatus()
    };
    return BB.snapshot
      .readDirHandle()
      .then(function (dir) {
        if (!dir) return info;
        info.folder = true;
        return dir
          .queryPermission({ mode: 'readwrite' })
          .then(function (permission) {
            info.permission = permission;
            if (permission !== 'granted') return info;
            return readStatusFile(dir).then(function (file) {
              info.statusFile = file;
              return info;
            });
          })
          .catch(function () {
            return info;
          });
      })
      .catch(function () {
        return info;
      });
  }

  /* ブリッジが最後に書いた bridge-status.json。無ければ null。 */
  function readStatusFile(dir) {
    return dir
      .getFileHandle(STATUS_FILE)
      .then(function (handle) {
        return handle.getFile();
      })
      .then(function (file) {
        return file.text();
      })
      .then(function (raw) {
        try {
          var value = JSON.parse(raw);
          return value && typeof value === 'object' ? value : null;
        } catch (e) {
          return null;
        }
      })
      .catch(function () {
        return null;
      });
  }

  /* 検査だけして、反映したらどうなるかを返す。保存は一切しない。
     手元の点検や、操作ファイルを書く前の下見に使う。 */
  function dryRun(op) {
    var state = BB.store.get();
    var type = op && typeof op.type === 'string' ? op.type : '';
    var args = op && op.args && typeof op.args === 'object' ? op.args : {};
    var opId = op && typeof op.opId === 'string' ? op.opId : '';
    var out = {
      ok: false,
      status: 'rejected',
      reason: '',
      summaryJa: '',
      policy: '',
      warning: '',
      ids: [],
      preview: { rows: [] }
    };

    var bridge = state.aiBridge || { results: [], pending: [] };
    if (opId && (hasOp(bridge.results || [], opId) || hasOp(bridge.pending || [], opId))) {
      out.reason = 'duplicate';
      out.summaryJa = SUMMARY.duplicate;
      return out;
    }
    if (hasForbidden(args)) {
      out.reason = 'not_allowed';
      out.summaryJa = SUMMARY.not_allowed;
      return out;
    }
    var spec = OPS[type];
    if (!spec) {
      out.reason = 'not_supported';
      out.summaryJa = SUMMARY.not_supported;
      return out;
    }
    if (!op.basis || op.basis.termId !== state.term.id) {
      out.reason = 'term_changed';
      out.summaryJa = SUMMARY.term_changed;
      return out;
    }

    out.policy = spec.policy;
    var verdict = spec.validate(state, args);
    if (verdict.reason) {
      out.reason = verdict.reason;
      out.summaryJa = verdict.summaryJa;
      if (verdict.current) out.current = verdict.current;
      return out;
    }

    /* 複製に apply を流して、変更後の id と差分を得る。本物の state には触らない。 */
    var result = null;
    try {
      result = spec.apply(clone(state), args);
    } catch (e) {
      out.reason = 'invalid_args';
      out.summaryJa = SUMMARY.invalid_args;
      return out;
    }

    out.ok = true;
    out.status = spec.policy === 'approval' ? 'pending_approval' : 'applied';
    out.summaryJa = (result && result.summaryJa) || verdict.summaryJa || '';
    out.warning = (result && result.warning) || '';
    out.ids = result && result.after && Array.isArray(result.after.ids) ? result.after.ids : [];
    out.preview = previewOf(state, spec, args);
    return out;
  }

  /* ---------- lock ---------- */

  function start() {
    if (!global.navigator || !global.navigator.locks || typeof global.navigator.locks.request !== 'function') return;
    if (typeof global.showDirectoryPicker !== 'function') return;

    global.navigator.locks
      .request(LOCK_NAME, function () {
        active = true;
        run();
        writeStatus();
        statusTimer = setInterval(writeStatus, STATUS_INTERVAL);
        /* ロックはタブを閉じるまで離さない。閉じればブラウザが外し、待っていたタブが引き継ぐ。 */
        return new Promise(function () {});
      })
      .catch(function () {
        /* ロックが取れなくても、画面の編集はそのまま使える。 */
      });
  }

  if (global.document && global.document.addEventListener) {
    global.document.addEventListener('visibilitychange', function () {
      schedule(0);
      /* 前面に戻ったら、溜まっていた書き出しをここで追いつかせる。 */
      flushSnapshot();
      writeStatus();
    });
    global.addEventListener('focus', function () {
      schedule(0);
      flushSnapshot();
    });
  }

  BB.bridge = {
    /* 手で 1 回だけ見たいとき用（ロックの有無に関係なく inbox を読む）。 */
    scan: scan,
    /* 許可・ロック・最後の取り込み・承認待ち件数。 */
    status: status,
    /* 検査だけして、反映したらどうなるかを返す。保存はしない。 */
    dryRun: dryRun,
    /* bridge-status.json を今すぐ書く。 */
    writeStatus: writeStatus,
    /* 受け付ける type の一覧。設定画面や将来の承認 UI から参照できる。 */
    types: Object.keys(OPS),
    undo: undoNow,
    /* 承認まわり。ダッシュボードと設定画面が使う。 */
    pending: pendingList,
    approve: approve,
    reject: reject,
    expire: expire,
    paused: isPaused,
    setPaused: setPaused,
    /* eBwise の候補を承認待ちに積む。inbox のファイルからは呼べない。 */
    submitInternal: submitInternal
  };

  /* 古い承認待ちは、フォルダの許可が無くても起動時に片付ける。 */
  expire();
  start();
})(window);
