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
        '<input id="s-name" class="bb-input" type="text" value="' + data.student.name + '" data-setting="student.name"></div>' +
        '<div><label class="bb-label" for="s-programme">Programme</label>' +
        '<input id="s-programme" class="bb-input" type="text" value="' + data.student.programme + '" disabled></div>' +
        '<div><label class="bb-label" for="s-id">Student ID</label>' +
        '<input id="s-id" class="bb-input num" type="text" value="' + data.student.studentId + '" data-setting="student.studentId"></div>' +
        '<div><label class="bb-label" for="s-term">Active Trimester</label>' +
        '<input id="s-term" class="bb-input" type="text" value="' + data.term.label + '" disabled></div>' +
        '</div>'
    );
  }

  function subjectsSection() {
    var rows = state()
      .subjects.map(function (subject) {
        return (
          '<div class="flex items-center justify-between gap-3 py-3 border-b border-border-subtle last:border-0">' +
          '<div class="flex items-center gap-3 min-w-0">' + BB.ui.solidChip(subject.color, subject.id) +
          '<div class="min-w-0"><div class="text-body-md font-semibold text-ink truncate">' + subject.name + '</div>' +
          '<div class="text-caption text-muted">' + subject.credits + ' Cr. • ' + subject.sessions.length +
          ' sessions • ' + subject.assessments.length + ' components</div></div></div>' +
          '<a href="subject-edit.html?id=' + subject.id + '" class="bb-btn bb-btn-ghost" style="height:34px">' +
          '<span class="material-symbols-outlined text-[16px]">edit</span>Edit</a></div>'
        );
      })
      .join('');

    return section(
      'menu_book',
      'Subjects &amp; Timetable',
      'Manage active subjects, session timings, and assessment weightings.',
      '<div class="flex items-center justify-between gap-3 pb-3 border-b border-border">' +
        '<div><div class="text-caption text-muted">Active Cycle</div>' +
        '<div class="text-body-md font-semibold text-ink">' + state().term.label + '</div></div>' +
        '<span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-primary)">' +
        state().subjects.length + ' subjects</span></div>' + rows
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

  function languageSection() {
    var data = state();
    var languages = [
      { id: 'en', label: 'English' },
      { id: 'ms', label: 'Bahasa Melayu' },
      { id: 'ja', label: '日本語' },
      { id: 'zh', label: '简体中文' }
    ];
    var formats = ['DD/MM/YYYY', 'YYYY/MM/DD', 'MM/DD/YYYY'];

    return section(
      'language',
      'Language &amp; Region',
      'Configure portal interface language, regional date conventions, and bilingual displays.',
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div><label class="bb-label" for="s-lang">Display Language</label>' +
        '<select id="s-lang" class="bb-input" data-setting="settings.language">' +
        languages
          .map(function (language) {
            return '<option value="' + language.id + '"' +
              (data.settings.language === language.id ? ' selected' : '') + '>' + language.label + '</option>';
          })
          .join('') +
        '</select></div>' +
        '<div><label class="bb-label" for="s-date">Date &amp; Time Notation</label>' +
        '<select id="s-date" class="bb-input" data-setting="settings.dateFormat">' +
        formats
          .map(function (format) {
            return '<option value="' + format + '"' +
              (data.settings.dateFormat === format ? ' selected' : '') + '>' + format + '</option>';
          })
          .join('') +
        '</select></div>' +
        '<label class="sm:col-span-2 flex items-center gap-3 text-body-sm text-body">' +
        '<input type="checkbox" class="w-[18px] h-[18px] rounded border-border text-primary focus:ring-primary/20"' +
        (data.settings.bilingual ? ' checked' : '') + ' data-setting="settings.bilingual">' +
        'Show secondary translated titles alongside official MMU course codes</label>' +
        '</div>'
    );
  }

  function goalsSection() {
    var data = state();
    return section(
      'flag',
      'Goals &amp; Alerts',
      'Set academic target alerts and notification frequency.',
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div><label class="bb-label" for="s-cgpa">CGPA Target</label>' +
        '<input id="s-cgpa" class="bb-input num" type="number" min="0" max="4" step="0.01" value="' +
        data.settings.cgpaTarget + '" data-setting="settings.cgpaTarget"></div>' +
        '<div><label class="bb-label" for="s-att">Attendance Warning Threshold (%)</label>' +
        '<input id="s-att" class="bb-input num" type="number" min="0" max="100" step="1" value="' +
        data.settings.attendanceThreshold + '" data-setting="settings.attendanceThreshold"></div>' +
        '<div><label class="bb-label" for="s-study">Weekly Study Target (hours)</label>' +
        '<input id="s-study" class="bb-input num" type="number" min="1" max="80" step="1" value="' +
        data.settings.weeklyStudyTarget + '" data-setting="settings.weeklyStudyTarget"></div>' +
        '<div class="space-y-2 pt-1">' +
        '<label class="flex items-center gap-3 text-body-sm text-body">' +
        '<input type="checkbox" class="w-[18px] h-[18px] rounded border-border text-primary focus:ring-primary/20"' +
        (data.settings.deadlineReminders ? ' checked' : '') + ' data-setting="settings.deadlineReminders">' +
        'Deadline reminders 48h and 12h before submission</label>' +
        '<label class="flex items-center gap-3 text-body-sm text-body">' +
        '<input type="checkbox" class="w-[18px] h-[18px] rounded border-border text-primary focus:ring-primary/20"' +
        (data.settings.classReminder ? ' checked' : '') + ' data-setting="settings.classReminder">' +
        'Remind me before each class</label></div>' +
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
        '<input id="s-start" class="bb-input" type="date" value="' + data.term.startDate +
        '" data-setting="term.startDate"></div>' +
        '<div><label class="bb-label" for="s-weeks">Number of Weeks</label>' +
        '<input id="s-weeks" class="bb-input num" type="number" min="1" max="30" value="' + data.term.weeks +
        '" data-setting="term.weeks"></div>' +
        '<div><label class="bb-label" for="s-day-start">Day Starts At</label>' +
        '<input id="s-day-start" class="bb-input" type="time" value="' + data.settings.dayStart +
        '" data-setting="settings.dayStart"></div>' +
        '<div><label class="bb-label" for="s-day-end">Day Ends At</label>' +
        '<input id="s-day-end" class="bb-input" type="time" value="' + data.settings.dayEnd +
        '" data-setting="settings.dayEnd"></div>' +
        '</div>'
    );
  }

  function termSection() {
    var data = state();
    var archive = data.archive || [];
    var archived = archive.length
      ? archive
          .map(function (entry, index) {
            return (
              '<div class="flex items-center justify-between gap-3 py-2.5 border-b border-border-subtle last:border-0">' +
              '<div><div class="text-body-sm font-semibold text-ink">' + entry.term.label + '</div>' +
              '<div class="text-caption text-muted">Starts ' + entry.term.startDate + ' • ' +
              entry.subjects.length + ' modules • archived ' + String(entry.archivedAt).slice(0, 10) + '</div></div>' +
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
        '<div class="text-title-md font-bold text-ink">' + data.term.label + '</div>' +
        '<div class="text-body-sm text-muted">Starts ' + data.term.startDate + ' • ' + data.term.weeks +
        ' weeks • exam week ' + data.term.examWeek + '</div></div>' +
        '<div><div class="bb-label">Start next trimester</div>' +
        '<form id="term-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
        '<div class="sm:col-span-2"><label class="bb-label" for="t-label">Trimester label</label>' +
        '<input id="t-label" name="termLabel" class="bb-input" type="text" placeholder="Trimester Feb/Mar 2027" required></div>' +
        '<div><label class="bb-label" for="t-start">Week 1 starts (Monday)</label>' +
        '<input id="t-start" name="termStart" class="bb-input" type="date" required></div>' +
        '<div><label class="bb-label" for="t-weeks">Number of weeks</label>' +
        '<input id="t-weeks" name="termWeeks" class="bb-input num" type="number" min="1" max="30" step="1" value="' +
        data.term.weeks + '"></div>' +
        '<div><label class="bb-label" for="t-exam">Exam week</label>' +
        '<input id="t-exam" name="termExam" class="bb-input num" type="number" min="1" max="30" step="1" value="' +
        data.term.examWeek + '"></div>' +
        '<div class="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
        '<p class="text-caption text-muted">Module structure carries over with marks, attendance and study log cleared. ' +
        'Adjust modules afterwards in the Subject Editor.</p>' +
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
      appearanceSection() +
      languageSection() +
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
    if (!window.confirm('Start "' + label + '"? The current trimester is archived and marks are cleared.')) return;
    BB.store.startTerm({
      id: 'term-' + Date.now(),
      label: label,
      shortLabel: label,
      startDate: startDate,
      weeks: weeks,
      examWeek: isFinite(examWeek) && examWeek > 0 ? examWeek : weeks + 1
    });
    BB.ui.toast('Switched to ' + label);
    render();
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
    });
    BB.ui.toast('Saved');
    render();
  });

  document.addEventListener('click', function (event) {
    var restoreButton = event.target.closest('[data-restore-term]');
    if (restoreButton) {
      var index = Number(restoreButton.getAttribute('data-restore-term'));
      if (!window.confirm('Restore this trimester? The current one is archived first.')) return;
      BB.store.restoreTerm(index);
      BB.ui.toast('Trimester restored');
      render();
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

    if (event.target.closest('#export-data')) {      var blob = new Blob([JSON.stringify(state(), null, 2)], { type: 'application/json' });
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
      if (window.confirm('Reset all local BeeBoard data? This cannot be undone.')) {
        BB.store.reset();
        window.location.reload();
      }
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
})();
