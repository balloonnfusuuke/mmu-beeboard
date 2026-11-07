(function () {
  'use strict';

  var BB = window.BB;
  var filter = 'all';
  var formOpen = false;

  BB.ui.mount({
    title: 'Deadlines',
    head: {
      title: 'Deadlines',
      subtitle: 'Track assessment timelines, deliverables, and weight at stake across the trimester.'
    }
  });

  function items() {
    var all = BB.dash.deadlineItems();
    return filter === 'all'
      ? all
      : all.filter(function (item) {
          return item.subject.id === filter;
        });
  }

  function renderAddForm() {
    var state = BB.store.get();
    var host = document.getElementById('add-deadline');
    var options = state.subjects
      .map(function (subject) {
        return '<option value="' + subject.id + '">' + subject.id + ' ' + subject.name + '</option>';
      })
      .join('');

    host.innerHTML =
      '<div class="bb-card overflow-hidden">' +
      '<button type="button" id="toggle-add" class="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left">' +
      '<span class="flex items-center gap-2">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">add_task</span>' +
      '<span class="text-title-md font-semibold text-ink">Add a deadline</span>' +
      '<span class="text-caption text-muted">for anything the module outline does not list</span></span>' +
      '<span class="material-symbols-outlined text-muted">' + (formOpen ? 'expand_less' : 'expand_more') + '</span>' +
      '</button>' +
      '<div class="px-5 pb-5 border-t border-border' + (formOpen ? '' : ' hidden') + '">' +
      '<form id="deadline-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">' +
      '<div class="sm:col-span-2"><label class="bb-label" for="d-name">Title</label>' +
      '<input id="d-name" name="name" class="bb-input" type="text" placeholder="Lab report submission" required></div>' +
      '<div><label class="bb-label" for="d-subject">Module</label>' +
      '<select id="d-subject" name="subjectId" class="bb-input">' + options + '</select></div>' +
      '<div><label class="bb-label" for="d-week">Week</label>' +
      '<input id="d-week" name="week" class="bb-input num" type="number" min="1" max="' +
      state.term.examWeek + '" step="1" value="' + BB.dash.currentWeek(new Date()) + '"></div>' +
      '<div><label class="bb-label" for="d-weight">Weight (%)</label>' +
      '<input id="d-weight" name="weight" class="bb-input num" type="number" min="0" max="100" step="1" value="0"></div>' +
      '<div><label class="bb-label" for="d-note">Due / note</label>' +
      '<input id="d-note" name="note" class="bb-input" type="text" placeholder="Sun 6 Dec, 23:59"></div>' +
      '<div class="sm:col-span-2 flex justify-end">' +
      '<button type="submit" class="bb-btn bb-btn-primary">' +
      '<span class="material-symbols-outlined text-[18px]">check</span>Add deadline</button></div>' +
      '</form></div></div>';
  }

  function renderFilters() {
    var state = BB.store.get();
    var host = document.getElementById('filters');
    var chips = [{ id: 'all', label: 'All modules', color: 'var(--bb-primary)' }].concat(
      state.subjects.map(function (subject) {
        return { id: subject.id, label: subject.id, color: subject.color };
      })
    );

    host.innerHTML = chips
      .map(function (chip) {
        var active = filter === chip.id;
        return (
          '<button type="button" data-filter="' + chip.id + '" class="bb-chip" style="' +
          (active
            ? 'background:' + chip.color + ';color:#fff;border:1px solid ' + chip.color
            : 'background:var(--bb-surface);color:var(--bb-text-muted);border:1px solid var(--bb-border)') +
          '">' + chip.label + '</button>'
        );
      })
      .join('');
  }

  function renderMilestone() {
    var host = document.getElementById('milestone');
    var now = new Date();
    var week = BB.dash.currentWeek(now);
    var upcoming = items().filter(function (item) {
      return item.week >= week;
    });
    var next = upcoming[0];

    if (!next) {
      host.innerHTML =
        '<div class="bb-card p-4 flex items-center gap-3 text-body-sm text-muted">' +
        '<span class="material-symbols-outlined text-[20px] text-primary">event_available</span>' +
        'No upcoming deadlines for this filter.</div>';
      return;
    }

    var start = BB.date.weekRange(next.week).start;
    var days = Math.round((start - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
    var when = days <= 0 ? 'This week' : days === 1 ? 'Tomorrow' : 'In ' + days + ' days';

    host.innerHTML =
      '<div class="bb-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
      '<div class="flex items-center gap-3">' +
      '<span class="material-symbols-outlined text-[22px] text-primary">alarm</span>' +
      '<div><div class="text-caption uppercase tracking-wider text-muted">Upcoming Milestone</div>' +
      '<div class="text-body-md font-semibold text-ink">Next deadline: ' + next.subject.id + ' ' +
      next.assessment.name + ' — Week ' + next.week + ' (' + BB.date.weekLabel(next.week) + ')</div></div></div>' +
      '<span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-primary)">' + when + '</span></div>';
  }

  function renderTimeline() {
    var host = document.getElementById('timeline');
    var list = items();

    if (!list.length) {
      host.innerHTML =
        '<div class="bb-card p-8 text-center text-body-sm text-muted">No assessments for this filter.</div>';
      return;
    }

    var weeks = {};
    list.forEach(function (item) {
      if (!weeks[item.week]) weeks[item.week] = [];
      weeks[item.week].push(item);
    });

    host.innerHTML = Object.keys(weeks)
      .map(Number)
      .sort(function (a, b) {
        return a - b;
      })
      .map(function (week) {
        var entries = weeks[week];
        var total = entries.reduce(function (sum, item) {
          return sum + item.assessment.weight;
        }, 0);
        var isExam = week >= BB.store.get().term.examWeek;
        var highStakes = total >= 50;

        var rows = entries
          .map(function (item) {
            var assessment = item.assessment;
            var meta = assessment.dueLabel || assessment.location || (assessment.kind === 'quiz' ? 'Standard Week Window' : '');
            var weight = assessment.weight > 0 ? assessment.weight + '%' : '—';
            var remove = item.custom
              ? '<button type="button" data-remove="' + item.custom.id + '" class="text-muted hover:text-alert transition-colors" title="Remove this custom deadline">' +
                '<span class="material-symbols-outlined text-[18px]">delete</span></button>'
              : '';
            return (
              '<div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-border-subtle last:border-0">' +
              '<div class="flex items-center gap-3 min-w-0">' + BB.ui.solidChip(item.subject.color, item.subject.id) +
              '<div class="min-w-0"><div class="text-body-md font-semibold text-ink truncate">' + assessment.name +
              (item.custom ? ' <span class="text-caption font-semibold text-muted">(custom)</span>' : '') + '</div>' +
              (meta ? '<div class="text-caption text-muted truncate">' + meta + '</div>' : '') + '</div></div>' +
              '<div class="flex items-center gap-3 shrink-0">' +
              '<span class="text-label-md font-bold text-ink num">' + weight + '</span>' + remove +
              '<a href="simulator.html?subject=' + item.subject.id + '" class="text-muted hover:text-primary transition-colors" title="Open Grade Simulator">' +
              '<span class="material-symbols-outlined text-[18px]">chevron_right</span></a></div></div>'
            );
          })
          .join('');

        return (
          '<div class="bb-card overflow-hidden">' +
          '<div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-canvas border-b border-border">' +
          '<div class="flex items-center gap-2">' +
          '<span class="text-label-sm font-bold text-primary uppercase tracking-wider">' +
          (isExam ? 'Week ' + week + ' (Exam Week)' : 'Week ' + week) + '</span>' +
          '<span class="text-caption text-muted">' + BB.date.weekLabel(week) + '</span>' +
          (highStakes ? '<span class="bb-chip" style="background:var(--bb-alert-surface);color:var(--bb-alert)">High Stakes</span>' : '') +
          '</div>' +
          '<span class="text-caption text-muted">Total Weight: <strong class="text-ink num">' + total + '%</strong></span>' +
          '</div>' + rows + '</div>'
        );
      })
      .join('');
  }

  function render() {
    renderAddForm();
    renderFilters();
    renderMilestone();
    renderTimeline();
  }

  document.getElementById('add-deadline').addEventListener('click', function (event) {
    if (!event.target.closest('#toggle-add')) return;
    formOpen = !formOpen;
    renderAddForm();
  });

  document.getElementById('add-deadline').addEventListener('submit', function (event) {
    if (event.target.id !== 'deadline-form') return;
    event.preventDefault();
    var form = event.target;
    var name = form.elements.name.value.trim();
    var week = Number(form.elements.week.value);
    if (!name) {
      BB.ui.toast('Title is required');
      return;
    }
    if (!isFinite(week) || week < 1) {
      BB.ui.toast('Week must be 1 or later');
      return;
    }
    BB.store.update(function (data) {
      data.customDeadlines = data.customDeadlines || [];
      data.customDeadlines.push({
        id: 'cd-' + Date.now(),
        subjectId: form.elements.subjectId.value,
        name: name,
        week: week,
        weight: Number(form.elements.weight.value) || 0,
        note: form.elements.note.value.trim(),
        createdAt: new Date().toISOString()
      });
    });
    formOpen = false;
    BB.ui.toast('Deadline added');
    render();
  });

  document.getElementById('timeline').addEventListener('click', function (event) {
    var button = event.target.closest('[data-remove]');
    if (!button) return;
    var id = button.getAttribute('data-remove');
    BB.store.update(function (data) {
      data.customDeadlines = (data.customDeadlines || []).filter(function (entry) {
        return entry.id !== id;
      });
    });
    BB.ui.toast('Deadline removed');
    render();
  });

  document.getElementById('filters').addEventListener('click', function (event) {
    var button = event.target.closest('[data-filter]');
    if (!button) return;
    filter = button.getAttribute('data-filter');
    render();
  });

  render();
})();
