(function () {
  'use strict';

  var BB = window.BB;
  var t = BB.i18n.t;
  var tn = BB.i18n.tn;
  var selected = null;

  BB.ui.mount({
    title: t('sl.title'),
    head: {
      title: t('sl.title'),
      subtitle: t('sl.subtitle')
    }
  });

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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
    var m = minutes % 60;
    return t('duration.hm', {
      h: Math.floor(minutes / 60),
      m: m,
      mm: m < 10 ? '0' + m : String(m)
    });
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
        '<p class="text-body-sm text-muted mt-2">' + t('sl.empty') + '</p>' +
        '<a href="subject-edit.html?new=1" class="bb-btn bb-btn-primary mt-3">' +
        '<span class="material-symbols-outlined text-[18px]">add</span>' + t('sl.addSubject') + '</a></div>';
      return;
    }

    var chips = state()
      .subjects.map(function (item) {
        var active = item.id === subject.id;
        return (
          '<button type="button" data-subject="' + item.id + '" class="bb-chip" title="' +
          esc(item.id + ' ' + item.name) + '" style="' +
          (active
            ? 'background:' + item.color + ';color:#fff;border:1px solid ' + item.color
            : 'background:var(--bb-surface);color:var(--bb-text-muted);border:1px solid var(--bb-border)') +
          '">' + item.id + ' ' + esc(item.name) + '</button>'
        );
      })
      .join('');

    document.getElementById('active-session').innerHTML =
      '<div class="bb-card p-6">' +
      '<div class="flex items-center gap-2 pb-4 border-b border-border-subtle">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">timer</span>' +
      '<h2 class="text-title-md font-bold text-ink">' + t('sl.active') + '</h2>' +
      '<span class="text-caption text-muted ml-auto">' + t('sl.focusInterval') + '</span></div>' +
      '<div class="pt-4"><div class="bb-label">' + t('sl.selectModule') + '</div>' +
      '<div class="flex flex-wrap gap-2">' + chips + '</div></div>' +
      '<div class="text-center py-6">' +
      '<div id="timer-display" class="text-display font-bold text-ink num tracking-tight">' +
      clock(BB.timer.elapsed()) + '</div>' +
      '<div class="text-caption text-muted mt-1">' +
      t('sl.meta', {
        term: BB.ui.termLabel(state()),
        week: BB.dash.currentWeek(new Date()),
        target: state().settings.weeklyStudyTarget
      }) + '</div></div>' +
      '<div class="flex items-center justify-center gap-3">' +
      '<button type="button" id="timer-start" class="bb-btn bb-btn-primary"' + (running ? ' disabled' : '') + '>' +
      '<span class="material-symbols-outlined text-[18px]">play_arrow</span>' + t('sl.start') + '</button>' +
      '<button type="button" id="timer-stop" class="bb-btn bb-btn-ghost"' + (running ? '' : ' disabled') + '>' +
      '<span class="material-symbols-outlined text-[18px]">stop</span>' + t('sl.stop') + '</button></div></div>';
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
          '<span class="min-w-0 truncate" title="' + esc(subject.id + ' ' + subject.name) + '">' +
          subject.id + ' ' + esc(subject.name) + '</span>' +
          '<span class="font-semibold num" style="color:' + subject.color + '">' +
          t('sl.hrs', { n: (minutes / 60).toFixed(1) }) + '</span></div>' +
          '<div class="w-full bg-border h-1.5 rounded-full overflow-hidden">' +
          '<div class="h-full rounded-full" style="width:' + pct + '%;background:' + subject.color + '"></div></div></div>'
        );
      })
      .join('');

    document.getElementById('week-summary').innerHTML =
      '<div class="bb-card p-5">' +
      '<div class="flex items-center gap-2 pb-3 border-b border-border-subtle">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">bar_chart</span>' +
      '<h2 class="text-title-md font-bold text-ink">' + t('sl.thisWeek') + '</h2></div>' +
      '<div class="pt-3">' +
      '<div class="text-caption text-muted">' +
      t('sl.targetMeta', { n: state().settings.weeklyStudyTarget, w: BB.dash.currentWeek(new Date()) }) + '</div>' +
      '<div class="text-headline-sm font-extrabold text-ink num mt-1">' +
      '<span class="whitespace-nowrap">' + hoursLabel(total) + ' /</span>' +
      ' <span class="text-body-sm font-normal text-muted whitespace-nowrap">' +
      t('sl.target', { n: state().settings.weeklyStudyTarget }) + '</span></div>' +
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
        '<h2 class="text-title-md font-bold text-ink">' + t('sl.manual') + '</h2></div>' +
        '<p class="text-body-sm text-muted pt-3">' + t('sl.manualEmpty') + '</p></div>';
      return;
    }

    document.getElementById('manual-entry').innerHTML =
      '<div class="bb-card p-5">' +
      '<div class="flex items-center gap-2 pb-3 border-b border-border-subtle">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">edit_note</span>' +
      '<h2 class="text-title-md font-bold text-ink">' + t('sl.manual') + '</h2></div>' +
      '<p class="text-body-sm text-muted pt-3">' + t('sl.manualHint') + '</p>' +
      '<form id="manual-form" class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">' +
      '<div class="sm:col-span-2"><label class="bb-label" for="m-subject">' + t('sl.subject') + '</label>' +
      '<select id="m-subject" class="bb-input">' + options + '</select></div>' +
      '<div><label class="bb-label" for="m-minutes">' + t('sl.duration') + '</label>' +
      '<input id="m-minutes" class="bb-input num" type="number" min="1" max="600" step="1" value="60" required>' +
      '<p class="text-caption text-muted mt-1.5">' + t('sl.durationHint') + '</p></div>' +
      '<div><label class="bb-label" for="m-date">' + t('sl.date') + '</label>' +
      '<input id="m-date" class="bb-input" type="date" value="' + today + '" required></div>' +
      '<div class="sm:col-span-2"><label class="bb-label" for="m-note">' + t('sl.notes') + '</label>' +
      '<input id="m-note" class="bb-input" type="text" placeholder="' +
      esc(t('sl.notesPlaceholder')) + '"></div>' +
      '<div class="sm:col-span-2 flex justify-end">' +
      '<button type="submit" class="bb-btn bb-btn-primary">' +
      '<span class="material-symbols-outlined text-[18px]">add</span>' + t('sl.addSession') + '</button></div>' +
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
              session.id + '" title="' + t('sl.deleteSession') + '">' +
              '<span class="material-symbols-outlined text-[18px]">delete</span></button></div>'
            );
          })
          .join('')
      : '<div class="px-5 py-8 text-center">' +
        '<span class="material-symbols-outlined text-[28px] text-placeholder">history_toggle_off</span>' +
        '<p class="text-body-sm text-muted mt-2">' + t('sl.historyEmpty') + '</p>' +
        '<p class="text-caption text-muted mt-1">' + t('sl.historyHint') + '</p></div>';

    document.getElementById('history').innerHTML =
      '<div class="bb-card overflow-hidden">' +
      '<div class="px-5 py-4 border-b border-border flex items-center justify-between gap-3">' +
      '<div class="flex items-center gap-2">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">history</span>' +
      '<h2 class="text-title-md font-bold text-ink">' + t('sl.history') + '</h2></div>' +
      '<span class="text-caption text-muted">' + tn('sl.count', sessions.length) + '</span></div>' +
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
        BB.ui.toast(t('sl.toast.noSubject'));
      } else if (seconds < 60) {
        BB.ui.toast(t('sl.toast.tooShort'));
      } else {
        var startedAt = new Date(Date.now() - seconds * 1000).toISOString();
        addSession(subject.id, Math.round(seconds / 60), startedAt, '');
        BB.ui.toast(t('sl.toast.saved'));
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
      var label = hoursLabel(removed.minutes) + ' · ' + removed.startedAt.slice(0, 10);

      BB.ui
        .confirm({
          title: t('sl.confirm.title'),
          message: t('sl.confirm.body', { label: label }),
          confirmLabel: t('sl.confirm.ok'),
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
          BB.ui.toast(t('sl.toast.deleted'), {
            actionLabel: t('common.undo'),
            onAction: function () {
              BB.store.update(function (data) {
                data.studySessions.splice(Math.min(index, data.studySessions.length), 0, removed);
              });
              render();
              BB.ui.toast(t('sl.toast.restored'));
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
      BB.ui.toast(t('sl.toast.noSubject'));
      return;
    }
    if (!minutes || minutes < 1) {
      BB.ui.toast(t('sl.toast.duration'));
      return;
    }
    addSession(subjectId, minutes, new Date(date + 'T12:00:00').toISOString(), note);
    BB.ui.toast(t('sl.toast.added'));
    render();
  });

  render();

  /* 他タブの保存を取り込んだら描き直す。 */
  BB.store.subscribe(function () {
    render();
  });
})();
