(function () {
  'use strict';

  var BB = window.BB;
  var t = BB.i18n.t;

  BB.ui.mount({
    title: t('rm.title'),
    head: {
      title: t('rm.title'),
      subtitle: t('rm.subtitle')
    }
  });

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 点数は 1 桁まで。入力済みかどうかは marks に数値があるかで決める。 */
  function markOf(subject, assessment) {
    var marks = subject.marks || {};
    var value = marks[assessment.id];
    return typeof value === 'number' && isFinite(value) ? value : null;
  }

  function numberText(value) {
    var n = Number(value);
    if (!isFinite(n)) return '—';
    return String(Math.round(n * 10) / 10);
  }

  /* 確保点 = 取得点 / 満点 × 配点。満点が 0 以下なら 0。 */
  function securedOf(item) {
    var max = Number(item.assessment.max);
    var weight = Number(item.assessment.weight) || 0;
    if (item.mark === null || !isFinite(max) || max <= 0) return 0;
    return (item.mark / max) * weight;
  }

  /* 全科目の評価項目を 1 本に均し、週 → 科目の登録順 → 項目の登録順で並べる。
     期末試験（kind: 'exam' / 'final'）も他の項目と同じ扱いで含める。 */
  function items() {
    var state = BB.store.get();
    var list = [];
    state.subjects.forEach(function (subject, subjectIndex) {
      (subject.assessments || []).forEach(function (assessment, index) {
        list.push({
          subject: subject,
          assessment: assessment,
          subjectIndex: subjectIndex,
          index: index,
          week: Number(assessment.week) || 1,
          mark: markOf(subject, assessment)
        });
      });
    });
    list.sort(function (a, b) {
      if (a.week !== b.week) return a.week - b.week;
      if (a.subjectIndex !== b.subjectIndex) return a.subjectIndex - b.subjectIndex;
      return a.index - b.index;
    });
    return list;
  }

  /* 配点ベースの進捗。採点済みの項目の配点が、全配点の何 % か。 */
  function progressOf(list) {
    var total = 0;
    var graded = 0;
    list.forEach(function (item) {
      var weight = Number(item.assessment.weight) || 0;
      total += weight;
      if (item.mark !== null) graded += weight;
    });
    return {
      total: total,
      graded: graded,
      percent: total > 0 ? (graded / total) * 100 : 0
    };
  }

  function renderProgress(list) {
    var host = document.getElementById('progress');
    var progress = progressOf(list);
    var percent = Math.round(progress.percent);
    var width = Math.max(0, Math.min(100, progress.percent));

    host.innerHTML =
      '<div class="bb-card p-5">' +
        '<div class="flex items-start justify-between gap-3">' +
          '<div class="min-w-0">' +
            '<h2 class="text-title-md font-bold text-ink">' + esc(t('rm.progress')) + '</h2>' +
            '<p class="text-caption text-muted mt-1">' +
              esc(t('rm.progressNote', {
                graded: numberText(progress.graded),
                total: numberText(progress.total)
              })) +
            '</p>' +
          '</div>' +
          '<div class="text-headline-sm font-extrabold text-ink num shrink-0" data-rm-percent>' +
            percent + '%</div>' +
        '</div>' +
        '<div class="mt-3 w-full bg-border h-2 rounded-full overflow-hidden">' +
          '<div class="h-full rounded-full bg-primary" style="width:' + width + '%"></div>' +
        '</div>' +
      '</div>';
  }

  function statusHtml(item) {
    if (item.mark === null) {
      return '<span class="px-2 py-0.5 rounded text-caption font-semibold bg-surface-subtle text-muted border border-border">' +
        esc(t('rm.notYet')) + '</span>';
    }
    return '<span class="px-2 py-0.5 rounded text-caption font-semibold bb-status-ok num" data-rm-mark>' +
      esc(t('rm.secured', {
        score: numberText(item.mark),
        max: numberText(item.assessment.max),
        points: securedOf(item).toFixed(1)
      })) + '</span>';
  }

  function row(item) {
    var assessment = item.assessment;
    var weight = Number(assessment.weight) || 0;
    var range = BB.date.weekLabel(item.week);
    var weekText = t('common.week', { n: item.week }) + (range ? ' · ' + range : '');

    return (
      '<div class="bb-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4"' +
        ' data-rm-item data-rm-week="' + item.week + '" data-rm-subject="' + esc(item.subject.id) + '">' +
        '<div class="flex items-center gap-2 min-w-0">' +
          '<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:' + esc(item.subject.color) + '"></span>' +
          '<span class="text-caption font-bold text-ink shrink-0">' + esc(item.subject.id) + '</span>' +
          '<span class="text-body-sm text-ink truncate" title="' + esc(assessment.name) + '">' +
            esc(assessment.name) + '</span>' +
        '</div>' +
        '<div class="flex flex-wrap items-center gap-3 text-caption text-muted shrink-0">' +
          '<span class="num font-semibold text-ink" title="' + esc(t('rm.weight', { n: weight })) + '">' +
            weight + '%</span>' +
          '<span class="num" data-rm-range>' + esc(weekText) + '</span>' +
          statusHtml(item) +
        '</div>' +
      '</div>'
    );
  }

  function render() {
    var list = items();
    renderProgress(list);

    var host = document.getElementById('roadmap');
    if (!list.length) {
      host.innerHTML =
        '<div class="bb-card p-8 text-center">' +
          '<span class="material-symbols-outlined text-[28px] text-placeholder">grading</span>' +
          '<p class="text-body-sm text-muted mt-2">' + esc(t('rm.empty')) + '</p>' +
          '<p class="text-caption text-muted mt-1">' + esc(t('rm.emptyHint')) + '</p>' +
        '</div>';
      return;
    }
    host.innerHTML = list.map(row).join('');
  }

  render();

  /* 他タブの保存を取り込んだら描き直す。 */
  BB.store.subscribe(function () {
    BB.ui.refreshChrome();
    render();
  });
})();
