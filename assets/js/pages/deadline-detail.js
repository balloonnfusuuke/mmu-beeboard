(function () {
  'use strict';

  var BB = window.BB;
  var t = BB.i18n.t;
  var key = new URLSearchParams(window.location.search).get('id') || '';

  /* 編集中の下書き。保存するまでストアには書かない。 */
  var draft = null;
  var editing = false;

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function item() {
    var found = null;
    BB.dash.deadlineItems().forEach(function (candidate) {
      if (candidate.key === key) found = candidate;
    });
    return found;
  }

  function ensureDraft() {
    if (draft) return draft;
    var detail = BB.dash.deadlineDetail(key);
    draft = {
      links: detail.links.map(function (link) {
        return { label: link.label || '', url: link.url || '' };
      }),
      memo: detail.memo
    };
    return draft;
  }

  /* 入力中の値を下書きへ戻す。追加・削除の再描画で消えないように。 */
  function collect() {
    if (!draft) return;
    var rows = document.querySelectorAll('[data-link-row]');
    for (var i = 0; i < rows.length; i++) {
      var label = rows[i].querySelector('[data-link-label]');
      var url = rows[i].querySelector('[data-link-url]');
      if (!draft.links[i]) draft.links[i] = { label: '', url: '' };
      draft.links[i].label = label ? label.value : '';
      draft.links[i].url = url ? url.value : '';
    }
    var memoField = document.getElementById('dd-memo');
    if (memoField) draft.memo = memoField.value;
  }

  function headFor(found) {
    return {
      title: found ? esc(found.assessment.name) : t('dd.title'),
      subtitle: found ? t('dd.subtitle') : '',
      actions: '<a href="deadlines.html" class="bb-btn bb-btn-ghost">' +
        '<span class="material-symbols-outlined text-[18px]">arrow_back</span>' + t('dd.back') + '</a>'
    };
  }

  BB.ui.mount({ title: t('dd.title'), head: { title: t('dd.title'), subtitle: t('dd.subtitle') } });

  function notFoundHtml() {
    return (
      '<div class="bb-card p-8 text-center">' +
      '<span class="material-symbols-outlined text-[28px] text-placeholder">search_off</span>' +
      '<p class="text-body-md font-semibold text-ink mt-2">' + t('dd.notFound') + '</p>' +
      '<p class="text-body-sm text-muted mt-1">' + t('dd.notFoundHint') + '</p></div>'
    );
  }

  function metaRow(label, value) {
    return (
      '<div><div class="text-caption uppercase tracking-wider text-muted">' + label + '</div>' +
      '<div class="text-body-md font-semibold text-ink">' + value + '</div></div>'
    );
  }

  function summaryHtml(found) {
    var assessment = found.assessment;
    var range = BB.date.weekLabel(found.week);
    var due = assessment.dueLabel || (range ? t('dl.dueInWeek', { range: range }) : t('dl.datesNotSet'));
    var weight = assessment.weight > 0 ? assessment.weight + '%' : '—';
    var kind = assessment.homework
      ? t('dl.homework')
      : assessment.custom
        ? t('dl.kind.' + (assessment.customKind || 'other'))
        : t('common.week', { n: found.week });

    return (
      '<div class="bb-card p-5">' +
      '<div class="flex flex-wrap items-center gap-2">' + BB.ui.solidChip(found.subject.color, found.subject.id) +
      (found.subject.name ? '<span class="text-body-sm text-muted">' + esc(found.subject.name) + '</span>' : '') +
      '</div>' +
      '<div class="flex flex-wrap gap-x-8 gap-y-3 mt-3 pt-3 border-t border-border-subtle">' +
      metaRow(t('dd.week'), t('common.week', { n: found.week })) +
      metaRow(t('dd.due'), esc(due)) +
      metaRow(t('dd.weight'), weight) +
      metaRow(t('dd.kind'), esc(kind)) +
      '</div></div>'
    );
  }

  function linkRowHtml(link, index) {
    return (
      '<div class="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-2 items-end" data-link-row="' + index + '">' +
      '<div><label class="bb-label">' + t('dd.linkLabel') + '</label>' +
      '<input class="bb-input" type="text" data-link-label value="' + esc(link.label) +
      '" placeholder="' + esc(t('dd.linkLabelPlaceholder')) + '"></div>' +
      '<div><label class="bb-label">' + t('dd.linkUrl') + '</label>' +
      '<input class="bb-input" type="url" data-link-url value="' + esc(link.url) +
      '" placeholder="' + esc(t('dd.linkUrlPlaceholder')) + '"></div>' +
      '<button type="button" class="bb-btn bb-btn-ghost" data-link-remove="' + index + '" title="' +
      esc(t('dd.removeLink')) + '" aria-label="' + esc(t('dd.removeLink')) + '">' +
      '<span class="material-symbols-outlined text-[18px]">delete</span>' +
      '<span class="hidden sm:inline">' + t('dd.removeLink') + '</span></button></div>'
    );
  }

  function linksHtml() {
    var current = ensureDraft();
    var rows = current.links.length
      ? current.links.map(linkRowHtml).join('')
      : '<p class="text-body-sm text-muted">' + t('dd.noLinks') + '</p>';
    return (
      '<div class="bb-card p-5">' +
      '<div class="flex items-center justify-between gap-3 pb-3 border-b border-border-subtle">' +
      '<div><h3 class="text-title-md font-bold text-ink">' + t('dd.links') + '</h3>' +
      '<p class="text-caption text-muted">' + t('dd.linksHint') + '</p></div>' +
      '<button type="button" class="bb-btn bb-btn-ghost shrink-0" data-link-add>' +
      '<span class="material-symbols-outlined text-[18px]">add_link</span>' + t('dd.addLink') + '</button></div>' +
      '<div class="space-y-3 pt-3">' + rows + '</div></div>'
    );
  }

  function memoHtml() {
    var current = ensureDraft();
    return (
      '<div class="bb-card p-5">' +
      '<h3 class="text-title-md font-bold text-ink">' + t('dd.memo') + '</h3>' +
      '<textarea id="dd-memo" class="bb-input mt-3" rows="3" placeholder="' +
      esc(t('dd.memoPlaceholder')) + '">' + esc(current.memo) + '</textarea></div>'
    );
  }

  /* 自分で追加した締切（カスタム・宿題）だけ、ここで中身を編集できる。 */
  function editHtml(found) {
    var assessment = found.assessment;
    if (!assessment.custom && !assessment.homework) return '';

    if (!editing) {
      return (
        '<div class="bb-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
        '<div><h3 class="text-title-md font-bold text-ink">' + t('dd.editTitle') + '</h3>' +
        '<p class="text-caption text-muted">' + t('dd.editHint') + '</p></div>' +
        '<button type="button" class="bb-btn bb-btn-ghost shrink-0" data-edit-open>' +
        '<span class="material-symbols-outlined text-[18px]">edit</span>' + t('dd.editTitle') + '</button></div>'
      );
    }

    var state = BB.store.get();
    var subjectOptions = state.subjects
      .map(function (subject) {
        var selected = subject.id === found.subject.id ? ' selected' : '';
        return '<option value="' + subject.id + '"' + selected + '>' + subject.id + ' ' + esc(subject.name) + '</option>';
      })
      .join('');

    if (assessment.homework) {
      var note = found.note || {};
      return (
        '<form class="bb-card p-5 space-y-3" data-edit-form>' +
        '<h3 class="text-title-md font-bold text-ink">' + t('dd.editTitle') + '</h3>' +
        '<div><label class="bb-label" for="ed-name">' + t('dd.name') + '</label>' +
        '<input id="ed-name" name="name" class="bb-input" type="text" value="' + esc(note.text) + '" required></div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        '<div><label class="bb-label" for="ed-subject">' + t('dd.subject') + '</label>' +
        '<select id="ed-subject" name="subject" class="bb-input"><option value="">—</option>' +
        subjectOptions + '</select></div>' +
        '<div><label class="bb-label" for="ed-date">' + t('dd.date') + '</label>' +
        '<input id="ed-date" name="date" class="bb-input num" type="datetime-local" value="' +
        esc(note.due || '') + '"></div></div>' +
        '<div class="flex justify-end gap-2">' +
        '<button type="button" class="bb-btn bb-btn-ghost" data-edit-cancel>' + t('common.cancel') + '</button>' +
        '<button type="submit" class="bb-btn bb-btn-primary">' + t('dd.saveEdit') + '</button></div></form>'
      );
    }

    var entry = found.custom || {};
    var kinds = ['homework', 'assignment', 'testPrep', 'other']
      .map(function (kind) {
        var selected = (entry.kind || 'other') === kind ? ' selected' : '';
        return '<option value="' + kind + '"' + selected + '>' + t('dl.kind.' + kind) + '</option>';
      })
      .join('');

    return (
      '<form class="bb-card p-5 space-y-3" data-edit-form>' +
      '<h3 class="text-title-md font-bold text-ink">' + t('dd.editTitle') + '</h3>' +
      '<div><label class="bb-label" for="ed-name">' + t('dd.name') + '</label>' +
      '<input id="ed-name" name="name" class="bb-input" type="text" value="' + esc(entry.name) + '" required></div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
      '<div><label class="bb-label" for="ed-subject">' + t('dd.subject') + '</label>' +
      '<select id="ed-subject" name="subject" class="bb-input">' + subjectOptions + '</select></div>' +
      '<div><label class="bb-label" for="ed-kind">' + t('dd.kind') + '</label>' +
      '<select id="ed-kind" name="kind" class="bb-input">' + kinds + '</select></div>' +
      '<div><label class="bb-label" for="ed-date">' + t('dd.date') + '</label>' +
      '<input id="ed-date" name="date" class="bb-input num" type="datetime-local" value="' +
      esc(entry.date || '') + '"></div>' +
      '<div><label class="bb-label" for="ed-weight">' + t('dd.weight') + '</label>' +
      '<input id="ed-weight" name="weight" class="bb-input num" type="number" min="0" max="100" step="1" value="' +
      (entry.weight || 0) + '"></div></div>' +
      '<div class="flex justify-end gap-2">' +
      '<button type="button" class="bb-btn bb-btn-ghost" data-edit-cancel>' + t('common.cancel') + '</button>' +
      '<button type="submit" class="bb-btn bb-btn-primary">' + t('dd.saveEdit') + '</button></div></form>'
    );
  }

  function render() {
    var host = document.getElementById('detail');
    var found = item();
    BB.ui.setHead(headFor(found));
    if (!found) {
      host.innerHTML = notFoundHtml();
      return;
    }
    host.innerHTML =
      summaryHtml(found) +
      linksHtml() +
      memoHtml() +
      '<div class="flex justify-end"><button type="button" class="bb-btn bb-btn-primary" data-save>' +
      '<span class="material-symbols-outlined text-[18px]">save</span>' + t('dd.save') + '</button></div>' +
      editHtml(found);
  }

  document.getElementById('detail').addEventListener('click', function (event) {
    if (event.target.closest('[data-link-add]')) {
      collect();
      ensureDraft().links.push({ label: '', url: '' });
      render();
      return;
    }
    var remove = event.target.closest('[data-link-remove]');
    if (remove) {
      collect();
      ensureDraft().links.splice(Number(remove.getAttribute('data-link-remove')), 1);
      render();
      return;
    }
    if (event.target.closest('[data-save]')) {
      collect();
      BB.dash.setDeadlineDetail(key, ensureDraft());
      draft = null;
      render();
      BB.ui.toast(t('dd.saved'));
      return;
    }
    if (event.target.closest('[data-edit-open]')) {
      editing = true;
      render();
      return;
    }
    if (event.target.closest('[data-edit-cancel]')) {
      editing = false;
      render();
    }
  });

  document.getElementById('detail').addEventListener('input', function (event) {
    if (event.target.id === 'dd-memo') {
      ensureDraft().memo = event.target.value;
    }
  });

  document.getElementById('detail').addEventListener('submit', function (event) {
    var form = event.target.closest('[data-edit-form]');
    if (!form) return;
    event.preventDefault();
    var found = item();
    if (!found) return;
    var name = form.elements.name.value.trim();
    if (!name) {
      BB.ui.toast(t('dd.nameRequired'));
      return;
    }
    var dateValue = form.elements.date.value.trim();
    if (dateValue && !BB.date.parse(dateValue.slice(0, 10))) {
      BB.ui.toast(t('dd.dateInvalid'));
      return;
    }

    if (found.assessment.homework) {
      var noteId = found.note ? found.note.id : '';
      BB.store.update(function (state) {
        (state.notes || []).forEach(function (note) {
          if (note.id !== noteId) return;
          note.text = name;
          note.subjectCode = form.elements.subject.value || null;
          note.due = dateValue;
        });
      });
    } else {
      var customId = found.custom ? found.custom.id : '';
      var subjectId = form.elements.subject.value;
      var weight = Number(form.elements.weight.value) || 0;
      var kind = form.elements.kind.value;
      BB.store.update(function (state) {
        (state.customDeadlines || []).forEach(function (entry) {
          if (entry.id !== customId) return;
          entry.name = name;
          entry.subjectId = subjectId;
          entry.date = dateValue;
          entry.weight = weight;
          entry.kind = kind;
          /* 日付があれば週は日付から決め直す。 */
          var when = dateValue ? BB.date.parse(dateValue.slice(0, 10)) : null;
          if (when) entry.week = BB.dash.weekOf(when);
        });
      });
    }

    editing = false;
    render();
    BB.ui.toast(t('dd.editSaved'));
  });

  render();

  /* 他タブの保存を取り込んだら描き直す。 */
  BB.store.subscribe(function () {
    draft = null;
    /* 他タブの保存では、ヘッダーもページ本体も再読込なしで追いつく。 */
    BB.ui.refreshChrome();
    render();
  });
})();
