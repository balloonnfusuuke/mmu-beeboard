(function () {
  'use strict';

  var BB = window.BB;
  var t = BB.i18n.t;
  var filter = 'all';
  var formOpen = false;

  BB.ui.mount({
    title: t('dl.title'),
    head: {
      title: t('dl.title'),
      subtitle: t('dl.subtitle')
    }
  });

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* High Stakes の基準。監査で「判定基準が不明」と指摘されたため 1 か所に固定する。 */
  var HIGH_STAKES_WEIGHT = 50;

  /* 締切の種別。辞書キーは dl.kind.<id>。 */
  var KINDS = ['homework', 'assignment', 'testPrep', 'other'];

  /* 'YYYY-MM-DD' → 'Mon 30 Nov'。週の日付が引けないときの見出し用。 */
  function shortDay(iso) {
    var day = BB.date.parse(String(iso || '').slice(0, 10));
    if (!day) return '';
    var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    var months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    return t('date.short', {
      day: t('day.' + days[day.getDay()]),
      d: day.getDate(),
      mon: t('month.' + months[day.getMonth()])
    });
  }

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

    /* 科目0件では紐づけ先がない。追加フォームの代わりにセットアップへ誘導する。 */
    if (!state.subjects.length) {
      host.innerHTML =
        '<div class="bb-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
        '<div class="flex items-center gap-3">' +
        '<span class="material-symbols-outlined text-[20px] text-primary">add_task</span>' +
        '<span class="text-body-sm text-muted">' + t('dl.addFirst') + '</span></div>' +
        '<a href="subject-edit.html?new=1" class="bb-btn bb-btn-ghost shrink-0">' + t('dl.addSubject') + '</a></div>';
      return;
    }

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
      '<span class="text-title-md font-semibold text-ink">' + t('dl.addDeadline') + '</span>' +
      '<span class="text-caption text-muted">' + t('dl.addDeadlineHint') + '</span></span>' +
      '<span class="material-symbols-outlined text-muted transition-transform" style="transform:rotate(' +
      (formOpen ? '90deg' : '0deg') + ')">chevron_right</span>' +
      '</button>' +
      '<div class="px-5 pb-5 border-t border-border' + (formOpen ? '' : ' hidden') + '">' +
      '<form id="deadline-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">' +
      '<div class="sm:col-span-2"><label class="bb-label" for="d-name">' + t('dl.titleField') + '</label>' +
      '<input id="d-name" name="name" class="bb-input" type="text" placeholder="' +
      esc(t('dl.titlePlaceholder')) + '" required></div>' +
      '<div><label class="bb-label" for="d-subject">' + t('dl.module') + '</label>' +
      '<select id="d-subject" name="subjectId" class="bb-input">' + options + '</select></div>' +
      '<div><label class="bb-label" for="d-kind">' + t('dl.kindField') + '</label>' +
      '<select id="d-kind" name="kind" class="bb-input">' +
      KINDS.map(function (kind) {
        return '<option value="' + kind + '">' + t('dl.kind.' + kind) + '</option>';
      }).join('') +
      '</select></div>' +
      '<div><label class="bb-label" for="d-date">' + t('dl.dateField') + '</label>' +
      '<input id="d-date" name="date" class="bb-input num" type="datetime-local">' +
      '<p class="text-caption text-muted mt-1">' + t('dl.dateHint') + '</p>' +
      '<p class="text-caption text-muted num mt-0.5">' + t('dl.dateExample') + '</p></div>' +
      '<div><label class="bb-label" for="d-week">' + t('dl.week') + '</label>' +
      '<input id="d-week" name="week" class="bb-input num" type="number" min="1" max="' +
      state.term.examWeek + '" step="1" value="' + BB.dash.currentWeek(new Date()) + '"></div>' +
      '<div><label class="bb-label" for="d-weight">' + t('dl.weight') + '</label>' +
      '<input id="d-weight" name="weight" class="bb-input num" type="number" min="0" max="100" step="1" value="0"></div>' +
      '<div class="sm:col-span-2"><label class="bb-label" for="d-memo">' + t('dl.memoField') + '</label>' +
      '<textarea id="d-memo" name="memo" class="bb-input" rows="2" placeholder="' +
      esc(t('dl.memoPlaceholder')) + '"></textarea>' +
      '<p class="text-caption text-muted mt-1">' + t('dl.memoHint') + '</p></div>' +
      '<div class="sm:col-span-2 flex justify-end">' +
      '<button type="submit" class="bb-btn bb-btn-primary">' +
      '<span class="material-symbols-outlined text-[18px]">check</span>' + t('dl.submit') + '</button></div>' +
      '</form></div></div>';
  }

  function renderFilters() {
    var state = BB.store.get();
    var host = document.getElementById('filters');
    var chips = [{ id: 'all', label: t('dl.allModules'), color: 'var(--bb-primary)' }].concat(
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
      .join('') +
      '<span class="w-full text-caption text-muted">' +
      t('dl.highStakesHint', { n: HIGH_STAKES_WEIGHT }) + '</span>';
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
        t('dl.noUpcoming') + '</div>';
      return;
    }

    /* 日数は日付の差で数える（ダッシュボードと同じ定義）。締切日が分かる項目は
       その日まで、週しか分からない項目はその週の月曜までを数える。 */
    var dueDate = next.sortDue ? BB.date.parse(String(next.sortDue).slice(0, 10)) : null;
    var range = dueDate ? null : BB.date.weekRange(next.week);
    var days = dueDate
      ? BB.dash.calendarDays(now, dueDate)
      : range
        ? BB.dash.calendarDays(now, range.start)
        : null;
    var when = days === null
      ? t('common.week', { n: next.week })
      : days <= 0 ? t('dl.thisWeek') : days === 1 ? t('dl.tomorrow') : t('dl.inDays', { n: days });

    host.innerHTML =
      '<div class="bb-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
      '<div class="flex items-center gap-3">' +
      '<span class="material-symbols-outlined text-[22px] text-primary">alarm</span>' +
      '<div><div class="text-caption uppercase tracking-wider text-muted">' + t('dl.milestone') + '</div>' +
      /* break-words で長い名前を裂くと「<」などが行末に孤立することがあるので、
         語の区切り（空白）だけで折り返す。 */
      '<div class="text-body-md font-semibold text-ink">' +
      (BB.date.weekLabel(next.week)
        ? t('dl.nextDeadline', {
            code: esc(next.subject.id),
            name: esc(next.assessment.name),
            n: next.week,
            range: BB.date.weekLabel(next.week)
          })
        : t('dl.nextDeadlineNoRange', {
            code: esc(next.subject.id),
            name: esc(next.assessment.name),
            n: next.week
          })) + '</div></div></div>' +
      '<span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-primary)">' + when + '</span></div>';
  }

  function renderTimeline() {
    var host = document.getElementById('timeline');
    var list = items();

    if (!list.length) {
      host.innerHTML =
        '<div class="bb-card p-8 text-center text-body-sm text-muted">' + t('dl.noAssessments') + '</div>';
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
        /* 配点は科目ごとに 100% が上限。週でまとめて足すと別科目の締切が
           同じ週に重なっただけで 110% の誤警告になる。 */
        var bySubject = {};
        entries.forEach(function (item) {
          var key = item.subject.id;
          if (!bySubject[key]) bySubject[key] = { subject: item.subject, total: 0 };
          bySubject[key].total += item.assessment.weight;
        });
        var groups = Object.keys(bySubject).map(function (key) {
          return bySubject[key];
        });
        var isExam = week >= BB.store.get().term.examWeek;
        var range = BB.date.weekLabel(week);
        if (!range) {
          var known = entries
            .map(function (item) {
              return item.sortDue ? String(item.sortDue).slice(0, 10) : '';
            })
            .filter(Boolean)
            .sort();
          if (known.length) {
            var first = shortDay(known[0]);
            var last = shortDay(known[known.length - 1]);
            range = first === last ? first : first + ' – ' + last;
          }
        }

        var rows = entries
          .map(function (item) {
            var assessment = item.assessment;
            /* 具体的な日付・時刻が無い項目は、その週の実日付範囲を必ず併記する。 */
            var meta = assessment.dueLabel || assessment.location ||
              (range ? t('dl.dueInWeek', { range: range }) : '');
            var weight = assessment.weight > 0
              ? '<span class="text-label-md font-bold text-ink num">' + assessment.weight + '%</span>'
              : '<span class="text-caption text-muted">' + t('dl.noWeight') + '</span>';
            var detailHref = 'deadline-detail.html?id=' + encodeURIComponent(item.key || '');
            var detail = item.key ? BB.dash.deadlineDetail(item.key) : { links: [], memo: '' };
            /* リンクとメモは別の印にする。「何が付いているか」が一目で分かるように。 */
            var marks =
              (detail.links.length
                ? '<span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-primary)" title="' +
                  esc(t('dd.chipLinksTitle', { n: detail.links.length })) + '">' +
                  '<span class="material-symbols-outlined text-[12px] align-middle">link</span>' +
                  detail.links.length + '</span>'
                : '') +
              (detail.memo
                ? '<span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-text-muted)" title="' +
                  esc(t('dd.chipMemoTitle')) + '">' +
                  '<span class="material-symbols-outlined text-[12px] align-middle">edit_note</span>' +
                  esc(t('dd.chipMemo')) + '</span>'
                : '');
            var remove = item.custom
              ? '<button type="button" data-remove="' + item.custom.id + '" class="text-muted hover:text-alert transition-colors" title="' +
                esc(t('dl.removeCustom')) + '">' +
                '<span class="material-symbols-outlined text-[18px]">delete</span></button>'
              : '';
            return (
              '<div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-border-subtle last:border-0">' +
              '<div class="flex items-center gap-3 min-w-0">' + BB.ui.solidChip(item.subject.color, item.subject.id) +
              '<div class="min-w-0"><div class="text-body-md font-semibold text-ink truncate" title="' +
              esc(assessment.name) + '">' +
              '<a href="' + detailHref + '" class="hover:text-primary transition-colors">' + esc(assessment.name) + '</a>' +
              (marks ? ' ' + marks : '') +
              (item.custom ? ' <span class="text-caption font-semibold text-muted">' + t('dl.custom') + '</span>' : '') +
              (item.custom && item.custom.source === 'ebwise'
                ? ' <span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-primary)">' +
                  t('dl.ebwise') + '</span>'
                : '') +
              (item.custom && assessment.customKind
                ? ' <span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-text-muted)">' +
                  t('dl.kind.' + assessment.customKind) + '</span>'
                : '') +
              (assessment.homework
                ? ' <span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-primary)">' +
                  t('dl.homework') + '</span>'
                : '') + '</div>' +
              (meta ? '<div class="text-caption text-muted truncate" title="' + esc(meta) + '">' + esc(meta) + '</div>' : '') + '</div></div>' +
              '<div class="flex items-center gap-3 shrink-0">' +
              weight + remove +
              '<a href="simulator.html?subject=' + item.subject.id + '" class="text-muted hover:text-primary transition-colors" title="' +
              esc(t('dl.openSim')) + '">' +
              '<span class="material-symbols-outlined text-[18px]">chevron_right</span></a></div></div>'
            );
          })
          .join('');

        var overWeighted = groups
          .filter(function (group) {
            return group.total > 100;
          })
          .map(function (group) {
            return '<div class="px-5 py-2.5 border-b border-border bg-alert-surface text-caption font-semibold text-alert">' +
              t('dl.overWeighted', { id: group.subject.id, total: group.total }) + '</div>';
          })
          .join('');

        var highStakes = groups.filter(function (group) {
          return group.total >= HIGH_STAKES_WEIGHT;
        });

        return (
          '<div class="bb-card overflow-hidden">' +
          '<div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-canvas border-b border-border">' +
          '<div class="flex items-center gap-2">' +
          '<span class="text-label-sm font-bold text-primary uppercase tracking-wider">' +
          (isExam ? t('dl.examWeek', { n: week }) : t('common.week', { n: week })) + '</span>' +
          '<span class="text-caption text-muted">' + (range || t('dl.datesNotSet')) + '</span>' +
          highStakes
            .map(function (group) {
              return '<span class="bb-chip" style="background:var(--bb-alert-surface);color:var(--bb-alert)" title="' +
                esc(t('dl.highStakesTitle', { n: HIGH_STAKES_WEIGHT, id: group.subject.id })) + '">' +
                t('dl.highStakes', { id: group.subject.id }) + '</span>';
            })
            .join('') +
          '</div>' +
          '<span class="text-caption text-muted">' + t('dl.totalWeight') + ' <strong class="text-ink num">' +
          groups
            .map(function (group) {
              return group.subject.id + ' ' + group.total + '%';
            })
            .join(' · ') +
          '</strong></span>' +
          '</div>' + overWeighted + rows + '</div>'
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
    var dateValue = form.elements.date.value.trim();
    var week = Number(form.elements.week.value);
    if (!name) {
      BB.ui.toast(t('dl.toast.titleRequired'));
      return;
    }
    /* 日付があれば週は日付から決める。無ければ従来どおり週の直接指定。 */
    if (dateValue) {
      var when = BB.date.parse(dateValue.slice(0, 10));
      if (!when) {
        BB.ui.toast(t('dl.toast.dateInvalid'));
        return;
      }
      week = BB.dash.weekOf(when);
    } else if (!isFinite(week) || week < 1) {
      BB.ui.toast(t('dl.toast.week'));
      return;
    }
    var newId = 'cd-' + Date.now();
    var memo = form.elements.memo ? form.elements.memo.value.trim() : '';
    BB.store.update(function (data) {
      data.customDeadlines = data.customDeadlines || [];
      data.customDeadlines.push({
        id: newId,
        subjectId: form.elements.subjectId.value,
        name: name,
        week: week,
        date: dateValue,
        kind: form.elements.kind.value,
        weight: Number(form.elements.weight.value) || 0,
        note: '',
        createdAt: new Date().toISOString()
      });
    });
    /* フォームで書いたメモは詳細画面のメモとして引き継ぐ。 */
    if (memo) BB.dash.setDeadlineDetail('c:' + newId, { links: [], memo: memo });
    formOpen = false;
    BB.ui.toast(t('dl.toast.added'));
    render();
  });

  /* 日付を入れたら週欄を自動で埋める。週は残したまま手で上書きもできる。 */
  document.getElementById('add-deadline').addEventListener('input', function (event) {
    if (event.target.id !== 'd-date') return;
    var raw = event.target.value.trim();
    var weekInput = document.getElementById('d-week');
    if (!raw || !weekInput) return;
    var when = BB.date.parse(raw.slice(0, 10));
    if (!when) return;
    weekInput.value = BB.dash.weekOf(when);
  });

  document.getElementById('timeline').addEventListener('click', function (event) {
    var button = event.target.closest('[data-remove]');
    if (!button) return;
    var id = button.getAttribute('data-remove');
    var entries = BB.store.get().customDeadlines || [];
    var index = -1;
    entries.forEach(function (entry, position) {
      if (entry.id === id) index = position;
    });
    if (index < 0) return;
    var removed = JSON.parse(JSON.stringify(entries[index]));

    BB.ui
      .confirm({
        title: t('dl.confirm.title'),
        message: t('dl.confirm.body', { name: removed.name }),
        confirmLabel: t('dl.confirm.ok'),
        danger: true
      })
      .then(function (ok) {
        if (!ok) return;
        BB.store.update(function (data) {
          data.customDeadlines = (data.customDeadlines || []).filter(function (entry) {
            return entry.id !== id;
          });
        });
        render();
        BB.ui.toast(t('dl.toast.removed'), {
          actionLabel: t('common.undo'),
          onAction: function () {
            BB.store.update(function (data) {
              data.customDeadlines = data.customDeadlines || [];
              data.customDeadlines.splice(Math.min(index, data.customDeadlines.length), 0, removed);
            });
            render();
            BB.ui.toast(t('dl.toast.restored'));
          }
        });
      });
  });

  document.getElementById('filters').addEventListener('click', function (event) {
    var button = event.target.closest('[data-filter]');
    if (!button) return;
    filter = button.getAttribute('data-filter');
    render();
  });

  render();

  /* 他タブの保存を取り込んだら描き直す。 */
  BB.store.subscribe(function () {
    /* 他タブの保存では、ヘッダーもページ本体も再読込なしで追いつく。 */
    BB.ui.refreshChrome();
    render();
  });
})();
