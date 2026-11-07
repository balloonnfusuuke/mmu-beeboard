(function () {
  'use strict';

  var BB = window.BB;

  BB.ui.mount({
    title: 'Attendance',
    head: {
      title: 'Attendance',
      subtitle: 'Monitor attendance across your 4 modules and maintain the 80% threshold for MMU exam eligibility.'
    }
  });

  function render() {
    var state = BB.store.get();
    var threshold = state.settings.attendanceThreshold;
    var stats = state.subjects.map(function (subject) {
      return { subject: subject, attendance: BB.dash.attendanceOf(subject) };
    });

    renderStatus(stats, threshold);
    renderPolicy(threshold);
    renderSubjects(stats, threshold);
    renderLog(state);
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
      text = 'No sessions held yet — attendance tracking starts in Week 1.';
    } else if (below === 0) {
      tone = 'bb-status-ok';
      icon = 'verified_user';
      text = 'Status: Exam Eligible (All Subjects)';
    } else {
      tone = 'bb-status-alert';
      icon = 'warning';
      text = 'Status: ' + below + ' module' + (below === 1 ? '' : 's') + ' below the ' + threshold + '% threshold';
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
      '<span class="font-semibold text-ink">MMU Attendance Policy:</span> ' +
      'Minimum ' + threshold + '% total attendance is required per subject to sit for final examinations. ' +
      'Falling below ' + threshold + '% triggers an automatic exam bar.</div></div>';
  }

  function renderSubjects(stats, threshold) {
    var host = document.getElementById('subjects');
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
          ? 'You are below the ' + threshold + '% threshold. Attend the next sessions to recover.'
          : 'You can miss <strong>' + attendance.allowed + ' more sessions</strong> before dropping below ' + threshold + '%.';

        return (
          '<div class="bb-card p-5">' +
          '<div class="flex items-start justify-between gap-3">' +
          '<div class="min-w-0">' +
          '<div class="flex items-center gap-2">' + BB.ui.solidChip(subject.color, subject.id) +
          '<span class="text-caption text-muted">· ' + subject.credits + ' Credits</span></div>' +
          '<h3 class="text-title-md font-bold text-ink mt-1.5">' + subject.name + '</h3>' +
          '<p class="text-caption text-muted">' + subject.sessions.length + ' sessions per week · ' +
          attendance.total + ' trimester sessions total</p></div>' +
          '<div class="text-right shrink-0">' +
          '<div class="text-headline-md font-extrabold num" style="color:' + rateColor + '">' + rateText + '</div>' +
          '<div class="text-caption text-muted">Current Standing</div></div></div>' +
          '<div class="grid grid-cols-2 gap-3 mt-4">' +
          '<div class="bg-canvas rounded-control p-3 border border-border-subtle">' +
          '<div class="text-caption text-muted">Sessions Attended</div>' +
          '<div class="text-title-md font-bold text-ink num">' + attendance.attended + ' / ' + attendance.held + '</div></div>' +
          '<div class="bg-canvas rounded-control p-3 border border-border-subtle">' +
          '<div class="text-caption text-muted">Absences Recorded</div>' +
          '<div class="text-title-md font-bold text-ink num">' + attendance.absences + '</div></div></div>' +
          '<div class="mt-3 flex items-start gap-2 text-body-sm text-body">' +
          '<span class="material-symbols-outlined text-[18px]" style="color:' + noteColor + '">' + noteIcon + '</span>' +
          '<span>' + note + '</span></div>' +
          '<div class="mt-3 pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2">' +
          '<span class="text-caption text-muted">Last session: ' +
          (attendance.held > 0 ? 'recorded' : '—') + '</span>' +
          '<div class="flex items-center gap-2">' +
          '<button type="button" class="bb-btn bb-btn-ghost" data-mark="present" data-subject="' + subject.id + '">' +
          '<span class="material-symbols-outlined text-[18px]">check</span>Mark attended</button>' +
          '<button type="button" class="bb-btn bb-btn-ghost" data-mark="absent" data-subject="' + subject.id + '">' +
          '<span class="material-symbols-outlined text-[18px]">event_busy</span>Mark absent</button>' +
          '</div></div></div>'
        );
      })
      .join('');
  }

  function renderLog(state) {
    var entries = [];
    state.subjects.forEach(function (subject) {
      var log = (subject.attendance && subject.attendance.log) || [];
      log.forEach(function (entry) {
        entries.push({ subject: subject, date: entry.date, status: entry.status });
      });
    });
    entries.sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });

    var body = entries.length
      ? entries
          .map(function (entry) {
            var present = entry.status === 'present';
            return (
              '<div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-border-subtle last:border-0">' +
              '<div class="flex items-center gap-3">' + BB.ui.solidChip(entry.subject.color, entry.subject.id) +
              '<span class="text-body-sm text-body">' + entry.subject.name + '</span></div>' +
              '<div class="flex items-center gap-3">' +
              '<span class="text-caption text-muted num">' + entry.date + '</span>' +
              '<span class="bb-chip" style="background:' + (present ? 'var(--bb-success-surface)' : 'var(--bb-alert-surface)') + ';color:' +
              (present ? 'var(--bb-success)' : 'var(--bb-alert)') + '">' + (present ? 'Present' : 'Absent') + '</span>' +
              '</div></div>'
            );
          })
          .join('')
      : '<div class="px-5 py-8 text-center">' +
        '<span class="material-symbols-outlined text-[28px] text-placeholder">task_alt</span>' +
        '<p class="text-body-sm text-muted mt-2">No absences recorded.</p>' +
        '<p class="text-caption text-muted mt-1">All modules are above the ' +
        state.settings.attendanceThreshold + '% exam eligibility benchmark for ' + state.term.label + '.</p></div>';

    document.getElementById('absence-log').innerHTML =
      '<div class="bb-card overflow-hidden">' +
      '<div class="px-5 py-4 border-b border-border flex items-center justify-between gap-3">' +
      '<div class="flex items-center gap-2">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">history</span>' +
      '<h2 class="text-title-md font-bold text-ink">Absence Log</h2>' +
      '<span class="text-caption text-muted">' + entries.length + ' Entries</span></div></div>' +
      body + '</div>';
  }

  document.getElementById('subjects').addEventListener('click', function (event) {
    var button = event.target.closest('[data-mark]');
    if (!button) return;
    BB.attendance.mark(button.getAttribute('data-subject'), button.getAttribute('data-mark'));
    render();
  });

  render();
})();
