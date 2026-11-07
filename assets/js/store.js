/* MMU BeeBoard — state persistence + color/date helpers.
   localStorage が使えない環境（file:// の一部ブラウザ）ではメモリ保持にフォールバックする。 */
(function (global) {
  'use strict';

  var KEY = 'mmu-beeboard';
  /* 2: 科目コードを eBwise 表記（C 付き）に変更。旧コードの保存状態は破棄して再シードする。 */
  var VERSION = 2;
  var memory = null;
  /* cache は「最後に読んだ生データ」とセットで持つ。生データが変わっていれば読み直す。 */
  var cache = null;
  var cacheRaw = null;
  var listeners = [];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function storage() {
    try {
      var probe = '__bb_probe__';
      global.localStorage.setItem(probe, '1');
      global.localStorage.removeItem(probe);
      return global.localStorage;
    } catch (e) {
      return null;
    }
  }

  function seedState() {
    var seed = global.BB_SEED;
    return {
      version: VERSION,
      term: clone(seed.term),
      student: clone(seed.student),
      settings: clone(seed.settings),
      subjects: clone(seed.subjects).map(function (subject) {
        subject.marks = {};
        return subject;
      }),
      studySessions: [],
      customDeadlines: [],
      notes: [],
      /* 休講・振替は定例コマの定義を書き換えず、この別枠だけで持つ。 */
      sessionOverrides: [],
      /* 締切の詳細（リンク・メモ）。締切本体とは分けて持つ。 */
      deadlineDetails: {},
      archive: [],
      /* 初回セットアップを終えたか（Skip でも立てる）。未完了かつ科目0件のときだけ自動表示する。 */
      setupDone: false
    };
  }

  function readRaw() {
    var store = storage();
    return store ? store.getItem(KEY) : memory;
  }

  function parse(raw) {
    if (!raw) return null;
    try {
      var state = JSON.parse(raw);
      return state && state.version === VERSION ? state : null;
    } catch (e) {
      return null;
    }
  }

  function write(state) {
    var raw = JSON.stringify(state);
    var store = storage();
    if (store) store.setItem(KEY, raw);
    else memory = raw;
    cache = state;
    cacheRaw = raw;
  }

  /* 常に保存済みの最新状態を返す。他タブが書き換えていれば生データが変わるので読み直す。
     これがないと「開いた時点のスナップショット」を保存して他タブの編集を消してしまう。 */
  function current() {
    var raw = readRaw();
    if (cache && raw === cacheRaw) return cache;
    var parsed = parse(raw);
    if (parsed) {
      cache = parsed;
      cacheRaw = raw;
      return cache;
    }
    /* 保存が無い・壊れている・バージョン違い → シードで作り直す */
    cache = seedState();
    write(cache);
    return cache;
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

  var api = {
    get: function () {
      return current();
    },
    save: function () {
      write(current());
      return current();
    },
    /* 変更関数は「保存直前の最新状態」に対して適用する。他タブの編集を巻き戻さない。 */
    update: function (mutate) {
      var state = current();
      mutate(state);
      write(state);
      return state;
    },
    /* 他タブの保存を取り込んだときに呼ばれる。ページ側は再描画を登録する。 */
    subscribe: function (listener) {
      listeners.push(listener);
      return function () {
        listeners = listeners.filter(function (item) {
          return item !== listener;
        });
      };
    },
    reset: function () {
      cache = seedState();
      write(cache);
      return cache;
    },
    subject: function (id) {
      var subjects = api.get().subjects;
      for (var i = 0; i < subjects.length; i++) {
        if (subjects[i].id === id) return subjects[i];
      }
      return null;
    },
    /* 初回セットアップの自動表示条件: 科目0件 かつ setupDone 未設定。 */
    needsSetup: function () {
      var state = api.get();
      return !state.setupDone && (!state.subjects || state.subjects.length === 0);
    },
    /* Skip でも完了扱いにして、二度と自動表示しない。 */
    completeSetup: function () {
      return api.update(function (state) {
        state.setupDone = true;
      });
    },
    /* 科目色は保存済み state の color のみが正。重複判定はここに集約する。 */
    colorOwner: function (hex, exceptId) {
      var subjects = api.get().subjects;
      var target = String(hex).toUpperCase();
      for (var i = 0; i < subjects.length; i++) {
        if (subjects[i].id !== exceptId && String(subjects[i].color).toUpperCase() === target) {
          return subjects[i];
        }
      }
      return null;
    },
    /* 現在の学期を archive へ退避する。切替・復元の両方から使う。 */
    archiveCurrent: function () {
      return api.update(function (state) {
        state.archive = state.archive || [];
        state.archive.push({
          term: clone(state.term),
          subjects: clone(state.subjects),
          studySessions: clone(state.studySessions || []),
          customDeadlines: clone(state.customDeadlines || []),
          notes: clone(state.notes || []),
          sessionOverrides: clone(state.sessionOverrides || []),
          deadlineDetails: clone(state.deadlineDetails || {}),
          archivedAt: new Date().toISOString()
        });
      });
    },
    /* 次の学期へ移る。科目構成は引き継ぎ、成績・出席・学習ログは持ち越さない。 */
    startTerm: function (term) {
      api.archiveCurrent();
      return api.update(function (state) {
        state.term = clone(term);
        state.subjects = state.subjects.map(function (subject) {
          subject.marks = {};
          /* 出席も前学期の記録。残すと「no sessions held yet」と出席率が同居する。 */
          subject.attendance = { held: 0, attended: 0, absences: 0, log: [] };
          return subject;
        });
        state.studySessions = [];
        state.customDeadlines = [];
        state.notes = [];
        state.sessionOverrides = [];
        state.deadlineDetails = {};
      });
    },
    /* archive の 1 件を現在の学期に戻す。今の学期は退避してから入れ替える。 */
    restoreTerm: function (index) {
      var entry = (api.get().archive || [])[index];
      if (!entry) return api.get();
      api.archiveCurrent();
      return api.update(function (state) {
        /* archiveCurrent が 1 件積んだので、対象は元の index のまま先頭側にある */
        state.archive.splice(index, 1);
        state.term = clone(entry.term);
        state.subjects = clone(entry.subjects);
        state.studySessions = clone(entry.studySessions || []);
        state.customDeadlines = clone(entry.customDeadlines || []);
        state.notes = clone(entry.notes || []);
        state.sessionOverrides = clone(entry.sessionOverrides || []);
        state.deadlineDetails = clone(entry.deadlineDetails || {});
      });
    }
  };

  /* 他タブの保存を検知したらキャッシュを捨てて購読者へ知らせる。
     これがないと、古いタブが自分のスナップショットを描き続けてしまう。 */
  if (global.addEventListener) {
    global.addEventListener('storage', function (event) {
      if (event.key !== null && event.key !== KEY) return;
      cache = null;
      cacheRaw = null;
      notify();
    });
  }

  /* ---------- color ---------- */

  function parseHex(hex) {
    var value = String(hex).replace('#', '');
    if (value.length === 3) {
      value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
    }
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16)
    ];
  }

  function toHex(rgb) {
    return (
      '#' +
      rgb
        .map(function (channel) {
          var part = Math.max(0, Math.min(255, Math.round(channel))).toString(16);
          return part.length === 1 ? '0' + part : part;
        })
        .join('')
        .toUpperCase()
    );
  }

  function mix(hex, target, amount) {
    var a = parseHex(hex);
    var b = parseHex(target);
    return toHex([
      a[0] + (b[0] - a[0]) * amount,
      a[1] + (b[1] - a[1]) * amount,
      a[2] + (b[2] - a[2]) * amount
    ]);
  }

  var color = {
    /* 同じ色の薄い版。チップ背景・淡色バッジはこれで派生させる。 */
    tint: function (hex, amount) {
      return mix(hex, '#FFFFFF', amount === undefined ? 0.88 : amount);
    },
    /* 同じ色の濃い版。淡色背景上の文字色に使う。 */
    shade: function (hex, amount) {
      return mix(hex, '#000000', amount === undefined ? 0.25 : amount);
    },
    alpha: function (hex, alpha) {
      var rgb = parseHex(hex);
      return 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', ' + alpha + ')';
    },
    chip: function (hex) {
      return {
        background: color.tint(hex),
        color: color.shade(hex),
        borderColor: color.alpha(hex, 0.12)
      };
    }
  };

  /* ---------- date ---------- */

  /* 'YYYY-MM-DD' → Date。未設定・不正値は null（例外にしない）。 */
  function parseDate(iso) {
    if (!iso) return null;
    var parts = String(iso).split('-');
    if (parts.length !== 3) return null;
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    if (!isFinite(year) || !isFinite(month) || !isFinite(day)) return null;
    var parsed = new Date(year, month - 1, day);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  var date = {
    parse: parseDate,
    /* 学期開始日が未設定なら null。呼び出し側は null を「日付未設定」として扱う。 */
    start: function () {
      return parseDate(api.get().term.startDate);
    },
    /* 学期開始からの経過週。Week 1 は開始週。開始日が未設定なら NaN。 */
    weekOf: function (when) {
      var start = date.start();
      if (!start) return NaN;
      var day = new Date(when.getFullYear(), when.getMonth(), when.getDate());
      var diff = Math.floor((day - start) / 86400000);
      return Math.floor(diff / 7) + 1;
    },
    /* 開始日が未設定なら null。 */
    weekRange: function (week) {
      var start = date.start();
      if (!start) return null;
      var from = new Date(start.getTime() + (week - 1) * 7 * 86400000);
      var to = new Date(from.getTime() + 6 * 86400000);
      return { start: from, end: to };
    },
    /* '23–29 Nov 2026' 形式。開始日が未設定なら空文字。月名と並びは辞書から引く。 */
    weekLabel: function (week) {
      var range = date.weekRange(week);
      if (!range) return '';
      var i18n = global.BB && global.BB.i18n;
      if (!i18n) return '';
      var keys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      var from = range.start;
      var to = range.end;
      if (from.getMonth() === to.getMonth()) {
        return i18n.t('date.weekSameMonth', {
          d1: from.getDate(),
          d2: to.getDate(),
          mon: i18n.t('month.' + keys[to.getMonth()]),
          year: to.getFullYear()
        });
      }
      return i18n.t('date.weekCrossMonth', {
        d1: from.getDate(),
        mon1: i18n.t('month.' + keys[from.getMonth()]),
        d2: to.getDate(),
        mon2: i18n.t('month.' + keys[to.getMonth()]),
        year: to.getFullYear()
      });
    }
  };

  /* theme.js が先に BB を作っているため、置き換えずに追記する */
  global.BB = global.BB || {};
  global.BB.store = api;
  global.BB.color = color;
  global.BB.date = date;
})(window);
