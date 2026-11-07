(function () {
  'use strict';

  var BB = window.BB;

  BB.ui.mount({
    title: 'Settings',
    head: {
      title: 'Settings & Preferences',
      subtitle: 'Manage your student profile, portal appearance, academic benchmarks, and timetable preferences.'
    }
  });

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

  function section(icon, title, subtitle, body) {
    return (
      '<section class="bb-card overflow-hidden">' +
      '<div class="px-6 py-4 border-b border-border flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">' + icon + '</span>' +
      '<div><h2 class="text-title-md font-bold text-ink">' + title + '</h2>' +
      '<p class="text-body-sm text-muted">' + subtitle + '</p></div></div>' +
      '<div class="p-6">' + body + '</div></section>'
    );
  }

  function profileSection() {
    var data = state();
    return section(
      'person',
      'Profile',
      'Personal and academic information displayed across the portal.',
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div><label class="bb-label" for="s-name">Full Name</label>' +
        '<input id="s-name" class="bb-input" type="text" value="' + esc(data.student.name) + '" data-setting="student.name">' +
        '<p class="text-caption text-muted mt-1.5">The avatar initials follow this name.</p></div>' +
        '<div><label class="bb-label" for="s-programme">Programme</label>' +
        '<input id="s-programme" class="bb-input" type="text" value="' + esc(data.student.programme) + '" disabled>' +
        '<p class="text-caption text-muted mt-1.5">Fixed placeholder — edit <code>STUDENT</code> in ' +
        '<code>assets/js/data.js</code> to change it.</p></div>' +
        '<div><label class="bb-label" for="s-id">Student ID</label>' +
        '<input id="s-id" class="bb-input num" type="text" value="' + esc(data.student.studentId) + '" data-setting="student.studentId">' +
        '<p class="text-caption text-muted mt-1.5">Optional. Shown in the footer when filled in.</p></div>' +
        '<div><label class="bb-label" for="s-term">Active Trimester</label>' +
        '<input id="s-term" class="bb-input" type="text" value="' + esc(data.term.label) + '" disabled>' +
        '<p class="text-caption text-muted mt-1.5">Change it in the Trimester section below.</p></div>' +
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
          '<div class="text-caption text-muted">' + subject.credits + ' Cr. • ' + subject.sessions.length +
          ' sessions • ' + subject.assessments.length + ' components</div></div></div>' +
          '<a href="subject-edit.html?id=' + encodeURIComponent(subject.id) + '" class="bb-btn bb-btn-ghost" style="height:34px">' +
          '<span class="material-symbols-outlined text-[16px]">edit</span>Edit</a></div>'
        );
      })
      .join('');

    var empty =
      '<div class="py-6 text-center">' +
      '<span class="material-symbols-outlined text-[28px] text-placeholder">menu_book</span>' +
      '<p class="text-body-sm text-muted mt-2">No subjects yet.</p></div>';

    return section(
      'menu_book',
      'Subjects &amp; Timetable',
      'Manage active subjects, session timings, and assessment weightings.',
      '<div class="flex items-center justify-between gap-3 pb-3 border-b border-border">' +
        '<div><div class="text-caption text-muted">Active Cycle</div>' +
        '<div class="text-body-md font-semibold text-ink">' + esc(data.term.label) + '</div></div>' +
        '<span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-primary)">' +
        data.subjects.length + ' subject' + (data.subjects.length === 1 ? '' : 's') + '</span></div>' +
        (rows || empty) +
        '<div class="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
        '<p class="text-caption text-muted">Add a module for this trimester, or edit an existing one.</p>' +
        '<a href="subject-edit.html?new=1" class="bb-btn bb-btn-primary shrink-0">' +
        '<span class="material-symbols-outlined text-[18px]">add</span>Add subject</a></div>'
    );
  }

  /* 初回セットアップをいつでも開き直せる導線。 */
  function setupSection() {
    return section(
      'add_task',
      'First-time setup',
      'Re-run the guided setup for your trimester and first subject.',
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
        '<p class="text-body-sm text-muted">The wizard walks through the trimester label, Week 1 start date, ' +
        'week count and your first subject. Skipping it is fine — nothing is locked.</p>' +
        '<a href="setup.html" class="bb-btn bb-btn-primary shrink-0">' +
        '<span class="material-symbols-outlined text-[18px]">arrow_forward</span>Open setup wizard</a></div>'
    );
  }

  function appearanceSection() {
    var data = state();
    var themes = [
      { id: 'light', label: 'Light', icon: 'light_mode' },
      { id: 'dark', label: 'Dark', icon: 'dark_mode' },
      { id: 'system', label: 'System', icon: 'desktop_windows' }
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
          '<a href="subject-edit.html?id=' + subject.id + '" class="text-caption font-semibold text-primary hover:underline">Change</a></div>'
        );
      })
      .join('');

    return section(
      'palette',
      'Appearance',
      'Customize the theme and subject palette across timetables and dashboards.',
      '<div class="space-y-5">' +
        '<div><div class="bb-label">Theme Mode</div>' +
        '<div class="flex flex-wrap gap-2">' + themeButtons + '</div>' +
        '<p class="text-caption text-muted mt-2">Dark palette is applied through CSS variables; subject colours stay identical in both themes.</p></div>' +
        '<div><div class="bb-label">Subject Color Taxonomy</div>' + colors + '</div>' +
        '</div>'
    );
  }

  function goalsSection() {
    var data = state();
    return section(
      'flag',
      'Goals &amp; Alerts',
      'Set the academic benchmarks used across the dashboard.',
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div><label class="bb-label" for="s-cgpa">CGPA Target</label>' +
        '<input id="s-cgpa" class="bb-input num" type="number" min="0" max="4" step="0.01" value="' +
        data.settings.cgpaTarget + '" data-setting="settings.cgpaTarget">' +
        '<p class="text-caption text-muted mt-1.5">Shown in the header and used by the Grade Simulator.</p></div>' +
        '<div><label class="bb-label" for="s-att">Attendance Warning Threshold (%)</label>' +
        '<input id="s-att" class="bb-input num" type="number" min="0" max="100" step="1" value="' +
        data.settings.attendanceThreshold + '" data-setting="settings.attendanceThreshold">' +
        '<p class="text-caption text-muted mt-1.5">Drives the attendance page, dashboard card and policy text.</p></div>' +
        '<div><label class="bb-label" for="s-study">Weekly Study Target (hours)</label>' +
        '<input id="s-study" class="bb-input num" type="number" min="1" max="80" step="1" value="' +
        data.settings.weeklyStudyTarget + '" data-setting="settings.weeklyStudyTarget">' +
        '<p class="text-caption text-muted mt-1.5">Used by the Study Log and the dashboard summary.</p></div>' +
        '</div>'
    );
  }

  function timetableSection() {
    var data = state();
    return section(
      'calendar_month',
      'Timetable',
      'Schedule boundaries and calendar configuration.',
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div><label class="bb-label" for="s-start">Term Start Date</label>' +
        '<input id="s-start" class="bb-input" type="date" value="' + esc(data.term.startDate) +
        '" data-setting="term.startDate">' +
        '<p class="text-caption text-muted mt-1.5">Week 1 Monday. Leave empty to keep every week number at Week 1.</p></div>' +
        '<div><label class="bb-label" for="s-weeks">Number of Weeks</label>' +
        '<input id="s-weeks" class="bb-input num" type="number" min="1" max="30" value="' + (data.term.weeks || 14) +
        '" data-setting="term.weeks">' +
        '<p class="text-caption text-muted mt-1.5">Teaching weeks before the exam week.</p></div>' +
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
              '<div class="text-caption text-muted">Starts ' + esc(entry.term.startDate || 'not set') + ' • ' +
              entry.subjects.length + ' module' + (entry.subjects.length === 1 ? '' : 's') +
              ' • archived ' + esc(String(entry.archivedAt).slice(0, 10)) + '</div></div>' +
              '<button type="button" data-restore-term="' + index + '" class="bb-btn bb-btn-ghost" style="height:32px;font-size:.75rem">Restore</button></div>'
            );
          })
          .join('')
      : '<p class="text-body-sm text-muted">No archived trimesters yet.</p>';

    return section(
      'event_repeat',
      'Trimester',
      'Move to the next trimester and keep past records archived in this browser.',
      '<div class="space-y-5">' +
        '<div class="rounded-control border border-border bg-canvas p-4">' +
        '<div class="text-caption uppercase tracking-wider text-muted">Active</div>' +
        '<div class="text-title-md font-bold text-ink">' + esc(data.term.label) + '</div>' +
        '<div class="text-body-sm text-muted">' +
        (data.term.startDate ? 'Starts ' + esc(data.term.startDate) : 'Start date not set') + ' • ' +
        (data.term.weeks || 14) + ' weeks • exam week ' + (data.term.examWeek || (data.term.weeks || 14) + 1) +
        '</div></div>' +
        '<div><div class="bb-label">Start next trimester</div>' +
        '<form id="term-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div class="sm:col-span-2"><label class="bb-label" for="t-label">Trimester label</label>' +
        '<input id="t-label" name="termLabel" class="bb-input" type="text" placeholder="Trimester Feb/Mar 2027" required></div>' +
        '<div><label class="bb-label" for="t-start">Week 1 starts (Monday)</label>' +
        '<input id="t-start" name="termStart" class="bb-input" type="date" value="' + suggestedStart() + '" required></div>' +
        '<div><label class="bb-label" for="t-weeks">Number of weeks</label>' +
        '<input id="t-weeks" name="termWeeks" class="bb-input num" type="number" min="1" max="30" step="1" value="' +
        (data.term.weeks || 14) + '"></div>' +
        '<div><label class="bb-label" for="t-exam">Exam week</label>' +
        '<input id="t-exam" name="termExam" class="bb-input num" type="number" min="1" max="30" step="1" value="' +
        (data.term.examWeek || (data.term.weeks || 14) + 1) + '"></div>' +
        '<div class="sm:col-span-2 rounded-control border border-border-subtle bg-canvas p-3.5">' +
        '<div class="text-caption uppercase tracking-wider text-muted">What happens on switch</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 text-body-sm">' +
        '<div class="flex items-start gap-2"><span class="material-symbols-outlined text-[18px] text-success">check</span>' +
        '<span class="text-body">Kept: ' + data.subjects.length + ' module' + (data.subjects.length === 1 ? '' : 's') +
        ' with their sessions, colours and assessment weightings.</span></div>' +
        '<div class="flex items-start gap-2"><span class="material-symbols-outlined text-[18px] text-alert">warning</span>' +
        '<span class="text-body">Cleared: marks, attendance records, study log and custom deadlines. ' +
        'The current trimester is archived first, so nothing is lost for good.</span></div>' +
        '</div></div>' +
        '<div class="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
        '<p class="text-caption text-muted">Adjust modules afterwards in the Subject Editor.</p>' +
        '<button type="submit" class="bb-btn bb-btn-primary shrink-0">' +
        '<span class="material-symbols-outlined text-[18px]">arrow_forward</span>Start trimester</button></div>' +
        '</form></div>' +
        '<div><div class="bb-label">Archived trimesters</div>' + archived + '</div>' +
        '</div>'
    );
  }

  function dataSection() {
    return section(
      'database',
      'Data &amp; Storage',
      'Export backup files or reset local browser state.',
      '<div class="flex flex-wrap items-center gap-3">' +
        '<button type="button" id="export-data" class="bb-btn bb-btn-ghost">' +
        '<span class="material-symbols-outlined text-[18px]">download</span>Export data (JSON)</button>' +
        '<label class="bb-btn bb-btn-ghost cursor-pointer">' +
        '<span class="material-symbols-outlined text-[18px]">upload</span>Import data' +
        '<input type="file" id="import-data" accept="application/json" class="hidden"></label>' +
        '<button type="button" id="reset-data" class="bb-btn bb-btn-danger">' +
        '<span class="material-symbols-outlined text-[18px]">warning</span>Reset all data</button>' +
        '</div>' +
        '<p class="text-caption text-muted mt-3">All data is stored locally in this browser. Nothing is sent to MMU.</p>'
    );
  }

  function render() {
    document.getElementById('settings').innerHTML =
      profileSection() +
      subjectsSection() +
      setupSection() +
      appearanceSection() +
      goalsSection() +
      timetableSection() +
      termSection() +
      dataSection();
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
      BB.ui.toast('Fill in label, start date and weeks');
      return;
    }
    BB.ui
      .confirm({
        title: 'Start "' + label + '"?',
        message:
          'The current trimester is archived and marks, attendance, study log and custom deadlines are cleared. ' +
          'Your modules carry over.',
        confirmLabel: 'Start trimester'
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
        BB.ui.toast('Switched to ' + label);
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
    });
    BB.ui.toast('Saved');
    BB.ui.refreshChrome();
    render();
  });

  document.addEventListener('click', function (event) {
    var restoreButton = event.target.closest('[data-restore-term]');
    if (restoreButton) {
      var index = Number(restoreButton.getAttribute('data-restore-term'));
      BB.ui
        .confirm({
          title: 'Restore this trimester?',
          message: 'The current trimester is archived first, then the selected one becomes active.',
          confirmLabel: 'Restore'
        })
        .then(function (ok) {
          if (!ok) return;
          BB.store.restoreTerm(index);
          BB.ui.toast('Trimester restored');
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
      BB.ui.toast('Theme set to ' + theme);
      render();
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
      BB.ui.toast('Backup downloaded');
      return;
    }

    if (event.target.closest('#reset-data')) {
      BB.ui
        .confirm({
          title: 'Reset all local data?',
          message:
            'Every subject, mark, attendance record and study session in this browser is deleted and the setup ' +
            'wizard runs again. Export a backup first if you want to keep it.',
          confirmLabel: 'Reset everything',
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
        BB.ui.toast('Data imported');
        window.location.reload();
      } catch (error) {
        BB.ui.toast('Import failed: invalid file');
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
})();
