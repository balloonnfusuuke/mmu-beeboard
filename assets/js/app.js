/* MMU BeeBoard — shared logic + dashboard rendering.
   科目データは data.js、状態は store.js 経由でのみ読む。 */
(function (global) {
  'use strict';

  var BB = global.BB;
  var t = BB.i18n.t;
  var tn = BB.i18n.tn;
  var DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
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

  function dayName(index) {
    return t('day.' + DAY_KEYS[index]);
  }

  function monthName(index) {
    return t('month.' + MONTH_KEYS[index]);
  }

  function fmtDate(date) {
    return t('date.short', { day: dayName(date.getDay()), d: date.getDate(), mon: monthName(date.getMonth()) });
  }

  /* 'YYYY-MM-DDTHH:mm' → 'Mon 16 Nov 2026, 23:59'。時刻が無ければ日付だけ。 */
  function fmtDateTime(value) {
    var raw = String(value || '');
    var day = BB.date.parse(raw.slice(0, 10));
    if (!day) return '';
    var time = raw.length > 10 ? raw.slice(11, 16) : '';
    return fmtDateFull(day) + (time ? ', ' + time : '');
  }

  function fmtDateFull(date) {
    return t('date.shortFull', {
      day: dayName(date.getDay()),
      d: date.getDate(),
      mon: monthName(date.getMonth()),
      year: date.getFullYear()
    });
  }

  /* 'YYYY-MM-DD'（日時付きでも可）を言語に追随した表示にする。保存値は ISO のまま。
     日付を保存時に整形すると、言語を切り替えても片方の言語のまま残る。 */
  function fmtIsoDate(value) {
    var raw = String(value === undefined || value === null ? '' : value);
    var day = BB.date.parse(raw.slice(0, 10));
    return day ? fmtDate(day) : raw;
  }

  function durationLabel(session) {
    var hours = (minutesOf(session.end) - minutesOf(session.start)) / 60;
    return hours === 1 ? t('duration.hour') : t('duration.hours', { n: hours });
  }

  /* 科目名は切り詰めずに出す。入りきらない幅のときだけ CSS で省略し、
     全文は title で読めるようにする（先頭語だけに化けるのを避ける）。 */
  function subjectName(subject) {
    return escHtml(subject.name);
  }

  function termStart() {
    return BB.date.start();
  }

  /* 開始日が未設定なら「プレビュー」ではなく通常表示にする。 */
  function isPreview(now) {
    var start = termStart();
    if (!start) return false;
    return startOfDay(now).getTime() < start.getTime();
  }

  function currentWeek(now) {
    var state = BB.store.get();
    var weeks = state.term.weeks || 14;
    var week = BB.date.weekOf(now);
    if (!isFinite(week) || week < 1) return 1;
    return Math.min(week, weeks + 1);
  }

  /* 表示中の週の各曜日（1=月 … 5=金）の実日付。休講・振替の照合と、出席ページの
     日付欄の初期値が同じ基準を使うように、ここへ集約する。
     学期開始日が未設定だと weekRange は null を返すが、そこで諦めると
     グリッドだけが休講・振替を落とす（凡例には「休講」が出たまま）ので、
     今日を含む月曜はじまりの週へフォールバックする。 */
  function weekDates(now) {
    var range = BB.date.weekRange(currentWeek(now));
    var monday;
    if (range) {
      monday = range.start;
    } else {
      var today = startOfDay(now);
      monday = addDays(today, -((today.getDay() + 6) % 7));
    }
    var dates = {};
    for (var day = 1; day <= 5; day++) {
      dates[day] = isoDay(addDays(monday, day - 1));
    }
    return dates;
  }

  /* ---------- pure logic ---------- */

  function nextClass(now) {
    var state = BB.store.get();
    var base = startOfDay(now);
    /* 学期開始前は開始日以降を探す。開始前の日付のコマを拾わない。開始日未設定なら今日から。 */
    var start = termStart();
    if (start && base.getTime() < start.getTime()) base = start;
    for (var offset = 0; offset < LOOKAHEAD_DAYS; offset++) {
      var day = addDays(base, offset);
      var weekday = day.getDay();
      var dayIso = isoDay(day);
      var found = [];
      state.subjects.forEach(function (subject) {
        subject.sessions.forEach(function (session, index) {
          if (session.day !== weekday) return;
          /* 休講にした回は Next Class に出さない。 */
          if (overrideFor(state, subject.id, index, dayIso)) return;
          var start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutesOf(session.start));
          if (start.getTime() > now.getTime()) {
            found.push({ subject: subject, session: session, start: start });
          }
        });
      });
      /* 振替の臨時セッションも候補に入れる。 */
      extraSessions(state).forEach(function (extra) {
        if (extra.date !== dayIso) return;
        var start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutesOf(extra.start));
        if (start.getTime() > now.getTime()) {
          found.push({ subject: extra.subject, session: extra, start: start, transfer: true });
        }
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

  /* 日数は「日付の差」で数える（11/7 → 11/10 は 3日）。時刻で丸めない。
     プレビューのバナーと締切ページの「あとn日」も同じ定義に揃えてある。 */
  function calendarDays(from, to) {
    return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
  }

  function countdown(target, now) {
    var mins = Math.round((target.getTime() - now.getTime()) / 60000);
    if (mins < 1) return t('countdown.now');
    if (mins < 60) return t('countdown.min', { n: mins });
    var hours = Math.round(mins / 60);
    if (hours < 24) return t('countdown.hour', { n: hours });
    var days = calendarDays(now, target);
    return t('countdown.days', { n: days < 1 ? 1 : days });
  }

  /* ---------- 休講・振替 ---------- */

  function overridesOf(state) {
    return state.sessionOverrides || [];
  }

  /* その科目・コマ・日付に休講（振替を含む）の記録があるか。 */
  function overrideFor(state, subjectId, sessionIndex, date) {
    var found = null;
    overridesOf(state).forEach(function (entry) {
      if (entry.subjectId !== subjectId) return;
      if (entry.sessionIndex !== sessionIndex) return;
      if (entry.date !== date) return;
      found = entry;
    });
    return found;
  }

  /* 休講にした回数。総回数から差し引く。 */
  function noClassCount(state, subjectId) {
    return overridesOf(state).filter(function (entry) {
      return entry.subjectId === subjectId;
    }).length;
  }

  /* 振替で作られた臨時セッション。定例コマの定義は書き換えない。 */
  function extraSessions(state) {
    var list = [];
    overridesOf(state).forEach(function (entry) {
      if (entry.kind !== 'transfer' || !entry.target) return;
      var subject = null;
      state.subjects.forEach(function (candidate) {
        if (candidate.id === entry.subjectId) subject = candidate;
      });
      if (!subject) return;
      var day = BB.date.parse(entry.target.date);
      if (!day) return;
      list.push({
        subject: subject,
        overrideId: entry.id,
        sourceDate: entry.date,
        date: entry.target.date,
        day: day.getDay(),
        start: entry.target.start,
        end: entry.target.end,
        room: entry.target.room || '',
        type: t('att.transferBadge')
      });
    });
    return list;
  }

  function attendanceOf(subject) {
    var state = BB.store.get();
    var threshold = state.settings.attendanceThreshold;
    var record = subject.attendance || {};
    var held = record.held || 0;
    var attended = record.attended || 0;
    var absences = record.absences || 0;
    /* 休講にした回は総回数から外す。分母が減るので「あと何回休めるか」も追随する。 */
    var total = Math.max(0, subject.sessions.length * state.term.weeks - noClassCount(state, subject.id));
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
        items.push({
          subject: subject,
          assessment: assessment,
          week: assessment.week,
          key: 'a:' + subject.id + ':' + assessment.id
        });
      });
    });
    /* 手動追加の締切は assessment と同じ形に均して、既存の描画にそのまま乗せる。 */
    (state.customDeadlines || []).forEach(function (entry) {
      var subject = null;
      state.subjects.forEach(function (candidate) {
        if (candidate.id === entry.subjectId) subject = candidate;
      });
      if (!subject) return;
      /* 日付があれば週は日付から決める。古いデータの week がずれていても実日付を優先する。 */
      var when = entry.date ? BB.date.parse(String(entry.date).slice(0, 10)) : null;
      items.push({
        subject: subject,
        week: when ? weekOfClamped(when) : entry.week,
        custom: entry,
        key: 'c:' + entry.id,
        sortDue: entry.date || '',
        assessment: {
          id: entry.id,
          name: entry.name,
          weight: entry.weight || 0,
          kind: 'custom',
          customKind: entry.kind || 'other',
          /* 日付が無いときに note を日付欄へ流用しない。note は自由記述で、
             過去には整形済みの日付文字列が入っていた。日付が無ければ
             一覧側が週の範囲を併記する。 */
          dueLabel: entry.date ? fmtDateTime(entry.date) : '',
          custom: true
        }
      });
    });
    homeworkDeadlineItems(state).forEach(function (item) {
      items.push(item);
    });
    items.sort(function (a, b) {
      if (a.week !== b.week) return a.week - b.week;
      var ad = a.sortDue || '';
      var bd = b.sortDue || '';
      if (ad === bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;
      return ad < bd ? -1 : 1;
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
    var m = minutes % 60;
    return t('duration.hm', { h: Math.floor(minutes / 60), m: m, mm: pad2(m) });
  }

  /* ---------- notes & homework ---------- */

  function notesOf(state) {
    return state.notes || [];
  }

  function isoDay(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function subjectByCode(state, code) {
    var found = null;
    if (!code) return null;
    state.subjects.forEach(function (subject) {
      if (subject.id === code) found = subject;
    });
    return found;
  }

  /* 'YYYY-MM-DDTHH:mm' を表示用にする。時刻が無ければ日付だけ。
     締切行は作成経路（科目の評価・手動追加・宿題）によらずこの書式に揃える。 */
  function dueLabel(due) {
    if (!due) return '';
    return fmtDateTime(due) || String(due);
  }

  /* 締切の近い順。締切なしは最後に回す。 */
  function byDue(a, b) {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
  }

  function openHomework(state) {
    return notesOf(state)
      .filter(function (note) {
        return note.kind === 'homework' && !note.done;
      })
      .sort(byDue);
  }

  function todayMemos(state, now) {
    var today = isoDay(now);
    return notesOf(state).filter(function (note) {
      return note.kind === 'memo' && note.date === today;
    });
  }

  /* 科目を持たない宿題は Deadlines 側で科目チップが要る。表示専用の代理を返す。 */
  function placeholderSubject() {
    return { id: '—', name: '', color: 'var(--bb-text-muted)', credits: 0, sessions: [], assessments: [] };
  }

  /* 締切のある未完了の宿題だけ Deadlines に合流させる。締切なしのメモは出さない。 */
  function homeworkDeadlineItems(state) {
    return openHomework(state)
      .filter(function (note) {
        return !!note.due;
      })
      .map(function (note) {
        var day = BB.date.parse(String(note.due).split('T')[0]);
        return {
          subject: subjectByCode(state, note.subjectCode) || placeholderSubject(),
          week: day ? weekOfClamped(day) : currentWeek(new Date()),
          note: note,
          key: 'n:' + note.id,
          sortDue: note.due,
          assessment: {
            id: note.id,
            name: note.text,
            weight: 0,
            kind: 'homework',
            dueLabel: dueLabel(note.due),
            homework: true
          }
        };
      });
  }

  /* 締切の詳細（リンク・メモ）は本体と分けた層に置く。科目由来の評価にも付けられる。 */
  function deadlineDetail(key) {
    var details = BB.store.get().deadlineDetails || {};
    var entry = details[key] || {};
    return {
      links: Array.isArray(entry.links) ? entry.links : [],
      memo: entry.memo || ''
    };
  }

  function hasDeadlineDetail(key) {
    var detail = deadlineDetail(key);
    return detail.links.length > 0 || !!detail.memo;
  }

  function setDeadlineDetail(key, detail) {
    BB.store.update(function (state) {
      state.deadlineDetails = state.deadlineDetails || {};
      var links = (detail.links || []).filter(function (link) {
        return link && (link.label || link.url);
      });
      var memo = detail.memo || '';
      if (!links.length && !memo) {
        delete state.deadlineDetails[key];
        return;
      }
      state.deadlineDetails[key] = { links: links, memo: memo };
    });
  }

  /* ---------- 個人予定 ---------- */

  /* 科目色と衝突させないため、予定は「淡い面＋左の色帯」で描く。塗りつぶしは使わない。 */
  var EVENT_COLORS = ['#475569', '#0F766E', '#7C3AED', '#B45309'];

  function personalEventsOf(state) {
    return state.personalEvents || [];
  }

  function eventById(state, id) {
    var found = null;
    personalEventsOf(state).forEach(function (entry) {
      if (entry.id === id) found = entry;
    });
    return found;
  }

  function minutesRange(start, end) {
    return { start: minutesOf(start), end: minutesOf(end) };
  }

  function rangesOverlap(a, b) {
    return a.start < b.end && b.start < a.end;
  }

  /* その曜日・その週に出る予定。once は日付が一致する週だけ、weekly は毎週。 */
  function eventsForDay(state, day, dayIso) {
    return personalEventsOf(state).filter(function (entry) {
      if (entry.kind === 'weekly') return Number(entry.weekday) === day;
      if (!dayIso || entry.date !== dayIso) return false;
      /* 単発は日付が一致する列にだけ出す。曜日も突き合わせて取り違えを防ぐ。 */
      var when = BB.date.parse(entry.date);
      return !!when && when.getDay() === day;
    });
  }

  /* ---------- rendering ---------- */


  function bindHeader(state, now, preview) {
    var weeks = state.term.weeks || 14;
    var weekText = preview
      ? t('header.starts', { date: fmtDate(termStart()) })
      : t('common.weekOf', { n: currentWeek(now), total: weeks });
    var binds = {
      'student.name': state.student.name,
      'student.initials': state.student.initials,
      'student.programme': t('header.programmeYear', {
        programme: state.student.programme,
        year: state.student.year
      }),
      'student.id': state.student.studentId,
      'student.idSuffix': state.student.studentId
        ? t('header.studentIdSuffix', { id: state.student.studentId })
        : '',
      'term.label': termLabelOf(state),
      'term.week': weekText,
      'settings.cgpaTarget': t('header.cgpaTarget', { value: state.settings.cgpaTarget.toFixed(2) }),
      'cgpa.value': '—',
      'topics.week': t('common.weekOf', { n: currentWeek(now), total: weeks }),
      'timetable.subtitle': t('dash.timetableSubtitle', { term: termLabelOf(state), weeks: weeks })
    };
    $$('[data-bind]').forEach(function (node) {
      var key = node.getAttribute('data-bind');
      if (Object.prototype.hasOwnProperty.call(binds, key)) node.textContent = binds[key];
    });
  }

  function renderPreviewBanner(preview, now) {
    var host = $('#preview-banner');
    if (!host) return;
    var start = termStart();
    if (!preview || !start) {
      host.innerHTML = '';
      return;
    }
    var days = calendarDays(now, start);
    host.innerHTML =
      '<div class="flex items-start sm:items-center gap-3 rounded-card border border-primary/25 bg-surface-sunken px-4 py-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">event_upcoming</span>' +
      '<div class="text-body-sm text-body">' +
      '<span class="font-semibold text-ink">' + t('preview.weekStarts', { date: fmtDateFull(start) }) + '</span>' +
      ' ' + t('preview.body') + ' ' +
      '<span class="text-muted">' +
      (days === 1 ? t('common.tomorrow') : t('countdown.days', { n: days })) +
      ' · ' + t('preview.noSessions') + '</span>' +
      '</div></div>';
  }

  function renderNextClass(next, now, preview) {
    var host = $('#next-class');
    if (!host) return;
    if (!BB.store.get().subjects.length) {
      host.innerHTML =
        '<div class="rounded-card border border-border bg-surface p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">' +
        '<div class="flex items-start gap-3">' +
        '<span class="material-symbols-outlined text-[22px] text-primary mt-0.5">calendar_today</span>' +
        '<div><div class="text-title-md font-bold text-ink">' + t('next.emptyTitle') + '</div>' +
        '<p class="text-body-sm text-muted mt-1">' + t('next.emptyBody') + '</p></div></div>' +
        '<a href="subject-edit.html?new=1" class="bb-btn bb-btn-primary shrink-0">' +
        '<span class="material-symbols-outlined text-[18px]">add</span>' + t('next.emptyCta') + '</a></div>';
      return;
    }
    if (!next) {
      host.innerHTML =
        '<div class="rounded-card border border-border bg-surface p-6 text-body-sm text-muted">' +
        t('next.notFound', { days: LOOKAHEAD_DAYS }) + '</div>';
      return;
    }
    var subject = next.subject;
    var session = next.session;
    var chip = BB.color.chip(subject.color);
    var badge = preview ? t('next.termStarts', { date: fmtDate(termStart()) }) : countdown(next.start, now);
    var dayText = fmtDate(next.start) + (isSameDay(next.start, now) ? ' • ' + t('next.today') : '');
    var roomText = roomLabel(session.room);

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
      '<div class="flex items-start gap-1"><span class="material-symbols-outlined text-[18px] text-primary">room</span>' +
      '<span>' + roomPrimary(session.room) +
      (roomText ? '<span class="block text-caption text-muted">' + escHtml(roomText) + '</span>' : '') +
      '</span></div>' +
      (subject.lecturer ? '<div class="flex items-center gap-1"><span class="material-symbols-outlined text-[18px] text-muted">person</span>' +
      '<span>' + subject.lecturer + '</span></div>' : '') +
      '</div></div>' +
      '<div class="flex items-center gap-3 shrink-0 pt-2 md:pt-0">' +
      '<a href="simulator.html?subject=' + subject.id + '" class="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-primary text-on-primary text-label-md font-semibold hover:bg-primary-hover transition-colors shadow-rest">' +
      '<span class="material-symbols-outlined text-[18px]">calculate</span><span>' + t('next.openSimulator') + '</span></a>' +
      '<a href="attendance.html" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-control border border-border bg-surface text-ink hover:bg-surface-subtle text-label-md font-medium transition-colors">' +
      '<span class="material-symbols-outlined text-[18px] text-muted">rule</span><span>' + t('next.attendance') + '</span></a>' +
      '<button type="button" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-control border border-border bg-surface text-ink hover:bg-surface-subtle text-label-md font-medium transition-colors"' +
      ' data-note-for="' + subject.id + '" data-note-date="' + isoDay(next.start) + '"' +
      ' title="' + escHtml(t('notes.addFromClass')) + '">' +
      '<span class="material-symbols-outlined text-[18px] text-muted">note_add</span>' +
      '<span>' + t('notes.addFromClass') + '</span></button>' +
      '</div></div></div>';
  }

  function renderLegend(state) {
    var host = $('#legend');
    if (!host) return;
    var items = state.subjects.map(function (subject) {
      return (
        '<div class="flex items-center gap-1.5 min-w-0"><span class="w-3 h-3 rounded-sm shrink-0" style="background:' +
        subject.color + '"></span><span class="text-muted truncate" style="max-width:12rem" title="' +
        escHtml(subject.id + ' ' + subject.name) + '">' + subject.id + ' ' + subjectName(subject) + '</span></div>'
      );
    });
    if (personalEventsOf(state).length) {
      items.push(
        '<div class="flex items-center gap-1.5"><span class="tt-legend-event"></span>' +
        '<span class="text-muted">' + t('pe.legend') + '</span></div>'
      );
    }
    if (overridesOf(state).length) {
      items.push(
        '<div class="flex items-center gap-1.5"><span class="tt-legend-off"></span>' +
        '<span class="text-muted">' + t('tt.noClass') + '</span></div>'
      );
    }
    host.innerHTML = items.join('');
  }

  /* 教室コードの下に出す人間可読な場所。表示専用で、保存値はコードのまま。 */
  function roomLabel(code) {
    return BB.room ? BB.room.label(code) : null;
  }

  /* 教室名の主表示。値がすでに「Room」「教室」で始まるならラベルを重ねない
     （Room Room A を避ける）。空なら未定と出す。 */
  function roomPrimary(code) {
    var value = String(code === undefined || code === null ? '' : code).trim();
    if (!value) return '<span class="text-muted">' + escHtml(t('next.roomTbd')) + '</span>';
    var strong = '<strong class="text-ink font-semibold">' + escHtml(value) + '</strong>';
    var word = t('next.roomWord');
    if (value.toLowerCase().indexOf(word.toLowerCase()) === 0) return strong;
    return t('next.room', { room: strong });
  }

  function renderTimetable(state, now) {
    var host = $('#timetable');
    if (!host) return;
    var height = (HOUR_END - HOUR_START) * HOUR_HEIGHT;
    host.style.setProperty('--tt-hour', HOUR_HEIGHT + 'px');

    /* 表示中の週の各曜日の実日付。メモ追加と休講・振替の照合で同じ値を使う。 */
    var weekDayDates = weekDates(now);
    function dateOfWeekday(day) {
      return weekDayDates[day] || isoDay(now);
    }
    /* 休講・振替の照合に使う日付。 */
    function weekDayIso(day) {
      return weekDayDates[day] || null;
    }

    /* 曜日見出しに付ける実日付。学期開始日が未設定なら出さない（例外で落ちない。
       週の半ばで月が変わる週では、月が変わった日とその週の月曜にも月を出す。 */
    var startGiven = !!state.term.startDate;
    var weekMonths = [1, 2, 3, 4, 5].map(function (day) {
      var iso = weekDayDates[day];
      var date = iso ? BB.date.parse(String(iso).slice(0, 10)) : null;
      return date ? date.getMonth() : -1;
    });
    var weekSpansMonths = weekMonths.some(function (month, index) {
      return index > 0 && month >= 0 && weekMonths[index - 1] >= 0 && month !== weekMonths[index - 1];
    });

    function dayDateText(day) {
      if (!startGiven) return '';
      var iso = weekDayDates[day];
      var date = iso ? BB.date.parse(String(iso).slice(0, 10)) : null;
      if (!date) return '';
      var dayOfMonth = date.getDate();
      var month = date.getMonth();
      var withMonth = weekSpansMonths &&
        (day === 1 || weekMonths[day - 2] !== month);
      var dateText = withMonth
        ? t('tt.dayDateWithMonth', {
            mon: t('month.' + MONTH_KEYS[month]),
            m: month + 1,
            d: dayOfMonth
          })
        : t('tt.dayDate', { d: dayOfMonth });
      return ' <span class="tt-day-date">' + dateText + '</span>';
    }

    var head =
      '<div class="tt-head"><div class="tt-corner">' + t('tt.time') + '</div>' +
      [1, 2, 3, 4, 5]
        .map(function (day) {
          var today = now.getDay() === day;
          return '<div class="tt-day' + (today ? ' is-today' : '') + '">' + dayName(day) +
            dayDateText(day) +
            (today ? ' ' + t('tt.today') : '') + '</div>';
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
        var dayIso = weekDayIso(day);
        state.subjects.forEach(function (subject) {
          subject.sessions.forEach(function (session, index) {
            if (session.day !== day) return;
            var startMin = minutesOf(session.start);
            var endMin = minutesOf(session.end);
            var blockTop = ((startMin - HOUR_START * 60) / 60) * HOUR_HEIGHT;
            var blockHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT;
            var roomText = roomLabel(session.room);
            var override = dayIso ? overrideFor(state, subject.id, index, dayIso) : null;
            if (override) {
              /* 休講にした回は通常のブロックを出さない。振替なら振替先も併記する。 */
              var note = override.kind === 'transfer' && override.target
                ? t('att.transferTo', {
                    date: override.target.date,
                    start: override.target.start,
                    end: override.target.end
                  })
                : t('att.noClassHint');
              blocks.push(
                '<div class="tt-block tt-block-off" style="top:' + blockTop + 'px;height:' + (blockHeight - 3) + 'px"' +
                  ' title="' + escHtml(subject.id + ' · ' + t('tt.noClass') + ' · ' + note) + '">' +
                  '<span class="tt-block-code">' + subject.id + '</span>' +
                  '<span class="tt-block-meta">' + t('tt.noClass') + '</span>' +
                  '<span class="tt-block-room">' + escHtml(note) + '</span>' +
                '</div>'
              );
              return;
            }
            /* 教室が空のときに区切り記号だけが残らないよう、要素を集めてから繋ぐ。 */
            var blockTitle = [subject.id, session.type, session.start + '–' + session.end];
            if (session.room) blockTitle.push(session.room);
            if (roomText) blockTitle.push(roomText);
            blocks.push(
              '<a class="tt-block" href="simulator.html?subject=' + subject.id + '"' +
                ' style="top:' + blockTop + 'px;height:' + (blockHeight - 3) + 'px;background:' + subject.color + '"' +
                ' title="' + escHtml(blockTitle.join(' · ')) + '">' +
                '<span class="tt-block-code">' + subject.id + '</span>' +
                '<span class="tt-block-meta">' + session.type +
                (session.room ? ' · ' + escHtml(session.room) : '') + '</span>' +
                (roomText ? '<span class="tt-block-room" title="' + escHtml(roomText) + '">' + roomText + '</span>' : '') +
              '</a>' +
              '<button type="button" class="tt-note" style="top:' + (blockTop + 3) + 'px"' +
                ' data-note-for="' + subject.id + '" data-note-date="' + dateOfWeekday(day) + '"' +
                ' title="' + escHtml(t('notes.addFromClass')) + '"' +
                ' aria-label="' + escHtml(t('notes.addFromClass')) + '">' +
                '<span class="material-symbols-outlined text-[12px]">note_add</span></button>'
            );
          });
        });
        /* 振替の臨時セッションは、振替先の週にだけ「振替」マーク付きで出す。 */
        extraSessions(state).forEach(function (extra) {
          if (!dayIso || extra.date !== dayIso) return;
          var startMin = minutesOf(extra.start);
          var endMin = minutesOf(extra.end);
          var blockTop = ((startMin - HOUR_START * 60) / 60) * HOUR_HEIGHT;
          var blockHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT;
          var roomText = roomLabel(extra.room);
          blocks.push(
            '<a class="tt-block tt-block-transfer" href="simulator.html?subject=' + extra.subject.id + '"' +
              ' style="top:' + blockTop + 'px;height:' + (blockHeight - 3) + 'px;background:' + extra.subject.color + '"' +
              ' title="' + escHtml(extra.subject.id + ' · ' + t('tt.transfer') + ' · ' + extra.start + '–' + extra.end) + '">' +
              '<span class="tt-block-code">' + extra.subject.id + '</span>' +
              '<span class="tt-block-meta">' + t('tt.transfer') + ' · ' +
              escHtml(extra.room || t('att.transferRoomTbd')) + '</span>' +
              (roomText ? '<span class="tt-block-room" title="' + escHtml(roomText) + '">' + roomText + '</span>' : '') +
            '</a>'
          );
        });
        /* 個人予定。授業と重なる時間帯では右半分に寄せて、両方が読めるようにする。 */
        var classRanges = [];
        state.subjects.forEach(function (subject) {
          subject.sessions.forEach(function (session) {
            if (session.day !== day) return;
            classRanges.push(minutesRange(session.start, session.end));
          });
        });
        eventsForDay(state, day, dayIso).forEach(function (entry) {
          var span = minutesRange(entry.start, entry.end);
          if (!isFinite(span.start) || !isFinite(span.end) || span.end <= span.start) return;
          var blockTop = ((span.start - HOUR_START * 60) / 60) * HOUR_HEIGHT;
          var blockHeight = ((span.end - span.start) / 60) * HOUR_HEIGHT;
          var overlaps = classRanges.some(function (range) {
            return rangesOverlap(span, range);
          });
          blocks.push(
            '<button type="button" class="tt-event' + (overlaps ? ' tt-event-shift' : '') + '"' +
              ' style="top:' + blockTop + 'px;height:' + (blockHeight - 3) + 'px;border-left-color:' +
              (entry.color || EVENT_COLORS[0]) + '"' +
              ' data-event-edit="' + entry.id + '"' +
              ' title="' + escHtml(entry.title + ' · ' + entry.start + '–' + entry.end + (entry.memo ? ' · ' + entry.memo : '')) + '">' +
              '<span class="tt-event-title">' + escHtml(entry.title) + '</span>' +
              '<span class="tt-event-meta">' + entry.start + '–' + entry.end + '</span>' +
            '</button>'
          );
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
    var attendanceNote = attendance.rate === null
      ? t('detail.noSessionsYet')
      : tn('detail.absences', attendance.absences);
    /* 点数は「14.3 / 100」を 1 つの値として扱う。途中で折り返さない。 */
    var securedValue = secured.entered > 0
      ? secured.secured.toFixed(1) + '\u00A0/\u00A0' + secured.possible
      : '—';
    var securedNote = secured.published ? t('detail.courseworkPending') : t('detail.notPublishedYet');
    var assessmentValue = upcoming ? upcoming.name : t('detail.notPublishedYet');
    var assessmentNote = upcoming ? t('common.week', { n: upcoming.week }) : '';

    host.innerHTML =
      '<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-border">' +
      '<div class="flex items-center gap-3">' +
      '<span class="w-3.5 h-3.5 rounded-full" style="background:' + subject.color + ';box-shadow:0 0 0 4px ' + BB.color.alpha(subject.color, 0.2) + '"></span>' +
      '<div><h3 class="text-title-md font-bold text-ink">' +
      t('detail.nextClass', { code: subject.id, name: subject.name }) +
      '&nbsp;<span class="font-normal text-muted">(' + session.type + ' • ' + dayName(session.day) + ' ' + session.start + '–' + session.end + ')</span></h3>' +
      '<p class="text-caption text-muted">' + subject.faculty +
      (subject.lecturer ? ' • ' + t('detail.lecturer', { name: subject.lecturer }) : '') + '</p></div>' +
      '</div>' +
      '<a href="simulator.html?subject=' + subject.id + '" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-control bg-surface border border-border hover:border-primary/40 text-caption font-semibold text-primary transition-colors shadow-rest">' +
      '<span>' + t('detail.openSimulator') + '</span><span class="material-symbols-outlined text-[15px]">arrow_forward</span></a>' +
      '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">' +
      detailPill('menu_book', subject.color, t('detail.thisWeekTopic'), subject.topics.title, '') +
      detailPill('verified', attendance.atRisk ? 'var(--bb-alert)' : subject.color, t('detail.attendance'), attendanceValue, attendanceNote) +
      detailPill('grade', subject.color, t('detail.securedMarks'), securedValue, securedNote) +
      detailPill('assignment_late', 'var(--bb-text-muted)', t('detail.nextAssessment'), assessmentValue, assessmentNote) +
      '</div>';
  }

  function detailPill(icon, color, label, value, note) {
    return (
      '<div class="bg-surface border border-border rounded-control p-3.5 flex items-start gap-3 min-w-0">' +
      '<span class="material-symbols-outlined text-[20px] mt-0.5 shrink-0" style="color:' + color + '">' + icon + '</span>' +
      '<div class="min-w-0 flex-1">' +
      '<div class="text-caption text-muted font-medium break-words">' + label + '</div>' +
      /* 値は語の途中で折らず、補足は 1 かたまりとして折り返す。 */
      '<div class="text-label-md font-semibold text-ink num flex flex-wrap items-baseline gap-1">' +
      '<span class="min-w-0">' + escHtml(value) + '</span>' +
      (note ? '<span class="text-caption font-normal text-muted whitespace-nowrap">(' + escHtml(note) + ')</span>' : '') +
      '</div></div></div>'
    );
  }

  function renderTopics(state) {
    var host = $('#topics');
    if (!host) return;
    if (!state.subjects.length) {
      host.innerHTML =
        '<div class="sm:col-span-2 lg:col-span-4 rounded-card border border-border bg-surface p-5 text-body-sm text-muted">' +
        t('topics.empty') + '</div>';
      return;
    }
    host.innerHTML = state.subjects
      .map(function (subject) {
        var chip = BB.color.chip(subject.color);
        return (
          '<a href="simulator.html?subject=' + subject.id + '" class="group bg-surface border border-border hover:border-primary/40 rounded-card p-4 shadow-rest hover:shadow-hover transition-all">' +
          '<div class="flex items-center justify-between pb-2">' +
          '<span class="px-2 py-0.5 rounded text-[11px] font-bold" style="background:' + chip.background + ';color:' + chip.color + ';border:1px solid ' + chip.borderColor + '">' + subject.id + '</span>' +
          '<span class="text-caption text-muted">' + subject.topics.label + '</span>' +
          '</div>' +
          '<div class="text-caption text-muted pt-1 truncate" title="' + escHtml(subject.name) + '">' +
          subjectName(subject) + '</div>' +
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
    host.innerHTML = [deadlinesCard(state, now), attendanceCard(state), studyLogCard(state, now, next)]
      .filter(function (html) {
        return !!html;
      })
      .join('');
  }

  function cardShell(href, title, icon, iconColor, body, footer) {
    return (
      '<div class="group bg-surface border border-border hover:border-primary/40 rounded-card p-5 shadow-rest hover:shadow-hover transition-all flex flex-col justify-between">' +
      '<div><div class="flex items-center justify-between gap-2 pb-3 border-b border-border-subtle">' +
      '<a href="' + href + '" class="flex items-center gap-2 min-w-0">' +
      '<span class="material-symbols-outlined text-[20px] shrink-0" style="color:' + iconColor + '">' + icon + '</span>' +
      '<h3 class="text-title-md font-bold text-ink group-hover:text-primary transition-colors truncate">' + title + '</h3></a>' +
      '<a href="' + href + '" class="flex items-center gap-1 text-muted hover:text-primary transition-colors shrink-0" aria-label="' +
      escHtml(title) + '">' +
      '<span class="text-caption hidden sm:inline">' + t('card.details') + '</span>' +
      '<span class="material-symbols-outlined text-[20px]">chevron_right</span></a>' +
      '</div>' + body + '</div>' + footer + '</div>'
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

    if (!items.length) {
      return cardShell(
        'deadlines.html',
        t('card.deadlines.title'),
        'assignment_late',
        'var(--bb-primary)',
        '<p class="py-4 text-body-sm text-muted">' + t('card.deadlines.empty') + '</p>',
        '<div class="pt-3 border-t border-border-subtle text-caption text-muted">' + t('card.deadlines.emptyHint') + '</div>'
      );
    }

    var body =
      '<div class="py-3 space-y-1.5">' +
      '<div class="text-caption uppercase tracking-wider text-muted">' + t('card.deadlines.nextUpcoming') + '</div>' +
      '<div class="text-body-lg font-bold text-ink flex items-start gap-2">' +
      (nextItem
        ? '<a href="deadline-detail.html?id=' + encodeURIComponent(nextItem.key || '') +
          '" class="min-w-0 break-words hover:text-primary transition-colors">' +
          escHtml(nextItem.subject.id + ' ' + nextItem.assessment.name) + '</a>'
        : '<span>—</span>') +
      (nextItem ? '<span class="shrink-0 text-caption font-semibold px-2 py-0.5 rounded bg-surface-sunken text-primary">' +
        t('common.week', { n: nextItem.week }) + '</span>' : '') +
      '</div>' +
      (nextItem
        ? (function () {
            var when = nextItem.assessment.dueLabel || BB.date.weekLabel(nextItem.week);
            return when ? '<p class="text-caption text-muted num">' + escHtml(when) + '</p>' : '';
          })()
        : '') +
      '<p class="text-body-sm text-muted">' + t('card.deadlines.scheduled', { n: items.length }) + '</p>' +
      '</div>';

    var footer =
      '<div class="pt-3 border-t border-border-subtle flex items-center justify-between text-caption text-muted">' +
      '<div class="flex items-center gap-1.5">' + dots +
      '<span class="pl-1">' + t('card.deadlines.allTracked') + '</span></div>' +
      '<a href="deadlines.html" class="font-semibold text-primary hover:underline flex items-center gap-0.5">' +
      '<span>' + t('card.deadlines.viewItems', { n: items.length }) + '</span>' +
      '<span class="material-symbols-outlined text-[14px]">arrow_forward</span></a></div>';

    return cardShell('deadlines.html', t('card.deadlines.title'), 'assignment_late', 'var(--bb-primary)', body, footer);
  }

  function attendanceCard(state) {
    if (!state.subjects.length) return '';
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
          '<span class="min-w-0 truncate" title="' + escHtml(subject.id + ' ' + subject.name) + '">' +
          subject.id + ' ' + subjectName(subject) + '</span>' +
          '<span class="font-semibold num" style="color:' + subject.color + '">' + value + '</span></div>' +
          '<div class="w-full bg-border h-1.5 rounded-full overflow-hidden">' +
          '<div class="h-full rounded-full" style="width:' + width + '%;background:' + subject.color + '"></div></div>'
        );
      })
      .join('');

    var overallRate = totals.held > 0 ? (totals.attended / totals.held) * 100 : null;
    var statusPill = overallRate === null
      ? '<span class="px-2 py-0.5 rounded text-caption font-semibold bg-surface-subtle text-muted border border-border">' +
        t('card.attendance.noSessions') + '</span>'
      : overallRate >= state.settings.attendanceThreshold
        ? '<span class="px-2 py-0.5 rounded text-caption font-semibold bb-status-ok">' +
          t('card.attendance.eligible', { n: state.settings.attendanceThreshold }) + '</span>'
        : '<span class="px-2 py-0.5 rounded text-caption font-semibold bb-status-alert">' +
          t('card.attendance.below', { n: state.settings.attendanceThreshold }) + '</span>';

    var body =
      '<div class="py-3 space-y-2">' +
      '<div class="flex items-center justify-between">' +
      '<span class="text-caption uppercase tracking-wider text-muted">' + t('card.attendance.overall') + '</span>' +
      statusPill + '</div>' +
      '<div class="text-headline-sm font-extrabold text-ink num">' +
      (overallRate === null ? '—' : Math.round(overallRate) + '%') +
      ' <span class="text-body-sm font-normal text-muted">' + tn('card.attendance.held', totals.held) + '</span></div>' +
      '<div class="space-y-1.5 pt-1">' + rows + '</div>' +
      '</div>';

    var footer =
      '<div class="pt-3 border-t border-border-subtle text-caption text-muted flex items-center justify-between">' +
      '<span>' + t('card.attendance.barred', { n: state.settings.attendanceThreshold }) + '</span>' +
      '<a href="attendance.html" class="font-semibold text-primary hover:underline flex items-center gap-0.5">' +
      '<span>' + t('card.attendance.detail') + '</span>' +
      '<span class="material-symbols-outlined text-[14px]">arrow_forward</span></a></div>';

    return cardShell('attendance.html', t('card.attendance.title'), 'rule', 'var(--bb-success)', body, footer);
  }

  function studyLogCard(state, now, next) {
    if (!state.subjects.length) return '';
    var minutes = studyMinutesThisWeek(now);
    var target = state.settings.weeklyStudyTarget;
    var targetSubject = next ? next.subject : state.subjects[0];
    var targetLabel = targetSubject
      ? '<span class="font-semibold text-primary truncate" title="' +
        escHtml(targetSubject.id + ' ' + targetSubject.name) + '">' +
        targetSubject.id + ' ' + subjectName(targetSubject) + '</span>'
      : '<span class="font-semibold text-primary">' + t('card.studyLog.noSubject') + '</span>';

    var body =
      '<div class="py-3 space-y-2">' +
      '<div class="text-caption uppercase tracking-wider text-muted">' + t('card.studyLog.currentWeek') + '</div>' +
      '<div class="text-headline-sm font-extrabold text-ink num">' +
      '<span class="whitespace-nowrap">' + hoursLabel(minutes) + ' /</span>' +
      ' <span class="text-body-sm font-normal text-muted whitespace-nowrap">' +
      t('card.studyLog.target', { n: target }) + '</span></div>' +
      '<p class="text-body-sm text-muted">' +
      (minutes === 0
        ? t('card.studyLog.justBegun', { n: currentWeek(now) })
        : t('card.studyLog.keepGoing')) +
      '</p></div>';

    var footer =
      '<div class="pt-3 border-t border-border-subtle space-y-2.5">' +
      '<div class="flex items-center justify-between text-caption text-muted">' +
      '<span>' + t('card.studyLog.targetSubject') + '</span>' +
      targetLabel + '</div>' +
      '<span class="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-control bg-primary text-on-primary text-label-md font-semibold hover:bg-primary-hover transition-colors shadow-rest">' +
      '<span class="material-symbols-outlined text-[18px]">play_arrow</span><span>' +
      t('card.studyLog.startTimer') + '</span></span></div>';

    return cardShell('studylog.html', t('card.studyLog.title'), 'menu_book', 'var(--bb-primary)', body, footer);
  }

  /* ---------- notes card ---------- */

  /* 追加・編集中の下書き。null ならフォームを閉じている。 */
  var noteForm = null;

  function noteFormHtml(state) {
    var draft = noteForm;
    var subjectOptions =
      '<option value="">' + t('notes.noSubject') + '</option>' +
      state.subjects
        .map(function (subject) {
          return '<option value="' + subject.id + '"' +
            (subject.id === draft.subjectCode ? ' selected' : '') + '>' +
            subject.id + ' ' + subject.name + '</option>';
        })
        .join('');

    return (
      '<form id="note-form" class="rounded-control border border-primary/25 bg-surface-sunken p-4 space-y-3">' +
      '<div class="flex items-center justify-between">' +
      '<h3 class="text-label-md font-bold text-ink">' +
      (draft.id ? t('notes.editTitle') : t('notes.addTitle')) + '</h3>' +
      '<button type="button" data-note-cancel class="text-muted hover:text-ink" aria-label="' + t('notes.cancel') + '">' +
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
      '<input id="n-text" class="bb-input" type="text" value="' + escHtml(draft.text) + '" placeholder="' +
      escHtml(t('notes.textPlaceholder')) + '" required></div>' +
      '<div><label class="bb-label" for="n-date">' + t('notes.date') + '</label>' +
      '<input id="n-date" class="bb-input" type="date" value="' + escHtml(draft.date) + '"></div>' +
      '<div><label class="bb-label" for="n-due">' + t('notes.due') + '</label>' +
      '<input id="n-due" class="bb-input" type="datetime-local" value="' + escHtml(draft.due) + '"></div>' +
      '</div>' +
      '<div class="flex justify-end gap-2">' +
      '<button type="button" data-note-cancel class="bb-btn bb-btn-ghost">' + t('notes.cancel') + '</button>' +
      '<button type="submit" class="bb-btn bb-btn-primary">' + t('notes.save') + '</button></div>' +
      '</form>'
    );
  }

  function noteRow(note, state, now) {
    var subject = subjectByCode(state, note.subjectCode);
    var isHomework = note.kind === 'homework';
    var overdue = isHomework && note.due && !note.done && String(note.due) < isoDay(now) + 'T23:59';
    var meta = [];
    if (subject) meta.push(subject.id);
    if (isHomework) {
      meta.push(note.due ? t('notes.dueOn', { when: dueLabel(note.due) }) : t('notes.noDue'));
    }
    var toggleLabel = note.done ? t('notes.markOpen') : t('notes.markDone');

    return (
      '<div class="flex items-start gap-3 py-2.5">' +
      '<button type="button" class="mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 ' +
      (note.done ? 'bg-success border-success text-white' : 'border-border text-transparent hover:border-primary') + '"' +
      ' data-note-toggle="' + note.id + '" aria-label="' + toggleLabel + '" title="' + toggleLabel + '">' +
      '<span class="material-symbols-outlined text-[14px]">check</span></button>' +
      '<div class="min-w-0 flex-1">' +
      '<div class="text-body-sm ' + (note.done ? 'line-through text-muted' : 'text-ink') + '">' +
      escHtml(note.text) + '</div>' +
      '<div class="flex flex-wrap items-center gap-2 text-caption text-muted mt-0.5">' +
      (subject ? '<span class="font-semibold" style="color:' + subject.color + '">' + subject.id + '</span>' : '') +
      '<span class="' + (overdue ? 'text-alert font-semibold' : '') + '">' + meta.join(' · ') + '</span>' +
      (overdue
        ? '<span class="bb-chip" style="background:var(--bb-alert-surface);color:var(--bb-alert)">' +
          t('notes.overdue') + '</span>'
        : '') +
      '</div></div>' +
      '<div class="flex items-center gap-1 shrink-0">' +
      '<button type="button" class="p-1.5 rounded text-muted hover:text-primary" data-note-edit="' + note.id +
      '" title="' + t('notes.edit') + '" aria-label="' + t('notes.edit') + '">' +
      '<span class="material-symbols-outlined text-[16px]">edit</span></button>' +
      '<button type="button" class="p-1.5 rounded text-muted hover:text-alert" data-note-delete="' + note.id +
      '" title="' + t('notes.delete') + '" aria-label="' + t('notes.delete') + '">' +
      '<span class="material-symbols-outlined text-[16px]">delete</span></button>' +
      '</div></div>'
    );
  }

  function notesGroup(title, list, state, now, emptyText) {
    var rows = list.length
      ? list
          .map(function (note) {
            return noteRow(note, state, now);
          })
          .join('')
      : '<p class="text-body-sm text-muted py-2">' + emptyText + '</p>';

    return (
      '<div>' +
      '<div class="flex items-center justify-between pb-2 border-b border-border-subtle">' +
      '<h3 class="text-caption font-bold text-ink uppercase tracking-wider">' + title + '</h3>' +
      '<span class="text-caption text-muted num">' + list.length + '</span></div>' +
      '<div class="divide-y divide-border-subtle">' + rows + '</div></div>'
    );
  }

  function renderNotes(state, now) {
    var host = $('#notes-body');
    if (!host) return;
    host.innerHTML =
      (noteForm ? noteFormHtml(state) : '') +
      notesGroup(t('notes.todayMemos'), todayMemos(state, now), state, now, t('notes.noMemos')) +
      notesGroup(t('notes.openHomework'), openHomework(state), state, now, t('notes.noHomework'));
  }

  function findNote(id) {
    var found = null;
    notesOf(BB.store.get()).forEach(function (note) {
      if (note.id === id) found = note;
    });
    return found;
  }

  /* 再描画の前に入力中のメモを下書きへ戻す。
     他タブの保存で再描画しても、開いているフォームの入力が消えないように。 */
  function collectNoteForm() {
    if (!noteForm) return;
    var kind = $('#n-kind');
    var text = $('#n-text');
    var subject = $('#n-subject');
    var date = $('#n-date');
    var due = $('#n-due');
    if (kind) noteForm.kind = kind.value === 'memo' ? 'memo' : 'homework';
    if (text) noteForm.text = text.value;
    if (subject) noteForm.subjectCode = subject.value || '';
    if (date) noteForm.date = date.value;
    if (due) noteForm.due = due.value || '';
  }

  /* 他タブの保存を取り込んだ再描画でも入力中のフォームは消さない。 */
  function syncOpenForms() {
    collectNoteForm();
    collectEventForm();
  }

  function saveNote() {
    var text = $('#n-text').value.trim();
    if (!text) {
      toast(t('notes.toastTextRequired'));
      return;
    }
    var kind = $('#n-kind').value === 'memo' ? 'memo' : 'homework';
    var subjectCode = $('#n-subject').value || null;
    var date = $('#n-date').value || isoDay(new Date());
    var due = kind === 'homework' ? $('#n-due').value || '' : '';
    var editing = noteForm && noteForm.id;

    BB.store.update(function (state) {
      state.notes = state.notes || [];
      if (editing) {
        state.notes.forEach(function (note) {
          if (note.id !== editing) return;
          note.text = text;
          note.kind = kind;
          note.subjectCode = subjectCode;
          note.date = date;
          note.due = due;
        });
        return;
      }
      state.notes.push({
        id: 'n' + Date.now(),
        date: date,
        subjectCode: subjectCode,
        text: text,
        kind: kind,
        due: due,
        done: false
      });
    });

    noteForm = null;
    toast(t('notes.toastSaved'));
    init();
  }

  function openNoteForm(prefill) {
    noteForm = {
      id: '',
      kind: (prefill && prefill.kind) || 'homework',
      text: '',
      subjectCode: (prefill && prefill.subjectCode) || '',
      date: (prefill && prefill.date) || isoDay(new Date()),
      due: ''
    };
    renderNotes(BB.store.get(), new Date());
    var host = $('#notes');
    if (host && host.scrollIntoView) host.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* 時間割ブロックと Next Class の「メモを追加」導線。 */
  function bindNoteTriggers() {
    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-note-for]');
      if (!trigger) return;
      event.preventDefault();
      openNoteForm({
        subjectCode: trigger.getAttribute('data-note-for'),
        date: trigger.getAttribute('data-note-date')
      });
    });
  }

  function bindNotes() {
    var host = $('#notes');
    if (!host || host.getAttribute('data-bound') === '1') return;
    host.setAttribute('data-bound', '1');

    host.addEventListener('click', function (event) {
      if (event.target.closest('[data-note-add]')) {
        openNoteForm(null);
        return;
      }
      if (event.target.closest('[data-note-cancel]')) {
        noteForm = null;
        renderNotes(BB.store.get(), new Date());
        return;
      }

      var toggle = event.target.closest('[data-note-toggle]');
      if (toggle) {
        var toggleId = toggle.getAttribute('data-note-toggle');
        BB.store.update(function (state) {
          (state.notes || []).forEach(function (note) {
            if (note.id === toggleId) note.done = !note.done;
          });
        });
        init();
        return;
      }

      var edit = event.target.closest('[data-note-edit]');
      if (edit) {
        var found = findNote(edit.getAttribute('data-note-edit'));
        if (!found) return;
        noteForm = {
          id: found.id,
          kind: found.kind,
          text: found.text,
          subjectCode: found.subjectCode || '',
          date: found.date || isoDay(new Date()),
          due: found.due || ''
        };
        renderNotes(BB.store.get(), new Date());
        return;
      }

      var remove = event.target.closest('[data-note-delete]');
      if (remove) {
        var removeId = remove.getAttribute('data-note-delete');
        var notes = notesOf(BB.store.get());
        var index = -1;
        notes.forEach(function (note, position) {
          if (note.id === removeId) index = position;
        });
        if (index < 0) return;
        var removed = JSON.parse(JSON.stringify(notes[index]));

        confirmAction({
          title: t('notes.deleteTitle'),
          message: t('notes.deleteBody', { text: removed.text }),
          confirmLabel: t('notes.deleteOk'),
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          BB.store.update(function (state) {
            state.notes = (state.notes || []).filter(function (note) {
              return note.id !== removeId;
            });
          });
          init();
          toast(t('notes.toastDeleted'), {
            actionLabel: t('common.undo'),
            onAction: function () {
              BB.store.update(function (state) {
                state.notes = state.notes || [];
                state.notes.splice(Math.min(index, state.notes.length), 0, removed);
              });
              init();
              toast(t('notes.toastRestored'));
            }
          });
        });
      }
    });

    host.addEventListener('submit', function (event) {
      if (event.target.id !== 'note-form') return;
      event.preventDefault();
      saveNote();
    });
  }

  function renderGrades(state) {
    var host = $('#grades');
    if (!host) return;
    if (!state.subjects.length) {
      host.innerHTML =
        '<div class="p-8 text-center">' +
        '<span class="material-symbols-outlined text-[28px] text-placeholder">grading</span>' +
        '<p class="text-body-sm text-muted mt-2">' + t('grades.empty') + '</p>' +
        '<a href="subject-edit.html?new=1" class="bb-btn bb-btn-ghost mt-3">' + t('grades.addSubject') + '</a></div>';
      return;
    }
    host.innerHTML = state.subjects
      .map(function (subject) {
        var secured = securedOf(subject);
        var chip = BB.color.chip(subject.color);
        var right;

        if (!secured.published) {
          right =
            '<div class="text-right"><span class="text-body-sm text-muted italic">' + t('grades.notPublished') + '</span></div>' +
            '<div class="flex items-center gap-3"><span class="text-label-md font-semibold text-muted">' + t('grades.secured') + '</span>' +
            '<span class="material-symbols-outlined text-[22px] text-muted group-hover:text-primary group-hover:translate-x-1 transition-all">chevron_right</span></div>';
        } else {
          var pct = secured.possible ? (secured.secured / secured.possible) * 100 : 0;
          right =
            '<div class="w-40 sm:w-56 space-y-1">' +
            '<div class="flex justify-between text-caption text-muted"><span>' + t('grades.courseworkSecured') + '</span>' +
            '<span class="font-bold text-ink num">' +
            t('grades.marks', { a: secured.secured.toFixed(1), b: secured.possible }) + '</span></div>' +
            '<div class="w-full bg-border h-2 rounded-full overflow-hidden">' +
            '<div class="h-full rounded-full" style="width:' + pct + '%;background:' + subject.color + '"></div></div></div>' +
            '<div class="flex items-center gap-2">' +
            '<span class="px-2 py-0.5 rounded text-caption font-medium" style="background:' + chip.background + ';color:' + chip.color + '">' +
            t('grades.simulator') + '</span>' +
            '<span class="material-symbols-outlined text-[22px] text-muted group-hover:text-primary group-hover:translate-x-1 transition-all">chevron_right</span></div>';
        }

        return (
          '<a href="simulator.html?subject=' + subject.id + '" class="group p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-canvas transition-colors">' +
          '<div class="flex items-center gap-3">' +
          '<span class="px-3 py-1 rounded-md text-caption font-bold text-white" style="background:' + subject.color + '">' + subject.id + '</span>' +
          '<div><h3 class="text-title-md font-bold text-ink">' + subject.name + '</h3>' +
          '<p class="text-caption text-muted">' + t('grades.creditHours', { n: subject.credits }) +
          (subject.lecturer ? ' • ' + subject.lecturer : '') + '</p></div></div>' +
          '<div class="flex items-center gap-6">' + right + '</div></a>'
        );
      })
      .join('');
  }

  /* 科目0件の間だけ出す「セットアップを続ける」カード。ウィザードを開き直せる。 */
  function renderSetupCard(state) {
    var host = $('#setup-card');
    if (!host) return;
    if (state.subjects.length) {
      host.innerHTML = '';
      return;
    }
    host.innerHTML =
      '<div class="rounded-card border border-primary/25 bg-surface-sunken p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">' +
      '<div class="flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[24px] text-primary mt-0.5">add_task</span>' +
      '<div><div class="text-title-md font-bold text-ink">' + t('setupCard.title') + '</div>' +
      '<p class="text-body-sm text-muted mt-1">' + t('setupCard.body') + '</p></div></div>' +
      '<a href="setup.html" class="bb-btn bb-btn-primary shrink-0">' +
      '<span class="material-symbols-outlined text-[18px]">arrow_forward</span>' + t('setupCard.cta') + '</a></div>';
  }

  /* ---------- 個人予定のフォーム ---------- */

  var eventDraft = null;

  function eventFormHtml(state) {
    var draft = eventDraft;
    var isOnce = draft.kind !== 'weekly';
    var weekdayOptions = [1, 2, 3, 4, 5]
      .map(function (day) {
        return '<option value="' + day + '"' + (Number(draft.weekday) === day ? ' selected' : '') + '>' +
          dayName(day) + '</option>';
      })
      .join('');
    var swatches = EVENT_COLORS.map(function (color) {
      return '<button type="button" class="w-7 h-7 rounded-full border-2" style="background:' + color +
        ';border-color:' + (draft.color === color ? 'var(--bb-text)' : 'transparent') + '"' +
        ' data-event-color="' + color + '" aria-label="' + color + '"></button>';
    }).join('');

    return (
      '<form id="event-form-el" class="bb-card p-4 space-y-3">' +
      '<div class="flex items-center justify-between">' +
      '<h3 class="text-label-md font-bold text-ink">' + (draft.id ? t('pe.editTitle') : t('pe.title')) + '</h3>' +
      '<button type="button" data-event-cancel class="text-muted hover:text-ink" aria-label="' + t('common.cancel') + '">' +
      '<span class="material-symbols-outlined text-[18px]">close</span></button></div>' +
      '<p class="text-caption text-muted">' + t('pe.subtitle') + '</p>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
      '<div class="sm:col-span-2"><label class="bb-label" for="pe-name">' + t('pe.name') + '</label>' +
      '<input id="pe-name" name="title" class="bb-input" type="text" value="' + escHtml(draft.title) +
      '" placeholder="' + escHtml(t('pe.namePlaceholder')) + '" required></div>' +
      '<div><label class="bb-label" for="pe-kind">' + t('pe.kind') + '</label>' +
      '<select id="pe-kind" name="kind" class="bb-input">' +
      '<option value="once"' + (isOnce ? ' selected' : '') + '>' + t('pe.kindOnce') + '</option>' +
      '<option value="weekly"' + (isOnce ? '' : ' selected') + '>' + t('pe.kindWeekly') + '</option></select></div>' +
      (isOnce
        ? '<div><label class="bb-label" for="pe-date">' + t('pe.date') + '</label>' +
          '<input id="pe-date" name="date" class="bb-input num" type="date" value="' + escHtml(draft.date) + '"></div>'
        : '<div><label class="bb-label" for="pe-weekday">' + t('pe.weekday') + '</label>' +
          '<select id="pe-weekday" name="weekday" class="bb-input">' + weekdayOptions + '</select></div>') +
      '<div><label class="bb-label" for="pe-start">' + t('pe.start') + '</label>' +
      '<input id="pe-start" name="start" class="bb-input num" type="time" value="' + escHtml(draft.start) + '"></div>' +
      '<div><label class="bb-label" for="pe-end">' + t('pe.end') + '</label>' +
      '<input id="pe-end" name="end" class="bb-input num" type="time" value="' + escHtml(draft.end) + '"></div>' +
      '<div class="sm:col-span-2"><label class="bb-label">' + t('pe.color') + '</label>' +
      '<div class="flex items-center gap-2">' + swatches + '</div></div>' +
      '<div class="sm:col-span-2"><label class="bb-label" for="pe-memo">' + t('pe.memo') + '</label>' +
      '<textarea id="pe-memo" name="memo" class="bb-input" rows="2" placeholder="' +
      escHtml(t('pe.memoPlaceholder')) + '">' + escHtml(draft.memo) + '</textarea></div>' +
      '</div>' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
      (draft.id
        ? '<button type="button" class="bb-btn bb-btn-ghost" data-event-delete="' + draft.id + '">' +
          '<span class="material-symbols-outlined text-[18px]">delete</span>' + t('pe.remove') + '</button>'
        : '<span></span>') +
      '<div class="flex items-center gap-2">' +
      '<button type="button" class="bb-btn bb-btn-ghost" data-event-cancel>' + t('common.cancel') + '</button>' +
      '<button type="submit" class="bb-btn bb-btn-primary">' + t('pe.save') + '</button></div></div>' +
      '</form>'
    );
  }

  /* 再描画の前に、入力中の値を下書きへ戻す。種別を切り替えても入力が消えないように。 */
  function collectEventForm() {
    var form = $('#event-form-el');
    if (!form || !eventDraft) return;
    if (form.elements.title) eventDraft.title = form.elements.title.value;
    if (form.elements.date) eventDraft.date = form.elements.date.value;
    if (form.elements.weekday) eventDraft.weekday = Number(form.elements.weekday.value) || 1;
    if (form.elements.start) eventDraft.start = form.elements.start.value;
    if (form.elements.end) eventDraft.end = form.elements.end.value;
    if (form.elements.memo) eventDraft.memo = form.elements.memo.value;
  }

  function renderEventForm(state) {
    var host = $('#event-form');
    if (!host) return;
    host.innerHTML = eventDraft ? eventFormHtml(state) : '';
  }

  function openEventForm(id) {
    var state = BB.store.get();
    if (id) {
      var found = eventById(state, id);
      if (!found) return;
      eventDraft = {
        id: found.id,
        title: found.title || '',
        kind: found.kind === 'weekly' ? 'weekly' : 'once',
        date: found.date || isoDay(new Date()),
        weekday: Number(found.weekday) || 1,
        start: found.start || '09:00',
        end: found.end || '10:00',
        color: found.color || EVENT_COLORS[0],
        memo: found.memo || ''
      };
    } else {
      eventDraft = {
        id: null,
        title: '',
        kind: 'once',
        date: isoDay(new Date()),
        weekday: 1,
        start: '09:00',
        end: '10:00',
        color: EVENT_COLORS[0],
        memo: ''
      };
    }
    renderEventForm(state);
    var field = $('#pe-name');
    if (field) field.focus();
  }

  function saveEvent(form) {
    var draft = eventDraft;
    if (!draft) return;
    var title = form.elements.title.value.trim();
    if (!title) {
      BB.ui.toast(t('pe.nameRequired'));
      return;
    }
    var kind = form.elements.kind.value === 'weekly' ? 'weekly' : 'once';
    var date = kind === 'once' ? form.elements.date.value.trim() : '';
    if (kind === 'once' && !date) {
      BB.ui.toast(t('pe.dateRequired'));
      return;
    }
    var start = form.elements.start.value.trim();
    var end = form.elements.end.value.trim();
    if (!start || !end || end <= start) {
      BB.ui.toast(t('pe.timeInvalid'));
      return;
    }
    var weekday = kind === 'weekly' ? Number(form.elements.weekday.value) : 0;
    var memo = form.elements.memo.value.trim();
    var id = draft.id;

    BB.store.update(function (state) {
      state.personalEvents = state.personalEvents || [];
      var entry = null;
      state.personalEvents.forEach(function (candidate) {
        if (candidate.id === id) entry = candidate;
      });
      if (!entry) {
        entry = { id: 'pe' + Date.now() };
        state.personalEvents.push(entry);
      }
      entry.title = title;
      entry.kind = kind;
      entry.date = date;
      entry.weekday = weekday;
      entry.start = start;
      entry.end = end;
      entry.color = draft.color;
      entry.memo = memo;
    });

    eventDraft = null;
    init();
    BB.ui.toast(t('pe.saved'));
  }

  function deleteEvent(id) {
    var state = BB.store.get();
    var found = eventById(state, id);
    if (!found) return;
    var removed = JSON.parse(JSON.stringify(found));
    BB.ui
      .confirm({
        title: t('pe.confirmTitle'),
        message: t('pe.confirmBody', { name: removed.title }),
        confirmLabel: t('pe.confirmOk'),
        danger: true
      })
      .then(function (ok) {
        if (!ok) return;
        BB.store.update(function (data) {
          data.personalEvents = (data.personalEvents || []).filter(function (entry) {
            return entry.id !== id;
          });
        });
        eventDraft = null;
        init();
        BB.ui.toast(t('pe.deleted'), {
          actionLabel: t('common.undo'),
          onAction: function () {
            BB.store.update(function (data) {
              data.personalEvents = data.personalEvents || [];
              data.personalEvents.push(removed);
            });
            init();
            BB.ui.toast(t('pe.restored'));
          }
        });
      });
  }

  function bindEvents() {
    var addButton = $('#tt-add-event');
    if (addButton && addButton.getAttribute('data-bound') !== '1') {
      addButton.setAttribute('data-bound', '1');
      addButton.addEventListener('click', function () {
        openEventForm(null);
      });
    }

    var grid = $('#timetable');
    if (grid && grid.getAttribute('data-bound') !== '1') {
      grid.setAttribute('data-bound', '1');
      grid.addEventListener('click', function (event) {
        var trigger = event.target.closest('[data-event-edit]');
        if (!trigger) return;
        event.preventDefault();
        openEventForm(trigger.getAttribute('data-event-edit'));
      });
    }

    var host = $('#event-form');
    if (!host || host.getAttribute('data-bound') === '1') return;
    host.setAttribute('data-bound', '1');

    host.addEventListener('click', function (event) {
      if (event.target.closest('[data-event-cancel]')) {
        eventDraft = null;
        renderEventForm(BB.store.get());
        return;
      }
      var swatch = event.target.closest('[data-event-color]');
      if (swatch) {
        collectEventForm();
        if (eventDraft) eventDraft.color = swatch.getAttribute('data-event-color');
        renderEventForm(BB.store.get());
        return;
      }
      var remove = event.target.closest('[data-event-delete]');
      if (remove) deleteEvent(remove.getAttribute('data-event-delete'));
    });

    host.addEventListener('change', function (event) {
      if (event.target.id !== 'pe-kind' || !eventDraft) return;
      /* 単発と毎週で必要な入力が変わる。選び直したら描き直す。 */
      collectEventForm();
      eventDraft.kind = event.target.value === 'weekly' ? 'weekly' : 'once';
      renderEventForm(BB.store.get());
    });

    host.addEventListener('submit', function (event) {
      if (event.target.id !== 'event-form-el') return;
      event.preventDefault();
      saveEvent(event.target);
    });
  }

  function init() {
    var state = BB.store.get();

    /* 初回（科目0件かつ未セットアップ）はウィザードへ。Skip 済みならここには来ない。 */
    if (BB.store.needsSetup()) {
      window.location.replace('setup.html');
      return;
    }

    var now = new Date();
    var preview = isPreview(now);
    var next = nextClass(now);

    bindHeader(state, now, preview);
    renderSetupCard(state);
    renderPreviewBanner(preview, now);
    renderNextClass(next, now, preview);
    renderLegend(state);
    renderTimetable(state, now);
    renderClassDetail(next, state, now);
    renderTopics(state);
    renderSummaries(state, now, next);
    renderNotes(state, now);
    renderEventForm(state);
    renderGrades(state);
  }

  /* ---------- shared page shell ---------- */

  /* ウィザード中は保存前の入力を見せたいので、表示値だけ差し替えられるようにする。 */
  function escHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 学期名が未設定なら言語ごとの既定名を出す。空欄のままにしない。 */
  function termLabelOf(state) {
    return state.term.label || t('wizard.term.labelPlaceholder');
  }

  function header(opts, preview) {
    var state = BB.store.get();
    var termLabel = preview && preview.termLabel !== undefined ? preview.termLabel : termLabelOf(state);
    var initials = preview && preview.initials !== undefined ? preview.initials : state.student.initials;
    var now = new Date();
    var weekText = isPreview(now)
      ? t('header.starts', { date: fmtDate(termStart()) })
      : t('common.weekOf', { n: currentWeek(now), total: state.term.weeks || 14 });
    return (
      '<header class="sticky top-0 z-30 w-full bg-surface border-b border-border shadow-rest">' +
      '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">' +
      '<div class="flex items-center gap-3 min-w-0">' +
      '<a href="index.html" class="p-2 -ml-2 rounded-control text-muted hover:text-primary hover:bg-surface-subtle transition-colors" aria-label="' +
      escHtml(t('nav.backToDashboard')) + '" title="' + escHtml(t('nav.backToDashboard')) + '">' +
      '<span class="material-symbols-outlined text-[20px]">arrow_back</span></a>' +
      '<a href="index.html" class="flex items-center gap-2.5 min-w-0">' +
      '<img src="assets/logo.svg" alt="" class="w-8 h-8 rounded-lg flex-shrink-0">' +
      '<span class="flex flex-col leading-none min-w-0">' +
      '<span class="text-title-md text-primary tracking-tight whitespace-nowrap"><span class="font-bold">MMU</span> <span class="font-normal">BeeBoard</span></span>' +
      '<span class="text-[11px] text-muted font-medium mt-0.5 whitespace-nowrap">' +
      escHtml(opts.title || t('brand.tagline')) + '</span>' +
      '</span></a>' +
      '<div class="hidden lg:block h-4 w-px bg-border"></div>' +
      '<div class="hidden lg:flex items-center gap-2 text-muted text-label-md">' +
      '<span class="material-symbols-outlined text-[18px] text-primary">calendar_today</span>' +
      '<span>' + escHtml(termLabel) + '</span><span class="text-border">•</span>' +
      '<span class="font-medium text-ink">' + weekText + '</span></div>' +
      '</div>' +
      '<div class="flex items-center gap-3">' +
      '<span class="w-8 h-8 rounded-full bg-primary text-on-primary text-label-sm font-bold flex items-center justify-center flex-shrink-0">' + escHtml(initials) + '</span>' +
      '<a href="settings.html" class="p-2 text-muted hover:text-primary hover:bg-surface-subtle rounded-control border border-transparent hover:border-border transition-colors" aria-label="' +
      escHtml(t('nav.settings')) + '" title="' + escHtml(t('nav.settings')) + '">' +
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

  function footer(preview) {
    var state = BB.store.get();
    var termLabel = preview && preview.termLabel !== undefined ? preview.termLabel : termLabelOf(state);
    return (
      '<footer class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 flex flex-col sm:flex-row items-center justify-between text-caption text-muted gap-2 border-t border-border">' +
      '<div class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-success"></span>' +
      '<span>' + t('dash.footer') + '</span></div>' +
      '<div class="num">' + escHtml(termLabel) +
      (state.student.studentId ? t('header.studentIdSuffix', { id: state.student.studentId }) : '') +
      '</div></footer>'
    );
  }

  var mountOptions = null;

  /* プレースホルダを描画結果で置き換え、同じ id を付け直す。
     id を残さないと 2 回目以降の描き直し（名前変更など）ができない。 */
  function replacePlaceholder(id, html) {
    var node = document.getElementById(id);
    if (!node) return;
    node.insertAdjacentHTML('beforebegin', html);
    var fresh = node.previousElementSibling;
    node.remove();
    if (fresh) fresh.id = id;
  }

  function mount(opts) {
    mountOptions = opts || mountOptions || {};
    replacePlaceholder('app-header', header(mountOptions));
    replacePlaceholder('app-footer', footer());
    var page = document.getElementById('page-head');
    if (page && mountOptions.head) page.innerHTML = pageHead(mountOptions.head);
  }

  /* ヘッダーとフッターだけ描き直す。氏名・イニシャルの変更を即座に反映する。
     preview を渡すと保存前の入力値で表示する（初回ウィザード用）。 */
  function refreshChrome(preview) {
    if (!mountOptions) return;
    replacePlaceholder('app-header', header(mountOptions, preview));
    replacePlaceholder('app-footer', footer(preview));
  }

  /* ページ副題を現在の設定値で描き直す。しきい値などを追随させる。 */
  function setHead(headOpts) {
    if (mountOptions) mountOptions.head = headOpts;
    var page = document.getElementById('page-head');
    if (page) page.innerHTML = pageHead(headOpts);
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

  function toast(message, options) {
    options = options || {};
    var stack = $('.bb-toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'bb-toast-stack';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }

    var node = document.createElement('div');
    node.className = 'bb-toast';

    var text = document.createElement('span');
    text.textContent = message;
    node.appendChild(text);

    var timer = null;
    function dismiss() {
      if (timer) clearTimeout(timer);
      node.remove();
    }

    if (options.actionLabel && typeof options.onAction === 'function') {
      var action = document.createElement('button');
      action.type = 'button';
      action.className = 'bb-toast-action';
      action.textContent = options.actionLabel;
      action.addEventListener('click', function () {
        dismiss();
        options.onAction();
      });
      node.appendChild(action);
    }

    stack.appendChild(node);
    timer = setTimeout(dismiss, options.duration || (options.actionLabel ? 6000 : 1800));
    return dismiss;
  }

  /* 破壊的操作の確認。ネイティブ confirm() は環境によって自動却下され
     「押しても無反応」に見えるため、ページ内モーダルで true/false を返す。 */
  function confirmAction(options) {
    options = options || {};
    return new Promise(function (resolve) {
      var previousFocus = document.activeElement;
      var overlay = document.createElement('div');
      overlay.className = 'bb-modal';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML =
        '<div class="bb-modal-panel">' +
        '<div class="bb-modal-title"></div>' +
        '<p class="bb-modal-body"></p>' +
        '<div class="bb-modal-actions">' +
        '<button type="button" class="bb-btn bb-btn-ghost" data-modal-cancel></button>' +
        '<button type="button" class="bb-btn ' + (options.danger ? 'bb-btn-danger' : 'bb-btn-primary') +
        '" data-modal-confirm></button>' +
        '</div></div>';

      $('.bb-modal-title', overlay).textContent = options.title || t('common.areYouSure');
      $('.bb-modal-body', overlay).textContent = options.message || '';
      $('[data-modal-cancel]', overlay).textContent = options.cancelLabel || t('common.cancel');
      $('[data-modal-confirm]', overlay).textContent = options.confirmLabel || t('common.confirm');

      function close(result) {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        if (previousFocus && previousFocus.focus) previousFocus.focus();
        resolve(result);
      }

      function onKey(event) {
        if (event.key === 'Escape') {
          event.preventDefault();
          close(false);
        }
      }

      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) close(false);
        if (event.target.closest('[data-modal-cancel]')) close(false);
        if (event.target.closest('[data-modal-confirm]')) close(true);
      });

      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(overlay);
      /* 破壊的操作では Cancel にフォーカスを置く。Enter の連打で消えないように。 */
      $(options.danger ? '[data-modal-cancel]' : '[data-modal-confirm]', overlay).focus();
    });
  }

  /* 氏名からアバターのイニシャルを作る。設定変更時にヘッダーを追随させるため公開する。 */
  function initialsOf(name) {
    var words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'S';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }

  /* 出席は「どのコマを・いつの分か」を明示して記録する。誤タップを取り消せるよう
     記録した log の位置を返し、unmark で同じ位置を消せるようにする。 */
  function markAttendance(subjectId, status, meta) {
    meta = meta || {};
    var index = -1;
    BB.store.update(function (state) {
      var subject = null;
      state.subjects.forEach(function (item) {
        if (item.id === subjectId) subject = item;
      });
      if (!subject) return;
      if (!subject.attendance) subject.attendance = { held: 0, attended: 0, absences: 0, log: [] };
      subject.attendance.log = subject.attendance.log || [];
      subject.attendance.held += 1;
      if (status === 'present') subject.attendance.attended += 1;
      else subject.attendance.absences += 1;
      subject.attendance.log.push({
        id: 'at' + Date.now(),
        date: meta.date || new Date().toISOString().slice(0, 10),
        status: status,
        session: meta.session || '',
        /* 表示用の文字列は言語に依存する。言語を切り替えても作り直せるよう、
           元のコマ情報も残しておく。 */
        sessionMeta: meta.sessionMeta || null
      });
      index = subject.attendance.log.length - 1;
    });
    return index;
  }

  /* 出席記録を 1 件取り消す。held と attended/absences の集計も同時に戻す。 */
  function unmarkAttendance(subjectId, index) {
    BB.store.update(function (state) {
      var subject = null;
      state.subjects.forEach(function (item) {
        if (item.id === subjectId) subject = item;
      });
      if (!subject || !subject.attendance || !subject.attendance.log) return;
      var entry = subject.attendance.log[index];
      if (!entry) return;
      subject.attendance.log.splice(index, 1);
      subject.attendance.held = Math.max(0, subject.attendance.held - 1);
      if (entry.status === 'present') {
        subject.attendance.attended = Math.max(0, subject.attendance.attended - 1);
      } else {
        subject.attendance.absences = Math.max(0, subject.attendance.absences - 1);
      }
    });
  }

  /* 休講・振替は定例コマの定義を書き換えず、sessionOverrides に 1 件だけ持つ。
     同じ科目・コマ・日付に二重登録しないよう、既存があれば上書きする。 */
  function setOverride(subjectId, sessionIndex, date, kind, target) {
    BB.store.update(function (state) {
      state.sessionOverrides = state.sessionOverrides || [];
      var existing = null;
      state.sessionOverrides.forEach(function (entry) {
        if (entry.subjectId === subjectId && entry.sessionIndex === sessionIndex && entry.date === date) {
          existing = entry;
        }
      });
      if (existing) {
        existing.kind = kind;
        existing.target = target || null;
        return;
      }
      state.sessionOverrides.push({
        id: 'so' + Date.now(),
        subjectId: subjectId,
        sessionIndex: sessionIndex,
        date: date,
        kind: kind,
        target: target || null
      });
    });
  }

  function removeOverride(id) {
    BB.store.update(function (state) {
      state.sessionOverrides = (state.sessionOverrides || []).filter(function (entry) {
        return entry.id !== id;
      });
    });
  }

  BB.ui = {
    header: header,
    footer: footer,
    pageHead: pageHead,
    mount: mount,
    refreshChrome: refreshChrome,
    setHead: setHead,
    chip: chip,
    solidChip: solidChip,
    toast: toast,
    confirm: confirmAction,
    initials: initialsOf,
    termLabel: termLabelOf
  };

  BB.attendance = {
    mark: markAttendance,
    unmark: unmarkAttendance,
    setOverride: setOverride,
    removeOverride: removeOverride
  };

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
    fmtDate: fmtDate,
    fmtDateFull: fmtDateFull,
    fmtDateTime: fmtDateTime,
    fmtIsoDate: fmtIsoDate,
    deadlineItems: deadlineItems,
    deadlineDetail: deadlineDetail,
    hasDeadlineDetail: hasDeadlineDetail,
    setDeadlineDetail: setDeadlineDetail,
    eventsForDay: eventsForDay,
    personalEventsOf: personalEventsOf,
    overridesOf: overridesOf,
    overrideFor: overrideFor,
    noClassCount: noClassCount,
    extraSessions: extraSessions,
    currentWeek: currentWeek,
    weekDates: weekDates,
    weekOf: weekOfClamped,
    calendarDays: calendarDays,
    isPreview: isPreview,
    countBlocks: function () {
      return BB.store.get().subjects.reduce(function (total, subject) {
        return total + subject.sessions.length;
      }, 0);
    }
  };

  if (typeof document !== 'undefined' && document.body && document.body.dataset.page === 'dashboard') {
    init();
    bindNotes();
    bindNoteTriggers();
    bindEvents();
    /* 他タブの保存は storage イベントで届く。ヘッダーもページ本体も、
       開いているフォームの入力を保ったまま描き直す。 */
    BB.store.subscribe(function () {
      syncOpenForms();
      init();
    });
  }
})(window);
