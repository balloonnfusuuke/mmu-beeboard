/* MMU BeeBoard — state persistence + color/date helpers.
   localStorage が使えない環境（file:// の一部ブラウザ）ではメモリ保持にフォールバックする。 */
(function (global) {
  'use strict';

  var KEY = 'mmu-beeboard';
  /* 2: 科目コードを eBwise 表記（C 付き）に変更。旧コードの保存状態は破棄して再シードする。 */
  var VERSION = 2;
  var memory = null;
  var cache = null;

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
      archive: []
    };
  }

  function read() {
    var store = storage();
    var raw = store ? store.getItem(KEY) : memory;
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
  }

  var api = {
    get: function () {
      if (!cache) {
        cache = read() || seedState();
        write(cache);
      }
      return cache;
    },
    save: function () {
      write(api.get());
      return api.get();
    },
    update: function (mutate) {
      var state = api.get();
      mutate(state);
      return api.save();
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
    /* 科目色は data.js の color のみが正。重複判定はここに集約する。 */
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
      var state = api.get();
      state.archive = state.archive || [];
      state.archive.push({
        term: clone(state.term),
        subjects: clone(state.subjects),
        studySessions: clone(state.studySessions || []),
        customDeadlines: clone(state.customDeadlines || []),
        archivedAt: new Date().toISOString()
      });
      return api.save();
    },
    /* 次の学期へ移る。科目構成は引き継ぎ、成績・出席・学習ログは持ち越さない。 */
    startTerm: function (term) {
      var state = api.get();
      api.archiveCurrent();
      state.term = clone(term);
      state.subjects = state.subjects.map(function (subject) {
        subject.marks = {};
        return subject;
      });
      state.studySessions = [];
      state.customDeadlines = [];
      return api.save();
    },
    /* archive の 1 件を現在の学期に戻す。今の学期は退避してから入れ替える。 */
    restoreTerm: function (index) {
      var state = api.get();
      var entry = (state.archive || [])[index];
      if (!entry) return state;
      api.archiveCurrent();
      state.archive.splice(index, 1);
      state.term = clone(entry.term);
      state.subjects = clone(entry.subjects);
      state.studySessions = clone(entry.studySessions || []);
      state.customDeadlines = clone(entry.customDeadlines || []);
      return api.save();
    }
  };

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

  function parseDate(iso) {
    var parts = String(iso).split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  var date = {
    parse: parseDate,
    /* 学期開始からの経過週。Week 1 は開始週。 */
    weekOf: function (when) {
      var term = api.get().term;
      var start = parseDate(term.startDate);
      var day = new Date(when.getFullYear(), when.getMonth(), when.getDate());
      var diff = Math.floor((day - start) / 86400000);
      return Math.floor(diff / 7) + 1;
    },
    weekRange: function (week) {
      var term = api.get().term;
      var start = parseDate(term.startDate);
      var from = new Date(start.getTime() + (week - 1) * 7 * 86400000);
      var to = new Date(from.getTime() + 6 * 86400000);
      return { start: from, end: to };
    },
    /* '23–29 Nov 2026' 形式 */
    weekLabel: function (week) {
      var range = date.weekRange(week);
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var from = range.start;
      var to = range.end;
      var head = from.getDate() + '–' + to.getDate() + ' ' + months[to.getMonth()];
      return from.getMonth() === to.getMonth()
        ? head + ' ' + to.getFullYear()
        : from.getDate() + ' ' + months[from.getMonth()] + '–' + to.getDate() + ' ' + months[to.getMonth()] + ' ' + to.getFullYear();
    }
  };

  /* theme.js が先に BB を作っているため、置き換えずに追記する */
  global.BB = global.BB || {};
  global.BB.store = api;
  global.BB.color = color;
  global.BB.date = date;
})(window);
