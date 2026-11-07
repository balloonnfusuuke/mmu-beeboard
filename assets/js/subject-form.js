/* MMU BeeBoard — subject editor form.
   科目エディタ（subject-edit.html）と初回セットアップの科目追加ステップが共有する。
   項目は コード・科目名・単位数・色・コマ・配点。ここ以外に科目フォームを書かない。 */
(function (global) {
  'use strict';

  var BB = global.BB;

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

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* 未使用のプリセット色を順に割り当てる。全色使用済みなら先頭に戻る。 */
  function nextUnusedColor() {
    for (var i = 0; i < PRESETS.length; i++) {
      if (!BB.store.colorOwner(PRESETS[i].hex)) return PRESETS[i].hex;
    }
    return PRESETS[0].hex;
  }

  function blank() {
    var state = BB.store.get();
    return {
      id: '',
      name: '',
      credits: 4,
      color: nextUnusedColor(),
      lecturer: '',
      faculty: (state.student && state.student.faculty) || 'Faculty of Computing and Informatics',
      sessions: [],
      assessments: [],
      marks: {},
      topics: { label: 'Module 1', title: 'Introduction', resource: 'Course outline' }
    };
  }

  function totalWeight(draft) {
    return draft.assessments.reduce(function (sum, assessment) {
      return sum + (Number(assessment.weight) || 0);
    }, 0);
  }

  function colorOwner(hex, exceptId) {
    return BB.store.colorOwner(hex, exceptId);
  }

  function palette(draft) {
    var color = draft.color;
    return (
      '<div class="flex flex-wrap gap-2">' +
      PRESETS.map(function (preset) {
        var selected = preset.hex.toUpperCase() === String(color).toUpperCase();
        var owner = colorOwner(preset.hex, draft.id);
        return (
          '<button type="button" data-color="' + preset.hex + '" title="' + esc(preset.name) +
          (owner ? ' — in use by ' + esc(owner.id) : '') + '"' +
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
      '<input id="f-color" class="bb-input num" style="height:36px;width:120px" type="text" value="' + esc(color) + '">' +
      '<span class="w-6 h-6 rounded" style="background:' + esc(color) + '"></span>' +
      '<span class="text-caption text-muted">' + (colorOwner(color, draft.id) ? 'In use by ' + esc(colorOwner(color, draft.id).id) : 'Available') + '</span>' +
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
      '<input class="bb-input num" type="time" value="' + esc(session.start) + '" data-field="start"></div>' +
      '<div class="col-span-6 sm:col-span-2"><label class="bb-label">End</label>' +
      '<input class="bb-input num" type="time" value="' + esc(session.end) + '" data-field="end"></div>' +
      '<div class="col-span-6 sm:col-span-2"><label class="bb-label">Type</label>' +
      '<select class="bb-input" data-field="type">' +
      ['LEC', 'TUT', 'LAB'].map(function (type) {
        return '<option value="' + type + '"' + (session.type === type ? ' selected' : '') + '>' + type + '</option>';
      }).join('') + '</select></div>' +
      '<div class="col-span-9 sm:col-span-3"><label class="bb-label">Room</label>' +
      '<input class="bb-input" type="text" value="' + esc(session.room) + '" data-field="room"></div>' +
      '<div class="col-span-3 sm:col-span-1 flex justify-end">' +
      '<button type="button" class="bb-btn bb-btn-ghost" style="width:40px;padding:0" data-remove-session="' + index + '" title="Remove session">' +
      '<span class="material-symbols-outlined text-[18px]">delete</span></button></div></div>'
    );
  }

  function assessmentRow(assessment, index) {
    var kind = assessment.kind === 'exam' ? 'exam' : 'coursework';
    return (
      '<div class="grid grid-cols-12 gap-2 items-end pb-3 border-b border-border-subtle last:border-0"' +
      ' data-assessment="' + index + '" data-id="' + esc(assessment.id) + '" data-kind="' + esc(kind) + '">' +
      '<div class="col-span-12 sm:col-span-3"><label class="bb-label">Component</label>' +
      '<input class="bb-input" type="text" value="' + esc(assessment.name) + '" data-field="name"></div>' +
      '<div class="col-span-4 sm:col-span-2"><label class="bb-label">Weight %</label>' +
      '<input class="bb-input num" type="number" min="0" max="100" step="1" value="' + esc(assessment.weight) + '" data-field="weight"></div>' +
      '<div class="col-span-4 sm:col-span-2"><label class="bb-label">Max marks</label>' +
      '<input class="bb-input num" type="number" min="1" step="1" value="' + esc(assessment.max) + '" data-field="max"></div>' +
      '<div class="col-span-4 sm:col-span-1"><label class="bb-label">Week</label>' +
      '<input class="bb-input num" type="number" min="1" max="20" step="1" value="' + esc(assessment.week) + '" data-field="week"></div>' +
      '<div class="col-span-10 sm:col-span-3"><label class="bb-label">Type</label>' +
      '<select class="bb-input" data-field="kind">' +
      '<option value="coursework"' + (kind === 'coursework' ? ' selected' : '') + '>Coursework</option>' +
      '<option value="exam"' + (kind === 'exam' ? ' selected' : '') + '>Final exam</option>' +
      '</select></div>' +
      '<div class="col-span-2 sm:col-span-1 flex justify-end">' +
      '<button type="button" class="bb-btn bb-btn-ghost" style="width:40px;padding:0" data-remove-assessment="' + index + '" title="Remove component">' +
      '<span class="material-symbols-outlined text-[18px]">delete</span></button></div></div>'
    );
  }

  /* options: { deleteButton: bool, footer: bool } */
  function render(host, draft, options) {
    options = options || {};
    var total = totalWeight(draft);
    var balanced = draft.assessments.length === 0 || total === 100;

    host.innerHTML =
      '<section class="bb-card overflow-hidden">' +
      '<div class="px-6 py-4 border-b border-border flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">badge</span>' +
      '<div><h2 class="text-title-md font-bold text-ink">Subject Details</h2>' +
      '<p class="text-body-sm text-muted">Core academic profile and visual indicators for timetabling.</p></div></div>' +
      '<div class="p-6 space-y-5">' +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">' +
      '<div><label class="bb-label" for="f-code">Subject Code *</label>' +
      '<input id="f-code" class="bb-input num" type="text" value="' + esc(draft.id) + '" placeholder="ABC1234"></div>' +
      '<div class="sm:col-span-2"><label class="bb-label" for="f-name">Subject Name *</label>' +
      '<input id="f-name" class="bb-input" type="text" value="' + esc(draft.name) + '" placeholder="Introduction to Programming"></div>' +
      '<div><label class="bb-label" for="f-credits">Credit Hours</label>' +
      '<input id="f-credits" class="bb-input num" type="number" min="1" max="12" step="1" value="' + esc(draft.credits) + '"></div>' +
      '<div class="sm:col-span-2"><label class="bb-label" for="f-lecturer">Lecturer</label>' +
      '<input id="f-lecturer" class="bb-input" type="text" value="' + esc(draft.lecturer || '') + '"></div>' +
      '</div>' +
      '<div><div class="bb-label">Subject Accent Color</div>' + palette(draft) +
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
      '<span id="total-weight" class="bb-chip" style="background:' + (balanced ? 'var(--bb-success-surface)' : 'var(--bb-alert-surface)') + ';color:' +
      (balanced ? 'var(--bb-success)' : 'var(--bb-alert)') + '">' +
      'Total Weighting: ' + total + '%' + (balanced ? '' : ' — must equal 100%') + '</span></div>' +
      '</div></section>' +

      (options.deleteButton
        ? '<div class="flex items-center justify-between gap-3">' +
          '<button type="button" id="delete-subject" class="bb-btn bb-btn-danger">' +
          '<span class="material-symbols-outlined text-[18px]">delete</span>Delete subject</button>' +
          '<div class="flex items-center gap-2">' +
          '<a href="settings.html" class="bb-btn bb-btn-ghost">Cancel</a>' +
          '<button type="button" id="save-subject-bottom" class="bb-btn bb-btn-primary">Save changes</button>' +
          '</div></div>'
        : '');
  }

  /* 入力値を draft へ書き戻す。render の前に必ず呼ぶ。
     フォームが DOM に無いときは何もしない（コマ・配点を空で上書きしない）。 */
  function sync(host, draft) {
    var code = host.querySelector('#f-code');
    var name = host.querySelector('#f-name');
    var credits = host.querySelector('#f-credits');
    var lecturer = host.querySelector('#f-lecturer');

    if (!code) return draft;

    draft.id = code.value.trim().toUpperCase();
    if (name) draft.name = name.value.trim();
    if (credits) draft.credits = Number(credits.value);
    if (lecturer) draft.lecturer = lecturer.value.trim();

    draft.sessions = Array.prototype.slice.call(host.querySelectorAll('[data-session]')).map(function (row) {
      return {
        type: row.querySelector('[data-field="type"]').value,
        day: Number(row.querySelector('[data-field="day"]').value),
        start: row.querySelector('[data-field="start"]').value,
        end: row.querySelector('[data-field="end"]').value,
        room: row.querySelector('[data-field="room"]').value.trim()
      };
    });

    draft.assessments = Array.prototype.slice.call(host.querySelectorAll('[data-assessment]')).map(function (row) {
      var kindField = row.querySelector('[data-field="kind"]');
      return {
        id: row.getAttribute('data-id'),
        name: row.querySelector('[data-field="name"]').value.trim(),
        weight: Number(row.querySelector('[data-field="weight"]').value),
        max: Number(row.querySelector('[data-field="max"]').value),
        week: Number(row.querySelector('[data-field="week"]').value),
        kind: kindField ? kindField.value : (row.getAttribute('data-kind') || 'coursework')
      };
    });

    return draft;
  }

  /* 重みの入力に追随して合計表示を更新する。追加・削除のときだけ更新すると
     「画面は 100% なのに保存できない」状態になる（監査 C3）。 */
  function updateTotal(host) {
    var chip = host.querySelector('#total-weight');
    if (!chip) return;
    var inputs = Array.prototype.slice.call(host.querySelectorAll('[data-field="weight"]'));
    var total = inputs.reduce(function (sum, input) {
      return sum + (Number(input.value) || 0);
    }, 0);
    total = Math.round(total * 100) / 100;
    var balanced = inputs.length === 0 || total === 100;
    chip.textContent = 'Total Weighting: ' + total + '%' + (balanced ? '' : ' — must equal 100%');
    chip.style.background = balanced ? 'var(--bb-success-surface)' : 'var(--bb-alert-surface)';
    chip.style.color = balanced ? 'var(--bb-success)' : 'var(--bb-alert)';
  }

  /* 行の追加・削除と色選択。変更後は onChange() で呼び出し側が再描画する。 */
  function bind(host, draft, onChange) {
    host.addEventListener('input', function (event) {
      if (!event.target.closest('[data-field="weight"]')) return;
      updateTotal(host);
    });

    host.addEventListener('click', function (event) {
      var swatch = event.target.closest('[data-color]');
      if (swatch) {
        sync(host, draft);
        draft.color = swatch.getAttribute('data-color');
        onChange();
        return;
      }

      if (event.target.closest('#add-session')) {
        sync(host, draft);
        draft.sessions.push({ type: 'LEC', day: 1, start: '09:00', end: '10:00', room: '' });
        onChange();
        return;
      }

      var removeSession = event.target.closest('[data-remove-session]');
      if (removeSession) {
        sync(host, draft);
        draft.sessions.splice(Number(removeSession.getAttribute('data-remove-session')), 1);
        onChange();
        return;
      }

      if (event.target.closest('#add-assessment')) {
        sync(host, draft);
        draft.assessments.push({
          id: 'a' + Date.now(),
          name: 'New component',
          weight: 0,
          max: 10,
          week: 1,
          kind: 'coursework'
        });
        onChange();
        return;
      }

      var removeAssessment = event.target.closest('[data-remove-assessment]');
      if (removeAssessment) {
        sync(host, draft);
        draft.assessments.splice(Number(removeAssessment.getAttribute('data-remove-assessment')), 1);
        onChange();
      }
    });

    host.addEventListener('change', function (event) {
      if (event.target.id !== 'f-color') return;
      var value = event.target.value.trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
        BB.ui.toast('Enter a HEX colour like #003DA5');
        return;
      }
      sync(host, draft);
      draft.color = value.toUpperCase();
      onChange();
    });
  }

  /* 保存前の検証。問題があればメッセージ、なければ null。 */
  function validate(draft, options) {
    options = options || {};
    var exceptId = options.exceptId;

    if (!draft.id || !draft.name) return 'Subject code and name are required';
    if (!draft.credits || draft.credits < 1) return 'Credit hours must be at least 1';

    var owner = colorOwner(draft.color, exceptId);
    if (owner) return 'Colour already used by ' + owner.id;

    if (draft.assessments.length && totalWeight(draft) !== 100) return 'Assessment weights must total 100%';

    var duplicate = BB.store.get().subjects.filter(function (subject) {
      return subject.id === draft.id && subject.id !== exceptId;
    });
    if (duplicate.length) return 'Subject code ' + draft.id + ' already exists';

    return null;
  }

  BB.subjectForm = {
    PRESETS: PRESETS,
    DAYS: DAYS,
    blank: blank,
    nextUnusedColor: nextUnusedColor,
    totalWeight: totalWeight,
    render: render,
    sync: sync,
    bind: bind,
    validate: validate
  };
})(window);
