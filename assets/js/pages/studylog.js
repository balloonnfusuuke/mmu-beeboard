(function () {
  'use strict';

  var BB = window.BB;
  var selected = null;

  BB.ui.mount({
    title: 'Study Log',
    head: {
      title: 'Study Log',
      subtitle: 'Track focused revision and module study time towards your academic goals.'
    }
  });

  function state() {
    return BB.store.get();
  }

  function subjectById(id) {
    var found = null;
    state().subjects.forEach(function (subject) {
      if (subject.id === id) found = subject;
    });
    return found;
  }

  function currentSubject() {
    var subjects = state().subjects;
    if (!subjects.length) return null;
    if (!selected) selected = subjects[0].id;
    return subjectById(selected) || subjects[0];
  }

  function clock(seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    return [h, m, s].map(function (part) {
      return part < 10 ? '0' + part : String(part);
    }).join(':');
  }

  function hoursLabel(minutes) {
    return Math.floor(minutes / 60) + 'h ' + (minutes % 60 < 10 ? '0' : '') + (minutes % 60) + 'm';
  }

  function weekSessions() {
    var week = BB.dash.currentWeek(new Date());
    return state().studySessions.filter(function (session) {
      return BB.dash.weekOf(new Date(session.startedAt)) === week;
    });
  }

  function renderActive() {
    var subject = currentSubject();
    var running = BB.timer.isRunning();

    /* 科目0件ではタイマーの記録先がない。空状態を出してセットアップへ誘導する。 */
    if (!subject) {
      document.getElementById('active-session').innerHTML =
        '<div class="bb-card p-8 text-center">' +
        '<span class="material-symbols-outlined text-[28px] text-placeholder">timer</span>' +
        '<p class="text-body-sm text-muted mt-2">Add a subject to start logging study time.</p>' +
        '<a href="subject-edit.html?new=1" class="bb-btn bb-btn-primary mt-3">' +
        '<span class="material-symbols-outlined text-[18px]">add</span>Add a subject</a></div>';
      return;
    }

    var chips = state()
      .subjects.map(function (item) {
        var active = item.id === subject.id;
        return (
          '<button type="button" data-subject="' + item.id + '" class="bb-chip" style="' +
          (active
            ? 'background:' + item.color + ';color:#fff;border:1px solid ' + item.color
            : 'background:var(--bb-surface);color:var(--bb-text-muted);border:1px solid var(--bb-border)') +
          '">' + item.id + ' ' + item.name.split(' ')[0] + '</button>'
        );
      })
      .join('');

    document.getElementById('active-session').innerHTML =
      '<div class="bb-card p-6">' +
      '<div class="flex items-center gap-2 pb-4 border-b border-border-subtle">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">timer</span>' +
      '<h2 class="text-title-md font-bold text-ink">Active Session</h2>' +
      '<span class="text-caption text-muted ml-auto">Focus Interval</span></div>' +
      '<div class="pt-4"><div class="bb-label">Select module to log</div>' +
      '<div class="flex flex-wrap gap-2">' + chips + '</div></div>' +
      '<div class="text-center py-6">' +
      '<div id="timer-display" class="text-display font-bold text-ink num tracking-tight">' +
      clock(BB.timer.elapsed()) + '</div>' +
      '<div class="text-caption text-muted mt-1">' + state().term.label + ' • Week ' +
      BB.dash.currentWeek(new Date()) + ' • Target ' + state().settings.weeklyStudyTarget + ' hrs/week</div></div>' +
      '<div class="flex items-center justify-center gap-3">' +
      '<button type="button" id="timer-start" class="bb-btn bb-btn-primary"' + (running ? ' disabled' : '') + '>' +
      '<span class="material-symbols-outlined text-[18px]">play_arrow</span>Start</button>' +
      '<button type="button" id="timer-stop" class="bb-btn bb-btn-ghost"' + (running ? '' : ' disabled') + '>' +
      '<span class="material-symbols-outlined text-[18px]">stop</span>Stop</button></div></div>';
  }

  function renderWeek() {
    var sessions = weekSessions();
    var total = sessions.reduce(function (sum, session) {
      return sum + session.minutes;
    }, 0);
    var target = state().settings.weeklyStudyTarget * 60;

    var rows = state()
      .subjects.map(function (subject) {
        var minutes = sessions
          .filter(function (session) {
            return session.subjectId === subject.id;
          })
          .reduce(function (sum, session) {
            return sum + session.minutes;
          }, 0);
        var pct = target ? Math.min(100, (minutes / target) * 100) : 0;
        return (
          '<div class="space-y-1">' +
          '<div class="flex items-center justify-between text-caption text-muted">' +
          '<span>' + subject.id + ' ' + subject.name.split(' ')[0] + '</span>' +
          '<span class="font-semibold num" style="color:' + subject.color + '">' + (minutes / 60).toFixed(1) + ' hrs</span></div>' +
          '<div class="w-full bg-border h-1.5 rounded-full overflow-hidden">' +
          '<div class="h-full rounded-full" style="width:' + pct + '%;background:' + subject.color + '"></div></div></div>'
        );
      })
      .join('');

    document.getElementById('week-summary').innerHTML =
      '<div class="bb-card p-5">' +
      '<div class="flex items-center gap-2 pb-3 border-b border-border-subtle">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">bar_chart</span>' +
      '<h2 class="text-title-md font-bold text-ink">This Week</h2></div>' +
      '<div class="pt-3">' +
      '<div class="text-caption text-muted">Target: ' + state().settings.weeklyStudyTarget +
      ' hrs/week • Week ' + BB.dash.currentWeek(new Date()) + '</div>' +
      '<div class="text-headline-sm font-extrabold text-ink num mt-1">' + hoursLabel(total) +
      ' <span class="text-body-sm font-normal text-muted">/ ' + state().settings.weeklyStudyTarget + 'h</span></div>' +
      '<div class="w-full bg-border h-2 rounded-full overflow-hidden mt-2">' +
      '<div class="h-full rounded-full bg-primary" style="width:' +
      (target ? Math.min(100, (total / target) * 100) : 0) + '%"></div></div>' +
      '<div class="space-y-2.5 mt-4">' + rows + '</div></div></div>';
  }

  function renderManual() {
    var options = state()
      .subjects.map(function (subject) {
        return '<option value="' + subject.id + '">' + subject.name + ' (' + subject.id + ')</option>';
      })
      .join('');
    var today = new Date().toISOString().slice(0, 10);

    if (!options) {
      document.getElementById('manual-entry').innerHTML =
        '<div class="bb-card p-5">' +
        '<div class="flex items-center gap-2 pb-3 border-b border-border-subtle">' +
        '<span class="material-symbols-outlined text-[20px] text-primary">edit_note</span>' +
        '<h2 class="text-title-md font-bold text-ink">Manual Entry</h2></div>' +
        '<p class="text-body-sm text-muted pt-3">Add a subject to log sessions manually.</p></div>';
      return;
    }

    document.getElementById('manual-entry').innerHTML =
      '<div class="bb-card p-5">' +
      '<div class="flex items-center gap-2 pb-3 border-b border-border-subtle">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">edit_note</span>' +
      '<h2 class="text-title-md font-bold text-ink">Manual Entry</h2></div>' +
      '<p class="text-body-sm text-muted pt-3">Log offline sessions or group tutorial revisions directly.</p>' +
      '<form id="manual-form" class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">' +
      '<div class="sm:col-span-2"><label class="bb-label" for="m-subject">Subject</label>' +
      '<select id="m-subject" class="bb-input">' + options + '</select></div>' +
      '<div><label class="bb-label" for="m-minutes">Duration (minutes)</label>' +
      '<input id="m-minutes" class="bb-input num" type="number" min="1" max="600" step="1" value="60" required>' +
      '<p class="text-caption text-muted mt-1.5">Any whole number of minutes, e.g. 30, 45, 60 or 90.</p></div>' +
      '<div><label class="bb-label" for="m-date">Date</label>' +
      '<input id="m-date" class="bb-input" type="date" value="' + today + '" required></div>' +
      '<div class="sm:col-span-2"><label class="bb-label" for="m-note">Notes</label>' +
      '<input id="m-note" class="bb-input" type="text" placeholder="e.g. Tutorial sheet 1 revision"></div>' +
      '<div class="sm:col-span-2 flex justify-end">' +
      '<button type="submit" class="bb-btn bb-btn-primary">' +
      '<span class="material-symbols-outlined text-[18px]">add</span>Add session</button></div>' +
      '</form></div>';
  }

  function renderHistory() {
    var sessions = state().studySessions.slice().sort(function (a, b) {
      return a.startedAt < b.startedAt ? 1 : -1;
    });

    var body = sessions.length
      ? sessions
          .map(function (session) {
            var subject = subjectById(session.subjectId);
            if (!subject) return '';
            return (
              '<div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-border-subtle last:border-0">' +
              '<div class="flex items-center gap-3 min-w-0">' + BB.ui.solidChip(subject.color, subject.id) +
              '<div class="min-w-0"><div class="text-body-sm font-semibold text-ink num">' +
              hoursLabel(session.minutes) + '</div>' +
              '<div class="text-caption text-muted truncate">' + session.startedAt.slice(0, 10) +
              (session.note ? ' • ' + session.note : '') + '</div></div></div>' +
              '<button type="button" class="text-muted hover:text-alert transition-colors" data-delete="' +
              session.id + '" title="Delete session">' +
              '<span class="material-symbols-outlined text-[18px]">delete</span></button></div>'
            );
          })
          .join('')
      : '<div class="px-5 py-8 text-center">' +
        '<span class="material-symbols-outlined text-[28px] text-placeholder">history_toggle_off</span>' +
        '<p class="text-body-sm text-muted mt-2">No sessions yet</p>' +
        '<p class="text-caption text-muted mt-1">Start the timer or add a session manually.</p></div>';

    document.getElementById('history').innerHTML =
      '<div class="bb-card overflow-hidden">' +
      '<div class="px-5 py-4 border-b border-border flex items-center justify-between gap-3">' +
      '<div class="flex items-center gap-2">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">history</span>' +
      '<h2 class="text-title-md font-bold text-ink">Session History</h2></div>' +
      '<span class="text-caption text-muted">' + sessions.length + ' Sessions</span></div>' +
      body + '</div>';
  }

  function render() {
    renderActive();
    renderWeek();
    renderManual();
    renderHistory();
  }

  function addSession(subjectId, minutes, startedAt, note) {
    BB.store.update(function (data) {
      data.studySessions.push({
        id: 's' + Date.now(),
        subjectId: subjectId,
        minutes: minutes,
        startedAt: startedAt,
        note: note || ''
      });
    });
  }

  document.addEventListener('click', function (event) {
    var chip = event.target.closest('[data-subject]');
    if (chip && chip.closest('#active-session')) {
      selected = chip.getAttribute('data-subject');
      renderActive();
      return;
    }

    if (event.target.closest('#timer-start')) {
      BB.timer.start(function (seconds) {
        var display = document.getElementById('timer-display');
        if (display) display.textContent = clock(seconds);
      });
      renderActive();
      return;
    }

    if (event.target.closest('#timer-stop')) {
      var seconds = BB.timer.stop();
      var subject = currentSubject();
      if (!subject) {
        BB.ui.toast('Add a subject before logging a session');
      } else if (seconds < 60) {
        BB.ui.toast('Session under a minute was discarded');
      } else {
        var startedAt = new Date(Date.now() - seconds * 1000).toISOString();
        addSession(subject.id, Math.round(seconds / 60), startedAt, '');
        BB.ui.toast('Session saved');
      }
      render();
      return;
    }

    var remove = event.target.closest('[data-delete]');
    if (remove) {
      var id = remove.getAttribute('data-delete');
      var sessions = state().studySessions;
      var index = -1;
      sessions.forEach(function (session, position) {
        if (session.id === id) index = position;
      });
      if (index < 0) return;
      var removed = JSON.parse(JSON.stringify(sessions[index]));
      var label = hoursLabel(removed.minutes) + ' on ' + removed.startedAt.slice(0, 10);

      BB.ui
        .confirm({
          title: 'Delete this session?',
          message: label + ' will be removed from your study log.',
          confirmLabel: 'Delete session',
          danger: true
        })
        .then(function (ok) {
          if (!ok) return;
          BB.store.update(function (data) {
            data.studySessions = data.studySessions.filter(function (session) {
              return session.id !== id;
            });
          });
          render();
          BB.ui.toast('Session deleted', {
            actionLabel: 'Undo',
            onAction: function () {
              BB.store.update(function (data) {
                data.studySessions.splice(Math.min(index, data.studySessions.length), 0, removed);
              });
              render();
              BB.ui.toast('Session restored');
            }
          });
        });
    }
  });

  document.addEventListener('submit', function (event) {
    if (event.target.id !== 'manual-form') return;
    event.preventDefault();
    var subjectId = document.getElementById('m-subject').value;
    var minutes = Number(document.getElementById('m-minutes').value);
    var date = document.getElementById('m-date').value;
    var note = document.getElementById('m-note').value.trim();
    if (!subjectId) {
      BB.ui.toast('Add a subject before logging a session');
      return;
    }
    if (!minutes || minutes < 1) {
      BB.ui.toast('Enter a duration in minutes');
      return;
    }
    addSession(subjectId, minutes, new Date(date + 'T12:00:00').toISOString(), note);
    BB.ui.toast('Session added');
    render();
  });

  render();

  /* 他タブの保存を取り込んだら描き直す。 */
  BB.store.subscribe(function () {
    render();
  });
})();
