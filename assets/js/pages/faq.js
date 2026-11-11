/* MMU BeeBoard — FAQ.
   検索とカテゴリで絞り込み、質問はアコーディオンで開閉する。
   回答は辞書（faq.items.*）に置き、ここには表示文字列を書かない。 */
(function () {
  'use strict';

  var BB = window.BB;
  var t = BB.i18n.t;
  var tn = BB.i18n.tn;

  /* カテゴリの並び順。キーは辞書の faq.categories.* と一致させる。 */
  var CATEGORIES = ['start', 'data', 'ai', 'grades', 'attendance', 'install', 'trouble'];

  /* 質問の並び順と、回答から張るリンク先。文言は辞書側が持つ。 */
  var ITEMS = [
    { key: 'q1', cat: 'start' },
    { key: 'q2', cat: 'start' },
    { key: 'q17', cat: 'start' },
    { key: 'q18', cat: 'start', href: 'settings.html' },
    { key: 'q3', cat: 'data', href: 'settings.html' },
    { key: 'q4', cat: 'data' },
    { key: 'q5', cat: 'data', href: 'settings.html' },
    { key: 'q6', cat: 'data' },
    { key: 'q19', cat: 'data', href: 'settings.html' },
    { key: 'q22', cat: 'ai', href: 'settings.html' },
    { key: 'q23', cat: 'ai' },
    { key: 'q24', cat: 'ai', href: 'settings.html' },
    { key: 'q25', cat: 'ai', href: 'settings.html' },
    { key: 'q26', cat: 'ai', href: 'settings.html' },
    { key: 'q27', cat: 'ai', href: 'settings.html' },
    { key: 'q28', cat: 'ai' },
    { key: 'q29', cat: 'ai', href: 'settings.html' },
    { key: 'q30', cat: 'ai' },
    { key: 'q10', cat: 'grades', href: 'simulator.html' },
    { key: 'q11', cat: 'grades', href: 'simulator.html' },
    { key: 'q12', cat: 'grades' },
    { key: 'q13', cat: 'grades', href: 'subject-edit.html' },
    { key: 'q14', cat: 'grades' },
    { key: 'q15', cat: 'attendance', href: 'settings.html' },
    { key: 'q16', cat: 'attendance' },
    { key: 'q7', cat: 'install' },
    { key: 'q8', cat: 'install', href: 'settings.html' },
    { key: 'q9', cat: 'install' },
    { key: 'q20', cat: 'trouble', href: 'contact.html' },
    { key: 'q21', cat: 'trouble' }
  ];

  var query = '';
  var category = 'all';
  /* 開いている質問の key。複数同時に開ける。 */
  var open = {};

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  BB.ui.mount({
    title: t('faq.title'),
    head: { title: t('faq.title'), subtitle: t('faq.subtitle') }
  });

  function matches(item) {
    if (category !== 'all' && item.cat !== category) return false;
    if (!query) return true;
    var haystack = (t('faq.items.' + item.key + '.q') + ' ' + t('faq.items.' + item.key + '.a')).toLowerCase();
    return haystack.indexOf(query) !== -1;
  }

  function visibleItems() {
    return ITEMS.filter(matches);
  }

  /* ---------- controls ---------- */

  function chip(value, label, active) {
    return (
      '<button type="button" data-cat="' + esc(value) + '" class="bb-chip" aria-pressed="' + (active ? 'true' : 'false') +
      '" style="' +
      (active
        ? 'background:var(--bb-primary);color:var(--bb-on-primary);border:1px solid var(--bb-primary)'
        : 'background:var(--bb-surface);color:var(--bb-text-muted);border:1px solid var(--bb-border)') +
      '">' + esc(label) + '</button>'
    );
  }

  function renderControls() {
    var chips = chip('all', t('faq.all'), category === 'all');
    chips += CATEGORIES.map(function (key) {
      return chip(key, t('faq.categories.' + key), category === key);
    }).join('');

    document.getElementById('faq-controls').innerHTML =
      '<section class="bb-card p-4 sm:p-5 space-y-3">' +
      '<div class="flex items-center gap-2">' +
      '<span class="material-symbols-outlined text-[20px] text-muted">search</span>' +
      '<input id="faq-search" class="bb-input" type="search" autocomplete="off" value="' + esc(query) +
      '" placeholder="' + esc(t('faq.searchPlaceholder')) + '" aria-label="' + esc(t('faq.searchAria')) + '">' +
      '</div>' +
      '<div class="flex flex-wrap gap-2">' + chips + '</div>' +
      '<div class="flex items-center justify-between gap-3">' +
      '<span class="text-caption text-muted num" id="faq-count">' + esc(tn('faq.count', visibleItems().length)) + '</span>' +
      '<button type="button" id="faq-clear" class="bb-btn bb-btn-ghost bb-btn-sm"' +
      (query || category !== 'all' ? '' : ' hidden') + '>' + esc(t('faq.clear')) + '</button>' +
      '</div></section>';
  }

  /* ---------- list ---------- */

  function itemHtml(item) {
    var base = 'faq.items.' + item.key;
    var isOpen = !!open[item.key];
    var link = item.href
      ? '<a href="' + item.href + '" class="bb-btn bb-btn-ghost bb-btn-sm mt-3">' +
        '<span class="material-symbols-outlined text-[16px]">open_in_new</span>' +
        esc(t(base + '.link')) + '</a>'
      : '';
    return (
      '<div class="bb-card overflow-hidden" data-item="' + esc(item.key) + '">' +
      '<button type="button" class="faq-q" data-toggle="' + esc(item.key) + '" ' +
      'id="faq-q-' + esc(item.key) + '" aria-controls="faq-a-' + esc(item.key) + '" ' +
      'aria-expanded="' + (isOpen ? 'true' : 'false') + '">' +
      '<span class="faq-q-text">' + esc(t(base + '.q')) + '</span>' +
      '<span class="material-symbols-outlined faq-chevron">expand_more</span></button>' +
      '<div class="faq-a" id="faq-a-' + esc(item.key) + '" role="region" ' +
      'aria-labelledby="faq-q-' + esc(item.key) + '"' + (isOpen ? '' : ' hidden') + '>' +
      '<p>' + esc(t(base + '.a')) + '</p>' + link + '</div></div>'
    );
  }

  function renderList() {
    var items = visibleItems();
    var host = document.getElementById('faq-list');
    if (!items.length) {
      host.innerHTML =
        '<div class="bb-card p-8 text-center">' +
        '<span class="material-symbols-outlined text-[28px] text-placeholder">search_off</span>' +
        '<p class="text-body-sm text-muted mt-2">' + esc(t('faq.empty')) + '</p></div>';
      return;
    }
    host.innerHTML = items.map(itemHtml).join('');
  }

  function renderHelp() {
    document.getElementById('faq-help').innerHTML =
      '<section class="bb-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">' +
      '<div class="min-w-0"><h2 class="text-title-md font-bold text-ink">' + esc(t('guide.help.title')) + '</h2>' +
      '<p class="text-body-sm text-muted mt-1">' + esc(t('guide.help.body')) + '</p></div>' +
      '<div class="flex flex-col sm:flex-row gap-2 shrink-0">' +
      '<a href="guide.html" class="bb-btn bb-btn-ghost">' +
      '<span class="material-symbols-outlined text-[18px]">menu_book</span>' +
      esc(t('guide.title')) + '</a>' +
      '<a href="contact.html" class="bb-btn bb-btn-primary">' +
      '<span class="material-symbols-outlined text-[18px]">forum</span>' +
      esc(t('guide.help.contact')) + '</a>' +
      '</div></section>';
  }

  function renderCount() {
    var node = document.getElementById('faq-count');
    if (node) node.textContent = tn('faq.count', visibleItems().length);
    var clear = document.getElementById('faq-clear');
    if (clear) clear.hidden = !(query || category !== 'all');
  }

  /* ---------- wiring ---------- */

  document.addEventListener('input', function (event) {
    if (event.target.id !== 'faq-search') return;
    query = event.target.value.trim().toLowerCase();
    renderList();
    renderCount();
  });

  document.addEventListener('click', function (event) {
    var target = event.target.closest ? event.target.closest('button') : null;
    if (!target) return;

    if (target.hasAttribute('data-cat')) {
      category = target.getAttribute('data-cat');
      renderControls();
      renderList();
      return;
    }

    if (target.id === 'faq-clear') {
      query = '';
      category = 'all';
      renderControls();
      renderList();
      return;
    }

    if (target.hasAttribute('data-toggle')) {
      var key = target.getAttribute('data-toggle');
      var panel = document.getElementById('faq-a-' + key);
      var next = target.getAttribute('aria-expanded') !== 'true';
      target.setAttribute('aria-expanded', next ? 'true' : 'false');
      if (panel) panel.hidden = !next;
      open[key] = next;
    }
  });

  renderControls();
  renderList();
  renderHelp();
})();
