/* MMU BeeBoard — service worker.
   アプリ本体（HTML・CSS・JS・アイコン・マニフェスト）をバージョン付きキャッシュに保持し、
   2 回目以降はオフラインでも全ページを開けるようにする。
   更新を配るときは CACHE の版を上げる。古いキャッシュは activate で削除する。 */
'use strict';

var CACHE = 'mmu-beeboard-v4';

/* 初回訪問でここをまとめてキャッシュする。1 つでも 404 すると install が失敗するので、
   実行時に読み込むファイルだけを列挙する（tailwind.src.css はビルド入力なので含めない）。 */
var ASSETS = [
  './',
  './index.html',
  './notes.html',
  './simulator.html',
  './deadlines.html',
  './deadline-detail.html',
  './session-detail.html',
  './attendance.html',
  './studylog.html',
  './settings.html',
  './subject-edit.html',
  './setup.html',
  './guide.html',
  './faq.html',
  './contact.html',
  './manifest.webmanifest',
  './assets/css/fonts.css',
  './assets/css/tokens.css',
  './assets/css/components.css',
  './assets/css/app.css',
  './assets/js/theme.js',
  './assets/js/i18n.js',
  './assets/js/data.js',
  './assets/js/store.js',
  './assets/js/room.js',
  './assets/js/app.js',
  './assets/js/subject-form.js',
  './assets/js/pages/attendance.js',
  './assets/js/pages/deadline-detail.js',
  './assets/js/pages/session-detail.js',
  './assets/js/pages/deadlines.js',
  './assets/js/pages/notes.js',
  './assets/js/pages/settings.js',
  './assets/js/pages/setup.js',
  './assets/js/pages/simulator.js',
  './assets/js/pages/studylog.js',
  './assets/js/pages/subject-edit.js',
  './assets/js/pages/guide.js',
  './assets/js/pages/faq.js',
  './assets/js/pages/contact.js',
  './assets/fonts/material-symbols-outlined.woff2',
  './assets/fonts/plus-jakarta-sans-cyrillic-ext.woff2',
  './assets/fonts/plus-jakarta-sans-latin-ext.woff2',
  './assets/fonts/plus-jakarta-sans-latin.woff2',
  './assets/fonts/plus-jakarta-sans-vietnamese.woff2',
  './assets/logo.svg',
  './assets/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (cache) {
        return cache.addAll(ASSETS);
      })
      .then(function () {
        /* 新しい版を待たせずに有効化する。古いキャッシュは activate で消す。 */
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            return key === CACHE ? null : caches.delete(key);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cached;

      return fetch(request)
        .then(function (response) {
          /* 成功した同一オリジンの応答だけを複製して残す。 */
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(request, copy);
          });
          return response;
        })
        .catch(function () {
          /* 未キャッシュのページ遷移はダッシュボードへ逃がす。 */
          if (request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
    })
  );
});
