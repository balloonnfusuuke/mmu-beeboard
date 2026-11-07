/* MMU BeeBoard — theme bootstrap.
   <head> で同期読み込みし、初回描画前に data-theme を確定させる（白フラッシュ防止）。
   保存済みテーマは store.js と同じ localStorage キーから直接読む。 */
(function (global) {
  'use strict';

  var KEY = 'mmu-beeboard';

  function resolve(theme) {
    if (theme === 'system') {
      return global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme === 'dark' ? 'dark' : 'light';
  }

  function saved() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return 'light';
      var state = JSON.parse(raw);
      return (state && state.settings && state.settings.theme) || 'light';
    } catch (e) {
      return 'light';
    }
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', resolve(theme));
  }

  global.BB = global.BB || {};
  global.BB.theme = { apply: apply, resolve: resolve, saved: saved };

  apply(saved());
})(window);
