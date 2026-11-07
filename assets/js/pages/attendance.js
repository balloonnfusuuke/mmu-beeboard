(function () {
  'use strict';

  var BB = window.BB;
  var t = BB.i18n.t;
  var tn = BB.i18n.tn;
  var DAY_KEYS = ['day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat'];

  /* 記録対象のコマと日付は科目ごとに保持する。再描画で選択が戻らないように。 */
  var pickedSession = {};
  var pickedDate = {};

  function state() {
    return BB.store.get();
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function headOptions() {
    var data = state();
    var count = data.subjects.length;
    var threshold = data.settings.attendanceThreshold;
    return {
      title: t('att.title'),
      subtitle: count
        ? tn('att.subtitle', count, { n: count, t: threshold })
        : t('att.subtitleEmpty', { t: threshold })
    };
  }

  BB.ui.mount({ title: t('att.title'), head: headOptions() });

  function sessionLabel(session) {
    return t(DAY_KEYS[session.day]) + ' ' + session.start + '–' + session.end + ' ' + session.type +
      (session.room ? ' · ' + session.room : '');
  }

  function render() {
    var data = state();
    var threshold = data.settings.attendanceThreshold;
    var stats = data.subjects.map(function (subject) {
      return { subject: subject, attendance: BB.dash.attendanceOf(subject) };
    });

    /* しきい値を変えたら副題も追随させる（監査で「半分だけ配線」と指摘）。 */
    BB.ui.setHead(headOptions());

    renderStatus(stats, threshold);
    renderPolicy(threshold);
    renderSubjects(stats, threshold);
    renderLog(data);
  }

  function renderStatus(stats, threshold) {
    var host = document.getElementById('status-banner');
    var held = stats.reduce(function (sum, item) {
      return sum + item.attendance.held;
    }, 0);
    var below = stats.filter(function (item) {
      return item.attendance.atRisk;
    }).length;

    var tone;
    var icon;
    var text;
    if (held === 0) {
      tone = 'border-border bg-surface text-muted';
      icon = 'info';
      text = t('att.noSessions');
    } else if (below === 0) {
      tone = 'bb-status-ok';
      icon = 'verified_user';
      text = t('att.eligible');
    } else {
      tone = 'bb-status-alert';
      icon = 'warning';
      text = tn('att.below', below, { n: below, t: threshold });
    }

    host.innerHTML =
      '<div class="flex items-center gap-2.5 rounded-card border px-4 py-3 ' + tone + '">' +
      '<span class="material-symbols-outlined text-[20px]">' + icon + '</span>' +
      '<span class="text-label-md font-semibold">' + text + '</span></div>';
  }

  function renderPolicy(threshold) {
    document.getElementById('policy').innerHTML =
      '<div class="bb-card p-4 flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">gavel</span>' +
      '<div class="text-body-sm text-body">' +
      '<span class="font-semibold text-ink">' + t('att.policyTitle') + '</span> ' +
      t('att.policyBody', { t: threshold }) + '</div></div>';
  }

  /* 記録するコマを選ばせる。以前は「どの授業の分か」を選べず誤タップがそのまま残った。 */
  function sessionPicker(subject) {
    if (!subject.sessions.length) {
      return (
        '<div><label class="bb-label">' + t('att.session') + '</label>' +
        '<select class="bb-input" disabled><option>' + t('att.noSessionsDefined') + '</option></select>' +
        '<p class="text-caption text-muted mt-1.5">' + t('att.addSessionsHint') + '</p></div>'
      );
    }
    var selected = pickedSession[subject.id];
    if (selected === undefined) selected = 0;
    return (
      '<div><label class="bb-label">' + t('att.session') + '</label>' +
      '<select class="bb-input" data-session-picker="' + subject.id + '">' +
      subject.sessions
        .map(function (session, index) {
          return '<option value="' + index + '"' + (index === selected ? ' selected' : '') + '>' +
            sessionLabel(session) + '</option>';
        })
        .join('') +
      '</select></div>'
    );
  }

  function renderSubjects(stats, threshold) {
    var host = document.getElementById('subjects');
    if (!stats.length) {
      host.innerHTML =
        '<div class="bb-card p-8 text-center lg:col-span-2">' +
        '<span class="material-symbols-outlined text-[28px] text-placeholder">rule</span>' +
        '<p class="text-body-sm text-muted mt-2">' + t('att.empty') + '</p>' +
        '<a href="subject-edit.html?new=1" class="bb-btn bb-btn-primary mt-3">' +
        '<span class="material-symbols-outlined text-[18px]">add</span>' + t('att.addSubject') + '</a></div>';
      return;
    }
    host.innerHTML = stats
      .map(function (item) {
        var subject = item.subject;
        var attendance = item.attendance;
        var rate = attendance.rate;
        var rateText = rate === null ? '—' : Math.round(rate) + '%';
        var rateColor = rate === null ? 'var(--bb-text-muted)' : attendance.atRisk ? 'var(--bb-alert)' : 'var(--bb-success)';
        var noteIcon = attendance.atRisk ? 'warning' : 'check_circle';
        var noteColor = attendance.atRisk ? 'var(--bb-alert)' : 'var(--bb-success)';
        var note = attendance.atRisk
          ? t('att.belowNote', { t: threshold })
          : tn('att.canMiss', attendance.allowed, { n: attendance.allowed, t: threshold });
        var lastEntry = (subject.attendance && subject.attendance.log && subject.attendance.log.length)
          ? subject.attendance.log[subject.attendance.log.length - 1]
          : null;

        return (
          '<div class="bb-card p-5">' +
          '<div class="flex items-start justify-between gap-3">' +
          '<div class="min-w-0">' +
          '<div class="flex items-center gap-2">' + BB.ui.solidChip(subject.color, subject.id) +
          '<span class="text-caption text-muted">· ' + t('att.credits', { n: subject.credits }) + '</span></div>' +
          '<h3 class="text-title-md font-bold text-ink mt-1.5">' + subject.name + '</h3>' +
          '<p class="text-caption text-muted">' +
          tn('att.perWeek', subject.sessions.length, { n: subject.sessions.length, total: attendance.total }) +
          '</p></div>' +
          '<div class="text-right shrink-0">' +
          '<div class="text-headline-md font-extrabold num" style="color:' + rateColor + '">' + rateText + '</div>' +
          '<div class="text-caption text-muted">' + t('att.standing') + '</div></div></div>' +
          '<div class="grid grid-cols-2 gap-3 mt-4">' +
          '<div class="bg-canvas rounded-control p-3 border border-border-subtle">' +
          '<div class="text-caption text-muted">' + t('att.attended') + '</div>' +
          '<div class="text-title-md font-bold text-ink num">' + attendance.attended + ' / ' + attendance.held + '</div></div>' +
          '<div class="bg-canvas rounded-control p-3 border border-border-subtle">' +
          '<div class="text-caption text-muted">' + t('att.absences') + '</div>' +
          '<div class="text-title-md font-bold text-ink num">' + attendance.absences + '</div></div></div>' +
          '<div class="mt-3 flex items-start gap-2 text-body-sm text-body">' +
          '<span class="material-symbols-outlined text-[18px]" style="color:' + noteColor + '">' + noteIcon + '</span>' +
          '<span>' + note + '</span></div>' +
          '<div class="mt-3 pt-3 border-t border-border-subtle space-y-2.5">' +
          '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
          sessionPicker(subject) +
          '<div><label class="bb-label">' + t('att.date') + '</label>' +
          '<input class="bb-input num" type="date" data-session-date="' + subject.id + '" value="' +
          (pickedDate[subject.id] || today()) + '"></div>' +
          '</div>' +
          '<div class="flex flex-wrap items-center justify-between gap-2">' +
          '<span class="text-caption text-muted">' +
          t('att.lastSession', {
            value: lastEntry ? lastEntry.date + (lastEntry.session ? ' · ' + lastEntry.session : '') : '—'
          }) + '</span>' +
          '<div class="flex items-center gap-2">' +
          '<button type="button" class="bb-btn bb-btn-ghost" data-mark="present" data-subject="' + subject.id + '">' +
          '<span class="material-symbols-outlined text-[18px]">check</span>' + t('att.markPresent') + '</button>' +
          '<button type="button" class="bb-btn bb-btn-ghost" data-mark="absent" data-subject="' + subject.id + '">' +
          '<span class="material-symbols-outlined text-[18px]">event_busy</span>' + t('att.markAbsent') + '</button>' +
          '</div></div></div></div>'
        );
      })
      .join('');
  }

  function renderLog(data) {
    var entries = [];
    data.subjects.forEach(function (subject) {
      var log = (subject.attendance && subject.attendance.log) || [];
      log.forEach(function (entry, index) {
        entries.push({ subject: subject, index: index, entry: entry });
      });
    });
    entries.sort(function (a, b) {
      return a.entry.date < b.entry.date ? 1 : -1;
    });

    var body = entries.length
      ? entries
          .map(function (item) {
            var present = item.entry.status === 'present';
            return (
              '<div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-border-subtle last:border-0">' +
              '<div class="flex items-center gap-3 min-w-0">' + BB.ui.solidChip(item.subject.color, item.subject.id) +
              '<div class="min-w-0"><div class="text-body-sm text-body truncate">' + item.subject.name + '</div>' +
              (item.entry.session
                ? '<div class="text-caption text-muted truncate">' + item.entry.session + '</div>'
                : '') + '</div></div>' +
              '<div class="flex items-center gap-3 shrink-0">' +
              '<span class="text-caption text-muted num">' + item.entry.date + '</span>' +
              '<span class="bb-chip" style="background:' + (present ? 'var(--bb-success-surface)' : 'var(--bb-alert-surface)') + ';color:' +
              (present ? 'var(--bb-success)' : 'var(--bb-alert)') + '">' +
              (present ? t('att.present') : t('att.absent')) + '</span>' +
              '<button type="button" class="text-muted hover:text-alert transition-colors" data-remove-entry="' +
              item.subject.id + '" data-entry-index="' + item.index + '" title="' + t('att.deleteRecord') + '">' +
              '<span class="material-symbols-outlined text-[18px]">delete</span></button>' +
              '</div></div>'
            );
          })
          .join('')
      : '<div class="px-5 py-8 text-center">' +
        '<span class="material-symbols-outlined text-[28px] text-placeholder">task_alt</span>' +
        '<p class="text-body-sm text-muted mt-2">' + t('att.logEmpty') + '</p>' +
        '<p class="text-caption text-muted mt-1">' +
        (data.subjects.length
          ? t('att.logEmptyHint', { term: BB.ui.termLabel(data) })
          : t('att.logEmptyNoSubject')) +
        '</p></div>';

    document.getElementById('absence-log').innerHTML =
      '<div class="bb-card overflow-hidden">' +
      '<div class="px-5 py-4 border-b border-border flex items-center justify-between gap-3">' +
      '<div class="flex items-center gap-2">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">history</span>' +
      '<h2 class="text-title-md font-bold text-ink">' + t('att.logTitle') + '</h2>' +
      '<span class="text-caption text-muted">' + tn('att.entry', entries.length) + '</span></div></div>' +
      body + '</div>';
  }

  document.getElementById('subjects').addEventListener('change', function (event) {
    var picker = event.target.closest('[data-session-picker]');
    if (picker) {
      pickedSession[picker.getAttribute('data-session-picker')] = Number(picker.value);
      return;
    }
    var dateField = event.target.closest('[data-session-date]');
    if (dateField) {
      pickedDate[dateField.getAttribute('data-session-date')] = dateField.value;
    }
  });

  document.getElementById('subjects').addEventListener('click', function (event) {
    var button = event.target.closest('[data-mark]');
    if (!button) return;
    var subjectId = button.getAttribute('data-subject');
    var status = button.getAttribute('data-mark');
    var subject = BB.store.subject(subjectId);
    if (!subject) return;

    var index = pickedSession[subjectId] === undefined ? 0 : pickedSession[subjectId];
    var session = subject.sessions[index];
    var date = pickedDate[subjectId] || today();
    var label = session ? sessionLabel(session) : '';

    var entryIndex = BB.attendance.mark(subjectId, status, { date: date, session: label });
    render();

    BB.ui.toast(
      (status === 'present' ? t('att.toast.present') : t('att.toast.absent')) + ' · ' + date +
        (label ? ' · ' + label : ''),
      {
        actionLabel: t('common.undo'),
        onAction: function () {
          BB.attendance.unmark(subjectId, entryIndex);
          render();
          BB.ui.toast(t('att.toast.removed'));
        }
      }
    );
  });

  document.getElementById('absence-log').addEventListener('click', function (event) {
    var button = event.target.closest('[data-remove-entry]');
    if (!button) return;
    var subjectId = button.getAttribute('data-remove-entry');
    var index = Number(button.getAttribute('data-entry-index'));
    var subject = BB.store.subject(subjectId);
    if (!subject || !subject.attendance || !subject.attendance.log) return;
    var entry = subject.attendance.log[index];
    if (!entry) return;
    var removed = JSON.parse(JSON.stringify(entry));

    BB.ui
      .confirm({
        title: t('att.confirm.title'),
        message: t('att.confirm.body', {
          code: subject.id,
          date: entry.date,
          session: entry.session ? ' · ' + entry.session : '',
          status: entry.status === 'present' ? t('att.present') : t('att.absent')
        }),
        confirmLabel: t('att.confirm.ok'),
        danger: true
      })
      .then(function (ok) {
        if (!ok) return;
        BB.attendance.unmark(subjectId, index);
        render();
        BB.ui.toast(t('att.toast.deleted'), {
          actionLabel: t('common.undo'),
          onAction: function () {
            BB.store.update(function (data) {
              var target = null;
              data.subjects.forEach(function (item) {
                if (item.id === subjectId) target = item;
              });
              if (!target) return;
              if (!target.attendance) target.attendance = { held: 0, attended: 0, absences: 0, log: [] };
              target.attendance.log = target.attendance.log || [];
              target.attendance.log.splice(Math.min(index, target.attendance.log.length), 0, removed);
              target.attendance.held += 1;
              if (removed.status === 'present') target.attendance.attended += 1;
              else target.attendance.absences += 1;
            });
            render();
            BB.ui.toast(t('att.toast.restored'));
          }
        });
      });
  });

  render();

  /* 他タブの保存を取り込んだら描き直す。 */
  BB.store.subscribe(function () {
    render();
  });
})();
