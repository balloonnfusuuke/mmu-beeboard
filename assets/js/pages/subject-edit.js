(function () {
  'use strict';

  var BB = window.BB;
  var PRESETS = [
    { hex: '#003DA5', name: 'MMU Blue' },
    { hex: '#0E7490', name: 'Cyan' },
    { hex: '#0F766E', name: 'Teal' },
    { hex: '#15803D', name: 'Green' },
    { hex: '#4D7C0F', name: 'Olive' },
    { hex: '#E35205', name: 'Orange' },
    { hex: '#BE185D', name: 'Pink' },
    { hex: '#7C3AED', name: 'Purple' },
    { hex: '#4338CA', name: 'Indigo' },
    { hex: '#6D4C41', name: 'Brown' },
    { hex: '#475569', name: 'Slate' }
  ];
  var DAYS = [
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' }
  ];

  function $(selector) {
    return document.querySelector(selector);
  }

  function $$(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function state() {
    return BB.store.get();
  }

  function findSubject(id) {
    var found = null;
    state().subjects.forEach(function (subject) {
      if (subject.id === id) found = subject;
    });
    return found;
  }

  var originalId = new URLSearchParams(window.location.search).get('id');
  var source = findSubject(originalId) || state().subjects[0];
  var draft = JSON.parse(JSON.stringify(source));
  var color = draft.color;

  BB.ui.mount({
    title: 'Edit Subject',
    head: {
      title: 'Edit Subject',
      subtitle: 'Configure subject metadata, weekly sessions, and continuous assessment weightings.',
      actions:
        '<a href="settings.html" class="bb-btn bb-btn-ghost">Cancel</a>' +
        '<button type="button" id="save-subject" class="bb-btn bb-btn-primary">' +
        '<span class="material-symbols-outlined text-[18px]">check</span>Save changes</button>'
    }
  });

  function colorOwner(hex) {
    return BB.store.colorOwner(hex, draft.id);
  }

  function palette() {
    return (
      '<div class="flex flex-wrap gap-2">' +
      PRESETS.map(function (preset) {
        var selected = preset.hex.toUpperCase() === String(color).toUpperCase();
        var owner = colorOwner(preset.hex);
        return (
          '<button type="button" data-color="' + preset.hex + '" title="' + preset.name +
          (owner ? ' — in use by ' + owner.id : '') + '"' +
          ' class="relative w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105"' +
          ' style="background:' + preset.hex + ';box-shadow:0 0 0 ' + (selected ? '3px' : '1px') + ' ' +
          (selected ? 'var(--bb-primary)' : 'var(--bb-border)') + '">' +
          (selected ? '<span class="material-symbols-outlined text-[18px] text-white">check</span>' : '') +
          (owner && !selected ? '<span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-white border border-border"></span>' : '') +
          '</button>'
        );
      }).join('') +
      '</div>' +
      '<div class="flex items-center gap-3 mt-3">' +
      '<span class="text-caption text-muted">Custom HEX</span>' +
      '<input id="f-color" class="bb-input num" style="height:36px;width:120px" type="text" value="' + color + '">' +
      '<span class="w-6 h-6 rounded" style="background:' + color + '"></span>' +
      '<span class="text-caption text-muted">' + (colorOwner(color) ? 'In use by ' + colorOwner(color).id : 'Available') + '</span>' +
      '</div>'
    );
  }

  function sessionRow(session, index) {
    return (
      '<div class="grid grid-cols-12 gap-2 items-end pb-3 border-b border-border-subtle last:border-0" data-session="' + index + '">' +
      '<div class="col-span-6 sm:col-span-2"><label class="bb-label">Day</label>' +
      '<select class="bb-input" data-field="day">' +
      DAYS.map(function (day) {
        return '<option value="' + day.value + '"' + (session.day === day.value ? ' selected' : '') + '>' +
          day.label + '</option>';
      }).join('') + '</select></div>' +
      '<div class="col-span-6 sm:col-span-2"><label class="bb-label">Start</label>' +
      '<input class="bb-input num" type="time" value="' + session.start + '" data-field="start"></div>' +
      '<div class="col-span-6 sm:col-span-2"><label class="bb-label">End</label>' +
      '<input class="bb-input num" type="time" value="' + session.end + '" data-field="end"></div>' +
      '<div class="col-span-6 sm:col-span-2"><label class="bb-label">Type</label>' +
      '<select class="bb-input" data-field="type">' +
      ['LEC', 'TUT', 'LAB'].map(function (type) {
        return '<option value="' + type + '"' + (session.type === type ? ' selected' : '') + '>' + type + '</option>';
      }).join('') + '</select></div>' +
      '<div class="col-span-9 sm:col-span-3"><label class="bb-label">Room</label>' +
      '<input class="bb-input" type="text" value="' + session.room + '" data-field="room"></div>' +
      '<div class="col-span-3 sm:col-span-1 flex justify-end">' +
      '<button type="button" class="bb-btn bb-btn-ghost" style="width:40px;padding:0" data-remove-session="' + index + '" title="Remove session">' +
      '<span class="material-symbols-outlined text-[18px]">delete</span></button></div></div>'
    );
  }

  function assessmentRow(assessment, index) {
    return (
      '<div class="grid grid-cols-12 gap-2 items-end pb-3 border-b border-border-subtle last:border-0"' +
      ' data-assessment="' + index + '" data-id="' + assessment.id + '" data-kind="' + (assessment.kind || 'coursework') + '">' +
      '<div class="col-span-12 sm:col-span-4"><label class="bb-label">Component</label>' +
      '<input class="bb-input" type="text" value="' + assessment.name + '" data-field="name"></div>' +
      '<div class="col-span-4 sm:col-span-2"><label class="bb-label">Weight %</label>' +
      '<input class="bb-input num" type="number" min="0" max="100" step="1" value="' + assessment.weight + '" data-field="weight"></div>' +
      '<div class="col-span-4 sm:col-span-2"><label class="bb-label">Max marks</label>' +
      '<input class="bb-input num" type="number" min="1" step="1" value="' + assessment.max + '" data-field="max"></div>' +
      '<div class="col-span-3 sm:col-span-2"><label class="bb-label">Week</label>' +
      '<input class="bb-input num" type="number" min="1" max="20" step="1" value="' + assessment.week + '" data-field="week"></div>' +
      '<div class="col-span-1 flex justify-end">' +
      '<button type="button" class="bb-btn bb-btn-ghost" style="width:40px;padding:0" data-remove-assessment="' + index + '" title="Remove component">' +
      '<span class="material-symbols-outlined text-[18px]">delete</span></button></div></div>'
    );
  }

  function totalWeight() {
    return draft.assessments.reduce(function (sum, assessment) {
      return sum + (Number(assessment.weight) || 0);
    }, 0);
  }

  function render() {
    var total = totalWeight();
    var balanced = draft.assessments.length === 0 || total === 100;

    document.getElementById('editor').innerHTML =
      '<section class="bb-card overflow-hidden">' +
      '<div class="px-6 py-4 border-b border-border flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">badge</span>' +
      '<div><h2 class="text-title-md font-bold text-ink">Subject Details</h2>' +
      '<p class="text-body-sm text-muted">Core academic profile and visual indicators for timetabling.</p></div></div>' +
      '<div class="p-6 space-y-5">' +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">' +
      '<div><label class="bb-label" for="f-code">Subject Code *</label>' +
      '<input id="f-code" class="bb-input num" type="text" value="' + draft.id + '"></div>' +
      '<div class="sm:col-span-2"><label class="bb-label" for="f-name">Subject Name *</label>' +
      '<input id="f-name" class="bb-input" type="text" value="' + draft.name + '"></div>' +
      '<div><label class="bb-label" for="f-credits">Credit Hours</label>' +
      '<input id="f-credits" class="bb-input num" type="number" min="1" max="12" step="1" value="' + draft.credits + '"></div>' +
      '<div class="sm:col-span-2"><label class="bb-label" for="f-lecturer">Lecturer</label>' +
      '<input id="f-lecturer" class="bb-input" type="text" value="' + (draft.lecturer || '') + '"></div>' +
      '</div>' +
      '<div><div class="bb-label">Subject Accent Color</div>' + palette() +
      '<p class="text-caption text-muted mt-2">Colour is used for timetable blocks, chips, and progress bars. ' +
      'Tints are derived automatically from this single value.</p></div>' +
      '</div></section>' +

      '<section class="bb-card overflow-hidden">' +
      '<div class="px-6 py-4 border-b border-border flex items-center justify-between gap-3">' +
      '<div class="flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">schedule</span>' +
      '<div><h2 class="text-title-md font-bold text-ink">Class Sessions</h2>' +
      '<p class="text-body-sm text-muted">Weekly recurring lectures, tutorials, and practical labs.</p></div></div>' +
      '<span class="text-caption text-muted">' + draft.sessions.length + ' Sessions</span></div>' +
      '<div class="p-6">' + draft.sessions.map(sessionRow).join('') +
      '<button type="button" id="add-session" class="bb-btn bb-btn-ghost mt-3">' +
      '<span class="material-symbols-outlined text-[18px]">add</span>Add session</button></div></section>' +

      '<section class="bb-card overflow-hidden">' +
      '<div class="px-6 py-4 border-b border-border flex items-center justify-between gap-3">' +
      '<div class="flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">grading</span>' +
      '<div><h2 class="text-title-md font-bold text-ink">Assessment Components</h2>' +
      '<p class="text-body-sm text-muted">Define continuous assessment weightings and submission targets.</p></div></div>' +
      '<span class="text-caption text-muted">' + draft.assessments.length + ' Components</span></div>' +
      '<div class="p-6">' + draft.assessments.map(assessmentRow).join('') +
      '<div class="flex flex-wrap items-center justify-between gap-3 mt-3">' +
      '<button type="button" id="add-assessment" class="bb-btn bb-btn-ghost">' +
      '<span class="material-symbols-outlined text-[18px]">add</span>Add component</button>' +
      '<span class="bb-chip" style="background:' + (balanced ? 'var(--bb-success-surface)' : 'var(--bb-alert-surface)') + ';color:' +
      (balanced ? 'var(--bb-success)' : 'var(--bb-alert)') + '">' +
      'Total Weighting: ' + total + '%' + (balanced ? '' : ' — must equal 100%') + '</span></div>' +
      '</div></section>' +

      '<div class="flex items-center justify-between gap-3">' +
      '<button type="button" id="delete-subject" class="bb-btn bb-btn-danger">' +
      '<span class="material-symbols-outlined text-[18px]">delete</span>Delete subject</button>' +
      '<div class="flex items-center gap-2">' +
      '<a href="settings.html" class="bb-btn bb-btn-ghost">Cancel</a>' +
      '<button type="button" id="save-subject-bottom" class="bb-btn bb-btn-primary">Save changes</button>' +
      '</div></div>';
  }

  function syncDraft() {
    draft.id = $('#f-code').value.trim().toUpperCase();
    draft.name = $('#f-name').value.trim();
    draft.credits = Number($('#f-credits').value);
    draft.lecturer = $('#f-lecturer').value.trim();
    draft.color = color;

    draft.sessions = $$('[data-session]').map(function (row) {
      return {
        type: row.querySelector('[data-field="type"]').value,
        day: Number(row.querySelector('[data-field="day"]').value),
        start: row.querySelector('[data-field="start"]').value,
        end: row.querySelector('[data-field="end"]').value,
        room: row.querySelector('[data-field="room"]').value.trim()
      };
    });

    draft.assessments = $$('[data-assessment]').map(function (row) {
      return {
        id: row.getAttribute('data-id'),
        name: row.querySelector('[data-field="name"]').value.trim(),
        weight: Number(row.querySelector('[data-field="weight"]').value),
        max: Number(row.querySelector('[data-field="max"]').value),
        week: Number(row.querySelector('[data-field="week"]').value),
        kind: row.getAttribute('data-kind') || 'coursework'
      };
    });
  }

  function save() {
    syncDraft();

    if (!draft.id || !draft.name) {
      BB.ui.toast('Subject code and name are required');
      return;
    }
    if (!draft.credits || draft.credits < 1) {
      BB.ui.toast('Credit hours must be at least 1');
      return;
    }
    var owner = BB.store.colorOwner(draft.color, source.id);
    if (owner) {
      BB.ui.toast('Colour already used by ' + owner.id);
      return;
    }
    if (draft.assessments.length && totalWeight() !== 100) {
      BB.ui.toast('Assessment weights must total 100%');
      return;
    }

    var duplicate = state().subjects.filter(function (subject) {
      return subject.id === draft.id && subject.id !== source.id;
    });
    if (duplicate.length) {
      BB.ui.toast('Subject code ' + draft.id + ' already exists');
      return;
    }

    var keep = {};
    draft.assessments.forEach(function (assessment) {
      if (source.marks && typeof source.marks[assessment.id] === 'number') {
        keep[assessment.id] = source.marks[assessment.id];
      }
    });
    draft.marks = keep;

    BB.store.update(function (data) {
      data.subjects = data.subjects.map(function (subject) {
        return subject.id === source.id ? draft : subject;
      });
    });
    BB.ui.toast('Subject saved');
    window.location.href = 'settings.html';
  }

  document.addEventListener('click', function (event) {
    var swatch = event.target.closest('[data-color]');
    if (swatch) {
      syncDraft();
      color = swatch.getAttribute('data-color');
      draft.color = color;
      render();
      return;
    }

    if (event.target.closest('#add-session')) {
      syncDraft();
      draft.sessions.push({ type: 'LEC', day: 1, start: '09:00', end: '10:00', room: '' });
      render();
      return;
    }

    var removeSession = event.target.closest('[data-remove-session]');
    if (removeSession) {
      syncDraft();
      draft.sessions.splice(Number(removeSession.getAttribute('data-remove-session')), 1);
      render();
      return;
    }

    if (event.target.closest('#add-assessment')) {
      syncDraft();
      draft.assessments.push({
        id: 'a' + Date.now(),
        name: 'New component',
        weight: 0,
        max: 10,
        week: 1,
        kind: 'coursework'
      });
      render();
      return;
    }

    var removeAssessment = event.target.closest('[data-remove-assessment]');
    if (removeAssessment) {
      syncDraft();
      draft.assessments.splice(Number(removeAssessment.getAttribute('data-remove-assessment')), 1);
      render();
      return;
    }

    if (event.target.closest('#save-subject') || event.target.closest('#save-subject-bottom')) {
      save();
      return;
    }

    if (event.target.closest('#delete-subject')) {
      if (!window.confirm('Delete ' + source.id + ' ' + source.name + '? This cannot be undone.')) return;
      BB.store.update(function (data) {
        data.subjects = data.subjects.filter(function (subject) {
          return subject.id !== source.id;
        });
      });
      window.location.href = 'settings.html';
    }
  });

  document.addEventListener('change', function (event) {
    if (event.target.id !== 'f-color') return;
    var value = event.target.value.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
      BB.ui.toast('Enter a HEX colour like #003DA5');
      return;
    }
    syncDraft();
    color = value.toUpperCase();
    draft.color = color;
    render();
  });

  render();
})();
