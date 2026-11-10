/* MMU BeeBoard — snapshot for a local AI.
   保存済みの状態（localStorage の mmu-beeboard）をそのまま JSON に写し、
   exportedAt と assignments を足す。読み取りだけで、クラウドには送らない。

   書き出し先は、利用者が選んだフォルダ（IndexedDB に記憶）だけ。
   許可が残っている間は、保存のたびに同じファイルを上書きする。ピッカーは
   ボタンを押したときしか出さない。

   使い方（ブラウザのコンソール）:
     BB.snapshot.build(); */
(function (global) {
  'use strict';

  var BB = global.BB;

  if (!BB || !BB.store || !BB.dash) {
    throw new Error('MMU BeeBoard is not loaded on this page.');
  }

  var FILE_NAME = 'beeboard-snapshot.json';
  var HANDLE_DB = 'mmu-beeboard-handles';
  var HANDLE_STORE = 'dirs';
  var HANDLE_KEY = 'snapshot-dir';
  /* 連続した保存をまとめる。短すぎると書き込みが増え、長すぎると反映が遅れる。 */
  var AUTO_WRITE_DELAY = 800;

  function clone(value) {
    return value === undefined ? null : JSON.parse(JSON.stringify(value));
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* 'YYYY-MM-DD' または 'YYYY-MM-DDTHH:mm' → 'YYYY-MM-DD'。読めなければ null。 */
  function isoDay(value) {
    var raw = String(value === undefined || value === null ? '' : value).slice(0, 10);
    var day = BB.date.parse(raw);
    if (!day) return null;
    return day.getFullYear() + '-' + pad2(day.getMonth() + 1) + '-' + pad2(day.getDate());
  }

  /* 締切 1 件。科目名・課題名・週・締切日・配点・種別だけを持つ。
     due は締切ページが日付として扱う値（sortDue）から作る。週しか持たない
     評価（科目の assessments）は due が null になり、week で位置が分かる。
     学期開始日が未設定だと週をカレンダーに置けないので、due は常に null。 */
  function toAssignment(item, hasStartDate) {
    var assessment = item.assessment || {};
    return {
      subject: item.subject && item.subject.name ? item.subject.name : null,
      name: assessment.name || '',
      week: isFinite(item.week) ? Number(item.week) : null,
      due: hasStartDate ? isoDay(item.sortDue) : null,
      weight: Number(assessment.weight) || 0,
      kind: assessment.kind === 'exam' ? 'exam' : 'coursework'
    };
  }

  /* 保存済みの状態を丸ごと写し、exportedAt と assignments を足す。
     状態はそのまま返さず複製する（呼び出し側が書き換えても保存に響かないように）。 */
  function build() {
    var state = BB.store.get();
    var hasStartDate = Boolean(BB.date.start());
    var snapshot = clone(state);

    snapshot.exportedAt = new Date().toISOString();
    snapshot.assignments = BB.dash.deadlineItems().map(function (item) {
      return toAssignment(item, hasStartDate);
    });

    return snapshot;
  }

  function toJson() {
    return JSON.stringify(build(), null, 2);
  }

  /* ---------- folder handle ---------- */

  /* 一度選んだフォルダを IndexedDB に覚えておく。FileSystemDirectoryHandle は
     構造化クローンで保存できる。使えない環境では毎回フォルダを選ぶだけになる。 */
  function openHandleDb() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(HANDLE_DB, 1);
      request.onupgradeneeded = function () {
        request.result.createObjectStore(HANDLE_STORE);
      };
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function readDirHandle() {
    return openHandleDb()
      .then(function (db) {
        return new Promise(function (resolve) {
          var request = db.transaction(HANDLE_STORE, 'readonly').objectStore(HANDLE_STORE).get(HANDLE_KEY);
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

  function writeDirHandle(handle) {
    return openHandleDb()
      .then(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction(HANDLE_STORE, 'readwrite');
          tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
          tx.oncomplete = function () {
            resolve();
          };
          tx.onerror = function () {
            resolve();
          };
        });
      })
      .catch(function () {});
  }

  function pickDir() {
    return window.showDirectoryPicker({ id: 'beeboard-snapshot', mode: 'readwrite' }).then(function (handle) {
      return writeDirHandle(handle).then(function () {
        return handle;
      });
    });
  }

  /* 許可が残っているフォルダを返す。無ければ選び直してもらう。
     ボタンからしか呼ばない（自動書き込みでピッカーを出さないため）。 */
  function ensureFolder() {
    return readDirHandle().then(function (stored) {
      if (!stored) return pickDir();
      return stored
        .queryPermission({ mode: 'readwrite' })
        .then(function (permission) {
          return permission === 'granted' ? stored : pickDir();
        })
        .catch(function () {
          return pickDir();
        });
    });
  }

  function writeTo(dir, json) {
    return dir.getFileHandle(FILE_NAME, { create: true }).then(function (handle) {
      return handle.createWritable().then(function (writable) {
        return writable
          .write(json)
          .then(function () {
            return writable.close();
          });
      });
    });
  }

  function download(json) {
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = FILE_NAME;
    link.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- automatic write ---------- */

  var timer = null;

  /* 許可が残っているフォルダにだけ書く。無ければ何もしない。
     失敗しても画面の編集は壊さない（静かに諦める）。 */
  function autoWrite() {
    return readDirHandle()
      .then(function (dir) {
        if (!dir) return null;
        return dir.queryPermission({ mode: 'readwrite' }).then(function (permission) {
          if (permission !== 'granted') return null;
          return writeTo(dir, toJson());
        });
      })
      .catch(function () {
        return null;
      });
  }

  function scheduleAutoWrite() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      autoWrite();
    }, AUTO_WRITE_DELAY);
  }

  BB.snapshot = {
    build: build,
    toJson: toJson,
    fileName: FILE_NAME,
    ensureFolder: ensureFolder,
    writeTo: writeTo,
    download: download,
    autoWrite: autoWrite,
    scheduleAutoWrite: scheduleAutoWrite
  };

  /* このタブの保存は onWrite、他タブの保存は subscribe で届く。 */
  if (typeof BB.store.onWrite === 'function') BB.store.onWrite(scheduleAutoWrite);
  BB.store.subscribe(scheduleAutoWrite);
})(window);
