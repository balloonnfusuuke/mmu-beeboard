/* MMU BeeBoard — Ask the developer.
   このアプリはサーバーを持たないので、ここからメッセージを送ることはしない。
   文面を組み立て、GitHub Issues の新規作成画面へ渡すだけにする。
   アプリ内のデータ（科目・点数・メモ）は本文にも診断情報にも含めない。 */
(function () {
  'use strict';

  /* Issues の URL はここ 1 か所だけ。 */
  var ISSUES_URL = 'https://github.com/balloonnfusuuke/mmu-beeboard/issues/new';
  var REPO_URL = 'https://github.com/balloonnfusuuke/mmu-beeboard';

  var BB = window.BB;
  var t = BB.i18n.t;

  var TYPES = ['question', 'bug', 'feature', 'other'];
  var PAGES = [
    'dashboard',
    'simulator',
    'deadlines',
    'deadlineDetail',
    'attendance',
    'studylog',
    'notes',
    'settings',
    'subjectEdit',
    'setup',
    'guide',
    'faq',
    'contact',
    'other'
  ];

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  BB.ui.mount({
    title: t('contact.title'),
    head: { title: t('contact.title'), subtitle: t('contact.subtitle') }
  });

  function field(id) {
    return document.getElementById(id);
  }

  function value(id) {
    var node = field(id);
    return node ? String(node.value || '').trim() : '';
  }

  /* 種別のキーは contact.form.typeQuestion のように語尾を大文字にする。 */
  function typeKey(key) {
    return 'contact.form.type' + key.charAt(0).toUpperCase() + key.slice(1);
  }

  function typeLabel() {
    return t(typeKey(value('c-type') || 'question'));
  }

  function pageLabel() {
    return t('contact.pages.' + (value('c-page') || 'other'));
  }

  /* 本文はテンプレートだけ。入力された種別・ページ・詳細・再現手順以外は入れない。 */
  function buildBody() {
    var lines = [
      '### ' + t('contact.template.type'),
      typeLabel(),
      '',
      '### ' + t('contact.template.page'),
      pageLabel(),
      '',
      '### ' + t('contact.template.details'),
      value('c-details') || '-'
    ];
    var repro = value('c-repro');
    if (repro) {
      lines.push('', '### ' + t('contact.template.repro'), repro);
    }
    return lines.join('\n');
  }

  function buildTitle() {
    return value('c-title') || typeLabel();
  }

  function issueUrl() {
    return ISSUES_URL + '?title=' + encodeURIComponent(buildTitle()) + '&body=' + encodeURIComponent(buildBody());
  }

  /* ---------- clipboard ---------- */

  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    area.remove();
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return legacyCopy(text);
        }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  function copyWithToast(text, okMessage) {
    return copyText(text).then(function (ok) {
      BB.ui.toast(ok ? okMessage : t('contact.actions.copyFailed'));
      return ok;
    });
  }

  /* ---------- diagnostics ---------- */

  function swCacheName() {
    if (!window.caches || !window.caches.keys) return Promise.resolve('-');
    return window.caches
      .keys()
      .then(function (keys) {
        var found = keys.filter(function (key) {
          return key.indexOf('mmu-beeboard') === 0;
        });
        return found.length ? found.sort().join(', ') : '-';
      })
      .catch(function () {
        return '-';
      });
  }

  /* 個人情報を含まないものだけ。localStorage の中身は読まない。 */
  function diagnosticsText() {
    return swCacheName().then(function (cache) {
      return [
        t('contact.diagnostics.page') + ': ' + pageLabel(),
        t('contact.diagnostics.lang') + ': ' + BB.i18n.lang(),
        t('contact.diagnostics.width') + ': ' + window.innerWidth + 'x' + window.innerHeight,
        t('contact.diagnostics.ua') + ': ' + navigator.userAgent,
        t('contact.diagnostics.cache') + ': ' + cache
      ].join('\n');
    });
  }

  /* ---------- render ---------- */

  function options(list, prefix, selected, keyOf) {
    return list
      .map(function (key) {
        return (
          '<option value="' + esc(key) + '"' + (key === selected ? ' selected' : '') + '>' +
          esc(t(keyOf ? keyOf(key) : prefix + key)) + '</option>'
        );
      })
      .join('');
  }

  function render() {
    document.getElementById('contact-form').innerHTML =
      '<section class="bb-card overflow-hidden">' +
      '<div class="px-5 sm:px-6 py-4 border-b border-border flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">forum</span>' +
      '<div><h2 class="text-title-md font-bold text-ink">' + esc(t('contact.title')) + '</h2>' +
      '<p class="text-body-sm text-muted">' + esc(t('contact.subtitle')) + '</p></div></div>' +
      '<div class="p-5 sm:p-6 space-y-4">' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
      '<div><label class="bb-label" for="c-type">' + esc(t('contact.form.type')) + '</label>' +
      '<select id="c-type" class="bb-input">' + options(TYPES, 'contact.form.type', 'question', typeKey) + '</select></div>' +
      '<div><label class="bb-label" for="c-page">' + esc(t('contact.form.page')) + '</label>' +
      '<select id="c-page" class="bb-input">' + options(PAGES, 'contact.pages.', 'other') + '</select></div>' +
      '</div>' +
      '<div><label class="bb-label" for="c-title">' + esc(t('contact.form.title')) + '</label>' +
      '<input id="c-title" class="bb-input" type="text" maxlength="120" placeholder="' +
      esc(t('contact.form.titlePlaceholder')) + '"></div>' +
      '<div><label class="bb-label" for="c-details">' + esc(t('contact.form.details')) + '</label>' +
      '<textarea id="c-details" class="bb-input" rows="5" placeholder="' +
      esc(t('contact.form.detailsPlaceholder')) + '" style="height:auto;padding:0.75rem 1rem"></textarea></div>' +
      '<div><label class="bb-label" for="c-repro">' + esc(t('contact.form.repro')) +
      ' <span class="text-caption text-muted">(' + esc(t('contact.form.optional')) + ')</span></label>' +
      '<textarea id="c-repro" class="bb-input" rows="4" placeholder="' +
      esc(t('contact.form.reproPlaceholder')) + '" style="height:auto;padding:0.75rem 1rem"></textarea>' +
      '<p class="text-caption text-muted mt-1.5">' + esc(t('contact.form.reproHint')) + '</p></div>' +
      '</div>' +
      '<div class="px-5 sm:px-6 py-4 border-t border-border" style="background:var(--bb-alert-surface)">' +
      '<div class="flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-alert mt-0.5">warning</span>' +
      '<div class="min-w-0"><h3 class="text-title-md font-bold text-ink">' + esc(t('contact.privacy.title')) + '</h3>' +
      '<p class="text-body-sm text-body mt-1">' + esc(t('contact.privacy.body')) + '</p>' +
      '<label class="flex items-start gap-2 mt-3 cursor-pointer">' +
      '<input id="c-privacy" type="checkbox" class="mt-0.5">' +
      '<span class="text-body-sm font-semibold text-ink">' + esc(t('contact.privacy.check')) + '</span></label>' +
      '<p class="text-caption text-muted mt-1">' + esc(t('contact.privacy.hint')) + '</p>' +
      '</div></div></div>' +
      '<div class="px-5 sm:px-6 py-4 border-t border-border flex flex-col sm:flex-row sm:items-center gap-2">' +
      '<button type="button" id="c-open" class="bb-btn bb-btn-primary" disabled>' +
      '<span class="material-symbols-outlined text-[18px]">open_in_new</span>' +
      esc(t('contact.actions.open')) + '</button>' +
      '<button type="button" id="c-copy" class="bb-btn bb-btn-ghost">' +
      '<span class="material-symbols-outlined text-[18px]">content_copy</span>' +
      esc(t('contact.actions.copy')) + '</button>' +
      '<button type="button" id="c-diagnostics" class="bb-btn bb-btn-ghost">' +
      '<span class="material-symbols-outlined text-[18px]">bug_report</span>' +
      esc(t('contact.actions.copyDiagnostics')) + '</button>' +
      '</div></section>' +
      '<section class="bb-card p-5 sm:p-6 mt-4">' +
      '<div class="bb-label">' + esc(t('contact.diagnostics.title')) + '</div>' +
      '<p class="text-body-sm text-muted">' + esc(t('contact.diagnostics.body')) + '</p>' +
      '<pre id="c-preview" class="bb-scroll mt-3 text-body-sm text-body" style="white-space:pre-wrap;word-break:break-word;background:var(--bb-surface-sunken);border-radius:var(--bb-radius-control);padding:0.75rem;max-height:16rem;overflow:auto"></pre>' +
      '</section>';

    document.getElementById('contact-links').innerHTML =
      '<section class="bb-card p-5 sm:p-6">' +
      '<h2 class="text-title-md font-bold text-ink">' + esc(t('contact.links.title')) + '</h2>' +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">' +
      linkCard(REPO_URL, 'code', t('contact.links.repo'), t('contact.links.repoBody')) +
      linkCard('faq.html', 'help', t('contact.links.faq'), t('contact.links.faqBody')) +
      linkCard('guide.html', 'menu_book', t('contact.links.guide'), t('contact.links.guideBody')) +
      '</div></section>';

    updatePreview();
  }

  function linkCard(href, icon, title, body) {
    return (
      '<a href="' + esc(href) + '" class="bb-card bb-card-hover p-4 flex items-start gap-3" ' +
      (href.indexOf('http') === 0 ? 'target="_blank" rel="noopener noreferrer" ' : '') + '>' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">' + icon + '</span>' +
      '<div class="min-w-0"><div class="text-body-md font-semibold text-ink">' + esc(title) + '</div>' +
      '<p class="text-body-sm text-muted mt-1">' + esc(body) + '</p></div></a>'
    );
  }

  function updatePreview() {
    var preview = field('c-preview');
    if (preview) preview.textContent = buildBody();
  }

  function syncGate() {
    var box = field('c-privacy');
    var button = field('c-open');
    if (button) button.disabled = !(box && box.checked);
  }

  /* ---------- wiring ---------- */

  document.addEventListener('input', function (event) {
    if (event.target.id === 'c-privacy') {
      syncGate();
      return;
    }
    if (event.target.id === 'c-title' || event.target.id === 'c-details' || event.target.id === 'c-repro') {
      updatePreview();
    }
  });

  document.addEventListener('change', function (event) {
    if (event.target.id === 'c-type' || event.target.id === 'c-page') updatePreview();
  });

  document.addEventListener('click', function (event) {
    var target = event.target.closest ? event.target.closest('button') : null;
    if (!target) return;

    if (target.id === 'c-open') {
      var box = field('c-privacy');
      if (!box || !box.checked) {
        BB.ui.toast(t('contact.actions.needCheck'));
        return;
      }
      window.open(issueUrl(), '_blank', 'noopener');
      return;
    }

    if (target.id === 'c-copy') {
      copyWithToast(buildBody(), t('contact.actions.copied'));
      return;
    }

    if (target.id === 'c-diagnostics') {
      diagnosticsText().then(function (text) {
        return copyWithToast(text, t('contact.diagnostics.copied'));
      });
    }
  });

  render();
})();
