(function () {
  'use strict';

  var BB = window.BB;
  var t = BB.i18n.t;
  var tn = BB.i18n.tn;
  /* 日付は保存値（ISO）から描画時に整形する。保存時に整形すると言語に追随しない。 */
  var fmtDate = BB.dash.fmtIsoDate;

  function headOptions() {
    return { title: t('settings.title'), subtitle: t('settings.subtitle') };
  }

  function mountPage() {
    BB.ui.mount({ title: t('nav.settings'), head: headOptions() });
  }

  mountPage();

  function state() {
    return BB.store.get();
  }

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setPath(target, path, value) {
    var parts = path.split('.');
    var node = target;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  }

  function applyTheme(theme) {
    BB.theme.apply(theme);
  }

  function section(icon, title, subtitle, body, compact) {
    return (
      '<section class="bb-card overflow-hidden">' +
      '<div class="px-6 py-4 border-b border-border flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">' + icon + '</span>' +
      '<div><h2 class="text-title-md font-bold text-ink">' + title + '</h2>' +
      '<p class="text-body-sm text-muted">' + subtitle + '</p></div></div>' +
      '<div class="' + (compact ? 'px-6 py-4' : 'p-6') + '">' + body + '</div></section>'
    );
  }

  function profileSection() {
    var data = state();
    return section(
      'person',
      t('settings.profile.title'),
      t('settings.profile.subtitle'),
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div><label class="bb-label" for="s-name">' + t('settings.profile.fullName') + '</label>' +
        '<input id="s-name" class="bb-input" type="text" value="' + esc(data.student.name) + '" data-setting="student.name">' +
        '<p class="text-caption text-muted mt-1.5">' + t('settings.profile.fullNameHint') + '</p></div>' +
        '<div><label class="bb-label" for="s-programme">' + t('settings.profile.programme') + '</label>' +
        '<input id="s-programme" class="bb-input" type="text" value="' + esc(data.student.programme) + '" data-setting="student.programme">' +
        '<p class="text-caption text-muted mt-1.5">' + t('settings.profile.programmeHint') + '</p></div>' +
        '<div><label class="bb-label" for="s-year">' + t('settings.profile.year') + '</label>' +
        '<select id="s-year" class="bb-input" data-setting="student.year">' +
        [1, 2, 3, 4]
          .map(function (year) {
            return '<option value="' + year + '"' + (Number(data.student.year) === year ? ' selected' : '') + '>' +
              t('settings.profile.yearOption', { n: year }) + '</option>';
          })
          .join('') +
        '</select>' +
        '<p class="text-caption text-muted mt-1.5">' + t('settings.profile.yearHint') + '</p></div>' +
        '<div><label class="bb-label" for="s-id">' + t('settings.profile.studentId') + '</label>' +
        '<input id="s-id" class="bb-input num" type="text" value="' + esc(data.student.studentId) + '" data-setting="student.studentId">' +
        '<p class="text-caption text-muted mt-1.5">' + t('settings.profile.studentIdHint') + '</p></div>' +
        '<div class="sm:col-span-2"><label class="bb-label" for="s-term">' + t('settings.profile.activeTrimester') + '</label>' +
        '<input id="s-term" class="bb-input" type="text" value="' + esc(BB.ui.termLabel(data)) + '" disabled>' +
        '<p class="text-caption text-muted mt-1.5">' + t('settings.profile.activeTrimesterHint') + '</p></div>' +
        '</div>'
    );
  }

  function subjectsSection() {
    var data = state();
    var rows = data.subjects
      .map(function (subject) {
        return (
          '<div class="flex items-center justify-between gap-3 py-3 border-b border-border-subtle last:border-0">' +
          '<div class="flex items-center gap-3 min-w-0">' + BB.ui.solidChip(subject.color, subject.id) +
          '<div class="min-w-0"><div class="text-body-md font-semibold text-ink truncate">' + esc(subject.name) + '</div>' +
          '<div class="text-caption text-muted">' + t('common.credits', { n: subject.credits }) + ' • ' +
          tn('form.sessionCount', subject.sessions.length) + ' • ' +
          tn('form.componentCount', subject.assessments.length) + '</div></div></div>' +
          '<a href="subject-edit.html?id=' + encodeURIComponent(subject.id) + '" class="bb-btn bb-btn-ghost" style="height:34px">' +
          '<span class="material-symbols-outlined text-[16px]">edit</span>' + t('common.edit') + '</a></div>'
        );
      })
      .join('');

    var empty =
      '<div class="py-6 text-center">' +
      '<span class="material-symbols-outlined text-[28px] text-placeholder">menu_book</span>' +
      '<p class="text-body-sm text-muted mt-2">' + t('settings.subjects.empty') + '</p></div>';

    return section(
      'menu_book',
      t('settings.subjects.title'),
      t('settings.subjects.subtitle'),
      '<div class="flex items-center justify-between gap-3 pb-3 border-b border-border">' +
        '<div><div class="text-caption text-muted">' + t('settings.subjects.activeCycle') + '</div>' +
        '<div class="text-body-md font-semibold text-ink">' + esc(BB.ui.termLabel(data)) + '</div></div>' +
        '<span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-primary)">' +
        tn('settings.subjects.count', data.subjects.length) + '</span></div>' +
        (rows || empty) +
        '<div class="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
        '<p class="text-caption text-muted">' + t('settings.subjects.hint') + '</p>' +
        '<a href="subject-edit.html?new=1" class="bb-btn bb-btn-primary shrink-0">' +
        '<span class="material-symbols-outlined text-[18px]">add</span>' + t('settings.subjects.add') + '</a></div>'
    );
  }

  /* 初回セットアップをいつでも開き直せる導線。 */
  function setupSection() {
    return section(
      'add_task',
      t('settings.setup.title'),
      t('settings.setup.subtitle'),
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
        '<p class="text-body-sm text-muted">' + t('settings.setup.body') + '</p>' +
        '<a href="setup.html" class="bb-btn bb-btn-primary shrink-0">' +
        '<span class="material-symbols-outlined text-[18px]">arrow_forward</span>' + t('settings.setup.cta') + '</a></div>'
    );
  }

  function appearanceSection() {
    var data = state();
    var themes = [
      { id: 'light', label: t('settings.appearance.light'), icon: 'light_mode' },
      { id: 'dark', label: t('settings.appearance.dark'), icon: 'dark_mode' },
      { id: 'system', label: t('settings.appearance.system'), icon: 'desktop_windows' }
    ];
    var themeButtons = themes
      .map(function (theme) {
        var active = data.settings.theme === theme.id;
        return (
          '<button type="button" data-theme-option="' + theme.id + '" class="bb-btn ' +
          (active ? 'bb-btn-primary' : 'bb-btn-ghost') + '">' +
          '<span class="material-symbols-outlined text-[18px]">' + theme.icon + '</span>' + theme.label + '</button>'
        );
      })
      .join('');

    var colors = data.subjects
      .map(function (subject) {
        return (
          '<div class="flex items-center justify-between gap-3 py-2.5 border-b border-border-subtle last:border-0">' +
          '<div class="flex items-center gap-3">' +
          '<span class="w-5 h-5 rounded" style="background:' + subject.color + '"></span>' +
          '<span class="text-body-sm text-ink">' + subject.name + '</span>' +
          '<span class="text-caption text-muted num">' + subject.id + '</span></div>' +
          '<a href="subject-edit.html?id=' + subject.id + '" class="text-caption font-semibold text-primary hover:underline">' +
          t('settings.appearance.change') + '</a></div>'
        );
      })
      .join('');

    return section(
      'palette',
      t('settings.appearance.title'),
      t('settings.appearance.subtitle'),
      '<div class="space-y-5">' +
        '<div><div class="bb-label">' + t('settings.appearance.themeMode') + '</div>' +
        '<div class="flex flex-wrap gap-2">' + themeButtons + '</div>' +
        '<p class="text-caption text-muted mt-2">' + t('settings.appearance.themeHint') + '</p></div>' +
        '<div><div class="bb-label">' + t('settings.appearance.taxonomy') + '</div>' + colors + '</div>' +
        '</div>'
    );
  }

  /* 言語は保存するだけでなく、その場で全ページに効く。 */
  function languageSection() {
    var active = BB.i18n.lang();
    var options = BB.i18n.languages
      .map(function (language) {
        return '<option value="' + language.id + '"' + (language.id === active ? ' selected' : '') + '>' +
          esc(language.label) + '</option>';
      })
      .join('');

    return section(
      'translate',
      t('settings.language.title'),
      t('settings.language.subtitle'),
      '<div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">' +
        '<label class="bb-label sm:mb-0 sm:w-40 shrink-0" for="s-lang">' + t('settings.language.label') + '</label>' +
        '<select id="s-lang" class="bb-input sm:max-w-xs" data-lang-select>' + options + '</select>' +
        '<p class="text-caption text-muted">' + t('settings.language.hint') + '</p></div>',
      true
    );
  }

  function goalsSection() {
    var data = state();
    return section(
      'flag',
      t('settings.goals.title'),
      t('settings.goals.subtitle'),
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div><label class="bb-label" for="s-cgpa">' + t('settings.goals.cgpa') + '</label>' +
        '<input id="s-cgpa" class="bb-input num" type="number" min="0" max="4" step="0.01" value="' +
        data.settings.cgpaTarget + '" data-setting="settings.cgpaTarget">' +
        '<p class="text-caption text-muted mt-1.5">' + t('settings.goals.cgpaHint') + '</p></div>' +
        '<div><label class="bb-label" for="s-att">' + t('settings.goals.attendance') + '</label>' +
        '<input id="s-att" class="bb-input num" type="number" min="0" max="100" step="1" value="' +
        data.settings.attendanceThreshold + '" data-setting="settings.attendanceThreshold">' +
        '<p class="text-caption text-muted mt-1.5">' + t('settings.goals.attendanceHint') + '</p></div>' +
        '<div><label class="bb-label" for="s-study">' + t('settings.goals.study') + '</label>' +
        '<input id="s-study" class="bb-input num" type="number" min="1" max="80" step="1" value="' +
        data.settings.weeklyStudyTarget + '" data-setting="settings.weeklyStudyTarget">' +
        '<p class="text-caption text-muted mt-1.5">' + t('settings.goals.studyHint') + '</p></div>' +
        '</div>'
    );
  }

  function timetableSection() {
    var data = state();
    return section(
      'calendar_month',
      t('settings.timetable.title'),
      t('settings.timetable.subtitle'),
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div><label class="bb-label" for="s-start">' + t('settings.timetable.startDate') + '</label>' +
        '<input id="s-start" class="bb-input" type="date" value="' + esc(data.term.startDate) +
        '" data-setting="term.startDate">' +
        '<p class="text-caption text-muted mt-1.5">' + t('settings.timetable.startDateHint') + '</p>' +
        (data.term.startDate
          ? ''
          : '<p class="text-caption text-alert mt-1">' + t('settings.timetable.startDateMissing') + '</p>') +
        '</div>' +
        '<div><label class="bb-label" for="s-weeks">' + t('settings.timetable.weeks') + '</label>' +
        '<input id="s-weeks" class="bb-input num" type="number" min="1" max="30" value="' + (data.term.weeks || 14) +
        '" data-setting="term.weeks">' +
        '<p class="text-caption text-muted mt-1.5">' + t('settings.timetable.weeksHint') + '</p></div>' +
        '</div>'
    );
  }

  /* 次の学期の Week 1 候補。今学期の開始日＋週数、無ければ次の月曜。 */
  function suggestedStart() {
    var data = state();
    var start = BB.date.parse(data.term.startDate);
    var weeks = data.term.weeks || 14;
    var next;
    if (start) {
      next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + weeks * 7);
    } else {
      var today = new Date();
      var offset = (8 - today.getDay()) % 7 || 7;
      next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    }
    return next.getFullYear() + '-' + pad2(next.getMonth() + 1) + '-' + pad2(next.getDate());
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function termSection() {
    var data = state();
    var archive = data.archive || [];
    var archived = archive.length
      ? archive
          .map(function (entry, index) {
            return (
              '<div class="flex items-center justify-between gap-3 py-2.5 border-b border-border-subtle last:border-0">' +
              '<div><div class="text-body-sm font-semibold text-ink">' + esc(entry.term.label) + '</div>' +
              '<div class="text-caption text-muted">' +
              t('settings.term.archivedMeta', {
                date: fmtDate(entry.term.startDate) || t('common.notSet'),
                modules: tn('common.moduleCount', entry.subjects.length),
                when: fmtDate(entry.archivedAt)
              }) + '</div></div>' +
              '<button type="button" data-restore-term="' + index + '" class="bb-btn bb-btn-ghost" style="height:32px;font-size:.75rem">' +
              t('settings.term.restore') + '</button></div>'
            );
          })
          .join('')
      : '<p class="text-body-sm text-muted">' + t('settings.term.none') + '</p>';

    return section(
      'event_repeat',
      t('settings.term.title'),
      t('settings.term.subtitle'),
      '<div class="space-y-5">' +
        '<div class="rounded-control border border-border bg-canvas p-4">' +
        '<div class="text-caption uppercase tracking-wider text-muted">' + t('settings.term.active') + '</div>' +
        '<div class="text-title-md font-bold text-ink">' + esc(BB.ui.termLabel(data)) + '</div>' +
        '<div class="text-body-sm text-muted">' +
        (data.term.startDate
          ? t('settings.term.starts', { date: esc(fmtDate(data.term.startDate)) })
          : t('settings.term.startNotSet')) + ' • ' +
        t('settings.term.weeksExam', {
          weeks: data.term.weeks || 14,
          exam: data.term.examWeek || (data.term.weeks || 14) + 1
        }) +
        '</div></div>' +
        '<div><div class="bb-label">' + t('settings.term.startNext') + '</div>' +
        '<p class="text-caption text-muted mb-2">' + t('settings.term.scopeHint') + '</p>' +
        '<form id="term-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div class="sm:col-span-2"><label class="bb-label" for="t-label">' + t('settings.term.label') + '</label>' +
        '<input id="t-label" name="termLabel" class="bb-input" type="text" placeholder="' +
        esc(t('settings.term.labelPlaceholder')) + '" required></div>' +
        '<div><label class="bb-label" for="t-start">' + t('settings.term.week1') + '</label>' +
        '<input id="t-start" name="termStart" class="bb-input" type="date" value="' + suggestedStart() + '" required></div>' +
        '<div><label class="bb-label" for="t-weeks">' + t('settings.term.weeks') + '</label>' +
        '<input id="t-weeks" name="termWeeks" class="bb-input num" type="number" min="1" max="30" step="1" value="' +
        (data.term.weeks || 14) + '"></div>' +
        '<div><label class="bb-label" for="t-exam">' + t('settings.term.examWeek') + '</label>' +
        '<input id="t-exam" name="termExam" class="bb-input num" type="number" min="1" max="30" step="1" value="' +
        (data.term.examWeek || (data.term.weeks || 14) + 1) + '"></div>' +
        '<div class="sm:col-span-2 rounded-control border border-border-subtle bg-canvas p-3.5">' +
        '<div class="text-caption uppercase tracking-wider text-muted">' + t('settings.term.whatHappens') + '</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 text-body-sm">' +
        '<div class="flex items-start gap-2"><span class="material-symbols-outlined text-[18px] text-success">check</span>' +
        '<span class="text-body">' + tn('settings.term.kept', data.subjects.length) + '</span></div>' +
        '<div class="flex items-start gap-2"><span class="material-symbols-outlined text-[18px] text-alert">warning</span>' +
        '<span class="text-body">' + t('settings.term.cleared') + '</span></div>' +
        '</div></div>' +
        '<div class="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
        '<p class="text-caption text-muted">' + t('settings.term.adjust') + '</p>' +
        '<button type="submit" class="bb-btn bb-btn-primary shrink-0">' +
        '<span class="material-symbols-outlined text-[18px]">arrow_forward</span>' + t('settings.term.start') + '</button></div>' +
        '</form></div>' +
        '<div><div class="bb-label">' + t('settings.term.archived') + '</div>' + archived + '</div>' +
        '</div>'
    );
  }

  function dataSection() {
    return section(
      'database',
      t('settings.data.title'),
      t('settings.data.subtitle'),
      '<div class="flex flex-wrap items-center gap-3">' +
        '<button type="button" id="export-data" class="bb-btn bb-btn-ghost">' +
        '<span class="material-symbols-outlined text-[18px]">download</span>' + t('settings.data.export') + '</button>' +
        '<label class="bb-btn bb-btn-ghost cursor-pointer">' +
        '<span class="material-symbols-outlined text-[18px]">upload</span>' + t('settings.data.import') +
        '<input type="file" id="import-data" accept="application/json" class="hidden"></label>' +
        '<button type="button" id="reset-data" class="bb-btn bb-btn-danger">' +
        '<span class="material-symbols-outlined text-[18px]">warning</span>' + t('settings.data.reset') + '</button>' +
        '</div>' +
        '<p class="text-caption text-muted mt-3">' + t('settings.data.hint') + '</p>'
    );
  }

  function installSection() {
    /* プロンプトが無い・インストール済みのときは、押せないボタンを置かない。 */
    if (!BB.install.available()) return '';
    return section(
      'download',
      t('settings.install.title'),
      t('settings.install.subtitle'),
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
        '<p class="text-body-sm text-muted">' + t('settings.install.body') + '</p>' +
        '<button type="button" id="install-app" class="bb-btn bb-btn-primary shrink-0">' +
        '<span class="material-symbols-outlined text-[18px]">download</span>' +
        t('settings.install.button') + '</button></div>'
    );
  }

  /* ヘルプ系 3 ページへの導線。設定の最後にまとめて置く。 */
  function helpSection() {
    return section(
      'help',
      t('settings.help.title'),
      t('settings.help.subtitle'),
      '<div class="flex flex-col sm:flex-row sm:flex-wrap gap-2">' +
        '<a href="guide.html" class="bb-btn bb-btn-ghost">' +
        '<span class="material-symbols-outlined text-[18px]">menu_book</span>' +
        t('settings.help.guide') + '</a>' +
        '<a href="faq.html" class="bb-btn bb-btn-ghost">' +
        '<span class="material-symbols-outlined text-[18px]">help</span>' +
        t('settings.help.faq') + '</a>' +
        '<a href="contact.html" class="bb-btn bb-btn-ghost">' +
        '<span class="material-symbols-outlined text-[18px]">forum</span>' +
        t('settings.help.contact') + '</a>' +
        '</div>'
    );
  }

  function render() {
    document.getElementById('settings').innerHTML =
      profileSection() +
      subjectsSection() +
      setupSection() +
      appearanceSection() +
      languageSection() +
      goalsSection() +
      timetableSection() +
      termSection() +
      dataSection() +
      installSection() +
      helpSection();
  }

  document.addEventListener('submit', function (event) {
    if (event.target.id !== 'term-form') return;
    event.preventDefault();
    var form = event.target;
    var label = form.elements.termLabel.value.trim();
    var startDate = form.elements.termStart.value;
    var weeks = Number(form.elements.termWeeks.value);
    var examWeek = Number(form.elements.termExam.value);
    if (!label || !startDate || !isFinite(weeks) || weeks < 1) {
      BB.ui.toast(t('settings.toast.fillAll'));
      return;
    }
    BB.ui
      .confirm({
        title: t('settings.confirm.startTitle', { label: label }),
        message: t('settings.confirm.startBody'),
        confirmLabel: t('settings.confirm.startConfirm')
      })
      .then(function (ok) {
        if (!ok) return;
        BB.store.startTerm({
          id: 'term-' + Date.now(),
          label: label,
          shortLabel: label,
          startDate: startDate,
          weeks: weeks,
          examWeek: isFinite(examWeek) && examWeek > 0 ? examWeek : weeks + 1
        });
        BB.ui.toast(t('settings.toast.switched', { label: label }));
        BB.ui.refreshChrome();
        render();
      });
  });

  /* テキスト入力は打鍵のたびに保存する。blur 待ちだと入力直後の再読込で変更が消える。 */
  document.addEventListener('input', function (event) {
    var field = event.target.closest('[data-setting]');
    if (!field) return;
    if (field.type === 'checkbox' || field.type === 'number' || field.tagName === 'SELECT') return;
    var path = field.getAttribute('data-setting');
    BB.store.update(function (data) {
      setPath(data, path, field.value);
      if (path === 'student.name') data.student.initials = BB.ui.initials(field.value);
    });
    BB.ui.refreshChrome();
  });

  document.addEventListener('change', function (event) {
    var field = event.target.closest('[data-setting]');
    if (!field) return;
    var path = field.getAttribute('data-setting');
    var value;
    if (field.type === 'checkbox') value = field.checked;
    else if (field.type === 'number') value = Number(field.value);
    else value = field.value;

    BB.store.update(function (data) {
      setPath(data, path, value);
      if (path === 'student.name') data.student.initials = BB.ui.initials(value);
      /* 学年は選択式だが、保存状態には数値で持たせて辞書の補間が崩れないようにする。 */
      if (path === 'student.year') data.student.year = Number(value) || 1;
    });
    BB.ui.toast(t('common.saved'));
    BB.ui.refreshChrome();
    render();
  });

  /* 言語の切り替え。保存してから、この画面を新しい言語で描き直す。 */
  document.addEventListener('change', function (event) {
    var select = event.target.closest('[data-lang-select]');
    if (!select) return;
    BB.i18n.setLang(select.value);
    mountPage();
    BB.ui.refreshChrome();
    render();
  });

  document.addEventListener('click', function (event) {
    var restoreButton = event.target.closest('[data-restore-term]');
    if (restoreButton) {
      var index = Number(restoreButton.getAttribute('data-restore-term'));
      BB.ui
        .confirm({
          title: t('settings.confirm.restoreTitle'),
          message: t('settings.confirm.restoreBody'),
          confirmLabel: t('settings.confirm.restoreConfirm')
        })
        .then(function (ok) {
          if (!ok) return;
          BB.store.restoreTerm(index);
          BB.ui.toast(t('settings.toast.restored'));
          BB.ui.refreshChrome();
          render();
        });
      return;
    }

    var themeButton = event.target.closest('[data-theme-option]');
    if (themeButton) {
      var theme = themeButton.getAttribute('data-theme-option');
      BB.store.update(function (data) {
        data.settings.theme = theme;
      });
      applyTheme(theme);
      BB.ui.toast(t('settings.toast.themeSet', { theme: t('settings.appearance.' + theme) }));
      render();
      return;
    }

    if (event.target.closest('#install-app')) {
      BB.install.prompt().then(function (accepted) {
        if (accepted) BB.ui.toast(t('settings.install.toastInstalled'));
        render();
      });
      return;
    }

    if (event.target.closest('#export-data')) {
      var blob = new Blob([JSON.stringify(state(), null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'mmu-beeboard-backup.json';
      link.click();
      URL.revokeObjectURL(url);
      BB.ui.toast(t('settings.toast.backup'));
      return;
    }

    if (event.target.closest('#reset-data')) {
      BB.ui
        .confirm({
          title: t('settings.confirm.resetTitle'),
          message: t('settings.confirm.resetBody'),
          confirmLabel: t('settings.confirm.resetConfirm'),
          danger: true
        })
        .then(function (ok) {
          if (!ok) return;
          BB.store.reset();
          window.location.reload();
        });
    }
  });

  document.addEventListener('change', function (event) {
    if (event.target.id !== 'import-data') return;
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var imported = JSON.parse(String(reader.result));
        if (!imported || !imported.subjects) throw new Error('invalid');
        BB.store.update(function (data) {
          Object.keys(imported).forEach(function (key) {
            data[key] = imported[key];
          });
        });
        BB.ui.toast(t('settings.toast.imported'));
        window.location.reload();
      } catch (error) {
        BB.ui.toast(t('settings.toast.importFailed'));
      }
    };
    reader.readAsText(file);
  });

  applyTheme(state().settings.theme);
  render();

  /* 他タブの保存を取り込んだら描き直す。入力中の欄があれば触らない。 */
  BB.store.subscribe(function () {
    var active = document.activeElement;
    if (active && active.closest && active.closest('#settings') && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName)) {
      return;
    }
    applyTheme(state().settings.theme);
    BB.ui.refreshChrome();
    render();
  });

  /* インストールの可否が変わったら（appinstalled など）ボタンを出し入れする。 */
  BB.install.subscribe(function () {
    render();
  });
})();
