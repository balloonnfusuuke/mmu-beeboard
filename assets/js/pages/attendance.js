(function () {
  'use strict';

  var BB = window.BB;
  var t = BB.i18n.t;
  var tn = BB.i18n.tn;
  var DAY_KEYS = ['day.sun', 'day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat'];
  /* 日付は保存値（ISO）から描画時に整形する。保存時に整形すると言語に追随しない。 */
  var fmtDate = BB.dash.fmtIsoDate;

  /* 記録対象のコマと日付は科目ごとに保持する。再描画で選択が戻らないように。 */
  var pickedSession = {};
  var pickedDate = {};
  /* 振替フォームの入力途中の状態。null なら閉じている。 */
  var transferDraft = null;

  function state() {
    return BB.store.get();
  }

  /* 端末のローカル日付。UTC で切ると、日本・マレーシアの朝は前日になり、
     保存した日付がグリッドの列と 1 日ずれる。 */
  function today() {
    return isoOf(new Date());
  }

  function isoOf(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  /* そのコマの「今週の実施日」。休講を押したときに学期外の日付へ記録して
     時間割に出ない、という取り違えを防ぐ。 */
  /* 日付欄の初期値。グリッドと同じ weekDates を使う。別々に組み立てると、
     学期開始日が未設定のときに保存した日付とグリッドの列がずれて、
     休講・振替がグリッドに出なくなる。 */
  function defaultDateFor(subject, index) {
    var session = subject.sessions[index];
    if (!session) return today();
    var day = Number(session.day);
    if (!day) return today();
    var dates = BB.dash.weekDates(new Date());
    return dates[day] || today();
  }

  /* 学期の範囲。日付欄が学期外へ飛ばないようにする。 */
  function termBounds() {
    var data = state();
    var start = BB.date.parse(data.term.startDate);
    if (!start) return { min: '', max: '' };
    var weeks = data.term.weeks || 14;
    return { min: isoOf(start), max: isoOf(addDays(start, weeks * 7 - 1)) };
  }

  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function headOptions() {
    var data = state();
    var count = data.subjects.length;
    var threshold = data.settings.attendanceThreshold;
    return {
      title: t('att.title'),
      subtitle: count
        ? tn('att.subtitle', count, { n: count, t: threshold })
        : t('att.subtitleEmpty', { t: threshold })
    };
  }

  BB.ui.mount({ title: t('att.title'), head: headOptions() });

  function sessionLabel(session) {
    if (!session) return '';
    var day = session.day === undefined || session.day === null ? '' : t(DAY_KEYS[session.day]) + ' ';
    return day + session.start + '–' + session.end + ' ' + session.type +
      (session.room ? ' · ' + session.room : '');
  }

  /* 記録済みの行は、保存済みの文字列ではなく元のコマ情報から組み立て直す。
     言語を切り替えても英語の曜日が残らない。
     sessionMeta を持たない古い記録は、保存された日付の曜日から科目のコマを
     引き当てる。それも無ければ最後の手段として保存文字列を使う。 */
  function entryLabel(entry, subject) {
    if (entry.sessionMeta) return sessionLabel(entry.sessionMeta);
    var day = BB.date.parse(String(entry.date || '').slice(0, 10));
    if (day && subject && subject.sessions) {
      var weekday = day.getDay();
      var match = null;
      subject.sessions.forEach(function (session) {
        if (Number(session.day) === weekday) match = session;
      });
      if (match) return sessionLabel(match);
    }
    return entry.session || '';
  }

  function render() {
    var data = state();
    var threshold = data.settings.attendanceThreshold;
    var stats = data.subjects.map(function (subject) {
      return { subject: subject, attendance: BB.dash.attendanceOf(subject) };
    });

    /* しきい値を変えたら副題も追随させる（監査で「半分だけ配線」と指摘）。 */
    BB.ui.setHead(headOptions());

    renderStatus(stats, threshold);
    renderPolicy(threshold);
    renderSubjects(stats, threshold);
    renderLog(data);
  }

  function renderStatus(stats, threshold) {
    var host = document.getElementById('status-banner');
    var held = stats.reduce(function (sum, item) {
      return sum + item.attendance.held;
    }, 0);
    var below = stats.filter(function (item) {
      return item.attendance.atRisk;
    }).length;

    var tone;
    var icon;
    var text;
    if (held === 0) {
      tone = 'border-border bg-surface text-muted';
      icon = 'info';
      text = t('att.noSessions');
    } else if (below === 0) {
      tone = 'bb-status-ok';
      icon = 'verified_user';
      text = t('att.eligible');
    } else {
      tone = 'bb-status-alert';
      icon = 'warning';
      text = tn('att.below', below, { n: below, t: threshold });
    }

    host.innerHTML =
      '<div class="flex items-center gap-2.5 rounded-card border px-4 py-3 ' + tone + '">' +
      '<span class="material-symbols-outlined text-[20px]">' + icon + '</span>' +
      '<span class="text-label-md font-semibold">' + text + '</span></div>';
  }

  function renderPolicy(threshold) {
    document.getElementById('policy').innerHTML =
      '<div class="bb-card p-4 flex items-start gap-3">' +
      '<span class="material-symbols-outlined text-[20px] text-primary mt-0.5">gavel</span>' +
      '<div class="text-body-sm text-body">' +
      '<span class="font-semibold text-ink">' + t('att.policyTitle') + '</span> ' +
      t('att.policyBody', { t: threshold }) + '</div></div>';
  }

  /* 記録するコマを選ばせる。以前は「どの授業の分か」を選べず誤タップがそのまま残った。
     振替の臨時セッションも出席対象なので、定例コマの後ろに並べる。 */
  function sessionPicker(subject) {
    if (!subject.sessions.length) {
      return (
        '<div><label class="bb-label">' + t('att.session') + '</label>' +
        '<select class="bb-input" disabled><option>' + t('att.noSessionsDefined') + '</option></select>' +
        '<p class="text-caption text-muted mt-1.5">' + t('att.addSessionsHint') + '</p></div>'
      );
    }
    var selected = pickedSession[subject.id];
    if (selected === undefined) selected = '0';
    var extras = BB.dash.extraSessions(state()).filter(function (extra) {
      return extra.subject.id === subject.id;
    });
    var options = subject.sessions
      .map(function (session, index) {
        return '<option value="' + index + '"' + (String(index) === String(selected) ? ' selected' : '') + '>' +
          esc(sessionLabel(session)) + '</option>';
      })
      .join('') +
      extras
        .map(function (extra) {
          var key = 'x:' + extra.overrideId;
          return '<option value="' + key + '"' + (key === String(selected) ? ' selected' : '') + '>' +
            esc(t('att.transferBadge') + ' · ' + fmtDate(extra.date) + ' ' + extra.start + '–' + extra.end) + '</option>';
        })
        .join('');
    return (
      '<div><label class="bb-label">' + t('att.session') + '</label>' +
      '<select class="bb-input" data-session-picker="' + subject.id + '">' + options + '</select></div>'
    );
  }

  /* 選択中のコマを解決する。振替の臨時セッションなら extra が入る。 */
  function resolvePick(subject) {
    var key = pickedSession[subject.id] === undefined ? '0' : String(pickedSession[subject.id]);
    if (key.indexOf('x:') === 0) {
      var id = key.slice(2);
      var extra = null;
      BB.dash.extraSessions(state()).forEach(function (candidate) {
        if (candidate.overrideId === id) extra = candidate;
      });
      if (extra) return { extra: extra, index: -1, session: extra, date: extra.date };
    }
    var index = Number(key);
    if (!isFinite(index) || index < 0) index = 0;
    return {
      extra: null,
      index: index,
      session: subject.sessions[index],
      date: pickedDate[subject.id] || defaultDateFor(subject, index)
    };
  }

  /* 振替フォームを開いたままコマや日付を変えると、保存される「元の回」が
     フォームの表示とずれる。開いた時点の値を持ち続けず、保存直前と
     選択が変わったときに解決し直す。 */
  function syncDraftSource() {
    if (!transferDraft || transferDraft.overrideId) return;
    var subject = BB.store.subject(transferDraft.subjectId);
    if (!subject) return;
    var pick = resolvePick(subject);
    var index = pick.extra ? 0 : pick.index;
    var session = subject.sessions[index];
    transferDraft.sessionIndex = index;
    transferDraft.date = pick.extra ? today() : pick.date;
    transferDraft.sessionLabel = session ? sessionLabel(session) : '';
  }

  /* フォームの「元の回」表示だけを差し替える。入力途中の振替先は消さない。 */
  function refreshDraftSource(subjectId) {
    if (!transferDraft || transferDraft.overrideId) return;
    if (transferDraft.subjectId !== subjectId) return;
    syncDraftSource();
    var lines = document.querySelectorAll('[data-transfer-source]');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].getAttribute('data-transfer-source') !== subjectId) continue;
      lines[i].textContent = t('att.transferSource', {
        date: fmtDate(transferDraft.date),
        session: transferDraft.sessionLabel
      });
    }
  }

  /* 振替フォーム。振替先の日付・開始・終了は必須、教室だけ任意。 */
  function transferFormHtml(subject, draft) {
    var target = draft.target || {};
    return (
      '<form class="mt-3 rounded-control border border-border bg-canvas p-3 space-y-2.5" data-transfer-form="' +
      subject.id + '">' +
      '<div class="text-label-md font-semibold text-ink">' +
      (draft.overrideId ? t('att.transferEditTitle') : t('att.transferTitle')) + '</div>' +
      '<p class="text-caption text-muted" data-transfer-source="' + subject.id + '">' +
      t('att.transferSource', { date: fmtDate(draft.date), session: draft.sessionLabel }) + '</p>' +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">' +
      '<div><label class="bb-label" for="tr-date">' + t('att.transferDate') + '</label>' +
      '<input id="tr-date" name="date" class="bb-input num" type="date" value="' + esc(target.date) + '" required></div>' +
      '<div><label class="bb-label" for="tr-start">' + t('att.transferStart') + '</label>' +
      '<input id="tr-start" name="start" class="bb-input num" type="time" value="' + esc(target.start) + '" required></div>' +
      '<div><label class="bb-label" for="tr-end">' + t('att.transferEnd') + '</label>' +
      '<input id="tr-end" name="end" class="bb-input num" type="time" value="' + esc(target.end) + '" required></div>' +
      '</div>' +
      '<div><label class="bb-label" for="tr-room">' + t('att.transferRoom') + '</label>' +
      '<input id="tr-room" name="room" class="bb-input" type="text" value="' + esc(target.room) +
      '" placeholder="' + esc(t('att.transferRoomTbd')) + '"></div>' +
      '<div class="flex justify-end gap-2">' +
      '<button type="button" class="bb-btn bb-btn-ghost" data-transfer-cancel="' + subject.id + '">' +
      t('common.cancel') + '</button>' +
      '<button type="submit" class="bb-btn bb-btn-primary">' + t('att.transferSave') + '</button>' +
      '</div></form>'
    );
  }

  /* 休講・振替の1行。出席ログと同じ場所に並べ、元の回→振替先が1行で分かるようにする。 */
  function overrideRow(entry, subject) {
    var session = subject.sessions[entry.sessionIndex];
    var isTransfer = entry.kind === 'transfer' && entry.target;
    var detail = isTransfer
      ? t('att.transferTo', {
          date: fmtDate(entry.target.date),
          start: entry.target.start,
          end: entry.target.end
        }) + ' · ' + (entry.target.room || t('att.transferRoomTbd'))
      : t('att.noClassHint');
    return (
      '<div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-border-subtle last:border-0">' +
      '<div class="flex items-center gap-3 min-w-0">' + BB.ui.solidChip(subject.color, subject.id) +
      '<div class="min-w-0">' +
      '<div class="flex flex-wrap items-center gap-2">' +
      '<span class="text-body-sm text-body truncate">' + subject.name + '</span>' +
      '<span class="bb-chip" style="background:var(--bb-surface-sunken);color:var(--bb-text-muted)">' +
      (isTransfer ? t('att.transferBadge') : t('att.noClassBadge')) + '</span></div>' +
      (session ? '<div class="text-caption text-muted truncate">' + esc(sessionLabel(session)) + '</div>' : '') +
      '<div class="text-caption text-muted">' + esc(detail) + '</div></div></div>' +
      '<div class="flex items-center gap-3 shrink-0">' +
      '<span class="text-caption text-muted num">' + esc(fmtDate(entry.date)) + '</span>' +
      '<button type="button" class="text-muted hover:text-primary transition-colors" data-override-edit="' +
      entry.id + '" data-subject="' + subject.id + '" title="' + esc(t('att.transferEdit')) +
      '" aria-label="' + esc(t('att.transferEdit')) + '">' +
      '<span class="material-symbols-outlined text-[18px]">edit</span></button>' +
      '<button type="button" class="text-muted hover:text-alert transition-colors" data-override-remove="' +
      entry.id + '" data-subject="' + subject.id + '" title="' + esc(t('att.transferRemove')) +
      '" aria-label="' + esc(t('att.transferRemove')) + '">' +
      '<span class="material-symbols-outlined text-[18px]">delete</span></button>' +
      '</div></div>'
    );
  }

  /* 振替フォーム。科目カード側に出し、保存するとログ側の行が更新される。 */
  function transferFormSection(subject) {
    var draft = transferDraft && transferDraft.subjectId === subject.id ? transferDraft : null;
    if (!draft) return '';
    return '<div class="mt-3 pt-3 border-t border-border-subtle">' + transferFormHtml(subject, draft) + '</div>';
  }

  function renderSubjects(stats, threshold) {
    var host = document.getElementById('subjects');
    var bounds = termBounds();
    if (!stats.length) {
      host.innerHTML =
        '<div class="bb-card p-8 text-center lg:col-span-2">' +
        '<span class="material-symbols-outlined text-[28px] text-placeholder">rule</span>' +
        '<p class="text-body-sm text-muted mt-2">' + t('att.empty') + '</p>' +
        '<a href="subject-edit.html?new=1" class="bb-btn bb-btn-primary mt-3">' +
        '<span class="material-symbols-outlined text-[18px]">add</span>' + t('att.addSubject') + '</a></div>';
      return;
    }
    host.innerHTML = stats
      .map(function (item) {
        var subject = item.subject;
        var attendance = item.attendance;
        var rate = attendance.rate;
        var rateText = rate === null ? '—' : Math.round(rate) + '%';
        var rateColor = rate === null ? 'var(--bb-text-muted)' : attendance.atRisk ? 'var(--bb-alert)' : 'var(--bb-success)';
        var noteIcon = attendance.atRisk ? 'warning' : 'check_circle';
        var noteColor = attendance.atRisk ? 'var(--bb-alert)' : 'var(--bb-success)';
        var note = attendance.held === 0
          ? ''
          : attendance.atRisk
            ? t('att.belowNote', { t: threshold })
            : tn('att.canMiss', attendance.allowed, { n: attendance.allowed, t: threshold });
        var lastEntry = (subject.attendance && subject.attendance.log && subject.attendance.log.length)
          ? subject.attendance.log[subject.attendance.log.length - 1]
          : null;

        return (
          '<div class="bb-card p-5">' +
          '<div class="flex items-start justify-between gap-3">' +
          '<div class="min-w-0">' +
          '<div class="flex items-center gap-2">' + BB.ui.solidChip(subject.color, subject.id) +
          '<span class="text-caption text-muted">· ' + t('att.credits', { n: subject.credits }) + '</span></div>' +
          '<h3 class="text-title-md font-bold text-ink mt-1.5">' + subject.name + '</h3>' +
          '<p class="text-caption text-muted">' +
          tn('att.perWeek', subject.sessions.length, { n: subject.sessions.length, total: attendance.total }) +
          '</p></div>' +
          '<div class="text-right shrink-0">' +
          '<div class="text-headline-md font-extrabold num" style="color:' + rateColor + '">' + rateText + '</div>' +
          '<div class="text-caption text-muted">' + t('att.standing') + '</div></div></div>' +
          '<div class="grid grid-cols-2 gap-3 mt-4">' +
          '<div class="bg-canvas rounded-control p-3 border border-border-subtle">' +
          '<div class="text-caption text-muted">' + t('att.attended') + '</div>' +
          '<div class="text-title-md font-bold text-ink num">' + attendance.attended + ' / ' + attendance.held + '</div></div>' +
          '<div class="bg-canvas rounded-control p-3 border border-border-subtle">' +
          '<div class="text-caption text-muted">' + t('att.absences') + '</div>' +
          '<div class="text-title-md font-bold text-ink num">' + attendance.absences + '</div></div></div>' +
          (note
            ? '<div class="mt-3 flex items-start gap-2 text-body-sm text-body">' +
              '<span class="material-symbols-outlined text-[18px]" style="color:' + noteColor + '">' + noteIcon + '</span>' +
              '<span>' + note + '</span></div>'
            : '') +
          '<div class="mt-3 pt-3 border-t border-border-subtle space-y-2.5">' +
          '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
          sessionPicker(subject) +
          '<div><label class="bb-label">' + t('att.date') + '</label>' +
          '<input class="bb-input num" type="date" data-session-date="' + subject.id + '" value="' +
          (pickedDate[subject.id] || defaultDateFor(subject, resolvePick(subject).index)) + '"' +
          (bounds.min ? ' min="' + bounds.min + '" max="' + bounds.max + '"' : '') + '></div>' +
          '</div>' +
          '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">' +
          '<button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" data-mark="present" data-subject="' + subject.id + '">' +
          '<span class="material-symbols-outlined text-[16px]">check</span>' + t('att.markPresent') + '</button>' +
          '<button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" data-mark="absent" data-subject="' + subject.id + '">' +
          '<span class="material-symbols-outlined text-[16px]">event_busy</span>' + t('att.markAbsent') + '</button>' +
          '<button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" data-mark="nocancel" data-subject="' + subject.id + '"' +
          (subject.sessions.length ? '' : ' disabled') + '>' +
          '<span class="material-symbols-outlined text-[16px]">event_available</span>' + t('att.markNoClass') +
          '</button>' +
          '<button type="button" class="bb-btn bb-btn-ghost bb-btn-sm" data-transfer-open="' + subject.id + '"' +
          (subject.sessions.length ? '' : ' disabled') + '>' +
          '<span class="material-symbols-outlined text-[16px]">swap_horiz</span>' + t('att.transferBadge') +
          '</button></div>' +
          '<div class="text-caption text-muted">' +
          t('att.lastSession', {
            value: lastEntry
              ? fmtDate(lastEntry.date) + (entryLabel(lastEntry, subject) ? ' · ' + entryLabel(lastEntry, subject) : '')
              : '—'
          }) + '</div>' +
          transferFormSection(subject) +
          '</div></div>'
        );
      })
      .join('');
  }

  function renderLog(data) {
    var entries = [];
    data.subjects.forEach(function (subject) {
      var log = (subject.attendance && subject.attendance.log) || [];
      log.forEach(function (entry, index) {
        entries.push({ kind: 'log', subject: subject, index: index, entry: entry });
      });
    });
    /* 休講・振替も同じ一覧に並べる。押した記録が消えたように見えないように。 */
    BB.dash.overridesOf(data).forEach(function (entry) {
      /* オンラインは開催される回。休講・振替の一覧には出さない。 */
      if (entry.kind === 'online') return;
      var subject = null;
      data.subjects.forEach(function (candidate) {
        if (candidate.id === entry.subjectId) subject = candidate;
      });
      if (!subject) return;
      entries.push({ kind: 'override', subject: subject, entry: entry });
    });
    entries.sort(function (a, b) {
      return a.entry.date < b.entry.date ? 1 : -1;
    });

    var body = entries.length
      ? entries
          .map(function (item) {
            if (item.kind === 'override') return overrideRow(item.entry, item.subject);
            var present = item.entry.status === 'present';
            return (
              '<div class="flex items-center justify-between gap-3 px-5 py-3 border-b border-border-subtle last:border-0">' +
              '<div class="flex items-center gap-3 min-w-0">' + BB.ui.solidChip(item.subject.color, item.subject.id) +
              '<div class="min-w-0"><div class="text-body-sm text-body truncate">' + item.subject.name + '</div>' +
              (entryLabel(item.entry, item.subject)
                ? '<div class="text-caption text-muted truncate">' + esc(entryLabel(item.entry, item.subject)) + '</div>'
                : '') + '</div></div>' +
              '<div class="flex items-center gap-3 shrink-0">' +
              '<span class="text-caption text-muted num">' + esc(fmtDate(item.entry.date)) + '</span>' +
              '<span class="bb-chip" style="background:' + (present ? 'var(--bb-success-surface)' : 'var(--bb-alert-surface)') + ';color:' +
              (present ? 'var(--bb-success)' : 'var(--bb-alert)') + '">' +
              (present ? t('att.present') : t('att.absent')) + '</span>' +
              '<button type="button" class="text-muted hover:text-alert transition-colors" data-remove-entry="' +
              item.subject.id + '" data-entry-index="' + item.index + '" title="' + t('att.deleteRecord') + '">' +
              '<span class="material-symbols-outlined text-[18px]">delete</span></button>' +
              '</div></div>'
            );
          })
          .join('')
      : '<div class="px-5 py-8 text-center">' +
        '<span class="material-symbols-outlined text-[28px] text-placeholder">task_alt</span>' +
        '<p class="text-body-sm text-muted mt-2">' + t('att.logEmpty') + '</p>' +
        '<p class="text-caption text-muted mt-1">' +
        (data.subjects.length
          ? t('att.logEmptyHint', { term: BB.ui.termLabel(data) })
          : t('att.logEmptyNoSubject')) +
        '</p></div>';

    document.getElementById('absence-log').innerHTML =
      '<div class="bb-card overflow-hidden">' +
      '<div class="px-5 py-4 border-b border-border flex items-center justify-between gap-3">' +
      '<div class="flex items-center gap-2">' +
      '<span class="material-symbols-outlined text-[20px] text-primary">history</span>' +
      '<h2 class="text-title-md font-bold text-ink">' + t('att.logTitle') + '</h2>' +
      '<span class="text-caption text-muted">' + tn('att.entry', entries.length) + '</span></div></div>' +
      body + '</div>';
  }

  document.getElementById('subjects').addEventListener('change', function (event) {
    var picker = event.target.closest('[data-session-picker]');
    if (picker) {
      pickedSession[picker.getAttribute('data-session-picker')] = picker.value;
      refreshDraftSource(picker.getAttribute('data-session-picker'));
      return;
    }
    var dateField = event.target.closest('[data-session-date]');
    if (dateField) {
      pickedDate[dateField.getAttribute('data-session-date')] = dateField.value;
      refreshDraftSource(dateField.getAttribute('data-session-date'));
    }
  });

  /* 休講・振替の取消。Undo 付き。 */
  function removeOverride(removeId) {
    var removed = null;
    BB.dash.overridesOf(state()).forEach(function (entry) {
      if (entry.id === removeId) removed = JSON.parse(JSON.stringify(entry));
    });
    if (!removed) return;
    BB.attendance.removeOverride(removeId);
    if (transferDraft && transferDraft.overrideId === removeId) transferDraft = null;
    render();
    BB.ui.toast(t('att.toast.transferRemoved'), {
      actionLabel: t('common.undo'),
      onAction: function () {
        BB.store.update(function (data) {
          data.sessionOverrides = data.sessionOverrides || [];
          data.sessionOverrides.push(removed);
        });
        render();
        BB.ui.toast(t('att.toast.restored'));
      }
    });
  }

  /* 振替フォームを開く。既存の休講・振替を編集するときはその内容を引き継ぐ。 */
  function openTransfer(subjectId, overrideId) {
    var subject = BB.store.subject(subjectId);
    if (!subject) return;
    var pick = resolvePick(subject);
    var index = pick.extra ? 0 : pick.index;
    var date = pick.extra ? today() : pick.date;
    var target = { date: '', start: '', end: '', room: '' };

    if (overrideId) {
      BB.dash.overridesOf(state()).forEach(function (entry) {
        if (entry.id !== overrideId) return;
        index = entry.sessionIndex;
        date = entry.date;
        if (entry.target) {
          target = {
            date: entry.target.date || '',
            start: entry.target.start || '',
            end: entry.target.end || '',
            room: entry.target.room || ''
          };
        }
      });
    }

    var session = subject.sessions[index];
    transferDraft = {
      subjectId: subjectId,
      overrideId: overrideId || null,
      sessionIndex: index,
      date: date,
      sessionLabel: session ? sessionLabel(session) : '',
      target: target
    };
    render();
  }

  function saveTransfer(form) {
    var draft = transferDraft;
    if (!draft) return;
    /* フォームを開いた後にコマや日付を変えていても、いま選ばれている回で保存する。 */
    syncDraftSource();
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
    BB.attendance.setOverride(draft.subjectId, draft.sessionIndex, draft.date, 'transfer', target);
    transferDraft = null;
    render();
    BB.ui.toast(t('att.toast.transferSaved'));
  }

  document.getElementById('subjects').addEventListener('submit', function (event) {
    var form = event.target.closest('[data-transfer-form]');
    if (!form) return;
    event.preventDefault();
    saveTransfer(form);
  });

  document.getElementById('subjects').addEventListener('click', function (event) {
    var transferOpen = event.target.closest('[data-transfer-open]');
    if (transferOpen) {
      openTransfer(transferOpen.getAttribute('data-transfer-open'), null);
      return;
    }
    var transferCancel = event.target.closest('[data-transfer-cancel]');
    if (transferCancel) {
      transferDraft = null;
      render();
      return;
    }
    var overrideEdit = event.target.closest('[data-override-edit]');
    if (overrideEdit) {
      openTransfer(overrideEdit.getAttribute('data-subject'), overrideEdit.getAttribute('data-override-edit'));
      return;
    }
    var overrideRemove = event.target.closest('[data-override-remove]');
    if (overrideRemove) {
      removeOverride(overrideRemove.getAttribute('data-override-remove'));
      return;
    }

    var button = event.target.closest('[data-mark]');
    if (!button) return;
    var subjectId = button.getAttribute('data-subject');
    var status = button.getAttribute('data-mark');
    var subject = BB.store.subject(subjectId);
    if (!subject) return;

    var pick = resolvePick(subject);
    var index = pick.index;
    var session = pick.session;
    var date = pick.date;
    var label = session ? sessionLabel(session) : '';

    /* 休講は出席ログではなく sessionOverrides に置く。総回数から外れる。 */
    if (status === 'nocancel') {
      /* 振替の臨時セッションは総回数の外にあるので休講にできない。取消で対応する。 */
      if (pick.extra) {
        BB.ui.toast(t('att.toast.noClassOnTransfer'));
        return;
      }
      BB.attendance.setOverride(subjectId, index, date, 'nocancel', null);
      render();
      BB.ui.toast(t('att.toast.noClass') + ' · ' + date + (label ? ' · ' + label : ''), {
        actionLabel: t('common.undo'),
        onAction: function () {
          var target = null;
          BB.dash.overridesOf(state()).forEach(function (entry) {
            if (entry.subjectId === subjectId && entry.sessionIndex === index && entry.date === date) {
              target = entry;
            }
          });
          if (!target) return;
          BB.attendance.removeOverride(target.id);
          render();
          BB.ui.toast(t('att.toast.noClassRemoved'));
        }
      });
      return;
    }

    var entryIndex = BB.attendance.mark(subjectId, status, {
      date: date,
      session: label,
      sessionMeta: session
        ? { day: session.day, start: session.start, end: session.end, type: session.type, room: session.room }
        : null
    });
    render();

    BB.ui.toast(
      (status === 'present' ? t('att.toast.present') : t('att.toast.absent')) + ' · ' + fmtDate(date) +
        (label ? ' · ' + label : ''),
      {
        actionLabel: t('common.undo'),
        onAction: function () {
          BB.attendance.unmark(subjectId, entryIndex);
          render();
          BB.ui.toast(t('att.toast.removed'));
        }
      }
    );
  });

  document.getElementById('absence-log').addEventListener('click', function (event) {
    var overrideEdit = event.target.closest('[data-override-edit]');
    if (overrideEdit) {
      openTransfer(overrideEdit.getAttribute('data-subject'), overrideEdit.getAttribute('data-override-edit'));
      return;
    }
    var overrideRemove = event.target.closest('[data-override-remove]');
    if (overrideRemove) {
      removeOverride(overrideRemove.getAttribute('data-override-remove'));
      return;
    }
    var button = event.target.closest('[data-remove-entry]');
    if (!button) return;
    var subjectId = button.getAttribute('data-remove-entry');
    var index = Number(button.getAttribute('data-entry-index'));
    var subject = BB.store.subject(subjectId);
    if (!subject || !subject.attendance || !subject.attendance.log) return;
    var entry = subject.attendance.log[index];
    if (!entry) return;
    var removed = JSON.parse(JSON.stringify(entry));

    BB.ui
      .confirm({
        title: t('att.confirm.title'),
        message: t('att.confirm.body', {
          code: subject.id,
          date: fmtDate(entry.date),
          session: entry.session ? ' · ' + entry.session : '',
          status: entry.status === 'present' ? t('att.present') : t('att.absent')
        }),
        confirmLabel: t('att.confirm.ok'),
        danger: true
      })
      .then(function (ok) {
        if (!ok) return;
        BB.attendance.unmark(subjectId, index);
        render();
        BB.ui.toast(t('att.toast.deleted'), {
          actionLabel: t('common.undo'),
          onAction: function () {
            BB.store.update(function (data) {
              var target = null;
              data.subjects.forEach(function (item) {
                if (item.id === subjectId) target = item;
              });
              if (!target) return;
              if (!target.attendance) target.attendance = { held: 0, attended: 0, absences: 0, log: [] };
              target.attendance.log = target.attendance.log || [];
              target.attendance.log.splice(Math.min(index, target.attendance.log.length), 0, removed);
              target.attendance.held += 1;
              if (removed.status === 'present') target.attendance.attended += 1;
              else target.attendance.absences += 1;
            });
            render();
            BB.ui.toast(t('att.toast.restored'));
          }
        });
      });
  });

  render();

  /* 他タブの保存を取り込んだら描き直す。 */
  BB.store.subscribe(function () {
    /* 他タブの保存では、ヘッダーもページ本体も再読込なしで追いつく。 */
    BB.ui.refreshChrome();
    render();
  });
})();
