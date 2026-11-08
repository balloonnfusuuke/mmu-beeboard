/* MMU BeeBoard — Notes list.
   ダッシュボードのカードは「今日のメモ＋未完了の宿題」だけを見せる。
   過去のメモと完了した宿題はここで日付の新しい順にすべて見返し、編集・削除も行う。 */
(function () {
  'use strict';

  var BB = window.BB;
  var t = BB.i18n.t;
  var DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  /* 既定は「すべて」。今日だけに絞ると過去のメモが見えなくなる。 */
  var filterSubject = 'all';
  var filterKind = 'all';
  /* 追加・編集中の下書き。null ならフォームを閉じている。 */
  var draft = null;

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

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function isoDay(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function subjectByCode(code) {
    var found = null;
    if (!code) return null;
    state().subjects.forEach(function (subject) {
      if (subject.id === code) found = subject;
    });
    return found;
  }

  /* メモの日付。日付が無い古いデータは締切日で代用する。 */
  function noteDate(note) {
    if (note.date) return String(note.date).slice(0, 10);
    if (note.due) return String(note.due).slice(0, 10);
    return '';
  }

  function dueLabel(due) {
    return due ? BB.dash.fmtDateTime(due) || String(due) : '';
  }

  function headOptions() {
    return {
      title: t('notes.listTitle'),
      subtitle: t('notes.listSubtitle'),
      actions:
        '<button type="button" data-note-add class="bb-btn bb-btn-primary">' +
        '<span class="material-symbols-outlined text-[18px]">add</span>' + t('notes.add') + '</button>'
    };
  }

  BB.ui.mount({ title: t('notes.listTitle'), head: headOptions() });

  /* ---------- filters ---------- */

  function chip(attr, value, label, active, color) {
    return (
      '<button type="button" ' + attr + '="' + esc(value) + '" class="bb-chip" style="' +
      (active
        ? 'background:' + color + ';color:#fff;border:1px solid ' + color
        : 'background:var(--bb-surface);color:var(--bb-text-muted);border:1px solid var(--bb-border)') +
      '">' + esc(label) + '</button>'
    );
  }

  function renderFilters() {
    var host = document.getElementById('filters');
    var subjects = state().subjects;

    var subjectChips = [
      chip('data-filter-subject', 'all', t('notes.allSubjects'), filterSubject === 'all', 'var(--bb-primary)')
    ]
      .concat(
        subjects.map(function (subject) {
          return chip('data-filter-subject', subject.id, subject.id, filterSubject === subject.id, subject.color);
        })
      )
      .concat([
        chip('data-filter-subject', 'none', t('notes.noSubject'), filterSubject === 'none', 'var(--bb-text-muted)')
      ]);

    var kindChips = [
      chip('data-filter-kind', 'all', t('notes.allKinds'), filterKind === 'all', 'var(--bb-primary)'),
      chip('data-filter-kind', 'memo', t('notes.kindMemo'), filterKind === 'memo', 'var(--bb-primary)'),
      chip('data-filter-kind', 'homework', t('notes.kindHomework'), filterKind === 'homework', 'var(--bb-primary)')
    ];

    host.innerHTML =
      '<div class="flex flex-wrap items-center gap-2">' +
      '<span class="text-caption font-semibold uppercase tracking-wider text-muted">' +
      t('notes.filterSubject') + '</span>' + subjectChips.join('') + '</div>' +
      '<div class="flex flex-wrap items-center gap-2">' +
      '<span class="text-caption font-semibold uppercase tracking-wider text-muted">' +
      t('notes.filterKind') + '</span>' + kindChips.join('') + '</div>';
  }

  function matches(note) {
    if (filterKind !== 'all' && note.kind !== filterKind) return false;
    if (filterSubject === 'all') return true;
    if (filterSubject === 'none') return !note.subjectCode;
    return note.subjectCode === filterSubject;
  }

  /* ---------- form ---------- */

  function formHtml() {
    var subjectOptions =
      '<option value="">' + t('notes.noSubject') + '</option>' +
      state().subjects
        .map(function (subject) {
          return '<option value="' + esc(subject.id) + '"' +
            (subject.id === draft.subjectCode ? ' selected' : '') + '>' +
            esc(subject.id + ' ' + subject.name) + '</option>';
        })
        .join('');

    return (
      '<form id="note-form" class="bb-card p-4 space-y-3">' +
      '<div class="flex items-center justify-between">' +
      '<h2 class="text-label-md font-bold text-ink">' +
      (draft.id ? t('notes.editTitle') : t('notes.addTitle')) + '</h2>' +
      '<button type="button" data-note-cancel class="text-muted hover:text-ink" aria-label="' +
      esc(t('notes.cancel')) + '">' +
      '<span class="material-symbols-outlined text-[18px]">close</span></button></div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
      '<div><label class="bb-label" for="n-kind">' + t('notes.kind') + '</label>' +
      '<select id="n-kind" class="bb-input">' +
      '<option value="homework"' + (draft.kind === 'homework' ? ' selected' : '') + '>' +
      t('notes.kindHomework') + '</option>' +
      '<option value="memo"' + (draft.kind === 'memo' ? ' selected' : '') + '>' +
      t('notes.kindMemo') + '</option></select></div>' +
      '<div><label class="bb-label" for="n-subject">' + t('notes.subject') + '</label>' +
      '<select id="n-subject" class="bb-input">' + subjectOptions + '</select></div>' +
      '<div class="sm:col-span-2"><label class="bb-label" for="n-text">' + t('notes.text') + '</label>' +
      '<input id="n-text" class="bb-input" type="text" value="' + esc(draft.text) + '" placeholder="' +
      esc(t('notes.textPlaceholder')) + '" required></div>' +
      '<div><label class="bb-label" for="n-date">' + t('notes.date') + '</label>' +
      '<input id="n-date" class="bb-input" type="date" value="' + esc(draft.date) + '"></div>' +
      '<div><label class="bb-label" for="n-due">' + t('notes.due') + '</label>' +
      '<input id="n-due" class="bb-input" type="datetime-local" value="' + esc(draft.due) + '"></div>' +
      '</div>' +
      '<div class="flex justify-end gap-2">' +
      '<button type="button" data-note-cancel class="bb-btn bb-btn-ghost">' + t('notes.cancel') + '</button>' +
      '<button type="submit" class="bb-btn bb-btn-primary">' + t('notes.save') + '</button></div>' +
      '</form>'
    );
  }

  function renderForm() {
    var host = document.getElementById('note-form-host');
    host.innerHTML = draft ? formHtml() : '';
  }

  /* 再描画の前に入力中の内容を下書きへ戻す。他タブの保存で再描画しても消えないように。 */
  function collectForm() {
    if (!draft) return;
    var kind = document.getElementById('n-kind');
    var text = document.getElementById('n-text');
    var subject = document.getElementById('n-subject');
    var date = document.getElementById('n-date');
    var due = document.getElementById('n-due');
    if (kind) draft.kind = kind.value === 'memo' ? 'memo' : 'homework';
    if (text) draft.text = text.value;
    if (subject) draft.subjectCode = subject.value || '';
    if (date) draft.date = date.value;
    if (due) draft.due = due.value || '';
  }

  function openForm(prefill) {
    draft = {
      id: '',
      kind: (prefill && prefill.kind) || 'homework',
      text: '',
      subjectCode: (prefill && prefill.subjectCode) || '',
      date: (prefill && prefill.date) || isoDay(new Date()),
      due: ''
    };
    render();
    var host = document.getElementById('note-form-host');
    if (host && host.scrollIntoView) host.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function findNote(id) {
    var found = null;
    (state().notes || []).forEach(function (note) {
      if (note.id === id) found = note;
    });
    return found;
  }

  function saveNote() {
    var text = document.getElementById('n-text').value.trim();
    if (!text) {
      BB.ui.toast(t('notes.toastTextRequired'));
      return;
    }
    var kind = document.getElementById('n-kind').value === 'memo' ? 'memo' : 'homework';
    var subjectCode = document.getElementById('n-subject').value || null;
    var date = document.getElementById('n-date').value || isoDay(new Date());
    var due = kind === 'homework' ? document.getElementById('n-due').value || '' : '';
    var editing = draft && draft.id;

    BB.store.update(function (data) {
      data.notes = data.notes || [];
      if (editing) {
        data.notes.forEach(function (note) {
          if (note.id !== editing) return;
          note.text = text;
          note.kind = kind;
          note.subjectCode = subjectCode;
          note.date = date;
          note.due = due;
        });
        return;
      }
      data.notes.push({
        id: 'n' + Date.now(),
        date: date,
        subjectCode: subjectCode,
        text: text,
        kind: kind,
        due: due,
        done: false
      });
    });

    draft = null;
    BB.ui.toast(t('notes.toastSaved'));
    render();
  }

  /* ---------- list ---------- */

  function byDueThenText(a, b) {
    var aDue = a.due || '';
    var bDue = b.due || '';
    if (aDue !== bDue) {
      if (!aDue) return 1;
      if (!bDue) return -1;
      return aDue < bDue ? -1 : 1;
    }
    return String(a.text).localeCompare(String(b.text));
  }

  /* 日付の新しい順。日付なしは最後に回す。 */
  function groupedNotes() {
    var buckets = {};
    (state().notes || []).filter(matches).forEach(function (note) {
      var key = noteDate(note);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(note);
    });
    return Object.keys(buckets)
      .sort()
      .reverse()
      .map(function (key) {
        return { date: key, notes: buckets[key].sort(byDueThenText) };
      });
  }

  function dateHeading(iso) {
    if (!iso) return t('notes.noDate');
    var day = BB.date.parse(iso);
    if (!day) return iso;
    return t('notes.dateHeading', { date: iso, day: t('day.' + DAY_KEYS[day.getDay()]) });
  }

  function noteRow(note) {
    var subject = subjectByCode(note.subjectCode);
    var isHomework = note.kind === 'homework';
    var overdue = isHomework && note.due && !note.done && String(note.due) < isoDay(new Date()) + 'T23:59';
    var toggleLabel = note.done ? t('notes.markOpen') : t('notes.markDone');
    var meta = isHomework ? (note.due ? t('notes.dueOn', { when: dueLabel(note.due) }) : t('notes.noDue')) : '';

    return (
      '<div class="flex items-start gap-3 px-5 py-3">' +
      '<button type="button" class="mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 ' +
      (note.done ? 'bg-success border-success text-white' : 'border-border text-transparent hover:border-primary') + '"' +
      ' data-note-toggle="' + esc(note.id) + '" aria-label="' + esc(toggleLabel) + '" title="' +
      esc(toggleLabel) + '">' +
      '<span class="material-symbols-outlined text-[14px]">check</span></button>' +
      '<div class="min-w-0 flex-1">' +
      '<div class="text-body-sm ' + (note.done ? 'line-through text-muted' : 'text-ink') + '">' +
      esc(note.text) + '</div>' +
      '<div class="flex flex-wrap items-center gap-2 text-caption text-muted mt-0.5">' +
      (subject
        ? '<span class="font-semibold" style="color:' + subject.color + '">' + esc(subject.id) + '</span>'
        : '') +
      '<span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-text-muted)">' +
      (isHomework ? t('notes.kindHomework') : t('notes.kindMemo')) + '</span>' +
      (note.done
        ? '<span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-success)">' +
          t('notes.done') + '</span>'
        : '') +
      (meta ? '<span class="' + (overdue ? 'text-alert font-semibold' : '') + '">' + esc(meta) + '</span>' : '') +
      (overdue
        ? '<span class="bb-chip" style="background:var(--bb-alert-surface);color:var(--bb-alert)">' +
          t('notes.overdue') + '</span>'
        : '') +
      '</div></div>' +
      '<div class="flex items-center gap-1 shrink-0">' +
      '<button type="button" class="p-1.5 rounded text-muted hover:text-primary" data-note-edit="' +
      esc(note.id) + '" title="' + esc(t('notes.edit')) + '" aria-label="' + esc(t('notes.edit')) + '">' +
      '<span class="material-symbols-outlined text-[16px]">edit</span></button>' +
      '<button type="button" class="p-1.5 rounded text-muted hover:text-alert" data-note-delete="' +
      esc(note.id) + '" title="' + esc(t('notes.delete')) + '" aria-label="' + esc(t('notes.delete')) + '">' +
      '<span class="material-symbols-outlined text-[16px]">delete</span></button>' +
      '</div></div>'
    );
  }

  function renderList() {
    var host = document.getElementById('note-list');
    var groups = groupedNotes();

    if (!groups.length) {
      var empty = (state().notes || []).length ? t('notes.emptyFiltered') : t('notes.empty');
      host.innerHTML = '<div class="bb-card p-8 text-center text-body-sm text-muted">' + empty + '</div>';
      return;
    }

    host.innerHTML = groups
      .map(function (group) {
        return (
          '<section class="bb-card overflow-hidden">' +
          '<div class="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-subtle">' +
          '<h2 class="text-label-md font-bold text-ink num">' + esc(dateHeading(group.date)) + '</h2>' +
          '<span class="text-caption text-muted num">' + group.notes.length + '</span></div>' +
          '<div class="divide-y divide-border-subtle">' +
          group.notes.map(noteRow).join('') + '</div></section>'
        );
      })
      .join('');
  }

  function render() {
    BB.ui.setHead(headOptions());
    renderFilters();
    renderForm();
    renderList();
  }

  /* ---------- events ---------- */

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-note-add]')) {
      openForm(null);
      return;
    }
    if (event.target.closest('[data-note-cancel]')) {
      draft = null;
      render();
      return;
    }

    var subjectChip = event.target.closest('[data-filter-subject]');
    if (subjectChip) {
      filterSubject = subjectChip.getAttribute('data-filter-subject');
      render();
      return;
    }

    var kindChip = event.target.closest('[data-filter-kind]');
    if (kindChip) {
      filterKind = kindChip.getAttribute('data-filter-kind');
      render();
      return;
    }

    var toggle = event.target.closest('[data-note-toggle]');
    if (toggle) {
      var toggleId = toggle.getAttribute('data-note-toggle');
      BB.store.update(function (data) {
        (data.notes || []).forEach(function (note) {
          if (note.id === toggleId) note.done = !note.done;
        });
      });
      render();
      return;
    }

    var edit = event.target.closest('[data-note-edit]');
    if (edit) {
      var found = findNote(edit.getAttribute('data-note-edit'));
      if (!found) return;
      draft = {
        id: found.id,
        kind: found.kind,
        text: found.text,
        subjectCode: found.subjectCode || '',
        date: found.date || isoDay(new Date()),
        due: found.due || ''
      };
      render();
      return;
    }

    var remove = event.target.closest('[data-note-delete]');
    if (!remove) return;
    var removeId = remove.getAttribute('data-note-delete');
    var notes = state().notes || [];
    var index = -1;
    notes.forEach(function (note, position) {
      if (note.id === removeId) index = position;
    });
    if (index < 0) return;
    var removed = JSON.parse(JSON.stringify(notes[index]));

    BB.ui
      .confirm({
        title: t('notes.deleteTitle'),
        message: t('notes.deleteBody', { text: removed.text }),
        confirmLabel: t('notes.deleteOk'),
        danger: true
      })
      .then(function (ok) {
        if (!ok) return;
        BB.store.update(function (data) {
          data.notes = (data.notes || []).filter(function (note) {
            return note.id !== removeId;
          });
        });
        render();
        BB.ui.toast(t('notes.toastDeleted'), {
          actionLabel: t('common.undo'),
          onAction: function () {
            BB.store.update(function (data) {
              data.notes = data.notes || [];
              data.notes.splice(Math.min(index, data.notes.length), 0, removed);
            });
            render();
            BB.ui.toast(t('notes.toastRestored'));
          }
        });
      });
  });

  document.addEventListener('submit', function (event) {
    if (event.target.id !== 'note-form') return;
    event.preventDefault();
    saveNote();
  });

  render();

  /* 他タブの保存を取り込んだら描き直す。入力中のフォームは下書きへ退避してから。 */
  BB.store.subscribe(function () {
    collectForm();
    BB.ui.refreshChrome();
    render();
  });
})();
