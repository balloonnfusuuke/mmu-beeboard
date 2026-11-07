/* MMU BeeBoard — shared logic + dashboard rendering.
   科目データは data.js、状態は store.js 経由でのみ読む。 */
(function (global) {
  'use strict';

  var BB = global.BB;
  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var HOUR_START = 8;
  var HOUR_END = 18;
  var HOUR_HEIGHT = 52;
  var LOOKAHEAD_DAYS = 21;

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function minutesOf(hhmm) {
    var parts = hhmm.split(':');
    return Number(parts[0]) * 60 + Number(parts[1]);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function fmtDate(date) {
    return DAY_NAMES[date.getDay()] + ' ' + date.getDate() + ' ' + MONTHS[date.getMonth()];
  }

  function fmtDateFull(date) {
    return fmtDate(date) + ' ' + date.getFullYear();
  }

  function durationLabel(session) {
    var hours = (minutesOf(session.end) - minutesOf(session.start)) / 60;
    return hours === 1 ? '1 Hour' : hours + ' Hours';
  }

  function shortName(subject) {
    return subject.name.split(' ')[0];
  }

  function termStart() {
    return BB.date.parse(BB.store.get().term.startDate);
  }

  function isPreview(now) {
    return startOfDay(now).getTime() < termStart().getTime();
  }

  function currentWeek(now) {
    var state = BB.store.get();
    var week = BB.date.weekOf(now);
    if (!isFinite(week) || week < 1) return 1;
    return Math.min(week, state.term.weeks + 1);
  }

  /* ---------- pure logic ---------- */

  function nextClass(now) {
    var state = BB.store.get();
    var base = startOfDay(now);
    /* 学期開始前は開始日以降を探す。開始前の日付のコマを拾わない。 */
    var start = termStart();
    if (base.getTime() < start.getTime()) base = start;
    for (var offset = 0; offset < LOOKAHEAD_DAYS; offset++) {
      var day = addDays(base, offset);
      var weekday = day.getDay();
      var found = [];
      state.subjects.forEach(function (subject) {
        subject.sessions.forEach(function (session) {
          if (session.day !== weekday) return;
          var start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutesOf(session.start));
          if (start.getTime() > now.getTime()) {
            found.push({ subject: subject, session: session, start: start });
          }
        });
      });
      if (found.length) {
        found.sort(function (a, b) {
          return a.start - b.start;
        });
        return found[0];
      }
    }
    return null;
  }

  function countdown(target, now) {
    var mins = Math.round((target.getTime() - now.getTime()) / 60000);
    if (mins < 1) return 'Starting now';
    if (mins < 60) return 'Starts in ' + mins + ' min';
    var hours = Math.round(mins / 60);
    if (hours < 24) return 'Starts in ' + hours + ' h';
    return 'In ' + Math.round(hours / 24) + ' days';
  }

  function attendanceOf(subject) {
    var state = BB.store.get();
    var threshold = state.settings.attendanceThreshold;
    var record = subject.attendance || {};
    var held = record.held || 0;
    var attended = record.attended || 0;
    var absences = record.absences || 0;
    var total = subject.sessions.length * state.term.weeks;
    var rate = held > 0 ? (attended / held) * 100 : null;
    return {
      held: held,
      attended: attended,
      absences: absences,
      total: total,
      rate: rate,
      threshold: threshold,
      allowed: Math.max(0, Math.floor(total * (1 - threshold / 100)) - absences),
      atRisk: rate !== null && rate < threshold
    };
  }

  function securedOf(subject) {
    var secured = 0;
    var possible = 0;
    var entered = 0;
    subject.assessments.forEach(function (assessment) {
      possible += assessment.weight;
      var score = subject.marks ? subject.marks[assessment.id] : undefined;
      if (typeof score === 'number' && !isNaN(score)) {
        secured += (score / assessment.max) * assessment.weight;
        entered += 1;
      }
    });
    return { secured: secured, possible: possible, entered: entered, published: subject.assessments.length > 0 };
  }

  function deadlineItems() {
    var state = BB.store.get();
    var items = [];
    state.subjects.forEach(function (subject) {
      subject.assessments.forEach(function (assessment) {
        items.push({ subject: subject, assessment: assessment, week: assessment.week });
      });
    });
    /* 手動追加の締切は assessment と同じ形に均して、既存の描画にそのまま乗せる。 */
    (state.customDeadlines || []).forEach(function (entry) {
      var subject = null;
      state.subjects.forEach(function (candidate) {
        if (candidate.id === entry.subjectId) subject = candidate;
      });
      if (!subject) return;
      items.push({
        subject: subject,
        week: entry.week,
        custom: entry,
        assessment: {
          id: entry.id,
          name: entry.name,
          weight: entry.weight || 0,
          kind: 'custom',
          dueLabel: entry.note || '',
          custom: true
        }
      });
    });
    items.sort(function (a, b) {
      return a.week - b.week;
    });
    return items;
  }

  function nextAssessmentOf(subject, week) {
    var upcoming = subject.assessments.filter(function (assessment) {
      return assessment.week >= week;
    });
    return upcoming.length ? upcoming[0] : null;
  }

  /* 学期開始前は weekOf が 0 以下になるため、表示用に Week 1 へ丸める。 */
  function weekOfClamped(when) {
    var week = BB.date.weekOf(when);
    return !isFinite(week) || week < 1 ? 1 : week;
  }

  function studyMinutesThisWeek(now) {
    var week = currentWeek(now);
    return BB.store.get().studySessions.reduce(function (sum, session) {
      var when = new Date(session.startedAt);
      return weekOfClamped(when) === week ? sum + (session.minutes || 0) : sum;
    }, 0);
  }

  function hoursLabel(minutes) {
    return Math.floor(minutes / 60) + 'h ' + pad2(minutes % 60) + 'm';
  }

  /* ---------- rendering ---------- */

  function bindHeader(state, now, preview) {
    var weekText = preview
      ? 'Starts ' + fmtDate(termStart())
      : 'Week ' + currentWeek(now) + ' of ' + state.term.weeks;
    var binds = {
      'student.name': state.student.name,
      'student.initials': state.student.initials,
      'student.programme': state.student.programme + ' • Year ' + state.student.year,
      'student.id': state.student.studentId,
      'student.idSuffix': state.student.studentId ? ' • Student ID: ' + state.student.studentId : '',
      'term.label': state.term.label,
      'term.week': weekText,
      'settings.cgpaTarget': state.settings.cgpaTarget.toFixed(2) + ' CGPA',
      'settings.language': String(state.settings.language || 'en').toUpperCase(),
      'cgpa.value': '—',
      'topics.week': 'Week ' + currentWeek(now) + ' of ' + state.term.weeks,
      'timetable.subtitle':
        state.term.label + ' • ' + state.term.weeks + ' teaching weeks • Click any class to open its Grade Simulator'
    };
    $$('[data-bind]').forEach(function (node) {
      var key = node.getAttribute('data-bind');
      if (Object.prototype.hasOwnProperty.call(binds, key)) node.textContent = binds[key];
    });
  }

  function renderPreviewBanner(preview, now) {
    var host = $('#preview-banner');
    if (!host) return;
    if (!preview) {
      host.innerHTML = '';
      return;
    }
    var start = termStart();
    var days = Math.round((startOfDay(start).getTime() - startOfDay(now).getTime()) / 86400000);
    host.innerHTML =
      '<div class="flex items-start sm:items-center gap-3 rounded-card border border-primary/25 bg-surface-sunken px-4 py-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">event_upcoming</span>' +
      '<div class="text-body-sm text-body">' +
      '<span class="font-semibold text-ink">Week 1 starts ' + fmtDateFull(start) + '</span>' +
      ' — showing a preview of the trimester. ' +
      '<span class="text-muted">' + (days === 1 ? 'Tomorrow' : 'In ' + days + ' days') + ' · no sessions held yet.</span>' +
      '</div></div>';
  }

  function renderNextClass(next, now, preview) {
    var host = $('#next-class');
    if (!host) return;
    if (!next) {
      host.innerHTML =
        '<div class="rounded-card border border-border bg-surface p-6 text-body-sm text-muted">' +
        'No upcoming class found in the next ' + LOOKAHEAD_DAYS + ' days.</div>';
      return;
    }
    var subject = next.subject;
    var session = next.session;
    var chip = BB.color.chip(subject.color);
    var badge = preview ? 'Term starts ' + fmtDate(termStart()) : countdown(next.start, now);
    var dayText = fmtDate(next.start) + (isSameDay(next.start, now) ? ' • Today' : '');

    host.innerHTML =
      '<div class="relative bg-surface border border-border rounded-card p-5 sm:p-6 shadow-rest hover:shadow-hover transition-shadow overflow-hidden">' +
      '<div class="absolute left-0 top-0 bottom-0 w-2" style="background:' + subject.color + '"></div>' +
      '<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-2">' +
      '<div class="space-y-1.5">' +
      '<div class="flex flex-wrap items-center gap-2">' +
      '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-caption font-semibold uppercase tracking-wider bg-primary text-on-primary">' +
      '<span class="w-1.5 h-1.5 rounded-full bg-white"></span>' + badge + '</span>' +
      '<span class="inline-flex items-center px-2 py-0.5 rounded text-caption font-medium" style="background:' +
      chip.background + ';color:' + chip.color + ';border:1px solid ' + chip.borderColor + '">' + session.type + '</span>' +
      '<span class="text-muted text-caption">' + dayText + '</span>' +
      '</div>' +
      '<h1 class="text-headline-sm font-bold text-ink tracking-tight">' + subject.id + ' ' + subject.name + '</h1>' +
      '<div class="flex flex-wrap items-center gap-4 text-muted text-body-sm pt-0.5">' +
      '<div class="flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-primary">schedule</span>' +
      '<span class="font-semibold text-ink num">' + session.start + ' – ' + session.end + '</span>' +
      '<span class="text-placeholder">(' + durationLabel(session) + ')</span></div>' +
      '<div class="flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-primary">room</span>' +
      '<span>Room <strong class="text-ink font-semibold">' + session.room + '</strong></span></div>' +
      (subject.lecturer ? '<div class="flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-muted">person</span>' +
      '<span>' + subject.lecturer + '</span></div>' : '') +
      '</div></div>' +
      '<div class="flex items-center gap-3 shrink-0 pt-2 md:pt-0">' +
      '<a href="simulator.html?subject=' + subject.id + '" class="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-primary text-on-primary text-label-md font-semibold hover:bg-primary-hover transition-colors shadow-rest">' +
      '<span class="material-symbols-outlined text-[18px]">calculate</span><span>Open Course Simulator</span></a>' +
      '<a href="attendance.html" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-control border border-border bg-surface text-ink hover:bg-surface-subtle text-label-md font-medium transition-colors">' +
      '<span class="material-symbols-outlined text-[18px] text-muted">rule</span><span>Attendance</span></a>' +
      '</div></div></div>';
  }

  function renderLegend(state) {
    var host = $('#legend');
    if (!host) return;
    host.innerHTML = state.subjects
      .map(function (subject) {
        return (
          '<div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm" style="background:' +
          subject.color + '"></span><span class="text-muted">' + subject.id + ' ' + shortName(subject) + '</span></div>'
        );
      })
      .join('');
  }

  function renderTimetable(state, now) {
    var host = $('#timetable');
    if (!host) return;
    var height = (HOUR_END - HOUR_START) * HOUR_HEIGHT;
    host.style.setProperty('--tt-hour', HOUR_HEIGHT + 'px');

    var head =
      '<div class="tt-head"><div class="tt-corner">Time</div>' +
      [1, 2, 3, 4, 5]
        .map(function (day) {
          var today = now.getDay() === day;
          return '<div class="tt-day' + (today ? ' is-today' : '') + '">' + DAY_NAMES[day] + (today ? ' (Today)' : '') + '</div>';
        })
        .join('') +
      '</div>';

    var times = '';
    for (var hour = HOUR_START; hour < HOUR_END; hour++) {
      var top = (hour - HOUR_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2;
      times += '<span style="top:' + top + 'px">' + pad2(hour) + ':00</span>';
    }

    var columns = [1, 2, 3, 4, 5]
      .map(function (day) {
        var blocks = [];
        state.subjects.forEach(function (subject) {
          subject.sessions.forEach(function (session) {
            if (session.day !== day) return;
            var startMin = minutesOf(session.start);
            var endMin = minutesOf(session.end);
            var blockTop = ((startMin - HOUR_START * 60) / 60) * HOUR_HEIGHT;
            var blockHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT;
            blocks.push(
              '<a class="tt-block" href="simulator.html?subject=' + subject.id + '"' +
                ' style="top:' + blockTop + 'px;height:' + (blockHeight - 3) + 'px;background:' + subject.color + '"' +
                ' title="' + subject.id + ' ' + session.type + ' ' + session.start + '–' + session.end + ' · ' + session.room + '">' +
                '<span class="tt-block-code">' + subject.id + '</span>' +
                '<span class="tt-block-meta">' + session.type + ' · ' + session.room + '</span>' +
              '</a>'
            );
          });
        });
        return '<div class="tt-col" style="height:' + height + 'px">' + blocks.join('') + '</div>';
      })
      .join('');

    host.innerHTML =
      head +
      '<div class="tt-body"><div class="tt-times" style="height:' + height + 'px">' + times + '</div>' + columns + '</div>';
  }

  function renderClassDetail(next, state, now) {
    var host = $('#class-detail');
    if (!host) return;
    if (!next) {
      host.innerHTML = '';
      return;
    }
    var subject = next.subject;
    var session = next.session;
    var attendance = attendanceOf(subject);
    var secured = securedOf(subject);
    var week = currentWeek(now);
    var upcoming = nextAssessmentOf(subject, week);

    var attendanceValue = attendance.rate === null ? '—' : Math.round(attendance.rate) + '%';
    var attendanceNote = attendance.rate === null ? 'no sessions yet' : attendance.absences + ' absences';
    var securedValue = secured.entered > 0 ? secured.secured.toFixed(1) + ' / ' + secured.possible : '—';
    var securedNote = secured.published ? 'coursework pending' : 'not published yet';
    var assessmentValue = upcoming ? upcoming.name : 'not published yet';
    var assessmentNote = upcoming ? 'Week ' + upcoming.week : '';

    host.innerHTML =
      '<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-border">' +
      '<div class="flex items-center gap-3">' +
      '<span class="w-3.5 h-3.5 rounded-full" style="background:' + subject.color + ';box-shadow:0 0 0 4px ' + BB.color.alpha(subject.color, 0.2) + '"></span>' +
      '<div><h3 class="text-title-md font-bold text-ink">Next class: ' + subject.id + ' ' + subject.name +
      ' <span class="font-normal text-muted">(' + session.type + ' • ' + DAY_NAMES[session.day] + ' ' + session.start + '–' + session.end + ')</span></h3>' +
      '<p class="text-caption text-muted">' + subject.faculty + (subject.lecturer ? ' • Lecturer: ' + subject.lecturer : '') + '</p></div>' +
      '</div>' +
      '<a href="simulator.html?subject=' + subject.id + '" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-control bg-surface border border-border hover:border-primary/40 text-caption font-semibold text-primary transition-colors shadow-rest">' +
      '<span>Open Course Simulator</span><span class="material-symbols-outlined text-[15px]">arrow_forward</span></a>' +
      '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">' +
      detailPill('menu_book', subject.color, "This week's topic", subject.topics.title, '') +
      detailPill('verified', attendance.atRisk ? 'var(--bb-alert)' : subject.color, 'Attendance', attendanceValue, attendanceNote) +
      detailPill('grade', subject.color, 'Secured marks', securedValue, securedNote) +
      detailPill('assignment_late', 'var(--bb-text-muted)', 'Next assessment', assessmentValue, assessmentNote) +
      '</div>';
  }

  function detailPill(icon, color, label, value, note) {
    return (
      '<div class="bg-surface border border-border rounded-control p-3.5 flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] mt-0.5" style="color:' + color + '">' + icon + '</span>' +
      '<div><div class="text-caption text-muted font-medium">' + label + '</div>' +
      '<div class="text-label-md font-semibold text-ink num">' + value +
      (note ? ' <span class="text-caption font-normal text-muted">(' + note + ')</span>' : '') +
      '</div></div></div>'
    );
  }

  function renderTopics(state) {
    var host = $('#topics');
    if (!host) return;
    host.innerHTML = state.subjects
      .map(function (subject) {
        var chip = BB.color.chip(subject.color);
        return (
          '<a href="simulator.html?subject=' + subject.id + '" class="group bg-surface border border-border hover:border-primary/40 rounded-card p-4 shadow-rest hover:shadow-hover transition-all">' +
          '<div class="flex items-center justify-between pb-2">' +
          '<span class="px-2 py-0.5 rounded text-[11px] font-bold" style="background:' + chip.background + ';color:' + chip.color + ';border:1px solid ' + chip.borderColor + '">' + subject.id + '</span>' +
          '<span class="text-caption text-muted">' + subject.topics.label + '</span>' +
          '</div>' +
          '<div class="text-caption text-muted pt-1">' + shortName(subject) + '</div>' +
          '<div class="text-body-md font-bold text-ink truncate group-hover:text-primary transition-colors">' + subject.topics.title + '</div>' +
          '<div class="mt-2.5 pt-2 border-t border-border-subtle flex items-center justify-between text-caption text-muted">' +
          '<span>' + subject.topics.resource + '</span>' +
          '<span class="material-symbols-outlined text-[16px] text-primary group-hover:translate-x-1 transition-transform">chevron_right</span>' +
          '</div></a>'
        );
      })
      .join('');
  }

  function renderSummaries(state, now, next) {
    var host = $('#summaries');
    if (!host) return;
    host.innerHTML = deadlinesCard(state, now) + attendanceCard(state) + studyLogCard(state, now, next);
  }

  function cardShell(href, title, icon, iconColor, body, footer) {
    return (
      '<a href="' + href + '" class="group bg-surface border border-border hover:border-primary/40 rounded-card p-5 shadow-rest hover:shadow-hover transition-all flex flex-col justify-between">' +
      '<div><div class="flex items-center justify-between pb-3 border-b border-border-subtle">' +
      '<div class="flex items-center gap-2">' +
      '<span class="material-symbols-outlined text-[20px]" style="color:' + iconColor + '">' + icon + '</span>' +
      '<h3 class="text-title-md font-bold text-ink group-hover:text-primary transition-colors">' + title + '</h3></div>' +
      '<div class="flex items-center gap-1 text-muted group-hover:text-primary transition-colors">' +
      '<span class="text-caption hidden sm:inline opacity-0 group-hover:opacity-100 transition-opacity">Details</span>' +
      '<span class="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">chevron_right</span>' +
      '</div></div>' + body + '</div>' + footer + '</a>'
    );
  }

  function deadlinesCard(state, now) {
    var items = deadlineItems();
    var week = currentWeek(now);
    var upcoming = items.filter(function (item) {
      return item.week >= week;
    });
    var nextItem = upcoming[0] || items[items.length - 1];
    var dots = state.subjects
      .map(function (subject) {
        return '<span class="w-2.5 h-2.5 rounded-full" style="background:' + subject.color + '" title="' + subject.id + '"></span>';
      })
      .join('');

    var body =
      '<div class="py-3 space-y-1.5">' +
      '<div class="text-caption uppercase tracking-wider text-muted">Next Upcoming</div>' +
      '<div class="text-body-lg font-bold text-ink flex items-center gap-2">' +
      '<span>' + (nextItem ? nextItem.subject.id + ' ' + nextItem.assessment.name : '—') + '</span>' +
      (nextItem ? '<span class="text-caption font-semibold px-2 py-0.5 rounded bg-surface-sunken text-primary">Week ' + nextItem.week + '</span>' : '') +
      '</div>' +
      '<p class="text-body-sm text-muted">' + items.length + ' assessments scheduled this trimester</p>' +
      '</div>';

    var footer =
      '<div class="pt-3 border-t border-border-subtle flex items-center justify-between text-caption text-muted">' +
      '<div class="flex items-center gap-1.5">' + dots + '<span class="pl-1">All modules tracked</span></div>' +
      '<span class="font-semibold text-primary group-hover:underline flex items-center gap-0.5">' +
      '<span>View ' + items.length + ' items</span>' +
      '<span class="material-symbols-outlined text-[14px]">arrow_forward</span></span></div>';

    return cardShell('deadlines.html', 'Deadlines', 'assignment_late', 'var(--bb-primary)', body, footer);
  }

  function attendanceCard(state) {
    var totals = { held: 0, attended: 0 };
    var rows = state.subjects
      .map(function (subject) {
        var attendance = attendanceOf(subject);
        totals.held += attendance.held;
        totals.attended += attendance.attended;
        var value = attendance.rate === null ? '—' : Math.round(attendance.rate) + '%';
        var width = attendance.rate === null ? 0 : Math.max(0, Math.min(100, attendance.rate));
        return (
          '<div class="flex items-center justify-between text-[11px] text-muted">' +
          '<span>' + subject.id + ' ' + shortName(subject) + '</span>' +
          '<span class="font-semibold num" style="color:' + subject.color + '">' + value + '</span></div>' +
          '<div class="w-full bg-border h-1.5 rounded-full overflow-hidden">' +
          '<div class="h-full rounded-full" style="width:' + width + '%;background:' + subject.color + '"></div></div>'
        );
      })
      .join('');

    var overallRate = totals.held > 0 ? (totals.attended / totals.held) * 100 : null;
    var statusPill = overallRate === null
      ? '<span class="px-2 py-0.5 rounded text-caption font-semibold bg-surface-subtle text-muted border border-border">No sessions yet</span>'
      : overallRate >= state.settings.attendanceThreshold
        ? '<span class="px-2 py-0.5 rounded text-caption font-semibold bb-status-ok">Eligible (≥' + state.settings.attendanceThreshold + '% req)</span>'
        : '<span class="px-2 py-0.5 rounded text-caption font-semibold bb-status-alert">Below ' + state.settings.attendanceThreshold + '%</span>';

    var body =
      '<div class="py-3 space-y-2">' +
      '<div class="flex items-center justify-between">' +
      '<span class="text-caption uppercase tracking-wider text-muted">Overall Status</span>' + statusPill + '</div>' +
      '<div class="text-headline-sm font-extrabold text-ink num">' +
      (overallRate === null ? '—' : Math.round(overallRate) + '%') +
      ' <span class="text-body-sm font-normal text-muted">(' + totals.held + ' sessions held)</span></div>' +
      '<div class="space-y-1.5 pt-1">' + rows + '</div>' +
      '</div>';

    var footer =
      '<div class="pt-3 border-t border-border-subtle text-caption text-muted flex items-center justify-between">' +
      '<span>Barred threshold: &lt;' + state.settings.attendanceThreshold + '%</span>' +
      '<span class="font-semibold text-primary group-hover:underline flex items-center gap-0.5">' +
      '<span>Attendance detail</span><span class="material-symbols-outlined text-[14px]">arrow_forward</span></span></div>';

    return cardShell('attendance.html', 'Attendance', 'rule', 'var(--bb-success)', body, footer);
  }

  function studyLogCard(state, now, next) {
    var minutes = studyMinutesThisWeek(now);
    var target = state.settings.weeklyStudyTarget;
    var targetSubject = next ? next.subject : state.subjects[0];

    var body =
      '<div class="py-3 space-y-2">' +
      '<div class="text-caption uppercase tracking-wider text-muted">Current Week Logged</div>' +
      '<div class="text-headline-sm font-extrabold text-ink num">' + hoursLabel(minutes) +
      ' <span class="text-body-sm font-normal text-muted">/ ' + target + 'h Target</span></div>' +
      '<p class="text-body-sm text-muted">' +
      (minutes === 0 ? 'Week ' + currentWeek(now) + ' just begun. Ready for your first focused study session?' : 'Keep the streak going.') +
      '</p></div>';

    var footer =
      '<div class="pt-3 border-t border-border-subtle space-y-2.5">' +
      '<div class="flex items-center justify-between text-caption text-muted">' +
      '<span>Target subject:</span><span class="font-semibold text-primary">' + targetSubject.id + ' ' + shortName(targetSubject) + '</span></div>' +
      '<span class="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-control bg-primary text-on-primary text-label-md font-semibold hover:bg-primary-hover transition-colors shadow-rest">' +
      '<span class="material-symbols-outlined text-[18px]">play_arrow</span><span>Start timer</span></span></div>';

    return cardShell('studylog.html', 'Study Log', 'menu_book', 'var(--bb-primary)', body, footer);
  }

  function renderGrades(state) {
    var host = $('#grades');
    if (!host) return;
    host.innerHTML = state.subjects
      .map(function (subject) {
        var secured = securedOf(subject);
        var chip = BB.color.chip(subject.color);
        var right;

        if (!secured.published) {
          right =
            '<div class="text-right"><span class="text-body-sm text-muted italic">Assessment structure not published yet.</span></div>' +
            '<div class="flex items-center gap-3"><span class="text-label-md font-semibold text-muted">Secured —</span>' +
            '<span class="material-symbols-outlined text-[22px] text-muted group-hover:text-primary group-hover:translate-x-1 transition-all">chevron_right</span></div>';
        } else {
          var pct = secured.possible ? (secured.secured / secured.possible) * 100 : 0;
          right =
            '<div class="w-40 sm:w-56 space-y-1">' +
            '<div class="flex justify-between text-caption text-muted"><span>Coursework Secured</span>' +
            '<span class="font-bold text-ink num">' + secured.secured.toFixed(1) + ' / ' + secured.possible + ' Marks</span></div>' +
            '<div class="w-full bg-border h-2 rounded-full overflow-hidden">' +
            '<div class="h-full rounded-full" style="width:' + pct + '%;background:' + subject.color + '"></div></div></div>' +
            '<div class="flex items-center gap-2">' +
            '<span class="px-2 py-0.5 rounded text-caption font-medium" style="background:' + chip.background + ';color:' + chip.color + '">Simulator</span>' +
            '<span class="material-symbols-outlined text-[22px] text-muted group-hover:text-primary group-hover:translate-x-1 transition-all">chevron_right</span></div>';
        }

        return (
          '<a href="simulator.html?subject=' + subject.id + '" class="group p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-canvas transition-colors">' +
          '<div class="flex items-center gap-3">' +
          '<span class="px-3 py-1 rounded-md text-caption font-bold text-white" style="background:' + subject.color + '">' + subject.id + '</span>' +
          '<div><h3 class="text-title-md font-bold text-ink">' + subject.name + '</h3>' +
          '<p class="text-caption text-muted">' + subject.credits + ' Credit Hours' + (subject.lecturer ? ' • ' + subject.lecturer : '') + '</p></div></div>' +
          '<div class="flex items-center gap-6">' + right + '</div></a>'
        );
      })
      .join('');
  }

  function init() {
    var state = BB.store.get();
    var now = new Date();
    var preview = isPreview(now);
    var next = nextClass(now);

    bindHeader(state, now, preview);
    renderPreviewBanner(preview, now);
    renderNextClass(next, now, preview);
    renderLegend(state);
    renderTimetable(state, now);
    renderClassDetail(next, state, now);
    renderTopics(state);
    renderSummaries(state, now, next);
    renderGrades(state);
  }

  /* ---------- shared page shell ---------- */

  function header(opts) {
    var state = BB.store.get();
    var now = new Date();
    var weekText = isPreview(now)
      ? 'Starts ' + fmtDate(termStart())
      : 'Week ' + currentWeek(now) + ' of ' + state.term.weeks;
    return (
      '<header class="sticky top-0 z-30 w-full bg-surface border-b border-border shadow-rest">' +
      '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">' +
      '<div class="flex items-center gap-3 min-w-0">' +
      '<a href="index.html" class="p-2 -ml-2 rounded-control text-muted hover:text-primary hover:bg-surface-subtle transition-colors" aria-label="Back to dashboard" title="Back to dashboard">' +
      '<span class="material-symbols-outlined text-[20px]">arrow_back</span></a>' +
      '<a href="index.html" class="flex items-center gap-2.5 min-w-0">' +
      '<img src="assets/logo.svg" alt="" class="w-8 h-8 rounded-lg flex-shrink-0">' +
      '<span class="flex flex-col leading-none min-w-0">' +
      '<span class="text-title-md text-primary tracking-tight whitespace-nowrap"><span class="font-bold">MMU</span> <span class="font-normal">BeeBoard</span></span>' +
      '<span class="text-[11px] text-muted font-medium mt-0.5 whitespace-nowrap">' + (opts.title || 'Personal study dashboard') + '</span>' +
      '</span></a>' +
      '<div class="hidden lg:block h-4 w-px bg-border"></div>' +
      '<div class="hidden lg:flex items-center gap-2 text-muted text-label-md">' +
      '<span class="material-symbols-outlined text-[18px] text-primary">calendar_today</span>' +
      '<span>' + state.term.label + '</span><span class="text-border">•</span>' +
      '<span class="font-medium text-ink">' + weekText + '</span></div>' +
      '</div>' +
      '<div class="flex items-center gap-3">' +
      '<span class="w-8 h-8 rounded-full bg-primary text-on-primary text-label-sm font-bold flex items-center justify-center flex-shrink-0">' + state.student.initials + '</span>' +
      '<a href="settings.html" class="p-2 text-muted hover:text-primary hover:bg-surface-subtle rounded-control border border-transparent hover:border-border transition-colors" aria-label="Settings" title="Settings">' +
      '<span class="material-symbols-outlined text-[20px]">settings</span></a>' +
      '</div></div></header>'
    );
  }

  function pageHead(opts) {
    return (
      '<div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">' +
      '<div><h1 class="text-headline-md font-bold text-ink tracking-tight">' + opts.title + '</h1>' +
      (opts.subtitle ? '<p class="text-body-md text-muted mt-1">' + opts.subtitle + '</p>' : '') +
      '</div>' +
      (opts.actions ? '<div class="flex items-center gap-2">' + opts.actions + '</div>' : '') +
      '</div>'
    );
  }

  function footer() {
    var state = BB.store.get();
    return (
      '<footer class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 flex flex-col sm:flex-row items-center justify-between text-caption text-muted gap-2 border-t border-border">' +
      '<div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-success"></span>' +
      '<span>MMU BeeBoard — a personal study dashboard. Not an official MMU system.</span></div>' +
      '<div class="num">' + state.term.label +
      (state.student.studentId ? ' • Student ID: ' + state.student.studentId : '') + '</div></footer>'
    );
  }

  function mount(opts) {
    var head = document.getElementById('app-header');
    if (head) head.outerHTML = header(opts);
    var foot = document.getElementById('app-footer');
    if (foot) foot.outerHTML = footer();
    var page = document.getElementById('page-head');
    if (page && opts.head) page.innerHTML = pageHead(opts.head);
  }

  function chip(hex, label) {
    var style = BB.color.chip(hex);
    return (
      '<span class="bb-chip" style="background:' + style.background + ';color:' + style.color +
      ';border:1px solid ' + style.borderColor + '">' + label + '</span>'
    );
  }

  function solidChip(hex, label) {
    return '<span class="bb-chip" style="background:' + hex + ';color:#fff">' + label + '</span>';
  }

  function toast(message) {
    var node = document.createElement('div');
    node.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-control bg-ink text-canvas text-label-md shadow-float';
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(function () {
      node.remove();
    }, 1800);
  }

  function markAttendance(subjectId, status) {
    BB.store.update(function (state) {
      var subject = null;
      state.subjects.forEach(function (item) {
        if (item.id === subjectId) subject = item;
      });
      if (!subject) return;
      if (!subject.attendance) subject.attendance = { held: 0, attended: 0, absences: 0, log: [] };
      subject.attendance.held += 1;
      if (status === 'present') subject.attendance.attended += 1;
      else subject.attendance.absences += 1;
      subject.attendance.log = subject.attendance.log || [];
      subject.attendance.log.push({ date: new Date().toISOString().slice(0, 10), status: status });
    });
  }

  BB.ui = {
    header: header,
    footer: footer,
    pageHead: pageHead,
    mount: mount,
    chip: chip,
    solidChip: solidChip,
    toast: toast
  };

  BB.attendance = { mark: markAttendance };

  /* Stitch のインラインタイマーをここへ吸収。ページ側は UI だけを持つ。 */
  var timerState = { startedAt: null, handle: null, tick: null };
  BB.timer = {
    isRunning: function () {
      return timerState.startedAt !== null;
    },
    elapsed: function () {
      return timerState.startedAt === null ? 0 : Math.floor((Date.now() - timerState.startedAt) / 1000);
    },
    start: function (onTick) {
      if (timerState.startedAt !== null) return;
      timerState.startedAt = Date.now();
      timerState.tick = onTick;
      timerState.handle = setInterval(function () {
        if (timerState.tick) timerState.tick(BB.timer.elapsed());
      }, 1000);
      if (onTick) onTick(0);
    },
    stop: function () {
      if (timerState.startedAt === null) return 0;
      var seconds = BB.timer.elapsed();
      clearInterval(timerState.handle);
      timerState.startedAt = null;
      timerState.handle = null;
      timerState.tick = null;
      return seconds;
    }
  };

  BB.dash = {
    nextClass: nextClass,
    attendanceOf: attendanceOf,
    securedOf: securedOf,
    deadlineItems: deadlineItems,
    currentWeek: currentWeek,
    weekOf: weekOfClamped,
    isPreview: isPreview,
    countBlocks: function () {
      return BB.store.get().subjects.reduce(function (total, subject) {
        return total + subject.sessions.length;
      }, 0);
    }
  };

  if (typeof document !== 'undefined' && document.body && document.body.dataset.page === 'dashboard') init();
})(window);
