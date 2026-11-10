/* MMU BeeBoard — local AI bridge.
   ローカルAIが置いた「操作ファイル」を inbox から取り込み、localStorage に反映する。
   クラウドもサーバーも使わない。動くのは、利用者が選んだフォルダの許可が
   'granted' のままで、かつこのタブがロックを持っているときだけ。

   操作ファイル（選択フォルダ/inbox/*.json）:
     { schema: 'beeboard-op/1', opId: '...', type: 'note.add',
       basis: { termId: '...' }, args: { kind, text, subjectCode, date, due } }

   結果は state.aiBridge.results に積み、beeboard-snapshot.json にも出る。
   同じフォルダの bridge-status.json に、ロックを持つタブが 20 秒ごとに生存を書く。

   この回で受け付ける type は 'note.add' だけ。それ以外は 'not_supported' で却下する。 */
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
  var MAX_RESULTS = 100;
  /* 表示中は短く、裏に回ったら長く。focus / visibilitychange では即座に 1 回見る。 */
  var POLL_VISIBLE = 3000;
  var POLL_HIDDEN = 30000;
  var STATUS_INTERVAL = 20000;

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
    unknown_subject: '科目が見つかりません'
  };

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
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

  function hasSubject(state, id) {
    var subjects = state.subjects || [];
    for (var i = 0; i < subjects.length; i++) {
      if (subjects[i].id === id) return true;
    }
    return false;
  }

  function hasNoteId(state, id) {
    var notes = state.notes || [];
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].id === id) return true;
    }
    return false;
  }

  function hasOp(list, opId) {
    if (!opId) return false;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].opId === opId) return true;
    }
    return false;
  }

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

  function reject(reason) {
    return { reason: reason, summaryJa: SUMMARY[reason] || '', note: null };
  }

  /* 1 件の操作を検証する。通れば note を返し、駄目なら理由を返す。 */
  function judge(state, op, type) {
    if (type !== 'note.add') return reject('not_supported');
    /* 操作ファイルは「どの学期向けに作られたか」を持つ。学期が変わっていたら入れない。 */
    if (!op.basis || op.basis.termId !== state.term.id) return reject('term_changed');

    var args = op.args;
    if (!args || typeof args !== 'object') return reject('invalid_args');

    var kind = args.kind === 'memo' ? 'memo' : args.kind === 'homework' ? 'homework' : null;
    if (!kind) return reject('invalid_args');

    var text = typeof args.text === 'string' ? args.text.trim() : '';
    if (!text || text.length > MAX_TEXT) return reject('invalid_text');

    if (!isRealDay(args.date)) return reject('invalid_date');
    if (!isDue(args.due)) return reject('invalid_due');

    var subjectCode = args.subjectCode;
    if (subjectCode === undefined || subjectCode === null || subjectCode === '') subjectCode = null;
    if (subjectCode !== null && !hasSubject(state, subjectCode)) return reject('unknown_subject');

    /* saveNote と同じ形。メモは締切を持たない。 */
    var stamp = Date.now();
    var id = 'n' + stamp;
    while (hasNoteId(state, id)) {
      stamp += 1;
      id = 'n' + stamp;
    }

    return {
      reason: '',
      summaryJa: kind === 'memo' ? 'メモを追加しました' : '宿題を追加しました',
      note: {
        id: id,
        date: args.date,
        subjectCode: subjectCode,
        text: text,
        kind: kind,
        due: kind === 'homework' ? args.due || '' : '',
        done: false
      }
    };
  }

  /* 1 件を、保存直前の最新状態に対して適用する。
     mutate の中から BB.store.update を呼ばない（保存が二重になる）。 */
  function applyOp(op) {
    var outcome = { applied: false, duplicate: false, reason: '', ids: [] };
    var opId = typeof op.opId === 'string' ? op.opId : '';
    var type = typeof op.type === 'string' ? op.type : '';

    BB.store.applyExternal(function (state) {
      var bridge = bridgeOf(state);

      /* 同じ opId は二重に適用しない。ファイルを消せなかったときの保険でもある。 */
      if (hasOp(bridge.results, opId) || hasOp(bridge.pending, opId)) {
        outcome.duplicate = true;
        return;
      }

      var verdict = judge(state, op, type);
      if (verdict.reason) {
        outcome.reason = verdict.reason;
        pushResult(bridge, resultEntry(opId, type, 'rejected', verdict.reason, verdict.summaryJa, []));
        return;
      }

      state.notes = state.notes || [];
      state.notes.push(verdict.note);
      outcome.applied = true;
      outcome.ids = [verdict.note.id];
      pushResult(bridge, resultEntry(opId, type, 'applied', '', verdict.summaryJa, outcome.ids));
    });

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

  function notifyApplied() {
    if (BB.ui && typeof BB.ui.toast === 'function' && BB.i18n) {
      BB.ui.toast(BB.i18n.t('bridge.toast.noteAdded'));
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
          if (outcome.applied) notifyApplied();
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
    status: writeStatus
  };

  start();
})(window);
