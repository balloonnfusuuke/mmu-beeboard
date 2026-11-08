/* MMU BeeBoard — How-to guide.
   静的な説明文の羅列ではなく、前へ／次へで進むステップ式ツアーと、
   機能ごとのカード（番号付き手順＋コツ）で「一緒に進める」形にする。
   動画ファイルも外部ライブラリも使わず、画面モックは HTML/CSS で組む。 */
(function () {
  'use strict';

  var BB = window.BB;
  var t = BB.i18n.t;

  /* ツアーの各ステップ。key は辞書の guide.steps.<key>、page は実ページへの導線。 */
  var STEPS = [
    { key: 's1', page: 'settings.html', mock: 'setup' },
    { key: 's2', page: 'subject-edit.html?new=1', mock: 'subject' },
    { key: 's3', page: 'index.html', mock: 'dashboard' },
    { key: 's4', page: 'simulator.html', mock: 'simulator' },
    { key: 's5', page: 'attendance.html', mock: 'attendance' },
    { key: 's6', page: 'studylog.html', mock: 'studylog' }
  ];

  var FEATURES = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9'];

  /* 0..STEPS.length-1 はステップ、STEPS.length は完了パネル。 */
  var step = 0;
  var swapping = false;

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  BB.ui.mount({
    title: t('guide.title'),
    head: { title: t('guide.title'), subtitle: t('guide.subtitle') }
  });

  /* ---------- hero ---------- */

  function promise(icon, title, body) {
    return (
      '<div class="bb-card p-4 flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">' + icon + '</span>' +
      '<div class="min-w-0"><div class="text-body-md font-semibold text-ink">' + esc(title) + '</div>' +
      '<p class="text-body-sm text-muted mt-1">' + esc(body) + '</p></div></div>'
    );
  }

  function renderHero() {
    document.getElementById('guide-hero').innerHTML =
      '<section class="bb-card overflow-hidden">' +
      '<div class="p-5 sm:p-8">' +
      '<span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-primary)">' +
      esc(t('guide.hero.eyebrow')) + '</span>' +
      '<h2 class="text-headline-md text-headline-lg font-bold text-ink tracking-tight mt-3">' +
      esc(t('guide.hero.heading')) + '</h2>' +
      '<p class="text-body-md text-muted mt-2 max-w-3xl">' + esc(t('guide.hero.body')) + '</p>' +
      '<div class="flex flex-col sm:flex-row flex-wrap gap-2 mt-4">' +
      '<button type="button" id="tour-start" class="bb-btn bb-btn-primary">' +
      '<span class="material-symbols-outlined text-[18px]">play_arrow</span>' +
      esc(t('guide.hero.startTour')) + '</button>' +
      '<a href="index.html" class="bb-btn bb-btn-ghost">' +
      '<span class="material-symbols-outlined text-[18px]">dashboard</span>' +
      esc(t('guide.hero.openDashboard')) + '</a>' +
      '<a href="faq.html" class="bb-btn bb-btn-ghost">' +
      '<span class="material-symbols-outlined text-[18px]">help</span>' +
      esc(t('guide.hero.readFaq')) + '</a>' +
      '</div></div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 px-5 sm:px-8 pb-5 sm:pb-8">' +
      promise('person_off', t('guide.hero.p1Title'), t('guide.hero.p1Body')) +
      promise('lock', t('guide.hero.p2Title'), t('guide.hero.p2Body')) +
      promise('cloud_off', t('guide.hero.p3Title'), t('guide.hero.p3Body')) +
      '</div></section>';
  }

  /* ---------- screen mocks ---------- */

  function mockFrame(inner) {
    return (
      '<div class="gd-mock" aria-hidden="true">' +
      '<div class="gd-mock-bar"><span class="gd-mock-dot"></span><span class="gd-mock-dot"></span>' +
      '<span class="gd-mock-dot"></span></div>' + inner + '</div>'
    );
  }

  function mockRow(label, value) {
    return (
      '<div class="gd-mock-row"><span class="gd-mock-label">' + esc(label) + '</span>' +
      '<span class="gd-mock-num">' + esc(value) + '</span></div>'
    );
  }

  function mockSetup() {
    return mockFrame(
      '<div class="gd-mock-panel">' +
        '<div class="gd-mock-label">' + esc(t('guide.mock.term')) + '</div>' +
        '<div class="gd-mock-field"></div>' +
        '<div class="gd-mock-label mt-2">' + esc(t('guide.mock.start')) + '</div>' +
        '<div class="gd-mock-field"></div>' +
        '<div class="gd-mock-btn mt-3">' + esc(t('guide.mock.save')) + '</div>' +
        '</div>'
    );
  }

  function mockSubject() {
    return mockFrame(
      '<div class="gd-mock-panel">' +
        '<div class="gd-mock-row"><span class="gd-mock-chip gd-mock-chip-solid">CPT6114</span>' +
        '<span class="gd-mock-strong">' + esc(t('guide.mock.subject')) + '</span></div>' +
        '<div class="gd-mock-row mt-2"><span class="gd-mock-line" style="width:52%"></span>' +
        '<span class="gd-mock-num">20%</span></div>' +
        '<div class="gd-mock-row mt-2"><span class="gd-mock-line" style="width:38%"></span>' +
        '<span class="gd-mock-num">30%</span></div>' +
        '<div class="gd-mock-row mt-2"><span class="gd-mock-line" style="width:46%"></span>' +
        '<span class="gd-mock-num">50%</span></div>' +
        '<div class="gd-mock-row gd-mock-total mt-3"><span>' + esc(t('guide.mock.total')) + '</span>' +
        '<span class="gd-mock-num">100%</span></div>' +
        '</div>'
    );
  }

  function mockDashboard() {
    return mockFrame(
      '<div class="gd-mock-panel">' +
        '<div class="gd-mock-label">' + esc(t('guide.mock.nextClass')) + '</div>' +
        '<div class="gd-mock-row mt-1"><span class="gd-mock-strong">CPT6114</span>' +
        '<span class="gd-mock-chip gd-mock-chip-solid">CQAR3002</span></div>' +
        '<div class="gd-mock-row mt-2"><span class="gd-mock-line" style="width:44%"></span>' +
        '<span class="gd-mock-num">14:00</span></div>' +
        '<div class="gd-mock-grid mt-3">' +
        '<div class="gd-mock-tile"><span class="gd-mock-num">3</span></div>' +
        '<div class="gd-mock-tile"><span class="gd-mock-num">86%</span></div>' +
        '</div></div>'
    );
  }

  function mockSimulator() {
    return mockFrame(
      '<div class="gd-mock-panel">' +
        mockRow(t('guide.mock.quiz'), '80 / 100') +
        '<div class="mt-2">' + mockRow(t('guide.mock.test'), '— / 100') + '</div>' +
        '<div class="mt-2">' + mockRow(t('guide.mock.final'), '— / 100') + '</div>' +
        '<div class="gd-mock-note mt-3">' + esc(t('sim.undetermined')) + '</div>' +
        '</div>'
    );
  }

  function mockAttendance() {
    return mockFrame(
      '<div class="gd-mock-panel">' +
        mockRow(t('guide.mock.attendance'), '86%') +
        '<div class="gd-mock-track mt-2"><span style="width:86%"></span></div>' +
        '<div class="mt-3">' + mockRow(t('guide.mock.deadline'), 'W4') + '</div>' +
        '<div class="gd-mock-line mt-2" style="width:68%"></div>' +
        '</div>'
    );
  }

  function mockStudylog() {
    return mockFrame(
      '<div class="gd-mock-panel">' +
        '<div class="gd-mock-label">' + esc(t('guide.mock.timer')) + '</div>' +
        '<div class="gd-mock-timer num">00:42:10</div>' +
        '<div class="gd-mock-row mt-3"><span class="gd-mock-line" style="width:48%"></span>' +
        '<span class="gd-mock-chip">' + esc(t('guide.mock.export')) + '</span></div>' +
        '</div>'
    );
  }

  var MOCKS = {
    setup: mockSetup,
    subject: mockSubject,
    dashboard: mockDashboard,
    simulator: mockSimulator,
    attendance: mockAttendance,
    studylog: mockStudylog
  };

  /* ---------- tour ---------- */

  function todoList(key) {
    var items = [1, 2, 3]
      .map(function (n) {
        return (
          '<li class="flex items-start gap-2">' +
          '<span class="material-symbols-outlined text-[16px] text-primary mt-0.5">check_circle</span>' +
          '<span class="text-body-sm text-body">' + esc(t('guide.steps.' + key + '.todo' + n)) + '</span></li>'
        );
      })
      .join('');
    return (
      '<div class="mt-4"><div class="bb-label">' + esc(t('guide.tour.todoTitle')) + '</div>' +
      '<ul class="space-y-1.5">' + items + '</ul></div>'
    );
  }

  function stepBody(item) {
    var base = 'guide.steps.' + item.key;
    return (
      '<div class="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">' +
      '<div class="min-w-0">' +
      '<h3 class="text-headline-sm font-bold text-ink">' + esc(t(base + '.title')) + '</h3>' +
      '<p class="text-body-md text-muted mt-2">' + esc(t(base + '.body')) + '</p>' +
      todoList(item.key) +
      '<a href="' + item.page + '" class="bb-btn bb-btn-primary mt-4">' +
      '<span class="material-symbols-outlined text-[18px]">open_in_new</span>' +
      esc(t(base + '.cta')) + '</a>' +
      '</div>' +
      '<div class="min-w-0">' +
      '<div class="bb-label">' + esc(t('guide.tour.mockLabel')) + '</div>' +
      MOCKS[item.mock]() +
      '</div></div>'
    );
  }

  function doneBody() {
    return (
      '<div class="text-center py-4">' +
      '<span class="material-symbols-outlined text-[28px] text-success">task_alt</span>' +
      '<p class="text-body-md text-body mt-2 max-w-3xl mx-auto">' + esc(t('guide.tour.done')) + '</p>' +
      '<div class="flex flex-col sm:flex-row justify-center gap-2 mt-4">' +
      '<a href="index.html" class="bb-btn bb-btn-primary">' +
      '<span class="material-symbols-outlined text-[18px]">dashboard</span>' +
      esc(t('guide.hero.openDashboard')) + '</a>' +
      '<button type="button" id="tour-restart" class="bb-btn bb-btn-ghost">' +
      '<span class="material-symbols-outlined text-[18px]">restart_alt</span>' +
      esc(t('guide.tour.restart')) + '</button>' +
      '</div></div>'
    );
  }

  function renderTour() {
    var total = STEPS.length;
    var done = step >= total;
    var current = done ? total - 1 : step;
    var percent = Math.round(((done ? total : step + 1) / total) * 100);

    var prevDisabled = step === 0;
    var nextLabel = done ? t('guide.tour.restart') : step === total - 1 ? t('guide.tour.finish') : t('guide.tour.next');

    document.getElementById('guide-tour').innerHTML =
      '<section class="bb-card overflow-hidden" id="tour-card" tabindex="-1">' +
      '<div class="px-5 sm:px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2">' +
      '<div class="flex items-center gap-2 min-w-0">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">play_circle</span>' +
      '<h2 class="text-title-md font-bold text-ink">' + esc(t('guide.tour.label')) + '</h2></div>' +
      '<span class="text-caption text-muted num" id="tour-counter">' +
      esc(t('guide.tour.stepOf', { n: done ? total : step + 1, total: total })) + '</span>' +
      '</div>' +
      '<div class="px-5 sm:px-6 pt-4">' +
      '<div class="gd-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" ' +
      'aria-valuenow="' + (done ? total : step + 1) + '" aria-label="' + esc(t('guide.tour.progressAria')) + '">' +
      '<span class="gd-progress-bar" id="tour-progress" style="width:' + percent + '%"></span></div>' +
      '</div>' +
      '<div id="tour-stage" class="gd-stage p-5 sm:p-6">' +
      (done ? doneBody() : stepBody(STEPS[current])) +
      '</div>' +
      '<div class="px-5 sm:px-6 py-4 border-t border-border flex items-center justify-between gap-3">' +
      '<button type="button" id="tour-prev" class="bb-btn bb-btn-ghost"' + (prevDisabled ? ' disabled' : '') + '>' +
      '<span class="material-symbols-outlined text-[18px]">arrow_back</span>' +
      esc(t('guide.tour.prev')) + '</button>' +
      '<button type="button" id="tour-next" class="bb-btn bb-btn-primary">' +
      esc(nextLabel) +
      '<span class="material-symbols-outlined text-[18px]">' + (done ? 'restart_alt' : 'arrow_forward') + '</span>' +
      '</button></div></section>';
  }

  /* ステップの切り替えは控えめなフェード＋縦のスライド。
     prefers-reduced-motion のときは待たずに差し替える。 */
  function goTo(next) {
    if (swapping || next === step) return;
    var total = STEPS.length;
    if (next < 0 || next > total) return;

    var stage = document.getElementById('tour-stage');
    if (!stage || reducedMotion()) {
      step = next;
      renderTour();
      return;
    }

    swapping = true;
    stage.classList.add('gd-stage-out');
    window.setTimeout(function () {
      step = next;
      renderTour();
      var fresh = document.getElementById('tour-stage');
      if (fresh) {
        fresh.classList.add('gd-stage-in');
        /* 次フレームで外して transition を効かせる。 */
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            fresh.classList.remove('gd-stage-in');
          });
        });
      }
      swapping = false;
    }, 150);
  }

  /* ---------- features ---------- */

  function featureCard(key, index) {
    var base = 'guide.features.' + key;
    var steps = [1, 2, 3]
      .map(function (n) {
        return (
          '<li class="flex items-start gap-2">' +
          '<span class="gd-num">' + n + '</span>' +
          '<span class="text-body-sm text-body">' + esc(t(base + '.step' + n)) + '</span></li>'
        );
      })
      .join('');
    return (
      '<article class="bb-card p-5 flex flex-col gap-3">' +
      '<div class="flex items-start gap-3">' +
      '<span class="gd-num gd-num-lg">' + (index + 1) + '</span>' +
      '<div class="min-w-0"><h3 class="text-title-md font-bold text-ink">' + esc(t(base + '.title')) + '</h3>' +
      '<p class="text-body-sm text-muted mt-1">' + esc(t(base + '.body')) + '</p></div></div>' +
      '<div><div class="bb-label">' + esc(t('guide.features.stepsLabel')) + '</div>' +
      '<ol class="space-y-1.5">' + steps + '</ol></div>' +
      '<div class="gd-tip"><div class="bb-label">' + esc(t('guide.features.tipsLabel')) + '</div>' +
      '<p class="text-body-sm text-body">' + esc(t(base + '.tip')) + '</p></div>' +
      '</article>'
    );
  }

  function renderFeatures() {
    document.getElementById('guide-features').innerHTML =
      '<section class="space-y-4">' +
      '<div><h2 class="text-headline-sm font-bold text-ink">' + esc(t('guide.features.title')) + '</h2>' +
      '<p class="text-body-sm text-muted mt-1">' + esc(t('guide.features.subtitle')) + '</p></div>' +
      '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">' +
      FEATURES.map(featureCard).join('') +
      '</div></section>';
  }

  /* ---------- help ---------- */

  function renderHelp() {
    document.getElementById('guide-help').innerHTML =
      '<section class="bb-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">' +
      '<div class="min-w-0"><h2 class="text-title-md font-bold text-ink">' + esc(t('guide.help.title')) + '</h2>' +
      '<p class="text-body-sm text-muted mt-1">' + esc(t('guide.help.body')) + '</p></div>' +
      '<div class="flex flex-col sm:flex-row gap-2 shrink-0">' +
      '<a href="faq.html" class="bb-btn bb-btn-ghost">' +
      '<span class="material-symbols-outlined text-[18px]">help</span>' +
      esc(t('guide.help.faq')) + '</a>' +
      '<a href="contact.html" class="bb-btn bb-btn-primary">' +
      '<span class="material-symbols-outlined text-[18px]">forum</span>' +
      esc(t('guide.help.contact')) + '</a>' +
      '</div></section>';
  }

  /* ---------- wiring ---------- */

  document.addEventListener('click', function (event) {
    var target = event.target.closest ? event.target.closest('button') : null;
    if (!target) return;

    if (target.id === 'tour-start') {
      step = 0;
      renderTour();
      var card = document.getElementById('tour-card');
      if (card) {
        card.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
        card.focus({ preventScroll: true });
      }
      return;
    }
    if (target.id === 'tour-next') {
      goTo(step >= STEPS.length ? 0 : step + 1);
      return;
    }
    if (target.id === 'tour-prev') {
      goTo(step - 1);
      return;
    }
    if (target.id === 'tour-restart') {
      goTo(0);
    }
  });

  renderHero();
  renderTour();
  renderFeatures();
  renderHelp();
})();
