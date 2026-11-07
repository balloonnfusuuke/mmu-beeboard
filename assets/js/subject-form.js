/* MMU BeeBoard — subject editor form.
   科目エディタ（subject-edit.html）と初回セットアップの科目追加ステップが共有する。
   項目は コード・科目名・単位数・色・コマ・配点。ここ以外に科目フォームを書かない。 */
(function (global) {
  'use strict';

  var BB = global.BB;
  var t = BB.i18n.t;
  var tn = BB.i18n.tn;

  var PRESETS = [
    { hex: '#003DA5', key: 'mmuBlue' },
    { hex: '#0E7490', key: 'cyan' },
    { hex: '#0F766E', key: 'teal' },
    { hex: '#15803D', key: 'green' },
    { hex: '#4D7C0F', key: 'olive' },
    { hex: '#E35205', key: 'orange' },
    { hex: '#BE185D', key: 'pink' },
    { hex: '#7C3AED', key: 'purple' },
    { hex: '#4338CA', key: 'indigo' },
    { hex: '#6D4C41', key: 'brown' },
    { hex: '#475569', key: 'slate' }
  ];

  var DAYS = [
    { value: 1, key: 'mon' },
    { value: 2, key: 'tue' },
    { value: 3, key: 'wed' },
    { value: 4, key: 'thu' },
    { value: 5, key: 'fri' }
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
      topics: {
        label: t('form.defaultTopicLabel'),
        title: t('form.defaultTopicTitle'),
        resource: t('form.defaultTopicResource')
      }
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
          '<button type="button" data-color="' + preset.hex + '" title="' + esc(t('form.preset.' + preset.key)) +
          (owner ? ' — ' + esc(t('form.inUseBy', { id: owner.id })) : '') + '"' +
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
      '<span class="text-caption text-muted">' + t('form.customHex') + '</span>' +
      '<input id="f-color" class="bb-input num" style="height:36px;width:120px" type="text" value="' + esc(color) + '">' +
      '<span class="w-6 h-6 rounded" style="background:' + esc(color) + '"></span>' +
      '<span class="text-caption text-muted">' +
      (colorOwner(color, draft.id) ? t('form.inUseBy', { id: colorOwner(color, draft.id).id }) : t('form.available')) +
      '</span>' +
      '</div>'
    );
  }

  /* 教室コードの下に人間可読な場所を出す。表示専用で、保存値はコードのまま。 */
  function roomCaption(code) {
    var text = BB.room ? BB.room.label(code) : null;
    return '<p class="text-caption text-muted mt-1" data-room-label' + (text ? '' : ' hidden') + '>' +
      esc(text || '') + '</p>';
  }

  function sessionRow(session, index) {
    return (
      '<div class="grid grid-cols-12 gap-2 items-end pb-3 border-b border-border-subtle last:border-0" data-session="' + index + '">' +
      '<div class="col-span-6 sm:col-span-2"><label class="bb-label">' + t('common.day') + '</label>' +
      '<select class="bb-input" data-field="day">' +
      DAYS.map(function (day) {
        return '<option value="' + day.value + '"' + (session.day === day.value ? ' selected' : '') + '>' +
          t('day.' + day.key) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="col-span-6 sm:col-span-2"><label class="bb-label">' + t('common.start') + '</label>' +
      '<input class="bb-input num" type="time" value="' + esc(session.start) + '" data-field="start"></div>' +
      '<div class="col-span-6 sm:col-span-2"><label class="bb-label">' + t('common.end') + '</label>' +
      '<input class="bb-input num" type="time" value="' + esc(session.end) + '" data-field="end"></div>' +
      '<div class="col-span-6 sm:col-span-2"><label class="bb-label">' + t('common.type') + '</label>' +
      '<select class="bb-input" data-field="type">' +
      ['LEC', 'TUT', 'LAB'].map(function (type) {
        return '<option value="' + type + '"' + (session.type === type ? ' selected' : '') + '>' + type + '</option>';
      }).join('') + '</select></div>' +
      '<div class="col-span-9 sm:col-span-3"><label class="bb-label">' + t('common.room') + '</label>' +
      '<input class="bb-input" type="text" value="' + esc(session.room) + '" data-field="room">' +
      roomCaption(session.room) + '</div>' +
      '<div class="col-span-3 sm:col-span-1 flex justify-end">' +
      '<button type="button" class="bb-btn bb-btn-ghost" style="width:40px;padding:0" data-remove-session="' + index +
      '" title="' + esc(t('form.removeSession')) + '">' +
      '<span class="material-symbols-outlined text-[18px]">delete</span></button></div></div>'
    );
  }

  function assessmentRow(assessment, index) {
    var kind = assessment.kind === 'exam' ? 'exam' : 'coursework';
    return (
      '<div class="grid grid-cols-12 gap-2 items-end pb-3 border-b border-border-subtle last:border-0"' +
      ' data-assessment="' + index + '" data-id="' + esc(assessment.id) + '" data-kind="' + esc(kind) + '">' +
      '<div class="col-span-12 sm:col-span-3"><label class="bb-label">' + t('form.component') + '</label>' +
      '<input class="bb-input" type="text" value="' + esc(assessment.name) + '" data-field="name"></div>' +
      '<div class="col-span-4 sm:col-span-2"><label class="bb-label">' + t('form.weightPercent') + '</label>' +
      '<input class="bb-input num" type="number" min="0" max="100" step="1" value="' + esc(assessment.weight) + '" data-field="weight"></div>' +
      '<div class="col-span-4 sm:col-span-2"><label class="bb-label">' + t('form.maxMarks') + '</label>' +
      '<input class="bb-input num" type="number" min="1" step="1" value="' + esc(assessment.max) + '" data-field="max"></div>' +
      '<div class="col-span-4 sm:col-span-1"><label class="bb-label">' + t('form.week') + '</label>' +
      '<input class="bb-input num" type="number" min="1" max="20" step="1" value="' + esc(assessment.week) + '" data-field="week"></div>' +
      '<div class="col-span-10 sm:col-span-3"><label class="bb-label">' + t('form.type') + '</label>' +
      '<select class="bb-input" data-field="kind">' +
      '<option value="coursework"' + (kind === 'coursework' ? ' selected' : '') + '>' + t('form.coursework') + '</option>' +
      '<option value="exam"' + (kind === 'exam' ? ' selected' : '') + '>' + t('form.finalExam') + '</option>' +
      '</select></div>' +
      '<div class="col-span-2 sm:col-span-1 flex justify-end">' +
      '<button type="button" class="bb-btn bb-btn-ghost" style="width:40px;padding:0" data-remove-assessment="' + index +
      '" title="' + esc(t('form.removeComponent')) + '">' +
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
      '<div><h2 class="text-title-md font-bold text-ink">' + t('form.subjectDetails') + '</h2>' +
      '<p class="text-body-sm text-muted">' + t('form.subjectDetailsHint') + '</p></div></div>' +
      '<div class="p-6 space-y-5">' +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">' +
      '<div><label class="bb-label" for="f-code">' + t('form.subjectCode') + '</label>' +
      '<input id="f-code" class="bb-input num" type="text" value="' + esc(draft.id) + '" placeholder="' +
      esc(t('form.codePlaceholder')) + '"></div>' +
      '<div class="sm:col-span-2"><label class="bb-label" for="f-name">' + t('form.subjectName') + '</label>' +
      '<input id="f-name" class="bb-input" type="text" value="' + esc(draft.name) + '" placeholder="' +
      esc(t('form.namePlaceholder')) + '"></div>' +
      '<div><label class="bb-label" for="f-credits">' + t('form.creditHours') + '</label>' +
      '<input id="f-credits" class="bb-input num" type="number" min="1" max="12" step="1" value="' + esc(draft.credits) + '"></div>' +
      '<div class="sm:col-span-2"><label class="bb-label" for="f-lecturer">' + t('form.lecturer') + '</label>' +
      '<input id="f-lecturer" class="bb-input" type="text" value="' + esc(draft.lecturer || '') + '"></div>' +
      '</div>' +
      '<div><div class="bb-label">' + t('form.accentColor') + '</div>' + palette(draft) +
      '<p class="text-caption text-muted mt-2">' + t('form.accentHint') + '</p></div>' +
      '</div></section>' +

      '<section class="bb-card overflow-hidden">' +
      '<div class="px-6 py-4 border-b border-border flex items-center justify-between gap-3">' +
      '<div class="flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">schedule</span>' +
      '<div><h2 class="text-title-md font-bold text-ink">' + t('form.classSessions') + '</h2>' +
      '<p class="text-body-sm text-muted">' + t('form.classSessionsHint') + '</p></div></div>' +
      '<span class="text-caption text-muted">' + tn('form.sessionCount', draft.sessions.length) + '</span></div>' +
      '<div class="p-6">' + draft.sessions.map(sessionRow).join('') +
      '<button type="button" id="add-session" class="bb-btn bb-btn-ghost mt-3">' +
      '<span class="material-symbols-outlined text-[18px]">add</span>' + t('form.addSession') + '</button></div></section>' +

      '<section class="bb-card overflow-hidden">' +
      '<div class="px-6 py-4 border-b border-border flex items-center justify-between gap-3">' +
      '<div class="flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">grading</span>' +
      '<div><h2 class="text-title-md font-bold text-ink">' + t('form.assessmentComponents') + '</h2>' +
      '<p class="text-body-sm text-muted">' + t('form.assessmentComponentsHint') + '</p></div></div>' +
      '<span class="text-caption text-muted">' + tn('form.componentCount', draft.assessments.length) + '</span></div>' +
      '<div class="p-6">' + draft.assessments.map(assessmentRow).join('') +
      '<div class="flex flex-wrap items-center justify-between gap-3 mt-3">' +
      '<button type="button" id="add-assessment" class="bb-btn bb-btn-ghost">' +
      '<span class="material-symbols-outlined text-[18px]">add</span>' + t('form.addComponent') + '</button>' +
      '<span id="total-weight" class="bb-chip" style="background:' + (balanced ? 'var(--bb-success-surface)' : 'var(--bb-alert-surface)') + ';color:' +
      (balanced ? 'var(--bb-success)' : 'var(--bb-alert)') + '">' +
      totalLabel(total, balanced) + '</span></div>' +
      '</div></section>' +

      (options.deleteButton
        ? '<div class="flex items-center justify-between gap-3">' +
          '<button type="button" id="delete-subject" class="bb-btn bb-btn-danger">' +
          '<span class="material-symbols-outlined text-[18px]">delete</span>' + t('form.deleteSubject') + '</button>' +
          '<div class="flex items-center gap-2">' +
          '<a href="settings.html" class="bb-btn bb-btn-ghost">' + t('common.cancel') + '</a>' +
          '<button type="button" id="save-subject-bottom" class="bb-btn bb-btn-primary">' + t('form.saveChanges') + '</button>' +
          '</div></div>'
        : '');
  }

  /* 配点合計の表示文言。render と updateTotal で同じ形にする。 */
  function totalLabel(total, balanced) {
    return balanced ? t('form.totalWeighting', { n: total }) : t('form.totalWeightingMust', { n: total });
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
    chip.textContent = totalLabel(total, balanced);
    chip.style.background = balanced ? 'var(--bb-success-surface)' : 'var(--bb-alert-surface)';
    chip.style.color = balanced ? 'var(--bb-success)' : 'var(--bb-alert)';
  }

  /* 行の追加・削除と色選択。変更後は onChange() で呼び出し側が再描画する。 */
  function bind(host, draft, onChange) {
    host.addEventListener('input', function (event) {
      if (event.target.closest('[data-field="weight"]')) {
        updateTotal(host);
        return;
      }

      /* 教室コードは入力中にその場でデコード表示を差し替える（再描画しない）。 */
      var room = event.target.closest('[data-field="room"]');
      if (room) {
        var row = room.closest('[data-session]');
        var caption = row ? row.querySelector('[data-room-label]') : null;
        if (!caption) return;
        var text = BB.room ? BB.room.label(room.value) : null;
        caption.textContent = text || '';
        caption.hidden = !text;
      }
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
          name: t('form.newComponent'),
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
        BB.ui.toast(t('form.err.hex'));
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

    if (!draft.id || !draft.name) return t('form.err.codeAndName');
    if (!draft.credits || draft.credits < 1) return t('form.err.credits');

    var owner = colorOwner(draft.color, exceptId);
    if (owner) return t('form.err.colorUsed', { id: owner.id });

    if (draft.assessments.length && totalWeight(draft) !== 100) return t('form.err.weights');

    var duplicate = BB.store.get().subjects.filter(function (subject) {
      return subject.id === draft.id && subject.id !== exceptId;
    });
    if (duplicate.length) return t('form.err.duplicate', { id: draft.id });

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
