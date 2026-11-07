/* MMU BeeBoard — first-time setup wizard.
   Welcome → 学期設定 → 科目追加 → 完了。全ステップに Skip があり、Skip でも
   setupDone を立てて二度と自動表示しない。科目追加は subject-form.js を再利用する。 */
(function () {
  'use strict';

  var BB = window.BB;
  var form = BB.subjectForm;

  var STEP_WELCOME = 0;
  var STEP_TERM = 1;
  var STEP_SUBJECT = 2;
  var STEP_DONE = 3;
  var LABELS = ['Welcome', 'Trimester', 'Subjects', 'Done'];

  var step = STEP_WELCOME;
  var draft = form.blank();
  var justSaved = null;
  BB.ui.mount({ title: 'First-time setup' });

  /* 学期ステップの入力は保存前なので、再描画で消えないようここに保持する。 */
  var termDraft = (function () {
    var data = BB.store.get();
    return {
      label: data.term.label || '',
      startDate: data.term.startDate || '',
      weeks: data.term.weeks || 14,
      name: data.student.name || ''
    };
  })();

  var progressHost = document.getElementById('progress');
  var stepHost = document.getElementById('step');

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

  /* form.bind が draft の参照を握るため、差し替えではなく中身を入れ替える。 */
  function resetDraft() {
    var fresh = form.blank();
    Object.keys(draft).forEach(function (key) {
      delete draft[key];
    });
    Object.keys(fresh).forEach(function (key) {
      draft[key] = fresh[key];
    });
  }

  function go(index) {
    step = index;
    if (step === STEP_SUBJECT) {
      justSaved = null;
      resetDraft();
    }
    render();
    window.scrollTo(0, 0);
  }

  /* Skip も完了扱い。二度と自動表示しない。 */
  function skip() {
    BB.store.completeSetup();
    window.location.href = 'index.html';
  }

  function finish() {
    BB.store.completeSetup();
    window.location.href = 'index.html';
  }

  function initialsOf(name) {
    return BB.ui.initials(name);
  }

  /* ---------- progress ---------- */

  function renderProgress() {
    progressHost.innerHTML =
      '<ol class="grid grid-cols-4 gap-2">' +
      LABELS.map(function (label, index) {
        var done = index < step;
        var active = index === step;
        return (
          '<li>' +
          '<div class="flex items-center gap-2">' +
          '<span class="w-6 h-6 rounded-full flex items-center justify-center text-caption font-bold ' +
          (active ? 'bg-primary text-on-primary' : done ? 'bg-success-surface text-success' : 'bg-surface-subtle text-muted') + '">' +
          (done ? '<span class="material-symbols-outlined text-[14px]">check</span>' : String(index + 1)) +
          '</span>' +
          '<span class="text-caption ' + (active ? 'text-ink font-semibold' : 'text-muted') + '">' + label + '</span>' +
          '</div>' +
          '<div class="h-1 mt-2 rounded-full ' + (index <= step ? 'bg-primary' : 'bg-border') + '"></div>' +
          '</li>'
        );
      }).join('') +
      '</ol>';
  }

  /* ---------- step 1: welcome ---------- */

  function welcomeStep() {
    var features = [
      { icon: 'calendar_today', title: 'Weekly timetable', text: 'Class blocks on a Mon–Fri grid with a next-class card.' },
      { icon: 'rule', title: 'Attendance', text: 'Track the exam-eligibility threshold per module.' },
      { icon: 'calculate', title: 'Grade simulator', text: 'Secured marks and the final exam score still needed.' },
      { icon: 'alarm', title: 'Deadlines', text: 'Assessment timeline grouped by week and weight.' },
      { icon: 'timer', title: 'Study log', text: 'A timer and manual entries against a weekly target.' }
    ];

    return (
      '<section class="bb-card overflow-hidden">' +
      '<div class="p-6 sm:p-8 border-b border-border">' +
      '<span class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-sunken text-primary text-caption font-semibold uppercase tracking-wider">' +
      '<span class="material-symbols-outlined text-[16px]">add_task</span>First-time setup</span>' +
      '<h1 class="text-headline-md font-bold text-ink tracking-tight mt-3">Welcome to MMU BeeBoard</h1>' +
      '<p class="text-body-md text-muted mt-2">A personal study dashboard for your trimester. ' +
      'Three short steps and your timetable is yours.</p>' +
      '</div>' +
      '<div class="p-6 sm:p-8 space-y-5">' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
      features.map(function (feature) {
        return (
          '<div class="flex items-start gap-3 rounded-control border border-border-subtle bg-canvas p-3.5">' +
          '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">' + feature.icon + '</span>' +
          '<div><div class="text-label-md font-semibold text-ink">' + feature.title + '</div>' +
          '<div class="text-caption text-muted">' + feature.text + '</div></div></div>'
        );
      }).join('') +
      '</div>' +
      '<div class="rounded-control border border-primary/25 bg-surface-sunken p-4 flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">info</span>' +
      '<div class="text-body-sm text-body">' +
      '<span class="font-semibold text-ink">Your data stays in this browser.</span> ' +
      'Everything you enter is saved to this browser\'s local storage only — no account, no server, ' +
      'no analytics, no network requests. Clearing site data removes it.</div></div>' +
      '</div>' +
      '<div class="px-6 sm:px-8 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3">' +
      '<button type="button" id="w-skip" class="bb-btn bb-btn-ghost">Skip setup</button>' +
      '<button type="button" id="w-start" class="bb-btn bb-btn-primary">Get started' +
      '<span class="material-symbols-outlined text-[18px]">arrow_forward</span></button>' +
      '</div></section>'
    );
  }

  /* ---------- step 2: trimester ---------- */

  function termStep() {
    return (
      '<section class="bb-card overflow-hidden">' +
      '<div class="p-6 sm:p-8 border-b border-border">' +
      '<h1 class="text-headline-sm font-bold text-ink tracking-tight">Set up your trimester</h1>' +
      '<p class="text-body-sm text-muted mt-1">The label and week count drive the header, the timetable subtitle, ' +
      'and every week number in the app.</p></div>' +
      '<div class="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">' +
      '<div class="sm:col-span-2"><label class="bb-label" for="w-label">Trimester label</label>' +
      '<input id="w-label" class="bb-input" type="text" value="' + esc(termDraft.label) + '" placeholder="My Trimester"></div>' +
      '<div><label class="bb-label" for="w-start-date">Week 1 starts (Monday)</label>' +
      '<input id="w-start-date" class="bb-input" type="date" value="' + esc(termDraft.startDate) + '">' +
      '<p class="text-caption text-muted mt-1.5">Optional. Leave it empty and week numbers stay at Week 1 ' +
      'until you set a date in Settings.</p></div>' +
      '<div><label class="bb-label" for="w-weeks">Number of weeks</label>' +
      '<input id="w-weeks" class="bb-input num" type="number" min="1" max="30" step="1" value="' +
      esc(termDraft.weeks) + '">' +
      '<p class="text-caption text-muted mt-1.5">Defaults to 14 teaching weeks.</p></div>' +
      '<div class="sm:col-span-2"><label class="bb-label" for="w-name">Your name (optional)</label>' +
      '<input id="w-name" class="bb-input" type="text" value="' + esc(termDraft.name) + '" placeholder="Student">' +
      '<p class="text-caption text-muted mt-1.5">Shown in the header and footer. You can change it any time in Settings.</p></div>' +
      '</div>' +
      '<div class="px-6 sm:px-8 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3">' +
      '<div class="flex items-center gap-2">' +
      '<button type="button" id="w-back" class="bb-btn bb-btn-ghost">' +
      '<span class="material-symbols-outlined text-[18px]">arrow_back</span>Back</button>' +
      '<button type="button" id="w-skip" class="bb-btn bb-btn-ghost">Skip setup</button></div>' +
      '<button type="button" id="w-next" class="bb-btn bb-btn-primary">Continue' +
      '<span class="material-symbols-outlined text-[18px]">arrow_forward</span></button>' +
      '</div></section>'
    );
  }

  function saveTerm() {
    var label = document.getElementById('w-label').value.trim() || 'My Trimester';
    var startDate = document.getElementById('w-start-date').value;
    var weeks = Number(document.getElementById('w-weeks').value);
    var name = document.getElementById('w-name').value.trim();

    if (!isFinite(weeks) || weeks < 1) {
      BB.ui.toast('Number of weeks must be 1 or more');
      return;
    }

    BB.store.update(function (data) {
      data.term.label = label;
      data.term.shortLabel = label;
      data.term.startDate = startDate || '';
      data.term.weeks = weeks;
      data.term.examWeek = weeks + 1;
      if (name) {
        data.student.name = name;
        data.student.initials = initialsOf(name);
      }
    });

    /* 保存済みになったので、ヘッダーのプレビュー表示を解除する。 */
    BB.ui.refreshChrome();
    go(STEP_SUBJECT);
  }

  /* ---------- step 3: subjects ---------- */

  function subjectList() {
    var subjects = state().subjects;
    if (!subjects.length) return '';
    return (
      '<div class="bb-card overflow-hidden">' +
      '<div class="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3">' +
      '<div class="flex items-center gap-2">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">menu_book</span>' +
      '<h2 class="text-title-md font-bold text-ink">Added so far</h2></div>' +
      '<span class="text-caption text-muted">' + subjects.length + ' subject' + (subjects.length === 1 ? '' : 's') + '</span></div>' +
      subjects.map(function (subject) {
        return (
          '<div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-border-subtle last:border-0">' +
          '<div class="flex items-center gap-3 min-w-0">' + BB.ui.solidChip(subject.color, subject.id) +
          '<div class="min-w-0"><div class="text-body-md font-semibold text-ink truncate">' + esc(subject.name) + '</div>' +
          '<div class="text-caption text-muted">' + subject.credits + ' Cr. • ' + subject.sessions.length +
          ' sessions • ' + subject.assessments.length + ' components</div></div></div>' +
          '<a href="subject-edit.html?id=' + encodeURIComponent(subject.id) + '" class="bb-btn bb-btn-ghost" style="height:32px">' +
          '<span class="material-symbols-outlined text-[16px]">edit</span>Edit</a></div>'
        );
      }).join('') +
      '</div>'
    );
  }

  function savedPanel() {
    var subject = BB.store.subject(justSaved);
    var name = subject ? subject.id + ' ' + subject.name : 'Subject';
    return (
      '<section class="bb-card overflow-hidden">' +
      '<div class="p-6 sm:p-8 flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[24px] text-success">task_alt</span>' +
      '<div><h2 class="text-title-md font-bold text-ink">' + esc(name) + ' added</h2>' +
      '<p class="text-body-sm text-muted mt-1">It is already on your timetable, deadlines, attendance and study log. ' +
      'Add another module, or finish setup and open the dashboard.</p></div></div>' +
      '<div class="px-6 sm:px-8 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3">' +
      '<button type="button" id="w-skip" class="bb-btn bb-btn-ghost">Skip setup</button>' +
      '<div class="flex flex-wrap items-center gap-2">' +
      '<button type="button" id="w-add-another" class="bb-btn bb-btn-ghost">' +
      '<span class="material-symbols-outlined text-[18px]">add</span>Add another subject</button>' +
      '<button type="button" id="w-finish" class="bb-btn bb-btn-primary">Go to finish' +
      '<span class="material-symbols-outlined text-[18px]">arrow_forward</span></button>' +
      '</div></div></section>'
    );
  }

  function subjectStep() {
    var head =
      '<section class="bb-card overflow-hidden">' +
      '<div class="p-6 sm:p-8 border-b border-border">' +
      '<h1 class="text-headline-sm font-bold text-ink tracking-tight">Add your first subject</h1>' +
      '<p class="text-body-sm text-muted mt-1">Same fields as the subject editor: code, name, credits, colour, ' +
      'weekly sessions and assessment weightings. The colour is picked from the unused presets.</p></div>' +
      '<div class="px-6 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3">' +
      '<div class="flex items-center gap-2">' +
      '<button type="button" id="w-back" class="bb-btn bb-btn-ghost">' +
      '<span class="material-symbols-outlined text-[18px]">arrow_back</span>Back</button>' +
      '<button type="button" id="w-skip" class="bb-btn bb-btn-ghost">Skip setup</button></div>' +
      '<div class="flex flex-wrap items-center gap-2">' +
      (state().subjects.length
        ? '<button type="button" id="w-finish" class="bb-btn bb-btn-ghost">Go to finish</button>'
        : '') +
      '<button type="button" id="w-save-subject" class="bb-btn bb-btn-primary">' +
      '<span class="material-symbols-outlined text-[18px]">check</span>Save subject</button>' +
      '</div></div></section>';

    return head + '<div id="subject-form"></div>';
  }

  function saveSubject() {
    form.sync(stepHost, draft);

    var error = form.validate(draft, {});
    if (error) {
      BB.ui.toast(error);
      return;
    }

    var subject = JSON.parse(JSON.stringify(draft));
    subject.marks = {};

    BB.store.update(function (data) {
      data.subjects.push(subject);
    });

    justSaved = subject.id;
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- step 4: done ---------- */

  function doneStep() {
    var data = state();
    var subjects = data.subjects;
    var start = BB.date.start();
    var startText = start
      ? start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0') + '-' + String(start.getDate()).padStart(2, '0')
      : 'Not set yet';

    return (
      '<section class="bb-card overflow-hidden">' +
      '<div class="p-6 sm:p-8 border-b border-border">' +
      '<span class="material-symbols-outlined text-[28px] text-success">task_alt</span>' +
      '<h1 class="text-headline-sm font-bold text-ink tracking-tight mt-2">Setup complete</h1>' +
      '<p class="text-body-sm text-muted mt-1">Everything is stored in this browser. You can change any of it later in Settings.</p>' +
      '</div>' +
      '<div class="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-3">' +
      '<div class="rounded-control border border-border-subtle bg-canvas p-3.5">' +
      '<div class="text-caption text-muted">Trimester</div>' +
      '<div class="text-label-md font-semibold text-ink">' + esc(data.term.label) + '</div></div>' +
      '<div class="rounded-control border border-border-subtle bg-canvas p-3.5">' +
      '<div class="text-caption text-muted">Week 1 starts</div>' +
      '<div class="text-label-md font-semibold text-ink num">' + esc(startText) + '</div></div>' +
      '<div class="rounded-control border border-border-subtle bg-canvas p-3.5">' +
      '<div class="text-caption text-muted">Teaching weeks</div>' +
      '<div class="text-label-md font-semibold text-ink num">' + esc(data.term.weeks) + '</div></div>' +
      '</div>' +
      '<div class="px-6 sm:px-8 pb-6 sm:pb-8">' +
      (subjects.length
        ? '<p class="text-body-sm text-muted">' + subjects.length + ' subject' + (subjects.length === 1 ? '' : 's') +
          ' ready: ' + subjects.map(function (subject) { return esc(subject.id); }).join(', ') + '</p>'
        : '<p class="text-body-sm text-muted">No subjects yet — the dashboard will show an empty state and a ' +
          '"Continue setup" card until you add one.</p>') +
      '</div>' +
      '<div class="px-6 sm:px-8 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3">' +
      '<div class="flex items-center gap-2">' +
      '<button type="button" id="w-skip" class="bb-btn bb-btn-ghost">Skip setup</button>' +
      '<button type="button" id="w-add-another" class="bb-btn bb-btn-ghost">' +
      '<span class="material-symbols-outlined text-[18px]">add</span>Add a subject</button></div>' +
      '<button type="button" id="w-open" class="bb-btn bb-btn-primary">Open dashboard' +
      '<span class="material-symbols-outlined text-[18px]">arrow_forward</span></button>' +
      '</div></section>'
    );
  }

  /* ---------- render ---------- */

  function render() {
    renderProgress();

    if (step === STEP_WELCOME) {
      stepHost.innerHTML = welcomeStep();
      return;
    }

    if (step === STEP_TERM) {
      stepHost.innerHTML = termStep();
      return;
    }

    if (step === STEP_SUBJECT) {
      stepHost.innerHTML = subjectStep();
      if (justSaved) {
        stepHost.innerHTML = savedPanel() + subjectList();
        return;
      }
      form.render(document.getElementById('subject-form'), draft, { deleteButton: false });
      stepHost.insertAdjacentHTML('beforeend', subjectList());
      return;
    }

    stepHost.innerHTML = doneStep();
  }

  /* 科目フォームの行追加・削除・色選択は共有モジュールに任せる。 */
  form.bind(stepHost, draft, function () {
    form.render(document.getElementById('subject-form'), draft, { deleteButton: false });
  });

  /* 学期ステップの入力は termDraft に写し、ヘッダー・フッターの表示も追随させる。 */
  stepHost.addEventListener('input', function (event) {
    if (step !== STEP_TERM) return;
    var id = event.target.id;
    if (id === 'w-label') termDraft.label = event.target.value;
    else if (id === 'w-start-date') termDraft.startDate = event.target.value;
    else if (id === 'w-weeks') termDraft.weeks = event.target.value;
    else if (id === 'w-name') termDraft.name = event.target.value;
    else return;

    if (id === 'w-label' || id === 'w-name') {
      BB.ui.refreshChrome({
        termLabel: termDraft.label.trim() || 'My Trimester',
        initials: BB.ui.initials(termDraft.name)
      });
    }
  });

  document.addEventListener('click', function (event) {
    if (event.target.closest('#w-start')) {
      go(STEP_TERM);
      return;
    }
    if (event.target.closest('#w-back')) {
      go(step === STEP_SUBJECT ? STEP_TERM : STEP_WELCOME);
      return;
    }
    if (event.target.closest('#w-next')) {
      saveTerm();
      return;
    }
    if (event.target.closest('#w-save-subject')) {
      saveSubject();
      return;
    }
    if (event.target.closest('#w-add-another')) {
      go(STEP_SUBJECT);
      return;
    }
    if (event.target.closest('#w-finish')) {
      go(STEP_DONE);
      return;
    }
    if (event.target.closest('#w-open')) {
      finish();
      return;
    }
    if (event.target.closest('#w-skip')) {
      skip();
    }
  });

  render();
})();
