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
   同じフォルダの bridge-status.json に、ロックを持つタブが 20 秒ごとに生存を書く。 */
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
    not_undoable: 'この操作は取り消せません'
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

  function ok(warning) {
    return { reason: '', summaryJa: '', warning: warning || '' };
  }

  function bad(reason) {
    return { reason: reason, summaryJa: SUMMARY[reason] || '' };
  }

  function conflict(current) {
    return { reason: 'conflict', summaryJa: SUMMARY.conflict, current: current };
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
      if (step.path === 'settings.theme') return state.settings ? state.settings.theme : undefined;
      if (step.path === 'settings.lang') {
        return BB.i18n && BB.i18n.lang ? BB.i18n.lang() : state.settings ? state.settings.lang : undefined;
      }
      return undefined;
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
      current[step.path + (step.id ? ':' + step.id : step.key ? ':' + step.key : '')] = now;
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
      if (step.path === 'settings.theme') {
        state.settings = state.settings || {};
        state.settings.theme = step.value;
      }
      /* settings.lang は mutate の外で BB.i18n.setLang に通す。 */
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

  var OPS = {
    'note.add': { policy: 'auto', validate: validateNoteAdd, apply: applyNoteAdd },
    'note.update': { policy: 'auto', validate: validateNoteUpdate, apply: applyNoteUpdate },
    'note.setDone': { policy: 'auto', validate: validateNoteSetDone, apply: applyNoteSetDone },
    'event.save': { policy: 'auto', validate: validateEventSave, apply: applyEventSave },
    'study.add': { policy: 'auto', validate: validateStudyAdd, apply: applyStudyAdd },
    'deadline.save': { policy: 'auto', validate: validateDeadlineSave, apply: applyDeadlineSave },
    'deadlineDetail.set': { policy: 'auto', validate: validateDeadlineDetailSet, apply: applyDeadlineDetailSet },
    'settings.appearance': { policy: 'auto', validate: validateAppearance, apply: applyAppearance },
    undo: { policy: 'auto', validate: validateUndo, apply: applyUndo }
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
  function applyOp(op) {
    var outcome = {
      applied: false,
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

      /* 承認待ちの種別は適用せず、pending に積んで人に委ねる。 */
      if (spec.policy === 'approval') {
        bridge.pending.push({ opId: outcome.opId, type: type, args: clone(args), at: new Date().toISOString() });
        outcome.reason = 'pending_approval';
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
    return outcome;
  }

  /* 読めなかったファイルの記録。opId が分からないものは null で残す。 */
  function recordRejection(opId, type, reason) {
    BB.store.applyExternal(function (state) {
      var bridge = bridgeOf(state);
      if (hasOp(bridge.results, opId) || hasOp(bridge.pending, opId)) return;
      pushResult(bridge, resultEntry(opId, type, 'rejected', reason, SUMMARY[reason] || '', []));
    });
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
      return;
    }
    if (outcome.reason && BB.ui && typeof BB.ui.toast === 'function') {
      BB.ui.toast(toastPrefix() + (SUMMARY[outcome.reason] || outcome.reason));
    }
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

  /* inbox 直下の .json だけを名前順に返す。.tmp は拡張子が違うので自然に外れる。 */
  function listFiles(inbox) {
    var names = [];
    var iterator = inbox.entries()[Symbol.asyncIterator]();

    function step() {
      return iterator.next().then(function (result) {
        if (result.done) return names.sort();
        var name = result.value[0];
        var handle = result.value[1];
        if (handle && handle.kind === 'file' && /\.json$/i.test(name)) names.push(name);
        return step();
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

  function handleFile(inbox, name) {
    return inbox
      .getFileHandle(name)
      .then(function (handle) {
        return handle.getFile();
      })
      .then(function (file) {
        if (file.size > MAX_BYTES) {
          recordRejection(null, null, 'too_large');
          return drop(inbox, name);
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
            return drop(inbox, name);
          }

          var opId = typeof op.opId === 'string' ? op.opId : '';
          var type = typeof op.type === 'string' ? op.type : '';

          if (op.schema !== OP_SCHEMA) {
            recordRejection(opId, type, 'bad_schema');
            return drop(inbox, name);
          }

          /* 取り込み済みなら何もしない。ファイルを消せなかったときの再読込を止める。 */
          if (opId && alreadyHandled(opId)) return drop(inbox, name);

          var outcome = applyOp(op);
          if (outcome.applied) notifyApplied(outcome);
          return drop(inbox, name);
        });
      })
      .catch(function () {
        /* 読めない・消せないは静かに諦める。画面の編集は壊さない。 */
        return null;
      });
  }

  function processAll(inbox, names) {
    return names.reduce(function (chain, name) {
      return chain.then(function () {
        return handleFile(inbox, name);
      });
    }, Promise.resolve());
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
    return resolveInbox()
      .then(function (inbox) {
        if (!inbox) return null;
        watchInbox(inbox);
        return listFiles(inbox).then(function (names) {
          return processAll(inbox, names);
        });
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
     フォルダの解決を待たずに呼ばれることがあるので、ここでも解決してから書く。 */
  function writeStatus() {
    if (!active) return Promise.resolve(null);
    return resolveInbox()
      .then(function () {
        if (!rootHandle) return null;
        return rootHandle.queryPermission({ mode: 'readwrite' }).then(function (permission) {
          if (permission !== 'granted') return null;
          return cacheName().then(function (cache) {
            var bridge = BB.store.get().aiBridge || {};
            return writeJson(rootHandle, STATUS_FILE, {
              schema: 1,
              heartbeatAt: new Date().toISOString(),
              visible: !global.document || global.document.visibilityState !== 'hidden',
              holder: true,
              permission: permission,
              pending: Array.isArray(bridge.pending) ? bridge.pending.length : 0,
              cache: cache
            });
          });
        });
      })
      .catch(function () {
        return null;
      });
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
      writeStatus();
    });
    global.addEventListener('focus', function () {
      schedule(0);
    });
  }

  BB.bridge = {
    /* 手で 1 回だけ見たいとき用（ロックの有無に関係なく inbox を読む）。 */
    scan: scan,
    status: writeStatus,
    /* 受け付ける type の一覧。設定画面や将来の承認 UI から参照できる。 */
    types: Object.keys(OPS),
    undo: undoNow
  };

  start();
})(window);
