(function () {
  'use strict';

  var BB = window.BB;
  var TARGETS = [
    { label: 'A+ (85%)', value: 85 },
    { label: 'A (80%)', value: 80 },
    { label: 'A- (75%)', value: 75 }
  ];
  var target = 80;

  function state() {
    return BB.store.get();
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

  BB.ui.mount({
    title: 'Grade Simulator',
    head: {
      title: 'Grade Simulator',
      subtitle: 'Enter coursework marks to project the grade and the final exam score still required.',
      actions: active
        ? '<select id="subject-switch" class="bb-input" style="height:40px;width:auto">' +
          state()
            .subjects.map(function (subject) {
              return '<option value="' + subject.id + '"' + (subject.id === active.id ? ' selected' : '') + '>' +
                subject.id + ' ' + subject.name + '</option>';
            })
            .join('') +
          '</select>'
        : ''
    }
  });

  /* 科目0件では比較対象がない。空状態を出してセットアップへ誘導する。 */
  if (!active) {
    document.getElementById('metrics').innerHTML = '';
    document.getElementById('subjects').innerHTML =
      '<div class="bb-card p-8 text-center">' +
      '<span class="material-symbols-outlined text-[28px] text-placeholder">calculate</span>' +
      '<p class="text-body-sm text-muted mt-2">No subjects to simulate yet.</p>' +
      '<a href="subject-edit.html?new=1" class="bb-btn bb-btn-primary mt-3">' +
      '<span class="material-symbols-outlined text-[18px]">add</span>Add a subject</a></div>';
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

  function compute(subject) {
    var secured = 0;
    var possible = 0;
    var entered = 0;
    var exam = finalOf(subject);
    var examScore = null;

    subject.assessments.forEach(function (assessment) {
      possible += assessment.weight;
      var score = subject.marks ? subject.marks[assessment.id] : undefined;
      if (typeof score === 'number' && !isNaN(score)) {
        secured += (score / assessment.max) * assessment.weight;
        entered += 1;
        if (exam && assessment.id === exam.id) examScore = score;
      }
    });

    var withoutExam = secured;
    if (exam && examScore !== null) withoutExam -= (examScore / exam.max) * exam.weight;

    var predicted = entered > 0 && entered === subject.assessments.length ? gradeFor(secured) : null;
    var needed = null;
    if (exam) {
      var required = (target - withoutExam) / exam.weight;
      needed = {
        percent: required * 100,
        marks: (required * exam.max),
        max: exam.max,
        reachable: required <= 1,
        secured: required <= 0
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
      '<span class="text-caption text-muted block mb-1">Predicted Trimester GPA</span>' +
      '<div class="flex items-baseline gap-2">' +
      '<span class="text-display font-bold text-ink num">' + (gpa === null ? '—' : gpa.toFixed(2)) + '</span>' +
      '<span class="text-label-md text-muted">' + (gpa === null ? 'No scores yet' : 'of 4.00') + '</span></div>' +
      '<span class="inline-flex items-center gap-1 mt-2 text-label-sm text-muted bg-surface-subtle px-2.5 py-1 rounded">' +
      '<span class="material-symbols-outlined text-[16px]">hourglass_empty</span>' +
      (graded.length
        ? graded.length + ' of ' + subjects.length + ' module' + (subjects.length === 1 ? '' : 's') + ' graded' +
          (provisional ? ' — provisional' : '')
        : 'Awaiting coursework marks') +
      '</span>' +
      (provisional
        ? '<p class="text-caption text-muted mt-2">Only graded modules are counted, so this figure will move ' +
          'as the remaining marks come in.</p>'
        : '') +
      '</div>' +
      '<div class="lg:border-r border-border pb-6 md:pb-0 lg:pr-6">' +
      '<div class="flex items-center justify-between mb-1">' +
      '<span class="text-caption text-muted">Scholarship Retention Threshold</span>' +
      '<span class="text-label-sm font-semibold text-alert">JPA / High Achiever</span></div>' +
      '<div class="flex items-baseline gap-2">' +
      '<span class="text-headline-lg font-bold text-ink num">' + goal.toFixed(2) + '</span>' +
      '<span class="text-caption text-muted">Min. Required</span></div>' +
      '<p class="text-body-sm text-muted mt-2 leading-tight">Requires continuous maintenance each trimester.</p></div>' +
      '<div class="lg:border-r border-border pb-6 md:pb-0 lg:pr-6">' +
      '<div class="flex items-center justify-between mb-1">' +
      '<span class="text-caption text-muted">Distance to Target</span>' +
      '<span class="text-label-sm font-semibold ' + (distance === null ? 'text-muted' : distance >= 0 ? 'text-primary' : 'text-alert') + '">' +
      (distance === null ? '—' : (distance >= 0 ? '+' : '') + distance.toFixed(2)) + '</span></div>' +
      '<div class="relative w-full h-3 bg-surface-subtle rounded-full mt-3 overflow-hidden">' +
      '<div class="h-full bg-primary rounded-full" style="width:' + gauge + '%"></div>' +
      '<div class="absolute top-0 bottom-0 w-1 bg-alert z-10" style="left:' + cutoff + '%" title="Scholarship minimum ' +
      goal.toFixed(2) + '"></div></div>' +
      '<div class="flex justify-between items-center text-caption text-muted mt-2">' +
      '<span>' + scaleMin.toFixed(2) + '</span><span class="text-alert font-semibold">' + goal.toFixed(2) +
      ' Cutoff</span><span>' + scaleMax.toFixed(2) + '</span></div></div>' +
      '<div><span class="text-caption text-muted block mb-1">Modules Counted</span>' +
      '<div class="flex items-baseline gap-2">' +
      '<span class="text-headline-lg font-bold text-ink num">' + graded.length + ' / ' + subjects.length + '</span>' +
      '<span class="text-caption text-muted">' + credits + ' of ' + totalCredits + ' Cr.</span></div>' +
      '<p class="text-caption text-muted mt-2">' +
      (gpa === null
        ? 'Enter marks for every component of a module to predict its grade.'
        : 'A module counts once all of its components have marks.') +
      '</p></div></div></div>';
  }

  function assessmentRow(subject, assessment, result) {
    var score = subject.marks ? subject.marks[assessment.id] : undefined;
    var hasScore = typeof score === 'number' && !isNaN(score);
    var contribution = hasScore ? ((score / assessment.max) * assessment.weight).toFixed(1) : '—';
    var isExam = result.exam && assessment.id === result.exam.id;

    return (
      '<tr class="' + (isExam ? 'bg-surface-sunken/60' : 'hover:bg-canvas') + ' transition-colors">' +
      '<td class="py-3 pr-4"><span class="font-semibold text-ink block">' + assessment.name + '</span>' +
      '<span class="text-caption text-muted">Week ' + assessment.week + '</span></td>' +
      '<td class="py-3 px-4 text-muted text-label-md num">' + assessment.weight + '%</td>' +
      '<td class="py-3 px-4"><div class="flex items-center gap-2">' +
      '<input class="bb-input num" style="height:36px;width:88px;text-align:center;padding:0 .5rem" type="number"' +
      ' min="0" max="' + assessment.max + '" step="0.5" placeholder="—"' +
      ' value="' + (hasScore ? score : '') + '"' +
      ' aria-label="Score obtained for ' + assessment.name + '"' +
      ' data-subject="' + subject.id + '" data-assessment="' + assessment.id + '">' +
      '<span class="text-caption text-muted num">/</span>' +
      '<input class="bb-input num" style="height:36px;width:64px;text-align:center;padding:0 .375rem" type="number"' +
      ' min="1" step="1" value="' + assessment.max + '" title="Full marks for this component"' +
      ' aria-label="Full marks for ' + assessment.name + '"' +
      ' data-max="' + assessment.id + '" data-subject="' + subject.id + '"></div></td>' +
      '<td class="py-3 px-4 font-semibold text-ink num">' + contribution + '</td>' +
      '<td class="py-3 pl-4 text-right">' +
      '<span class="bb-chip" style="background:' + (hasScore ? 'var(--bb-success-surface)' : 'var(--bb-surface-subtle)') +
      ';color:' + (hasScore ? 'var(--bb-success)' : 'var(--bb-text-muted)') + '">' +
      (hasScore ? 'Graded' : 'Pending') + '</span></td></tr>'
    );
  }

  function expandedCard(subject) {
    var result = compute(subject);
    var chip = BB.color.chip(subject.color);
    var needed = result.needed;

    var neededText;
    if (!result.published) {
      neededText = '<span class="text-muted">Assessment structure not published yet.</span>';
    } else if (!needed) {
      neededText = '<span class="text-muted">No final exam component.</span>';
    } else if (needed.secured) {
      neededText = '<span class="text-success font-bold">Already secured</span>';
    } else if (!needed.reachable) {
      neededText = '<span class="text-alert font-bold">Not reachable</span>';
    } else {
      neededText = '<span class="text-primary font-bold num">' + needed.marks.toFixed(1) + ' / ' + needed.max + '</span>';
    }

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
      '<span class="text-caption text-muted">' + subject.credits + ' Credit Hours</span>' +
      '<span class="w-1.5 h-1.5 rounded-full bg-border"></span>' +
      '<span class="text-caption text-muted">' + subject.faculty + '</span></div>' +
      '<h3 class="text-headline-sm font-bold text-ink">' + subject.name + '</h3></div>' +
      '<div class="flex items-center gap-4 bg-canvas px-4 py-2.5 rounded-control border border-border">' +
      '<div><span class="text-caption text-muted block">Current Secured</span>' +
      '<span class="text-label-md font-bold text-ink num">' + result.secured.toFixed(1) + ' / ' +
      result.possible + ' (' + (result.possible ? ((result.secured / result.possible) * 100).toFixed(1) : '0.0') + '%)</span></div>' +
      '<div class="h-8 w-px bg-border"></div>' +
      '<div><span class="text-caption text-muted block">Predicted Grade</span>' +
      '<span class="text-label-md font-bold num" style="color:' + (result.predicted ? subject.color : 'var(--bb-text-muted)') + '">' +
      (result.predicted ? result.predicted.grade : '—') + '</span></div></div></div></div>' +
      '<div class="p-6 space-y-5">' +
      '<h4 class="text-title-md font-semibold text-ink">Continuous Assessments &amp; Weighted Components</h4>' +
      (result.published
        ? '<div class="overflow-x-auto bb-scroll"><table class="w-full text-left text-body-md border-collapse">' +
          '<thead><tr class="border-b border-border text-caption text-muted">' +
          '<th class="py-2.5 pr-4 font-semibold">Component</th>' +
          '<th class="py-2.5 px-4 font-semibold">Weight</th>' +
          '<th class="py-2.5 px-4 font-semibold">Score / Full marks</th>' +
          '<th class="py-2.5 px-4 font-semibold">Weighted</th>' +
          '<th class="py-2.5 pl-4 text-right font-semibold">Status</th></tr></thead>' +
          '<tbody class="divide-y divide-border-subtle">' + rows + '</tbody></table></div>' +
          '<p class="text-caption text-muted">The second box is the denominator (full marks) for that component, ' +
          'not a button. Marks save as you type.</p>'
        : '<div class="rounded-control border border-border bg-canvas p-4 text-body-sm text-muted">' +
          'The assessment structure for this module has not been published yet.</div>') +
      '<div class="p-4 sm:p-5 rounded-card border border-primary/25 bg-surface-sunken flex flex-col md:flex-row md:items-center justify-between gap-4">' +
      '<div class="space-y-1">' +
      '<div class="flex flex-wrap items-center gap-2">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">calculate</span>' +
      '<span class="text-title-md font-bold text-ink">Final exam score needed for ' + target + '%:</span>' +
      neededText + '</div>' +
      '<p class="text-body-sm text-muted">Current coursework secured: ' + result.secured.toFixed(2) + ' / ' +
      result.possible + '%. Enter marks above to recompute the target buffer.</p></div>' +
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
      ? result.secured.toFixed(1) + ' / ' + result.possible + ' secured • ' +
        subject.assessments.length + ' components'
      : 'Assessment structure not published yet.';

    return (
      '<a href="simulator.html?subject=' + subject.id + '" class="bb-card bb-card-hover p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">' +
      '<div class="flex items-center gap-3.5">' +
      '<span class="w-10 h-10 rounded-control flex items-center justify-center text-white text-caption font-bold" style="background:' +
      subject.color + '">' + subject.id.slice(0, 2) + '</span>' +
      '<div><div class="flex items-center gap-2">' +
      '<span class="text-label-sm font-bold" style="color:' + subject.color + '">' + subject.id + '</span>' +
      '<span class="text-title-md font-semibold text-ink">' + subject.name + '</span>' +
      '<span class="text-caption text-muted">(' + subject.credits + ' Cr.)</span></div>' +
      '<p class="text-body-sm text-muted mt-0.5">' + summary + '</p></div></div>' +
      '<div class="flex items-center gap-3 self-end md:self-center">' +
      '<span class="bb-chip" style="background:var(--bb-surface-subtle);color:var(--bb-text-muted)">' +
      (result.entered ? 'In progress' : 'No scores yet') + '</span>' +
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
          entry.point.toFixed(2) + ' GP' + (isTarget ? ' (Target)' : '') + '</span></div>'
        );
      })
      .join('');

    document.getElementById('sidebar').innerHTML =
      '<div class="bb-card p-6">' +
      '<div class="flex items-center justify-between pb-4 border-b border-border">' +
      '<div><h3 class="text-title-md font-semibold text-ink">MMU Grading Scale</h3>' +
      '<p class="text-caption text-muted">Indicative bands — confirm with your faculty handbook</p></div>' +
      '<span class="material-symbols-outlined text-muted">menu_book</span></div>' +
      '<div class="mt-4 space-y-1">' + rows + '</div>' +
      '<p class="text-caption text-muted mt-3">(Target) marks the band that contains the ' + target +
      '% target. A and A+ both carry 4.00 grade points, so the band only affects the percentage, not the GPA.</p>' +
      '<div class="mt-4 pt-4 border-t border-border text-caption text-muted flex items-start gap-2">' +
      '<span class="material-symbols-outlined text-[16px] text-alert shrink-0">info</span>' +
      '<span>A minimum grade point average of ' + state().settings.cgpaTarget.toFixed(2) +
      ' is mandatory across two consecutive trimesters to retain the full scholarship endowment.</span></div></div>';
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

  function saveMark(subjectId, assessmentId, raw) {
    BB.store.update(function (data) {
      data.subjects.forEach(function (subject) {
        if (subject.id !== subjectId) return;
        subject.marks = subject.marks || {};
        if (raw === '') delete subject.marks[assessmentId];
        else subject.marks[assessmentId] = Number(raw);
      });
    });
  }

  /* 入力中に再描画するとフォーカスが飛ぶため、少し待ってから同じ欄へ戻す。
     これがないと「Enter を押すまで反映されない」ように見える。 */
  var renderTimer = null;
  function renderSoon(selector) {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(function () {
      renderTimer = null;
      render();
      if (!selector) return;
      var node = document.querySelector(selector);
      if (!node) return;
      node.focus();
      try {
        node.setSelectionRange(node.value.length, node.value.length);
      } catch (e) {
        /* type=number では選択範囲を扱えないブラウザがある */
      }
    }, 450);
  }

  function fieldSelector(input) {
    var subjectId = input.getAttribute('data-subject');
    var assessmentId = input.getAttribute('data-assessment') || input.getAttribute('data-max');
    var attribute = input.hasAttribute('data-max') ? 'data-max' : 'data-assessment';
    return '[' + attribute + '="' + assessmentId + '"][data-subject="' + subjectId + '"]';
  }

  document.addEventListener('input', function (event) {
    var maxInput = event.target.closest('[data-max]');
    if (maxInput) {
      var maxValue = Number(maxInput.value);
      if (!isFinite(maxValue) || maxValue <= 0) return;
      saveMax(maxInput.getAttribute('data-subject'), maxInput.getAttribute('data-max'), maxValue);
      renderSoon(fieldSelector(maxInput));
      return;
    }

    var input = event.target.closest('[data-assessment]');
    if (!input) return;
    saveMark(
      input.getAttribute('data-subject'),
      input.getAttribute('data-assessment'),
      input.value.trim()
    );
    renderSoon(fieldSelector(input));
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
      saveMark(
        input.getAttribute('data-subject'),
        input.getAttribute('data-assessment'),
        input.value.trim()
      );
      render();
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
    render();
  });
})();
