/* MMU BeeBoard — one class, in detail.
   回の同一性は既存の約束どおり (subjectId, sessionIndex, date) だけで表す。新しい ID は作らない。
   振替先のブロックから来ても URL は元の回を指すので、同じ詳細が開く。 */
(function () {
  'use strict';

  var BB = window.BB;
  var t = BB.i18n.t;
  var DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var params = new URLSearchParams(window.location.search);
  var subjectId = params.get('subject') || '';
  var sessionParam = params.get('session');
  var dateParam = params.get('date') || '';
  /* 開いている例外フォーム。null なら閉じている。入力途中の値は draft に持つ。 */
  var editor = null;
  var draft = null;

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isoOf(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  /* 学期の最終日。開始日が未設定なら null（範囲判定をしない）。 */
  function termEnd() {
    var start = BB.date.start();
    if (!start) return null;
    return addDays(start, (BB.store.get().term.weeks || 14) * 7 - 1);
  }

  /* URL の 3 つを検証して、その回を返す。1 つでも欠ければ null。 */
  function resolve() {
    var state = BB.store.get();
    var subject = null;
    state.subjects.forEach(function (candidate) {
      if (candidate.id === subjectId) subject = candidate;
    });
    if (!subject) return null;

    /* Number(null) は 0 になる。パラメータの欠落を 0 番目のコマと取り違えないよう、
       数字だけを受け付ける。 */
    if (!/^\d+$/.test(String(sessionParam === null ? '' : sessionParam))) return null;
    var index = Number(sessionParam);
    if (index >= subject.sessions.length) return null;
    var session = subject.sessions[index];
    if (!session) return null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return null;
    var day = BB.date.parse(dateParam);
    if (!day) return null;
    /* 2026-02-31 のような繰り上がりを弾く。 */
    if (isoOf(day) !== dateParam) return null;
    /* そのコマの曜日と違う日付は「存在しない回」。 */
    if (Number(session.day) !== day.getDay()) return null;

    var start = BB.date.start();
    var end = termEnd();
    if (start && end && (day.getTime() < start.getTime() || day.getTime() > end.getTime())) return null;

    return {
      subject: subject,
      session: session,
      index: index,
      date: dateParam,
      day: day,
      week: BB.dash.weekOf(day)
    };
  }

  /* 同じ科目・同じコマの前後の回。学期の外へは出さない（null で無効化）。 */
  function shiftHref(found, weeks) {
    var day = addDays(found.day, weeks * 7);
    var start = BB.date.start();
    var end = termEnd();
    if (start && end && (day.getTime() < start.getTime() || day.getTime() > end.getTime())) return null;
    return BB.dash.sessionHref(found.subject.id, found.index, isoOf(day));
  }

  /* 出席ページと同じ書式。ログの行が両方のページで同じ見た目になる。 */
  function sessionLabel(session) {
    if (!session) return '';
    var day = session.day === undefined || session.day === null ? '' : t('day.' + DAY_KEYS[session.day]) + ' ';
    return day + session.start + '–' + session.end + ' ' + session.type +
      (session.room ? ' · ' + session.room : '');
  }

  /* その回の出席記録。日付とコマ（開始・終了）で照合する。
     sessionMeta を持たない古い記録は日付だけで照合する。 */
  function attendanceEntry(found) {
    var log = (found.subject.attendance && found.subject.attendance.log) || [];
    var match = null;
    log.forEach(function (entry, index) {
      if (String(entry.date).slice(0, 10) !== found.date) return;
      var meta = entry.sessionMeta;
      if (meta) {
        if (String(meta.start) !== String(found.session.start)) return;
        if (String(meta.end) !== String(found.session.end)) return;
      }
      match = { entry: entry, index: index };
    });
    return match;
  }

  function typeLabel(type) {
    var key = 'sd.type.' + String(type || '').toUpperCase();
    var label = t(key);
    return label === key ? String(type || '') : label;
  }

  function badge(text, background, color) {
    return '<span class="bb-chip" style="background:' + background + ';color:' + color + '">' +
      esc(text) + '</span>';
  }

  function metaRow(label, value) {
    return (
      '<div class="min-w-0"><div class="text-caption uppercase tracking-wider text-muted">' + label + '</div>' +
      '<div class="text-body-md font-semibold text-ink break-words">' + value + '</div></div>'
    );
  }

  function roomHtml(session) {
    var code = String(session.room === undefined || session.room === null ? '' : session.room).trim();
    if (!code) return '<span class="text-muted">' + t('sd.roomTbd') + '</span>';
    var label = BB.room ? BB.room.label(code) : null;
    return esc(code) +
      (label ? '<span class="block text-caption font-normal text-muted">' + esc(label) + '</span>' : '');
  }

  function headerHtml(found) {
    var subject = found.subject;
    var session = found.session;
    var chip = BB.color.chip(subject.color);
    return (
      '<div class="bb-card p-5">' +
      '<div class="flex flex-wrap items-center gap-2">' +
      BB.ui.solidChip(subject.color, esc(subject.id)) +
      '<span class="text-body-md font-semibold text-ink break-words">' + esc(subject.name) + '</span>' +
      '<span class="bb-chip" style="background:' + chip.background + ';color:' + chip.color +
      ';border:1px solid ' + chip.borderColor + '">' + esc(typeLabel(session.type)) + '</span>' +
      '</div>' +
      '<div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mt-3 pt-3 border-t border-border-subtle">' +
      metaRow(t('common.date'), esc(BB.dash.fmtDateFull(found.day))) +
      metaRow(t('common.weekLabel'), t('common.week', { n: found.week })) +
      metaRow(t('sd.time'), '<span class="num">' + esc(session.start + '–' + session.end) + '</span>') +
      metaRow(t('common.room'), roomHtml(session)) +
      '</div></div>'
    );
  }

  /* 休講・振替・オンラインの表示。未知の kind は従来どおり休講として扱う。 */
  function overrideHtml(override) {
    if (!override) return '';
    if (override.kind === 'transfer' && override.target) {
      var target = override.target;
      return (
        '<div class="flex flex-wrap items-center gap-2">' +
        badge(t('att.transferBadge'), 'var(--bb-surface-sunken)', 'var(--bb-text-muted)') +
        '<span class="text-body-sm text-body break-words">' +
        esc(t('att.transferTo', {
          date: BB.dash.fmtIsoDate(target.date),
          start: target.start,
          end: target.end
        })) + ' · ' + esc(target.room || t('att.transferRoomTbd')) + '</span></div>'
      );
    }
    if (override.kind === 'online') {
      var url = override.target && override.target.url ? String(override.target.url) : '';
      return (
        '<div class="flex flex-wrap items-center gap-2">' +
        badge(t('sd.online'), 'var(--bb-surface-sunken)', 'var(--bb-primary)') +
        '<span class="text-body-sm text-body">' + t('sd.onlineHint') + '</span>' +
        (url
          ? '<a class="bb-btn bb-btn-ghost bb-btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener">' +
            '<span class="material-symbols-outlined text-[16px]">videocam</span>' + t('sd.openMeeting') + '</a>'
          : '') +
        '</div>'
      );
    }
    return (
      '<div class="flex flex-wrap items-center gap-2">' +
      badge(t('att.noClassBadge'), 'var(--bb-surface-sunken)', 'var(--bb-text-muted)') +
      '<span class="text-body-sm text-body">' + t('att.noClassHint') + '</span></div>'
    );
  }

  function attendanceHtml(found) {
    var record = attendanceEntry(found);
    var text = record
      ? (record.entry.status === 'present' ? t('att.present') : t('att.absent'))
      : t('sd.notRecorded');
    var background = record
      ? (record.entry.status === 'present' ? 'var(--bb-success-surface)' : 'var(--bb-alert-surface)')
      : 'var(--bb-surface-sunken)';
    var color = record
      ? (record.entry.status === 'present' ? 'var(--bb-success)' : 'var(--bb-alert)')
      : 'var(--bb-text-muted)';
    return (
      '<div class="flex flex-wrap items-center gap-2">' +
      badge(text, background, color) +
      '<span class="text-caption text-muted">' + esc(sessionLabel(found.session)) + '</span></div>'
    );
  }

  function field(name, label, type, value) {
    return (
      '<div><label class="bb-label" for="sd-' + name + '">' + label + '</label>' +
      '<input id="sd-' + name + '" name="' + name + '" class="bb-input num" type="' + type +
      '" value="' + esc(value) + '" required></div>'
    );
  }

  /* 振替フォーム。必須と「終了＞開始」の検証は出席ページと同じ。 */
  function transferFormHtml() {
    var target = draft || {};
    return (
      '<form class="mt-3 rounded-control border border-border bg-canvas p-3 space-y-2.5" data-transfer-form>' +
      '<div class="text-label-md font-semibold text-ink">' + t('att.transferTitle') + '</div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">' +
      field('date', t('att.transferDate'), 'date', target.date) +
      field('start', t('att.transferStart'), 'time', target.start) +
      field('end', t('att.transferEnd'), 'time', target.end) +
      '</div>' +
      '<div><label class="bb-label" for="sd-room">' + t('att.transferRoom') + '</label>' +
      '<input id="sd-room" name="room" class="bb-input" type="text" value="' + esc(target.room) +
      '" placeholder="' + esc(t('att.transferRoomTbd')) + '"></div>' +
      '<div class="flex justify-end gap-2">' +
      '<button type="button" class="bb-btn bb-btn-ghost" data-editor-cancel>' + t('common.cancel') + '</button>' +
      '<button type="submit" class="bb-btn bb-btn-primary">' + t('att.transferSave') + '</button>' +
      '</div></form>'
    );
  }

  /* オンラインフォーム。URL は必須にしない（空で保存されたら例外を作らない）。 */
  function onlineFormHtml() {
    var url = draft && draft.url !== undefined ? draft.url : '';
    return (
      '<form class="mt-3 rounded-control border border-border bg-canvas p-3 space-y-2.5" data-online-form>' +
      '<div class="text-label-md font-semibold text-ink">' + t('sd.onlineTitle') + '</div>' +
      '<div><label class="bb-label" for="sd-url">' + t('sd.onlineUrl') + '</label>' +
      '<input id="sd-url" name="url" class="bb-input" type="url" value="' + esc(url) +
      '" placeholder="' + esc(t('sd.onlineUrlPlaceholder')) + '"></div>' +
      '<div class="flex justify-end gap-2">' +
      '<button type="button" class="bb-btn bb-btn-ghost" data-editor-cancel>' + t('common.cancel') + '</button>' +
      '<button type="submit" class="bb-btn bb-btn-primary">' + t('sd.onlineSave') + '</button>' +
      '</div></form>'
    );
  }

  function editorHtml() {
    if (editor === 'transfer') return transferFormHtml();
    if (editor === 'online') return onlineFormHtml();
    return '';
  }

  function exceptionActionsHtml(override) {
    return (
      '<div class="flex flex-wrap gap-2 mt-3">' +
      '<button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" data-override-cancel>' +
      '<span class="material-symbols-outlined text-[16px]">event_busy</span>' + t('att.markNoClass') + '</button>' +
      '<button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" data-override-transfer>' +
      '<span class="material-symbols-outlined text-[16px]">swap_horiz</span>' + t('att.transferBadge') + '</button>' +
      '<button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" data-override-online>' +
      '<span class="material-symbols-outlined text-[16px]">videocam</span>' + t('sd.online') + '</button>' +
      (override
        ? '<button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" data-override-remove>' +
          '<span class="material-symbols-outlined text-[16px]">delete</span>' + t('sd.removeException') + '</button>'
        : '') +
      '</div>' + editorHtml()
    );
  }

  function attendanceActionsHtml(found) {
    return (
      '<div class="flex flex-wrap gap-2 mt-3">' +
      '<button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" data-mark="present">' +
      '<span class="material-symbols-outlined text-[16px]">check</span>' + t('att.markPresent') + '</button>' +
      '<button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" data-mark="absent">' +
      '<span class="material-symbols-outlined text-[16px]">event_busy</span>' + t('att.markAbsent') + '</button>' +
      (attendanceEntry(found)
        ? '<button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" data-unmark>' +
          '<span class="material-symbols-outlined text-[16px]">undo</span>' + t('sd.removeRecord') + '</button>'
        : '') +
      '</div>'
    );
  }

  function statusHtml(found) {
    var override = BB.dash.overrideFor(BB.store.get(), found.subject.id, found.index, found.date);
    return (
      '<div class="bb-card p-5 space-y-4">' +
      '<h3 class="text-title-md font-bold text-ink">' + t('sd.status') + '</h3>' +
      '<div>' +
      '<div class="text-caption uppercase tracking-wider text-muted mb-1.5">' + t('sd.exception') + '</div>' +
      (override ? overrideHtml(override) : '<p class="text-body-sm text-muted">' + t('sd.noException') + '</p>') +
      exceptionActionsHtml(override) +
      '</div>' +
      '<div class="pt-3 border-t border-border-subtle">' +
      '<div class="text-caption uppercase tracking-wider text-muted mb-1.5">' + t('att.title') + '</div>' +
      attendanceHtml(found) +
      attendanceActionsHtml(found) +
      '</div></div>'
    );
  }

  function notesHtml(found) {
    var list = (BB.store.get().notes || []).filter(function (note) {
      return note.subjectCode === found.subject.id && String(note.date).slice(0, 10) === found.date;
    });
    var body = list.length
      ? list
          .map(function (note) {
            var homework = note.kind === 'homework';
            return (
              '<div class="flex items-start gap-3 px-5 py-3 border-b border-border-subtle last:border-0">' +
              '<span class="material-symbols-outlined text-[18px] mt-0.5 shrink-0" style="color:' +
              (note.done ? 'var(--bb-success)' : 'var(--bb-text-placeholder)') + '">' +
              (note.done ? 'check_circle' : 'radio_button_unchecked') + '</span>' +
              '<div class="min-w-0 flex-1">' +
              '<div class="text-body-sm break-words ' + (note.done ? 'line-through text-muted' : 'text-ink') + '">' +
              esc(note.text) + '</div>' +
              '<div class="flex flex-wrap items-center gap-2 text-caption text-muted mt-0.5">' +
              badge(homework ? t('notes.kindHomework') : t('notes.kindMemo'),
                'var(--bb-surface-sunken)', 'var(--bb-text-muted)') +
              (note.done ? badge(t('notes.done'), 'var(--bb-surface-sunken)', 'var(--bb-success)') : '') +
              (homework
                ? '<span>' + esc(note.due ? t('notes.dueOn', { when: BB.dash.fmtDateTime(note.due) }) : t('notes.noDue')) + '</span>'
                : '') +
              '</div></div></div>'
            );
          })
          .join('')
      : '<div class="px-5 py-6 text-center text-body-sm text-muted">' + t('sd.notesEmpty') + '</div>';

    return (
      '<div class="bb-card overflow-hidden">' +
      '<div class="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">' +
      '<div class="min-w-0"><h3 class="text-title-md font-bold text-ink">' + t('sd.notes') + '</h3>' +
      '<p class="text-caption text-muted">' + t('sd.notesHint') + '</p></div>' +
      '<a href="notes.html" class="bb-btn bb-btn-ghost bb-btn-sm shrink-0">' +
      '<span class="material-symbols-outlined text-[16px]">note_add</span>' + t('sd.openNotes') + '</a></div>' +
      body + '</div>'
    );
  }

  /* その科目の、この回以降でいちばん近い締切。deadlineItems は週の昇順。 */
  function nextDeadlineOf(subject, week) {
    var found = null;
    BB.dash.deadlineItems().forEach(function (item) {
      if (found || item.subject.id !== subject.id) return;
      if (item.week < week) return;
      found = item;
    });
    return found;
  }

  function overviewHtml(found) {
    var subject = found.subject;
    var secured = BB.dash.securedOf(subject);
    var attendance = BB.dash.attendanceOf(subject);
    var next = nextDeadlineOf(subject, found.week);

    var securedValue = secured.entered > 0
      ? secured.secured.toFixed(1) + ' / ' + secured.possible
      : '—';
    var rateValue = attendance.rate === null ? '—' : Math.round(attendance.rate) + '%';
    var rateNote = attendance.held > 0
      ? t('sd.attendanceHeld', { attended: attendance.attended, held: attendance.held })
      : t('sd.noAttendance');

    var assessments = subject.assessments.length
      ? subject.assessments
          .map(function (assessment) {
            return (
              '<div class="flex items-center justify-between gap-3 py-1.5 border-b border-border-subtle last:border-0">' +
              '<span class="text-body-sm text-body break-words">' + esc(assessment.name) + '</span>' +
              '<span class="text-body-sm font-semibold text-ink num shrink-0">' + assessment.weight + '%</span></div>'
            );
          })
          .join('')
      : '<p class="text-body-sm text-muted">' + t('grades.notPublished') + '</p>';

    return (
      '<div class="bb-card p-5">' +
      '<h3 class="text-title-md font-bold text-ink">' + t('sd.overview') + '</h3>' +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">' +
      '<div class="bg-canvas rounded-control p-3 border border-border-subtle min-w-0">' +
      '<div class="text-caption text-muted">' + t('sd.secured') + '</div>' +
      '<div class="text-title-md font-bold text-ink num">' + esc(securedValue) + '</div></div>' +
      '<div class="bg-canvas rounded-control p-3 border border-border-subtle min-w-0">' +
      '<div class="text-caption text-muted">' + t('sd.attendanceRate') + '</div>' +
      '<div class="text-title-md font-bold text-ink num">' + esc(rateValue) + '</div>' +
      '<div class="text-caption text-muted">' + esc(rateNote) + '</div></div>' +
      '<div class="bg-canvas rounded-control p-3 border border-border-subtle min-w-0">' +
      '<div class="text-caption text-muted">' + t('sd.nextDeadline') + '</div>' +
      (next
        ? '<div class="text-body-sm font-semibold text-ink break-words">' + esc(next.assessment.name) + '</div>' +
          '<div class="text-caption text-muted">' + t('common.week', { n: next.week }) + '</div>'
        : '<div class="text-body-sm text-muted">' + t('sd.noDeadline') + '</div>') +
      '</div></div>' +
      '<div class="mt-3 pt-3 border-t border-border-subtle">' +
      '<div class="flex items-center justify-between gap-3 mb-1">' +
      '<span class="text-caption uppercase tracking-wider text-muted">' + t('sd.assessments') + '</span>' +
      '<a href="deadlines.html" class="text-caption font-semibold text-primary hover:underline">' +
      t('sd.openDeadlines') + '</a></div>' +
      assessments + '</div></div>'
    );
  }

  /* この科目に結びついた eBwise の資料。対応が無い・0 件なら空文字を返す。 */
  function ebwiseInner(found) {
    if (!BB.ebwise || typeof BB.ebwise.mapping !== 'function') return '';
    var feed = BB.ebwise.feed();
    if (!feed) return '';
    var state = BB.store.get();
    var seenAt = (state.ebwise && state.ebwise.seenAt) || {};
    var items = BB.ebwise.core.materialsFor(
      feed,
      BB.ebwise.mapping().map,
      found.subject.id,
      seenAt[found.subject.id] || ''
    );
    if (!items.length) return '';

    var more = items.length > 5
      ? '<a href="index.html#ebwise" class="text-caption font-semibold text-primary hover:underline">' +
        esc(t('sd.ebwise.all')) + '</a>'
      : '';
    return (
      '<div class="bb-card p-5">' +
      '<div class="flex items-center justify-between gap-3">' +
      '<h3 class="text-title-md font-bold text-ink flex items-center gap-2">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">school</span>' +
      esc(t('sd.ebwise.title')) + '</h3>' + more + '</div>' +
      '<div class="mt-2">' +
      BB.ebwise.ui.materialRowsHtml(items.slice(0, 5), { site: feed.site }) +
      '</div></div>'
    );
  }

  function navHtml(found) {
    var prev = shiftHref(found, -1);
    var next = shiftHref(found, 1);
    function button(href, icon, label) {
      var inner = '<span class="material-symbols-outlined text-[18px]">' + icon + '</span>' +
        '<span class="truncate">' + label + '</span>';
      if (!href) {
        return '<button type="button" class="bb-btn bb-btn-ghost min-w-0" disabled>' + inner + '</button>';
      }
      return '<a class="bb-btn bb-btn-ghost min-w-0" href="' + esc(href) + '">' + inner + '</a>';
    }
    return (
      '<div class="flex items-center justify-between gap-3">' +
      button(prev, 'chevron_left', t('sd.prev')) +
      button(next, 'chevron_right', t('sd.next')) +
      '</div>'
    );
  }

  function notFoundHtml() {
    return (
      '<div class="bb-card p-8 text-center">' +
      '<span class="material-symbols-outlined text-[28px] text-placeholder">search_off</span>' +
      '<p class="text-body-md font-semibold text-ink mt-2">' + t('sd.notFound') + '</p>' +
      '<p class="text-body-sm text-muted mt-1">' + t('sd.notFoundHint') + '</p>' +
      '<a href="index.html" class="bb-btn bb-btn-primary mt-4">' +
      '<span class="material-symbols-outlined text-[18px]">dashboard</span>' + t('sd.back') + '</a></div>'
    );
  }

  function headFor(found) {
    return {
      title: found ? found.subject.id + ' ' + esc(found.subject.name) : t('sd.title'),
      subtitle: found ? t('sd.subtitle') : '',
      actions: '<a href="index.html" class="bb-btn bb-btn-ghost">' +
        '<span class="material-symbols-outlined text-[18px]">arrow_back</span>' + t('sd.back') + '</a>'
    };
  }

  BB.ui.mount({ title: t('sd.title'), head: { title: t('sd.title'), subtitle: t('sd.subtitle') } });

  function render() {
    var host = document.getElementById('detail');
    var found = resolve();
    BB.ui.setHead(headFor(found));
    if (!found) {
      host.innerHTML = notFoundHtml();
      return;
    }
    host.innerHTML =
      headerHtml(found) +
      statusHtml(found) +
      notesHtml(found) +
      overviewHtml(found) +
      '<div id="sd-ebwise">' + ebwiseInner(found) + '</div>' +
      navHtml(found);
  }

  /* ---------- 記録・編集 ---------- */

  /* 出席は出席ページと同じ BB.attendance.mark を通す。保存形式も集計も共通。 */
  function mark(status) {
    var found = resolve();
    if (!found) return;
    BB.attendance.mark(found.subject.id, status, {
      date: found.date,
      session: sessionLabel(found.session),
      sessionMeta: {
        day: found.session.day,
        start: found.session.start,
        end: found.session.end,
        type: found.session.type,
        room: found.session.room
      }
    });
    render();
    BB.ui.toast(status === 'present' ? t('att.toast.present') : t('att.toast.absent'));
  }

  function unmark() {
    var found = resolve();
    if (!found) return;
    var record = attendanceEntry(found);
    if (!record) return;
    BB.attendance.unmark(found.subject.id, record.index);
    render();
    BB.ui.toast(t('att.toast.removed'));
  }

  function currentOverride(found) {
    return BB.dash.overrideFor(BB.store.get(), found.subject.id, found.index, found.date);
  }

  function setCancel() {
    var found = resolve();
    if (!found) return;
    BB.attendance.setOverride(found.subject.id, found.index, found.date, 'cancel', null);
    editor = null;
    draft = null;
    render();
    BB.ui.toast(t('att.toast.noClass'));
  }

  function removeOverride() {
    var found = resolve();
    if (!found) return;
    var override = currentOverride(found);
    if (!override) return;
    BB.attendance.removeOverride(override.id);
    editor = null;
    draft = null;
    render();
    BB.ui.toast(
      override.kind === 'online'
        ? t('sd.toast.onlineRemoved')
        : override.kind === 'transfer'
          ? t('att.toast.transferRemoved')
          : t('att.toast.noClassRemoved')
    );
  }

  function openTransfer() {
    var found = resolve();
    if (!found) return;
    var override = currentOverride(found);
    var target = { date: '', start: '', end: '', room: '' };
    if (override && override.kind === 'transfer' && override.target) {
      target = {
        date: override.target.date || '',
        start: override.target.start || '',
        end: override.target.end || '',
        room: override.target.room || ''
      };
    }
    editor = 'transfer';
    draft = target;
    render();
  }

  function openOnline() {
    var found = resolve();
    if (!found) return;
    var override = currentOverride(found);
    editor = 'online';
    draft = {
      url: override && override.kind === 'online' && override.target ? override.target.url || '' : ''
    };
    render();
  }

  function saveTransfer(form) {
    var found = resolve();
    if (!found) return;
    var target = {
      date: form.elements.date.value.trim(),
      start: form.elements.start.value.trim(),
      end: form.elements.end.value.trim(),
      room: form.elements.room.value.trim()
    };
    /* 振替先は必須。空のまま保存させず、理由を出す。 */
    if (!target.date || !target.start || !target.end) {
      BB.ui.toast(t('att.toast.transferRequired'));
      return;
    }
    if (target.end <= target.start) {
      BB.ui.toast(t('att.toast.transferRange'));
      return;
    }
    BB.attendance.setOverride(found.subject.id, found.index, found.date, 'transfer', target);
    editor = null;
    draft = null;
    render();
    BB.ui.toast(t('att.toast.transferSaved'));
  }

  function saveOnline(form) {
    var found = resolve();
    if (!found) return;
    var url = form.elements.url.value.trim();
    /* URL が空なら例外を作らない。教室表示のままにする。 */
    if (!url) {
      BB.ui.toast(t('sd.toast.urlRequired'));
      return;
    }
    BB.attendance.setOverride(found.subject.id, found.index, found.date, 'online', { url: url });
    editor = null;
    draft = null;
    render();
    BB.ui.toast(t('sd.toast.onlineSaved'));
  }

  var detail = document.getElementById('detail');

  detail.addEventListener('click', function (event) {
    var markButton = event.target.closest('[data-mark]');
    if (markButton) {
      mark(markButton.getAttribute('data-mark'));
      return;
    }
    if (event.target.closest('[data-unmark]')) {
      unmark();
      return;
    }
    if (event.target.closest('[data-override-cancel]')) {
      setCancel();
      return;
    }
    if (event.target.closest('[data-override-transfer]')) {
      openTransfer();
      return;
    }
    if (event.target.closest('[data-override-online]')) {
      openOnline();
      return;
    }
    if (event.target.closest('[data-override-remove]')) {
      removeOverride();
      return;
    }
    if (event.target.closest('[data-editor-cancel]')) {
      editor = null;
      draft = null;
      render();
    }
  });

  /* 入力途中の値を draft へ戻す。出席の記録などで再描画されても消えない。 */
  detail.addEventListener('input', function (event) {
    if (!draft) return;
    var transfer = event.target.closest('[data-transfer-form]');
    if (transfer) {
      draft.date = transfer.elements.date.value;
      draft.start = transfer.elements.start.value;
      draft.end = transfer.elements.end.value;
      draft.room = transfer.elements.room.value;
      return;
    }
    var online = event.target.closest('[data-online-form]');
    if (online) draft.url = online.elements.url.value;
  });

  detail.addEventListener('submit', function (event) {
    var transfer = event.target.closest('[data-transfer-form]');
    if (transfer) {
      event.preventDefault();
      saveTransfer(transfer);
      return;
    }
    var online = event.target.closest('[data-online-form]');
    if (online) {
      event.preventDefault();
      saveOnline(online);
    }
  });

  render();

  /* 他タブの保存を取り込んだら描き直す。 */
  BB.store.subscribe(function () {
    BB.ui.refreshChrome();
    render();
  });

  /* feed が変わったら、eBwise のブロックだけ描き直す。出席の記録や入力中のフォームは触らない。 */
  if (BB.ebwise && typeof BB.ebwise.onChange === 'function') {
    BB.ebwise.onChange(function () {
      var host = document.getElementById('sd-ebwise');
      var found = resolve();
      if (!host || !found) return;
      host.innerHTML = ebwiseInner(found);
    });
  }
})();
