(function () {
  'use strict';

  var BB = window.BB;
  var t = BB.i18n.t;
  var tn = BB.i18n.tn;
  var TARGETS = [
    { label: 'A+ (85%)', value: 85 },
    { label: 'A (80%)', value: 80 },
    { label: 'A- (75%)', value: 75 }
  ];
  var target = 80;

  function state() {
    return BB.store.get();
  }

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function requestedSubject() {
    var code = new URLSearchParams(window.location.search).get('subject');
    var found = null;
    state().subjects.forEach(function (subject) {
      if (subject.id === code) found = subject;
    });
    return found || state().subjects[0];
  }

  var active = requestedSubject();

  /* 保存済みの最新から科目を ID で引き直す。開いた時点のオブジェクトは
     他タブの保存で古くなるので、再描画のたびに付け替える。 */
  function subjectById(id) {
    var found = null;
    state().subjects.forEach(function (subject) {
      if (subject.id === id) found = subject;
    });
    return found;
  }

  BB.ui.mount({
    title: t('sim.title'),
    head: {
      title: t('sim.title'),
      subtitle: t('sim.subtitle'),
      actions:
        (active
          ? '<select id="subject-switch" class="bb-input" style="height:40px;width:auto">' +
            state()
              .subjects.map(function (subject) {
                return '<option value="' + subject.id + '"' + (subject.id === active.id ? ' selected' : '') + '>' +
                  subject.id + ' ' + subject.name + '</option>';
              })
              .join('') +
            '</select>'
          : '') +
        '<a href="roadmap.html" class="bb-btn bb-btn-ghost" aria-label="' + esc(t('rm.title')) +
        '" title="' + esc(t('rm.title')) + '">' +
        '<span class="material-symbols-outlined text-[18px]">grading</span>' +
        '<span class="hidden sm:inline">' + esc(t('rm.link')) + '</span></a>'
    }
  });

  /* 科目0件では比較対象がない。空状態を出してセットアップへ誘導する。 */
  if (!active) {
    document.getElementById('metrics').innerHTML = '';
    document.getElementById('subjects').innerHTML =
      '<div class="bb-card p-8 text-center">' +
      '<span class="material-symbols-outlined text-[28px] text-placeholder">calculate</span>' +
      '<p class="text-body-sm text-muted mt-2">' + t('sim.empty') + '</p>' +
      '<a href="subject-edit.html?new=1" class="bb-btn bb-btn-primary mt-3">' +
      '<span class="material-symbols-outlined text-[18px]">add</span>' + t('sim.addSubject') + '</a></div>';
    renderSidebar();
    return;
  }

  function gradeFor(percent) {
    var scale = window.BB_SEED.gradingScale;
    for (var i = 0; i < scale.length; i++) {
      if (percent >= scale[i].min) return scale[i];
    }
    return scale[scale.length - 1];
  }

  function finalOf(subject) {
    var exam = null;
    subject.assessments.forEach(function (assessment) {
      if (assessment.kind === 'exam') exam = assessment;
    });
    return exam;
  }

  /* 保存済みデータに満点超えが残っていても確保点を水増ししない。 */
  function scoreOf(subject, assessment) {
    var score = subject.marks ? subject.marks[assessment.id] : undefined;
    if (typeof score !== 'number' || isNaN(score)) return null;
    var max = Number(assessment.max);
    if (!isFinite(max) || max <= 0) return Math.max(0, score);
    return Math.max(0, Math.min(max, score));
  }

  function compute(subject) {
    var secured = 0;
    var possible = 0;
    var entered = 0;
    var unenteredWeight = 0;
    var unenteredNonFinal = 0;
    var exam = finalOf(subject);
    var examScore = null;

    subject.assessments.forEach(function (assessment) {
      possible += assessment.weight;
      var score = scoreOf(subject, assessment);
      if (score !== null) {
        secured += (score / assessment.max) * assessment.weight;
        entered += 1;
        if (exam && assessment.id === exam.id) examScore = score;
      } else {
        unenteredWeight += assessment.weight;
        if (!exam || assessment.id !== exam.id) unenteredNonFinal += 1;
      }
    });

    var withoutExam = secured;
    if (exam && examScore !== null) withoutExam -= (examScore / exam.max) * exam.weight;

    /* 未入力の項目を満点で取った場合の上限。未入力は 0 点ではなく「まだ取れる点」として扱う。
       ここでも目標に届かないときだけ「到達できません」と言い切れる。 */
    var maxReachable = secured + unenteredWeight;

    var predicted = entered > 0 && entered === subject.assessments.length ? gradeFor(secured) : null;
    var needed = null;
    if (exam) {
      var required = (target - withoutExam) / exam.weight;
      needed = {
        percent: required * 100,
        marks: (required * exam.max),
        max: exam.max,
        reachable: maxReachable >= target - 1e-9,
        secured: required <= 0,
        /* 未入力の非 Final 項目がある間は、必要 Final 点を断定できない。 */
        undetermined: unenteredNonFinal > 0,
        maxReachablePercent: possible > 0 ? (maxReachable / possible) * 100 : 0
      };
    }

    return {
      secured: secured,
      possible: possible,
      entered: entered,
      exam: exam,
      examScore: examScore,
      predicted: predicted,
      needed: needed,
      published: subject.assessments.length > 0
    };
  }

  function renderMetrics() {
    var subjects = state().subjects;
    var graded = subjects
      .map(function (subject) {
        return { subject: subject, result: compute(subject) };
      })
      .filter(function (item) {
        return item.result.predicted !== null;
      });

    var credits = graded.reduce(function (sum, item) {
      return sum + item.subject.credits;
    }, 0);
    var points = graded.reduce(function (sum, item) {
      return sum + item.result.predicted.point * item.subject.credits;
    }, 0);
    var gpa = credits ? points / credits : null;
    var goal = state().settings.cgpaTarget;
    var distance = gpa === null ? null : gpa - goal;
    var totalCredits = subjects.reduce(function (sum, subject) {
      return sum + subject.credits;
    }, 0);
    var provisional = graded.length > 0 && graded.length < subjects.length;

    /* 目盛りは目標値が必ず内側に入るように取る。3.00 固定だと 2.50 の目標が外に出る。 */
    var scaleMin = Math.min(3, goal);
    var scaleMax = 4;
    function position(value) {
      return Math.max(0, Math.min(100, ((value - scaleMin) / (scaleMax - scaleMin)) * 100));
    }
    var gauge = gpa === null ? 0 : position(gpa);
    var cutoff = position(goal);

    document.getElementById('metrics').innerHTML =
      '<div class="bb-card p-6"><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">' +
      '<div class="lg:border-r border-border pb-6 md:pb-0 lg:pr-6">' +
      '<span class="text-caption text-muted block mb-1">' + t('sim.gpa') + '</span>' +
      '<div class="flex items-baseline gap-2">' +
      '<span class="text-display font-bold text-ink num">' + (gpa === null ? '—' : gpa.toFixed(2)) + '</span>' +
      '<span class="text-label-md text-muted">' + (gpa === null ? t('sim.noScores') : t('sim.ofFour')) + '</span></div>' +
      '<span class="inline-flex items-center gap-1 mt-2 text-label-sm text-muted bg-surface-subtle px-2.5 py-1 rounded">' +
      '<span class="material-symbols-outlined text-[16px]">hourglass_empty</span>' +
      (graded.length
        ? tn('sim.graded', graded.length, { total: subjects.length }) +
          (provisional ? t('sim.provisional') : '')
        : t('sim.awaiting')) +
      '</span>' +
      (provisional
        ? '<p class="text-caption text-muted mt-2">' + t('sim.provisionalNote') + '</p>'
        : '') +
      '</div>' +
      '<div class="lg:border-r border-border pb-6 md:pb-0 lg:pr-6">' +
      '<div class="flex items-center justify-between mb-1">' +
      '<span class="text-caption text-muted">' + t('sim.threshold') + '</span>' +
      '<span class="text-label-sm font-semibold text-alert">' + t('sim.scholarship') + '</span></div>' +
      '<div class="flex items-baseline gap-2">' +
      '<span class="text-headline-lg font-bold text-ink num">' + goal.toFixed(2) + '</span>' +
      '<span class="text-caption text-muted">' + t('sim.minRequired') + '</span></div>' +
      '<p class="text-body-sm text-muted mt-2 leading-tight">' + t('sim.maintenance') + '</p></div>' +
      '<div class="lg:border-r border-border pb-6 md:pb-0 lg:pr-6">' +
      '<div class="flex items-center justify-between mb-1">' +
      '<span class="text-caption text-muted">' + t('sim.distance') + '</span>' +
      '<span class="text-label-sm font-semibold ' + (distance === null ? 'text-muted' : distance >= 0 ? 'text-primary' : 'text-alert') + '">' +
      (distance === null ? '—' : (distance >= 0 ? '+' : '') + distance.toFixed(2)) + '</span></div>' +
      '<div class="relative w-full h-3 bg-surface-subtle rounded-full mt-3 overflow-hidden">' +
      '<div class="h-full bg-primary rounded-full" style="width:' + gauge + '%"></div>' +
      '<div class="absolute top-0 bottom-0 w-1 bg-alert z-10" style="left:' + cutoff + '%" title="' +
      t('sim.cutoffTitle', { n: goal.toFixed(2) }) + '"></div></div>' +
      '<div class="flex justify-between items-center text-caption text-muted mt-2">' +
      '<span>' + scaleMin.toFixed(2) + '</span><span class="text-alert font-semibold">' +
      t('sim.cutoff', { n: goal.toFixed(2) }) + '</span><span>' + scaleMax.toFixed(2) + '</span></div></div>' +
      '<div><span class="text-caption text-muted block mb-1">' + t('sim.modulesCounted') + '</span>' +
      '<div class="flex items-baseline gap-2">' +
      '<span class="text-headline-lg font-bold text-ink num">' + graded.length + ' / ' + subjects.length + '</span>' +
      '<span class="text-caption text-muted">' + t('sim.creditsOf', { a: credits, b: totalCredits }) + '</span></div>' +
      '<p class="text-caption text-muted mt-2">' +
      (gpa === null ? t('sim.enterAll') : t('sim.countsWhenComplete')) +
      '</p></div></div></div>';
  }

  function assessmentRow(subject, assessment, result) {
    var score = scoreOf(subject, assessment);
    var hasScore = score !== null;
    var contribution = hasScore ? ((score / assessment.max) * assessment.weight).toFixed(1) : '—';
    var isExam = result.exam && assessment.id === result.exam.id;

    return (
      '<tr class="' + (isExam ? 'bg-surface-sunken/60' : 'hover:bg-canvas') + ' transition-colors">' +
      '<td class="py-3 pr-4"><span class="font-semibold text-ink block">' + esc(assessment.name) + '</span>' +
      '<span class="text-caption text-muted">' + t('sim.week', { n: assessment.week }) + '</span></td>' +
      '<td class="py-3 px-4 text-muted text-label-md num">' + assessment.weight + '%</td>' +
      '<td class="py-3 px-4"><div class="flex items-center gap-2">' +
      '<input class="bb-input num" style="height:36px;width:88px;text-align:center;padding:0 .5rem" type="number"' +
      ' min="0" max="' + assessment.max + '" step="0.5" placeholder="—"' +
      ' value="' + (hasScore ? score : '') + '"' +
      ' aria-label="' + t('sim.scoreAria', { name: assessment.name }) + '"' +
      ' data-subject="' + subject.id + '" data-assessment="' + assessment.id + '">' +
      '<span class="text-caption text-muted num">/</span>' +
      '<input class="bb-input num" style="height:36px;width:64px;text-align:center;padding:0 .375rem" type="number"' +
      ' min="1" step="1" value="' + assessment.max + '" title="' + t('sim.maxTitle') + '"' +
      ' aria-label="' + t('sim.maxAria', { name: assessment.name }) + '"' +
      ' data-max="' + assessment.id + '" data-subject="' + subject.id + '"></div></td>' +
      '<td class="py-3 px-4 font-semibold text-ink num" data-weighted="' + assessment.id + '">' + contribution + '</td>' +
      '<td class="py-3 pl-4 text-right">' +
      '<span class="bb-chip" data-status="' + assessment.id + '" style="background:' + (hasScore ? 'var(--bb-success-surface)' : 'var(--bb-surface-subtle)') +
      ';color:' + (hasScore ? 'var(--bb-success)' : 'var(--bb-text-muted)') + '">' +
      (hasScore ? t('sim.gradedStatus') : t('sim.pendingStatus')) + '</span></td></tr>'
    );
  }

  /* 目標に必要な Final 点の表示。科目編集で Type を Final exam にしないと
     ここが空のままになるので、その導線を文言で示す。 */
  function neededHtml(result) {
    var needed = result.needed;
    if (!result.published) {
      return '<span class="text-muted">' + t('sim.notPublished') + '</span>';
    }
    if (!needed) {
      return '<span class="text-muted">' + t('sim.noFinal') + '</span>';
    }
    if (needed.secured) return '<span class="text-success font-bold">' + t('sim.alreadySecured') + '</span>';
    if (!needed.reachable) return '<span class="text-alert font-bold">' + t('sim.notReachable') + '</span>';
    if (needed.undetermined) {
      return '<span class="text-muted font-semibold">' + t('sim.undetermined') + '</span>' +
        ' <span class="text-caption text-muted num">' +
        t('sim.reachableMax', { n: needed.maxReachablePercent.toFixed(1) }) + '</span>';
    }
    return '<span class="text-primary font-bold num">' + needed.marks.toFixed(1) + ' / ' + needed.max + '</span>';
  }

  function expandedCard(subject) {
    var result = compute(subject);
    var neededText = neededHtml(result);

    var rows = subject.assessments
      .map(function (assessment) {
        return assessmentRow(subject, assessment, result);
      })
      .join('');

    return (
      '<article class="bb-card overflow-hidden">' +
      '<div class="p-6 border-b border-border">' +
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
      '<div><div class="flex items-center gap-2 mb-1.5">' + BB.ui.solidChip(subject.color, subject.id) +
      '<span class="text-caption text-muted">' + t('sim.creditHours', { n: subject.credits }) + '</span>' +
      '<span class="w-1.5 h-1.5 rounded-full bg-border"></span>' +
      '<span class="text-caption text-muted">' + subject.faculty + '</span></div>' +
      '<h3 class="text-headline-sm font-bold text-ink">' + subject.name + '</h3></div>' +
      '<div class="flex items-center gap-4 bg-canvas px-4 py-2.5 rounded-control border border-border">' +
      '<div><span class="text-caption text-muted block">' + t('sim.currentSecured') + '</span>' +
      '<span class="text-label-md font-bold text-ink num" data-secured="' + subject.id + '">' + result.secured.toFixed(1) + ' / ' +
      result.possible + ' (' + (result.possible ? ((result.secured / result.possible) * 100).toFixed(1) : '0.0') + '%)</span></div>' +
      '<div class="h-8 w-px bg-border"></div>' +
      '<div><span class="text-caption text-muted block">' + t('sim.predictedGrade') + '</span>' +
      '<span class="text-label-md font-bold num" data-predicted="' + subject.id + '" style="color:' + (result.predicted ? subject.color : 'var(--bb-text-muted)') + '">' +
      (result.predicted ? result.predicted.grade : '—') + '</span></div></div></div></div>' +
      '<div class="p-6 space-y-5">' +
      '<h4 class="text-title-md font-semibold text-ink">' + t('sim.assessmentsTitle') + '</h4>' +
      (result.published
        ? '<div class="overflow-x-auto bb-scroll"><table class="w-full text-left text-body-md border-collapse">' +
          '<thead><tr class="border-b border-border text-caption text-muted">' +
          '<th class="py-2.5 pr-4 font-semibold">' + t('sim.th.component') + '</th>' +
          '<th class="py-2.5 px-4 font-semibold">' + t('sim.th.weight') + '</th>' +
          '<th class="py-2.5 px-4 font-semibold">' + t('sim.th.score') + '</th>' +
          '<th class="py-2.5 px-4 font-semibold">' + t('sim.th.weighted') + '</th>' +
          '<th class="py-2.5 pl-4 text-right font-semibold">' + t('sim.th.status') + '</th></tr></thead>' +
          '<tbody class="divide-y divide-border-subtle">' + rows + '</tbody></table></div>' +
          '<p class="text-caption text-muted">' + t('sim.denominatorNote') + '</p>'
        : '<div class="rounded-control border border-border bg-canvas p-4 text-body-sm text-muted">' +
          t('sim.structureNotPublished') + '</div>') +
      '<div class="p-4 sm:p-5 rounded-card border border-primary/25 bg-surface-sunken flex flex-col md:flex-row md:items-center justify-between gap-4">' +
      '<div class="space-y-1">' +
      '<div class="flex flex-wrap items-center gap-2">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">calculate</span>' +
      '<span class="text-title-md font-bold text-ink">' + t('sim.neededFor', { n: target }) + '</span>' +
      '<span data-needed="' + subject.id + '">' + neededText + '</span></div>' +
      '<p class="text-body-sm text-muted" data-secured-line="' + subject.id + '">' +
      t('sim.securedLine', { a: result.secured.toFixed(2), b: result.possible }) + '</p></div>' +
      '<div class="flex items-center gap-2 shrink-0">' +
      TARGETS.map(function (option) {
        var on = option.value === target;
        return '<button type="button" data-target="' + option.value + '" class="bb-btn ' +
          (on ? 'bb-btn-primary' : 'bb-btn-ghost') + '" style="height:34px;font-size:.75rem">' +
          option.label + '</button>';
      }).join('') +
      '</div></div></div></article>'
    );
  }

  function collapsedCard(subject) {
    var result = compute(subject);
    var summary = result.published
      ? t('sim.securedSummary', {
          a: result.secured.toFixed(1),
          b: result.possible,
          n: subject.assessments.length
        })
      : t('sim.structureNotPublished');

    return (
      '<a href="simulator.html?subject=' + subject.id + '" class="bb-card bb-card-hover p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">' +
      '<div class="flex items-center gap-3.5">' +
      '<span class="w-10 h-10 rounded-control flex items-center justify-center text-white text-caption font-bold" style="background:' +
      subject.color + '">' + subject.id.slice(0, 2) + '</span>' +
      '<div><div class="flex items-center gap-2">' +
      '<span class="text-label-sm font-bold" style="color:' + subject.color + '">' + subject.id + '</span>' +
      '<span class="text-title-md font-semibold text-ink">' + subject.name + '</span>' +
      '<span class="text-caption text-muted">' + t('sim.cr', { n: subject.credits }) + '</span></div>' +
      '<p class="text-body-sm text-muted mt-0.5">' + summary + '</p></div></div>' +
      '<div class="flex items-center gap-3 self-end md:self-center">' +
      '<span class="bb-chip" style="background:var(--bb-surface-subtle);color:var(--bb-text-muted)">' +
      (result.entered ? t('sim.inProgress') : t('sim.noScoresYet')) + '</span>' +
      '<span class="material-symbols-outlined text-[20px] text-muted">chevron_right</span></div></a>'
    );
  }

  function renderSubjects() {
    var subjects = state().subjects;
    var host = document.getElementById('subjects');
    host.innerHTML =
      expandedCard(active) +
      '<div class="space-y-3">' +
      subjects
        .filter(function (subject) {
          return subject.id !== active.id;
        })
        .map(collapsedCard)
        .join('') +
      '</div>';
  }

  function renderSidebar() {
    var scale = window.BB_SEED.gradingScale;
    var rows = scale
      .map(function (entry) {
        var isTarget = target >= entry.min && target <= entry.max;
        return (
          '<div class="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0 text-body-sm' +
          (isTarget ? ' bg-surface-sunken px-2 rounded' : '') + '">' +
          '<div class="flex items-center gap-2">' +
          '<span class="w-6 text-center font-bold ' + (isTarget ? 'text-primary' : 'text-ink') + '">' + entry.grade + '</span>' +
          '<span class="' + (isTarget ? 'text-ink font-medium' : 'text-muted') + '">' + entry.min + ' - ' + entry.max + '%</span></div>' +
          '<span class="font-semibold num ' + (isTarget ? 'text-primary' : 'text-ink') + '">' +
          entry.point.toFixed(2) + ' ' + t('sim.gp') + (isTarget ? ' ' + t('sim.target') : '') + '</span></div>'
        );
      })
      .join('');

    document.getElementById('sidebar').innerHTML =
      '<div class="bb-card p-6">' +
      '<div class="flex items-center justify-between pb-4 border-b border-border">' +
      '<div><h3 class="text-title-md font-semibold text-ink">' + t('sim.gradingScale') + '</h3>' +
      '<p class="text-caption text-muted">' + t('sim.gradingHint') + '</p></div>' +
      '<span class="material-symbols-outlined text-muted">menu_book</span></div>' +
      '<div class="mt-4 space-y-1">' + rows + '</div>' +
      '<p class="text-caption text-muted mt-3">' + t('sim.targetNote', { n: target }) + '</p>' +
      '<div class="mt-4 pt-4 border-t border-border text-caption text-muted flex items-start gap-2">' +
      '<span class="material-symbols-outlined text-[16px] text-alert shrink-0">info</span>' +
      '<span>' + t('sim.scholarshipNote', { n: state().settings.cgpaTarget.toFixed(2) }) + '</span></div></div>';
  }

  function render() {
    renderMetrics();
    renderSubjects();
    renderSidebar();
  }

  function saveMax(subjectId, assessmentId, value) {
    BB.store.update(function (data) {
      data.subjects.forEach(function (subject) {
        if (subject.id !== subjectId) return;
        subject.assessments.forEach(function (assessment) {
          if (assessment.id === assessmentId) assessment.max = value;
        });
      });
    });
  }

  /* 満点を超える点数は確保点を水増しするので、保存時に 0〜満点へ丸める。
     丸めた場合は丸めた値を返す（呼び出し側が入力欄を直す）。 */
  function saveMark(subjectId, assessmentId, raw) {
    var clamped = null;
    BB.store.update(function (data) {
      data.subjects.forEach(function (subject) {
        if (subject.id !== subjectId) return;
        subject.marks = subject.marks || {};
        if (raw === '') {
          delete subject.marks[assessmentId];
          return;
        }
        var value = Number(raw);
        if (!isFinite(value)) {
          delete subject.marks[assessmentId];
          return;
        }
        var max = NaN;
        subject.assessments.forEach(function (assessment) {
          if (assessment.id === assessmentId) max = Number(assessment.max);
        });
        var upper = isFinite(max) && max > 0 ? max : Infinity;
        var bounded = Math.max(0, Math.min(upper, value));
        if (bounded !== value) clamped = bounded;
        subject.marks[assessmentId] = bounded;
      });
    });
    return clamped;
  }

  /* 入力中は入力欄を作り直さず、依存する数字だけを差し替える。
     全体を描き直すとフォーカスが飛び、打っている途中の値が古いまま見える。 */
  function refreshLive(subjectId) {
    var subject = BB.store.subject(subjectId);
    if (!subject) return;
    var result = compute(subject);

    subject.assessments.forEach(function (assessment) {
      var score = scoreOf(subject, assessment);
      var hasScore = score !== null;

      var weighted = document.querySelector('[data-weighted="' + assessment.id + '"]');
      if (weighted) {
        weighted.textContent = hasScore ? ((score / assessment.max) * assessment.weight).toFixed(1) : '—';
      }

      var status = document.querySelector('[data-status="' + assessment.id + '"]');
      if (status) {
        status.textContent = hasScore ? t('sim.gradedStatus') : t('sim.pendingStatus');
        status.style.background = hasScore ? 'var(--bb-success-surface)' : 'var(--bb-surface-subtle)';
        status.style.color = hasScore ? 'var(--bb-success)' : 'var(--bb-text-muted)';
      }

      var scoreInput = document.querySelector(
        '[data-assessment="' + assessment.id + '"][data-subject="' + subjectId + '"]'
      );
      if (scoreInput) scoreInput.setAttribute('max', assessment.max);
    });

    var secured = document.querySelector('[data-secured="' + subjectId + '"]');
    if (secured) {
      secured.textContent = result.secured.toFixed(1) + ' / ' + result.possible + ' (' +
        (result.possible ? ((result.secured / result.possible) * 100).toFixed(1) : '0.0') + '%)';
    }

    var predicted = document.querySelector('[data-predicted="' + subjectId + '"]');
    if (predicted) {
      predicted.textContent = result.predicted ? result.predicted.grade : '—';
      predicted.style.color = result.predicted ? subject.color : 'var(--bb-text-muted)';
    }

    var needed = document.querySelector('[data-needed="' + subjectId + '"]');
    if (needed) needed.innerHTML = neededHtml(result);

    var line = document.querySelector('[data-secured-line="' + subjectId + '"]');
    if (line) {
      line.textContent = t('sim.securedLine', { a: result.secured.toFixed(2), b: result.possible });
    }

    renderMetrics();
  }

  document.addEventListener('input', function (event) {
    var maxInput = event.target.closest('[data-max]');
    if (maxInput) {
      var maxValue = Number(maxInput.value);
      if (!isFinite(maxValue) || maxValue <= 0) return;
      saveMax(maxInput.getAttribute('data-subject'), maxInput.getAttribute('data-max'), maxValue);
      refreshLive(maxInput.getAttribute('data-subject'));
      return;
    }

    var input = event.target.closest('[data-assessment]');
    if (!input) return;
    var subjectId = input.getAttribute('data-subject');
    var raw = input.value.trim();
    var clamped = saveMark(subjectId, input.getAttribute('data-assessment'), raw);
    if (clamped !== null) {
      input.value = clamped;
      /* 満点を超えた入力を黙って書き換えると、直されたことに気づけない。
         0 未満の丸めは入力欄の min で防げるので、知らせるのは上限だけ。 */
      if (Number(raw) > clamped) BB.ui.toast(t('sim.toastCapped'));
    }
    refreshLive(subjectId);
  });

  document.addEventListener('change', function (event) {
    var maxInput = event.target.closest('[data-max]');
    if (maxInput) {
      var maxSubjectId = maxInput.getAttribute('data-subject');
      var maxAssessmentId = maxInput.getAttribute('data-max');
      var maxValue = Number(maxInput.value);
      if (!isFinite(maxValue) || maxValue <= 0) {
        render();
        return;
      }
      saveMax(maxSubjectId, maxAssessmentId, maxValue);
      render();
      return;
    }

    var input = event.target.closest('[data-assessment]');
    if (input) {
      var subjectId = input.getAttribute('data-subject');
      var clamped = saveMark(subjectId, input.getAttribute('data-assessment'), input.value.trim());
      if (clamped !== null) {
        input.value = clamped;
        BB.ui.toast(t('sim.toastCapped'));
      }
      refreshLive(subjectId);
      return;
    }

    if (event.target.id === 'subject-switch') {
      window.location.href = 'simulator.html?subject=' + event.target.value;
    }
  });

  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-target]');
    if (!button) return;
    target = Number(button.getAttribute('data-target'));
    render();
  });

  render();

  /* 他タブの保存を取り込んだら描き直す。 */
  BB.store.subscribe(function () {
    /* active は marks ごと古いオブジェクトを掴んだままなので、保存済みの最新から
       同じ科目 ID で引き直す。科目が削除されていたら先頭科目に戻す。 */
    active = (active && subjectById(active.id)) || requestedSubject();
    if (!active) return;
    /* 他タブの保存では、ヘッダーもページ本体も再読込なしで追いつく。 */
    BB.ui.refreshChrome();
    render();
  });
})();
