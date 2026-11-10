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

  var core = {
    parseFeed: parseFeed,
    safeUrl: safeUrl,
    mapCourses: mapCourses,
    materialsFor: materialsFor,
    termRange: termRange
  };

  BB.ebwise = { core: core };

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
    notify();
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

  start();
})(typeof window !== 'undefined' ? window : globalThis);
