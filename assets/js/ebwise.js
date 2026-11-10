/* MMU BeeBoard — eBwise feed reader.
   ローカルAIが置いた ebwise-feed.json を読み、科目と資料・締切を対応づける。
   形式は docs/ebwise-feed.md。

   前半の core は純粋な関数だけで、DOM にも保存にも触らない（node のテストで読める）。
   後半の読み込みは、window と document があるページでだけ動く。読んだ feed は
   このファイルの変数にだけ置き、localStorage・sessionStorage・IndexedDB には書かない。
   フォルダのピッカーも requestPermission も自動では出さない（許可済みのときだけ読む）。
   文字列は信用しない前提で、リンクは safeUrl を通したものだけを href にしてよい。 */
(function (global) {
  'use strict';

  var BB = global.BB || (global.BB = {});

  var SCHEMA = 'ebwise-feed/1';
  /* 1 MB を超えるファイルは読まない。 */
  var MAX_BYTES = 1024 * 1024;
  var MAX_MATERIALS = 300;
  var MAX_DEADLINES = 200;
  /* 学期の週数が読めないときの既定値。store.js の学期と同じ。 */
  var DEFAULT_WEEKS = 14;
  /* JSON から来たキーをそのまま object のキーにしない。 */
  var UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];

  function isText(value) {
    return typeof value === 'string' && value !== '';
  }

  function textOf(value) {
    return typeof value === 'string' ? value : '';
  }

  function isUnsafe(key) {
    return UNSAFE_KEYS.indexOf(key) >= 0;
  }

  /* 元の object を書き換えないための浅い複製。 */
  function shallow(value) {
    var copy = {};
    var keys = Object.keys(value);
    for (var i = 0; i < keys.length; i++) {
      if (isUnsafe(keys[i])) continue;
      copy[keys[i]] = value[keys[i]];
    }
    return copy;
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* ISO 文字列の時刻。読めない値は 0（＝いちばん古い）として並べる。 */
  function timeOf(iso) {
    var stamp = Date.parse(String(iso === undefined || iso === null ? '' : iso));
    return isFinite(stamp) ? stamp : 0;
  }

  function originOf(url) {
    try {
      return new URL(url).origin;
    } catch (e) {
      return '';
    }
  }

  function isHttpsOrigin(url) {
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) return false;
    return originOf(url) !== '';
  }

  /* ---------- parseFeed ---------- */

  /* 必須項目がそろっているか。欠けた項目は feed から落とし、dropped に数える。 */
  function isMaterial(item) {
    return !!item && typeof item === 'object' && isText(item.id) && isText(item.course) && isText(item.title);
  }

  function isDeadline(item) {
    return !!item && typeof item === 'object' && isText(item.id) && isText(item.course) &&
      isText(item.name) && isText(item.dueDate);
  }

  /* 壊れた項目を数えながら、上限まで残す。上限を超えた分は壊れてはいないので数えない。 */
  function keep(list, test, max) {
    var items = Array.isArray(list) ? list : [];
    var kept = [];
    var dropped = 0;
    for (var i = 0; i < items.length; i++) {
      if (!test(items[i])) {
        dropped += 1;
        continue;
      }
      if (kept.length < max) kept.push(items[i]);
    }
    return { items: kept, dropped: dropped };
  }

  function fail(reason) {
    return { ok: false, feed: null, reason: reason, dropped: 0 };
  }

  /* text は生の JSON 文字列、byteLength はファイルのバイト数。
     byteLength を渡さない呼び出しでは文字数で代用する（ASCII の JSON なら同じ）。 */
  function parseFeed(text, byteLength) {
    var size = typeof byteLength === 'number' && isFinite(byteLength)
      ? byteLength
      : typeof text === 'string' ? text.length : 0;
    if (size > MAX_BYTES) return fail('too_large');
    if (typeof text !== 'string') return fail('invalid_json');

    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return fail('invalid_json');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail('bad_schema');
    if (parsed.schema !== SCHEMA) return fail('bad_schema');
    if (!isHttpsOrigin(parsed.site)) return fail('bad_site');

    var materials = keep(parsed.materials, isMaterial, MAX_MATERIALS);
    var deadlines = keep(parsed.deadlines, isDeadline, MAX_DEADLINES);

    /* 知っている項目だけを写す。JSON の __proto__ などをそのまま持ち込まない。 */
    var feed = {
      schema: SCHEMA,
      generatedAt: textOf(parsed.generatedAt),
      site: parsed.site,
      windowDays: typeof parsed.windowDays === 'number' && isFinite(parsed.windowDays) ? parsed.windowDays : 0,
      lastSync: parsed.lastSync && typeof parsed.lastSync === 'object' ? parsed.lastSync : null,
      filesRoot: textOf(parsed.filesRoot),
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
      materials: materials.items,
      deadlines: deadlines.items
    };

    return { ok: true, feed: feed, reason: '', dropped: materials.dropped + deadlines.dropped };
  }

  /* ---------- safeUrl ---------- */

  /* https で、site と同じ origin のときだけ url を返す。それ以外と例外は ''。 */
  function safeUrl(url, site) {
    if (typeof url !== 'string' || typeof site !== 'string') return '';
    if (!/^https:\/\//i.test(url)) return '';
    var target = originOf(url);
    var base = originOf(site);
    if (!target || !base) return '';
    return target === base ? url : '';
  }

  /* ---------- mapCourses ---------- */

  function lower(value) {
    return String(value === undefined || value === null ? '' : value).toLowerCase();
  }

  /* 英数字以外で区切った語。shortname の照合に使う。 */
  function tokens(value) {
    return lower(value).split(/[^a-z0-9]+/).filter(function (part) {
      return part !== '';
    });
  }

  /* 空白と大文字小文字を無視した比較用の文字列。 */
  function squash(value) {
    return lower(value).replace(/\s+/g, '');
  }

  function subjectById(subjects, id) {
    for (var i = 0; i < subjects.length; i++) {
      if (subjects[i] && subjects[i].id === id) return subjects[i];
    }
    return null;
  }

  /* 1 科目だけ当たればその id。2 科目以上なら ambiguous。 */
  function autoMatch(subjects, course) {
    var code = lower(course.code);
    var shortTokens = tokens(course.shortname);
    var fullname = squash(course.fullname);
    var byCode = [];
    var byShortname = [];
    var byFullname = [];

    for (var i = 0; i < subjects.length; i++) {
      var subject = subjects[i];
      if (!subject || !isText(subject.id)) continue;
      var id = lower(subject.id);
      if (id === code) byCode.push(subject.id);
      if (shortTokens.indexOf(id) >= 0) byShortname.push(subject.id);
      var name = squash(subject.name);
      /* 空の名前は何にでも当たるので見ない。 */
      if (name && fullname.indexOf(name) >= 0) byFullname.push(subject.id);
    }

    var stages = [byCode, byShortname, byFullname];
    for (var s = 0; s < stages.length; s++) {
      if (stages[s].length === 1) return { id: stages[s][0], ambiguous: false };
      if (stages[s].length > 1) return { id: '', ambiguous: true };
    }
    return { id: '', ambiguous: false };
  }

  /* manual は { code: subjectId }。'' は「つながない」。
     返り値の map は { code: subjectId } で、値は必ず実在する科目の id。 */
  function mapCourses(subjects, courses, manual) {
    var list = Array.isArray(subjects) ? subjects : [];
    var feedCourses = Array.isArray(courses) ? courses : [];
    var manualMap = manual && typeof manual === 'object' ? manual : {};
    var map = {};
    var how = {};
    var unmatched = [];
    var ambiguous = [];

    for (var i = 0; i < feedCourses.length; i++) {
      var course = feedCourses[i];
      if (!course || !isText(course.code) || isUnsafe(course.code)) continue;
      var code = course.code;

      if (Object.prototype.hasOwnProperty.call(manualMap, code)) {
        var chosen = manualMap[code];
        /* '' は本人が「つながない」と決めた科目。自動の照合もしない。 */
        if (chosen === '') {
          how[code] = 'off';
          continue;
        }
        /* 消えた科目を指している手動設定は、自動の照合に戻す。 */
        if (isText(chosen) && subjectById(list, chosen)) {
          map[code] = chosen;
          how[code] = 'manual';
          continue;
        }
      }

      var found = autoMatch(list, course);
      if (found.ambiguous) {
        ambiguous.push(code);
        continue;
      }
      if (!found.id) {
        unmatched.push(code);
        continue;
      }
      map[code] = found.id;
      how[code] = 'auto';
    }

    return { map: map, how: how, unmatched: unmatched, ambiguous: ambiguous };
  }

  /* ---------- materialsFor ---------- */

  /* その科目の資料を changedAt の新しい順に返す。seenAt より新しいものに unread を付ける。
     seenAt が空なら全部 unread。feed は書き換えない。 */
  function materialsFor(feed, map, subjectId, seenAt) {
    var materials = feed && Array.isArray(feed.materials) ? feed.materials : [];
    var mapping = map && typeof map === 'object' ? map : {};
    var codes = {};
    var code;
    for (code in mapping) {
      if (!Object.prototype.hasOwnProperty.call(mapping, code)) continue;
      if (mapping[code] === subjectId) codes[code] = true;
    }

    var seen = timeOf(seenAt);
    var list = [];
    for (var i = 0; i < materials.length; i++) {
      var item = materials[i];
      if (!item || typeof item !== 'object') continue;
      if (!Object.prototype.hasOwnProperty.call(codes, item.course)) continue;
      var copy = shallow(item);
      copy.unread = timeOf(item.changedAt) > seen;
      list.push(copy);
    }

    list.sort(function (a, b) {
      return timeOf(b.changedAt) - timeOf(a.changedAt);
    });
    return list;
  }

  /* ---------- termRange ---------- */

  function dayString(date) {
    return date.getUTCFullYear() + '-' + pad2(date.getUTCMonth() + 1) + '-' + pad2(date.getUTCDate());
  }

  /* 学期の初日と末日を 'YYYY-MM-DD' で返す。末日は開始日 + (weeks + 1) * 7 - 1 日。
     開始日が読めないときは空文字（画面は「未設定」として扱う）。 */
  function termRange(term) {
    var startDate = term && typeof term.startDate === 'string' ? term.startDate : '';
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);
    if (!match) return { start: '', end: '' };

    var start = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    /* 2/31 のような日付は Date が翌月へ丸めるので、戻して一致を見る。 */
    if (dayString(start) !== startDate) return { start: '', end: '' };

    var weeks = Math.floor(Number(term.weeks));
    if (!isFinite(weeks) || weeks <= 0) weeks = DEFAULT_WEEKS;
    var end = new Date(start.getTime() + ((weeks + 1) * 7 - 1) * 86400000);
    return { start: startDate, end: dayString(end) };
  }

  /* ---------- deadlineOps ---------- */

  var OP_SCHEMA = 'beeboard-op/1';
  /* feed の kind を BeeBoard の締切の種別に寄せる。 */
  var KIND_OF = { assignment: 'assignment', quiz: 'testPrep', event: 'other' };
  /* これより古い締切は候補にしない。 */
  var OLD_MS = 7 * 86400000;

  /* 'YYYY-MM-DD' を UTC のミリ秒に。実在しない日付は null。 */
  function dayMs(iso) {
    var value = String(iso === undefined || iso === null ? '' : iso);
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    var date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (isNaN(date.getTime())) return null;
    if (dayString(date) !== value) return null;
    return date.getTime();
  }

  /* 同じ締切・同じ日時なら同じ opId。日時が変われば別の opId になる。 */
  function opIdOf(id, dueDate, dueTime) {
    return 'ebw-' + String(id).replace(/[^A-Za-z0-9]/g, '-') + '-' + dueDate + 'T' +
      String(dueTime === undefined || dueTime === null ? '' : dueTime).replace(/:/g, '');
  }

  function deadlineById(state, id) {
    var list = state && Array.isArray(state.customDeadlines) ? state.customDeadlines : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  /* feed の締切から、承認待ちに積む操作を作る。DOM にも保存にも触らない。
     自動では反映しない。呼ぶ側が 1 件ずつ承認の流れに渡す。 */
  function deadlineOps(feed, map, state, todayIso) {
    var ops = [];
    if (!feed || !Array.isArray(feed.deadlines)) return ops;
    var mapping = map && typeof map === 'object' ? map : {};
    var data = state && typeof state === 'object' ? state : {};
    var term = data.term || {};
    var range = termRange(term);
    var today = dayMs(todayIso);
    var suggested = data.ebwise && data.ebwise.suggested ? data.ebwise.suggested : {};
    var site = typeof feed.site === 'string' ? feed.site : '';

    for (var i = 0; i < feed.deadlines.length; i++) {
      var item = feed.deadlines[i];
      if (!item || typeof item !== 'object') continue;
      var id = textOf(item.id);
      var course = textOf(item.course);
      if (!id || !course) continue;
      /* 対応する科目が無いものは候補にしない。 */
      var subjectId = typeof mapping[course] === 'string' ? mapping[course] : '';
      if (!subjectId) continue;
      var dueDate = textOf(item.dueDate);
      if (!dueDate) continue;
      var dueMs = dayMs(dueDate);
      if (dueMs === null) continue;
      if (range.start && range.end && (dueDate < range.start || dueDate > range.end)) continue;
      if (today !== null && today - dueMs >= OLD_MS) continue;
      if (item.submission === 'submitted') continue;

      var record = suggested[id];
      var status = record && typeof record === 'object' ? textOf(record.status) : '';
      if (status === 'dismissed' || status === 'pending') continue;

      var dueTime = textOf(item.dueTime);
      var opId = opIdOf(id, dueDate, dueTime);
      var basis = { termId: term.id };

      if (status === 'imported') {
        /* 取り込んだ締切がまだ残っていて、日時が変わったときだけ更新する。 */
        var deadline = deadlineById(data, textOf(record.deadlineId));
        if (!deadline) continue;
        if (textOf(record.dueDate) === dueDate && textOf(record.dueTime) === dueTime) continue;
        ops.push({
          schema: OP_SCHEMA,
          opId: opId,
          type: 'ebwise.deadline.update',
          basis: basis,
          args: {
            ebwiseId: id,
            deadlineId: deadline.id,
            expect: { date: textOf(deadline.date) },
            date: dueDate,
            time: dueTime
          }
        });
        continue;
      }

      /* 知らない状態は候補にしない。記録が無いものだけ取り込む。 */
      if (status) continue;

      ops.push({
        schema: OP_SCHEMA,
        opId: opId,
        type: 'ebwise.deadline.import',
        basis: basis,
        args: {
          ebwiseId: id,
          subjectId: subjectId,
          name: textOf(item.name),
          date: dueDate,
          time: dueTime,
          kind: KIND_OF[textOf(item.kind)] || 'other',
          url: safeUrl(item.url, site),
          course: course
        }
      });
    }
    return ops;
  }

  /* ---------- ui ---------- */

  var JA_DAYS = ['日', '月', '火', '水', '木', '金', '土'];
  var EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function escHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function langCode() {
    return BB.i18n && typeof BB.i18n.lang === 'function' ? BB.i18n.lang() : 'en';
  }

  /* 辞書があれば訳す。無ければ英語の既定文（node のテストでも同じ形で動く）。 */
  function label(key, fallback) {
    if (BB.i18n && typeof BB.i18n.t === 'function') {
      var text = BB.i18n.t(key);
      if (typeof text === 'string' && text !== key) return text;
    }
    return fallback;
  }

  /* changedAt は +08:00 のまま書かれている。日付部分をそのまま読み、曜日だけ Date で出す。 */
  function dayParts(iso) {
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso === undefined || iso === null ? '' : iso));
    if (!match) return null;
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(Number(match[1]), month - 1, day));
    if (isNaN(date.getTime())) return null;
    return { month: month, day: day, weekday: date.getUTCDay() };
  }

  function dateLabel(iso) {
    var parts = dayParts(iso);
    if (!parts) return '';
    if (langCode() === 'ja') {
      return parts.month + '月' + parts.day + '日（' + JA_DAYS[parts.weekday] + '）';
    }
    return parts.day + ' ' + EN_MONTHS[parts.month - 1] + ' (' + EN_DAYS[parts.weekday] + ')';
  }

  /* 資料 1 件ぶんの行。DOM を使わないので、node でも文字列として試せる。
     opts.site は feed の site。リンクは safeUrl が通ったときだけ出す。 */
  function materialRowsHtml(items, opts) {
    var list = Array.isArray(items) ? items : [];
    var options = opts || {};
    var site = typeof options.site === 'string' ? options.site : '';

    return list
      .map(function (item) {
        if (!item || typeof item !== 'object') return '';
        var id = typeof item.id === 'string' ? item.id : '';
        var unread = !!item.unread;
        var status = item.status === 'updated'
          ? label('ebwise.material.updated', 'Updated')
          : label('ebwise.material.new', 'New');
        var badgeClass = unread ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-muted';
        var where = [item.section, item.module]
          .filter(function (part) {
            return typeof part === 'string' && part !== '';
          })
          .join(' › ');
        var when = dateLabel(item.changedAt);
        var meta = [where, when]
          .filter(function (part) {
            return part !== '';
          })
          .join(' · ');
        var url = safeUrl(item.url, site);
        var open = url
          ? '<a href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer" ' +
            'class="text-caption font-semibold text-primary hover:underline whitespace-nowrap">' +
            escHtml(label('ebwise.material.open', 'Open in eBwise')) + '</a>'
          : '';
        /* 資料フォルダをつないでいるときだけ、資料名を押して開ける。 */
        var canOpen = options.files === true && typeof item.localPath === 'string' && item.localPath !== '';
        var copy = typeof item.localPath === 'string' && item.localPath !== ''
          ? '<button type="button" data-ebwise-copy="' + escHtml(id) + '" ' +
            'class="text-caption font-semibold text-muted hover:text-primary whitespace-nowrap">' +
            escHtml(label('ebwise.material.copy', 'Copy path')) + '</button>'
          : '';

        return (
          '<div class="flex items-start gap-3 py-2.5 border-b border-border-subtle last:border-0">' +
          '<span class="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ' +
          badgeClass + '">' + escHtml(status) + '</span>' +
          '<div class="min-w-0 flex-1">' +
          '<div class="text-body-sm font-semibold text-ink break-words">' +
          (canOpen
            ? '<button type="button" data-ebwise-open="' + escHtml(id) + '" ' +
              'class="text-left hover:text-primary hover:underline">' + escHtml(item.title) + '</button>'
            : escHtml(item.title)) +
          '</div>' +
          (meta ? '<div class="text-caption text-muted break-words">' + escHtml(meta) + '</div>' : '') +
          '</div>' +
          (open || copy ? '<div class="flex items-center gap-2 shrink-0">' + open + copy + '</div>' : '') +
          '</div>'
        );
      })
      .join('');
  }

  var core = {
    parseFeed: parseFeed,
    safeUrl: safeUrl,
    mapCourses: mapCourses,
    materialsFor: materialsFor,
    termRange: termRange,
    deadlineOps: deadlineOps
  };

  BB.ebwise = {
    core: core,
    ui: { materialRowsHtml: materialRowsHtml }
  };

  /* ---------- loader ---------- */

  /* ここから下はブラウザのページでだけ動く。node（テスト）には document が無いので
     何も登録せずに終わる。BB.ebwise.core はそのまま使える。 */
  if (!global.document || typeof global.document.addEventListener !== 'function') return;

  var FEED_FILE = 'ebwise-feed.json';
  /* 表示中はこの間隔で読み直す。裏に回っている間は読まない。 */
  var POLL_MS = 60000;

  /* 読んだ feed はこの変数にだけ置く。保存はしない。 */
  var feed = null;
  var status = emptyStatus('none', '');
  var listeners = [];
  /* 前回読んだファイルの lastModified と size。同じなら中身を読み直さない。 */
  var lastStamp = '';
  /* 前回通知した内容。変わっていなければ onChange を呼ばない。 */
  var lastSignature = '';
  var reading = false;
  var again = false;
  var pending = null;
  var timer = null;
  var started = false;

  function emptyStatus(state, reason) {
    return {
      state: state,
      reason: reason || '',
      generatedAt: '',
      lastSync: null,
      counts: { courses: 0, materials: 0, deadlines: 0, dropped: 0 }
    };
  }

  function okStatus(parsed, dropped) {
    return {
      state: 'ok',
      reason: '',
      generatedAt: parsed.generatedAt,
      lastSync: parsed.lastSync,
      counts: {
        courses: parsed.courses.length,
        materials: parsed.materials.length,
        deadlines: parsed.deadlines.length,
        dropped: dropped
      }
    };
  }

  function cloneStatus(value) {
    return {
      state: value.state,
      reason: value.reason,
      generatedAt: value.generatedAt,
      lastSync: value.lastSync ? JSON.parse(JSON.stringify(value.lastSync)) : null,
      counts: {
        courses: value.counts.courses,
        materials: value.counts.materials,
        deadlines: value.counts.deadlines,
        dropped: value.counts.dropped
      }
    };
  }

  /* 1 回分の読み取り。例外は投げず、状態にして返す。 */
  function read() {
    if (!BB.snapshot || typeof BB.snapshot.readDirHandle !== 'function') {
      return Promise.resolve({ status: emptyStatus('none', ''), feed: null });
    }
    return BB.snapshot
      .readDirHandle()
      .then(function (dir) {
        if (!dir) return { status: emptyStatus('none', ''), feed: null };
        /* 許可を尋ねるだけで、ピッカーも requestPermission も出さない。 */
        return dir.queryPermission({ mode: 'readwrite' }).then(function (permission) {
          if (permission !== 'granted') return { status: emptyStatus('no_permission', ''), feed: null };
          return readFile(dir);
        });
      })
      .catch(function () {
        return { status: emptyStatus('no_permission', ''), feed: null };
      });
  }

  function readFile(dir) {
    return dir
      .getFileHandle(FEED_FILE)
      .then(function (handle) {
        return handle.getFile();
      })
      .then(function (file) {
        var stamp = file.lastModified + ':' + file.size;
        /* 同じファイルを読んでいるだけなら、中身も同じ。 */
        if (stamp === lastStamp) return null;
        lastStamp = stamp;
        return file.text().then(function (text) {
          var result = core.parseFeed(text, file.size);
          if (!result.ok) return { status: emptyStatus('invalid', result.reason), feed: null };
          return { status: okStatus(result.feed, result.dropped), feed: result.feed };
        });
      })
      .catch(function (error) {
        /* ファイルが無いのは異常ではない。次の走査で拾える。 */
        lastStamp = '';
        if (error && error.name === 'NotFoundError') {
          return { status: emptyStatus('missing', ''), feed: null };
        }
        return { status: emptyStatus('invalid', 'read_failed'), feed: null };
      });
  }

  function signatureOf(result) {
    return result.status.state + '|' + result.status.reason + '|' +
      (result.feed ? JSON.stringify(result.feed) : '');
  }

  /* 中身か状態が変わったときだけ購読者へ知らせる。 */
  function apply(result) {
    if (!result) return;
    var signature = signatureOf(result);
    if (signature === lastSignature) return;
    lastSignature = signature;
    feed = result.feed;
    status = result.status;
    submitDeadlines();
    notify();
  }

  /* 今日の日付（この PC のローカル）。締切の古さはここから測る。 */
  function todayIso() {
    var now = new Date();
    return now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
  }

  /* feed の締切を承認待ちに積む。自動では反映しない。
     新しく積まれたときだけ、inbox と同じトーストを 1 回出す。 */
  function submitDeadlines() {
    if (!feed || !BB.bridge || typeof BB.bridge.submitInternal !== 'function') return;
    if (!BB.store || typeof BB.store.get !== 'function') return;
    var data = BB.store.get();
    if (!data) return;
    var manual = data.ebwise && data.ebwise.mapping ? data.ebwise.mapping : {};
    var map = core.mapCourses(data.subjects || [], feed.courses || [], manual).map;
    var ops = core.deadlineOps(feed, map, data, todayIso());
    var added = 0;
    ops.forEach(function (op) {
      var outcome = BB.bridge.submitInternal(op);
      if (outcome && outcome.pending) added += 1;
    });
    if (!added) return;
    if (!BB.ui || typeof BB.ui.toast !== 'function') return;
    var prefix = BB.i18n && typeof BB.i18n.t === 'function' ? BB.i18n.t('bridge.toast.prefix') : '';
    var message = BB.i18n && typeof BB.i18n.t === 'function' ? BB.i18n.t('ai.pending.toast') : '';
    BB.ui.toast(prefix + message);
  }

  function notify() {
    listeners.slice().forEach(function (listener) {
      try {
        listener();
      } catch (e) {
        /* 1 つの購読者が落ちても他は動かす */
      }
    });
  }

  function visible() {
    return !global.document || global.document.visibilityState !== 'hidden';
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = null;
    /* 裏に回っている間は読まない。戻ったときに visibilitychange が読み直す。 */
    if (!visible()) return;
    timer = setTimeout(function () {
      timer = null;
      run();
    }, POLL_MS);
  }

  /* 読み取りは 1 本にまとめる。読んでいる最中に呼ばれたら、終わってからもう 1 回読む。
     戻り値は「この呼び出しの分まで終わった」ときに解決する。 */
  function run() {
    if (reading) {
      again = true;
      return pending;
    }
    reading = true;
    pending = read()
      .then(apply)
      .catch(function () {
        apply({ status: emptyStatus('invalid', 'read_failed'), feed: null });
      })
      .then(function () {
        reading = false;
        if (again) {
          again = false;
          return run();
        }
        pending = null;
        schedule();
      });
    return pending;
  }

  function onChange(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.push(listener);
    return function () {
      listeners = listeners.filter(function (item) {
        return item !== listener;
      });
    };
  }

  function start() {
    if (started) return;
    started = true;
    run();
    global.addEventListener('focus', function () {
      run();
    });
    global.document.addEventListener('visibilitychange', function () {
      if (!visible()) {
        /* 裏に回ったらタイマーを止める。 */
        if (timer) clearTimeout(timer);
        timer = null;
        return;
      }
      run();
    });
  }

  /* 今の feed（読めていなければ null）。 */
  BB.ebwise.feed = function () {
    return feed;
  };
  /* 読み取りの状態。呼び出し側が書き換えても内部は変わらない。 */
  BB.ebwise.status = function () {
    return cloneStatus(status);
  };
  /* 中身が変わったときだけ呼ばれる。戻り値は購読をやめる関数。 */
  BB.ebwise.onChange = onChange;
  /* すぐ 1 回読む。 */
  BB.ebwise.refresh = function () {
    return run();
  };

  /* eBwise の科目と BeeBoard の科目の対応。feed が無ければ空。 */
  BB.ebwise.mapping = function () {
    var empty = { map: {}, how: {}, unmatched: [], ambiguous: [] };
    if (!feed) return empty;
    if (!BB.store || typeof BB.store.get !== 'function') return empty;
    var data = BB.store.get();
    if (!data) return empty;
    var manual = data.ebwise && data.ebwise.mapping ? data.ebwise.mapping : {};
    return core.mapCourses(data.subjects || [], feed.courses || [], manual);
  };

  /* code の対応を手で決める。'auto' は手動の指定を消す。'' は「つながない」。
     実在しない科目は受け付けない。 */
  BB.ebwise.setMapping = function (code, subjectId) {
    if (typeof code !== 'string' || !code || isUnsafe(code)) return false;
    if (!BB.store || typeof BB.store.update !== 'function') return false;
    var value = subjectId === undefined || subjectId === null ? 'auto' : String(subjectId);
    if (value !== 'auto' && value !== '') {
      var data = BB.store.get();
      var exists = (data.subjects || []).some(function (subject) {
        return subject && subject.id === value;
      });
      if (!exists) return false;
    }
    BB.store.update(function (state) {
      state.ebwise = state.ebwise ||
        { schema: 1, mapping: {}, suggested: {}, seenAt: {}, filesLinked: false };
      state.ebwise.mapping = state.ebwise.mapping || {};
      if (value === 'auto') delete state.ebwise.mapping[code];
      else state.ebwise.mapping[code] = value;
    });
    return true;
  };

  /* その科目の資料を今まで読んだことにする。unread の基準はこの時刻。 */
  BB.ebwise.markSeen = function (subjectId) {
    if (typeof subjectId !== 'string' || !subjectId || isUnsafe(subjectId)) return false;
    if (!BB.store || typeof BB.store.update !== 'function') return false;
    BB.store.update(function (state) {
      state.ebwise = state.ebwise ||
        { schema: 1, mapping: {}, suggested: {}, seenAt: {}, filesLinked: false };
      state.ebwise.seenAt = state.ebwise.seenAt || {};
      state.ebwise.seenAt[subjectId] = new Date().toISOString();
    });
    return true;
  };

  /* ---------- 資料フォルダ（任意） ---------- */

  /* snapshot.js は 'mmu-beeboard-handles' を使う。こちらは別の DB にして、
     あちらのハンドルには触らない。 */
  var FILES_DB = 'mmu-beeboard-ebwise';
  var FILES_STORE = 'dirs';
  var FILES_KEY = 'files-dir';

  function openFilesDb() {
    return new Promise(function (resolve, reject) {
      var request = global.indexedDB.open(FILES_DB, 1);
      request.onupgradeneeded = function () {
        request.result.createObjectStore(FILES_STORE);
      };
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function readFilesHandle() {
    if (!global.indexedDB) return Promise.resolve(null);
    return openFilesDb()
      .then(function (db) {
        return new Promise(function (resolve) {
          var request = db.transaction(FILES_STORE, 'readonly').objectStore(FILES_STORE).get(FILES_KEY);
          request.onsuccess = function () {
            resolve(request.result || null);
          };
          request.onerror = function () {
            resolve(null);
          };
        });
      })
      .catch(function () {
        return null;
      });
  }

  function writeFilesHandle(handle) {
    return openFilesDb()
      .then(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction(FILES_STORE, 'readwrite');
          tx.objectStore(FILES_STORE).put(handle, FILES_KEY);
          tx.oncomplete = function () {
            resolve(true);
          };
          tx.onerror = function () {
            resolve(false);
          };
        });
      })
      .catch(function () {
        return false;
      });
  }

  function clearFilesHandle() {
    if (!global.indexedDB) return Promise.resolve(false);
    return openFilesDb()
      .then(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction(FILES_STORE, 'readwrite');
          tx.objectStore(FILES_STORE).delete(FILES_KEY);
          tx.oncomplete = function () {
            resolve(true);
          };
          tx.onerror = function () {
            resolve(false);
          };
        });
      })
      .catch(function () {
        return false;
      });
  }

  function setFilesLinked(value) {
    if (!BB.store || typeof BB.store.update !== 'function') return;
    BB.store.update(function (state) {
      state.ebwise = state.ebwise ||
        { schema: 1, mapping: {}, suggested: {}, seenAt: {}, filesLinked: false };
      state.ebwise.filesLinked = !!value;
    });
  }

  /* 資料フォルダをつないでいるか。保存値だけを見る。 */
  BB.ebwise.filesLinked = function () {
    var data = BB.store && typeof BB.store.get === 'function' ? BB.store.get() : null;
    return !!(data && data.ebwise && data.ebwise.filesLinked);
  };

  /* 押されたときだけピッカーを出す。 */
  BB.ebwise.linkFiles = function () {
    if (typeof global.showDirectoryPicker !== 'function') {
      return Promise.resolve({ ok: false, reason: 'unsupported' });
    }
    return global
      .showDirectoryPicker({ id: 'beeboard-ebwise-files', mode: 'read' })
      .then(function (handle) {
        return writeFilesHandle(handle).then(function (saved) {
          if (!saved) return { ok: false, reason: 'failed' };
          setFilesLinked(true);
          return { ok: true, name: handle.name || '', warn: handle.name !== 'files' };
        });
      })
      .catch(function (error) {
        if (error && error.name === 'AbortError') return { ok: false, reason: 'cancelled' };
        return { ok: false, reason: 'failed' };
      });
  };

  /* つなぎを外す。保存したハンドルを消し、filesLinked を false にする。 */
  BB.ebwise.unlinkFiles = function () {
    return clearFilesHandle().then(function () {
      setFilesLinked(false);
      return true;
    });
  };

  /* localPath を '/' で分ける。'..' や空の要素があれば開かない。 */
  function pathParts(localPath) {
    if (typeof localPath !== 'string' || !localPath) return null;
    var parts = localPath.split('/');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part || part === '.' || part === '..' || part.indexOf('\\') >= 0) return null;
    }
    return parts;
  }

  function fileAt(dir, parts) {
    var current = Promise.resolve(dir);
    for (var i = 0; i < parts.length - 1; i++) {
      (function (name) {
        current = current.then(function (handle) {
          return handle.getDirectoryHandle(name);
        });
      })(parts[i]);
    }
    return current.then(function (handle) {
      return handle.getFileHandle(parts[parts.length - 1]).then(function (fileHandle) {
        return fileHandle.getFile();
      });
    });
  }

  /* 資料を開く。許可が 'prompt' のときだけ、押されたこの瞬間に尋ねる。 */
  function openMaterial(id) {
    var item = materialById(id);
    if (!item) return Promise.resolve(false);
    var parts = pathParts(item.localPath);
    if (!parts) return Promise.resolve(false);
    return readFilesHandle()
      .then(function (dir) {
        if (!dir) return null;
        return dir.queryPermission({ mode: 'read' }).then(function (permission) {
          if (permission === 'granted') return dir;
          if (permission !== 'prompt' || typeof dir.requestPermission !== 'function') return null;
          return dir.requestPermission({ mode: 'read' }).then(function (next) {
            return next === 'granted' ? dir : null;
          });
        });
      })
      .then(function (dir) {
        if (!dir) return false;
        return fileAt(dir, parts).then(function (file) {
          var url = global.URL.createObjectURL(file);
          global.open(url, '_blank', 'noopener');
          setTimeout(function () {
            global.URL.revokeObjectURL(url);
          }, 60000);
          return true;
        });
      })
      .catch(function () {
        return false;
      });
  }

  BB.ebwise.openMaterial = openMaterial;

  /* ---------- 資料の行の操作 ---------- */

  function toast(message) {
    if (BB.ui && typeof BB.ui.toast === 'function') BB.ui.toast(message);
  }

  function materialById(id) {
    if (!feed || !Array.isArray(feed.materials)) return null;
    for (var i = 0; i < feed.materials.length; i++) {
      if (feed.materials[i] && feed.materials[i].id === id) return feed.materials[i];
    }
    return null;
  }

  /* filesRoot と localPath を Windows のパスにつなぐ。 */
  function fullPathOf(item) {
    if (!item || typeof item.localPath !== 'string' || !item.localPath) return '';
    var root = feed && typeof feed.filesRoot === 'string' ? feed.filesRoot : '';
    return ((root ? root + '\\' : '') + item.localPath).replace(/\//g, '\\');
  }

  function copyPath(id) {
    var path = fullPathOf(materialById(id));
    if (!path) return;
    var clipboard = global.navigator && global.navigator.clipboard;
    if (!clipboard || typeof clipboard.writeText !== 'function') {
      toast(label('ebwise.toast.copyFailed', 'Could not copy the path'));
      return;
    }
    clipboard.writeText(path).then(
      function () {
        toast(label('ebwise.toast.copied', 'Path copied'));
      },
      function () {
        toast(label('ebwise.toast.copyFailed', 'Could not copy the path'));
      }
    );
  }

  /* 行のボタンは data 属性で id を渡す。行は描き直されるので document で受ける。 */
  global.document.addEventListener('click', function (event) {
    var open = event.target && event.target.closest ? event.target.closest('[data-ebwise-open]') : null;
    if (open) {
      openMaterial(open.getAttribute('data-ebwise-open')).then(function (opened) {
        if (!opened) toast(label('ebwise.toast.fileMissing', 'Could not find the file'));
      });
      return;
    }
    var button = event.target && event.target.closest ? event.target.closest('[data-ebwise-copy]') : null;
    if (!button) return;
    copyPath(button.getAttribute('data-ebwise-copy'));
  });

  start();
})(typeof window !== 'undefined' ? window : globalThis);
