/* MMU BeeBoard — read-only snapshot for a local AI.
   保存済みの状態（localStorage の mmu-beeboard）から、AI に渡すための JSON を組み立てる。
   読み取りだけで、保存も送信もしない。

   使い方（ブラウザのコンソール、BeeBoard のページを開いた状態で）:
     await import('/assets/js/snapshot.js');
     BB.snapshot.build();

   入れないもの: 氏名・学籍番号・メール（student）、点数（marks）、出欠（attendance）、
   学習ログ（studySessions）、メモ（notes）、個人の予定（personalEvents）。
   締切の一覧は、締切ページと同じ BB.dash.deadlineItems() をそのまま使う。 */
(function (global) {
  'use strict';

  var BB = global.BB;

  if (!BB || !BB.store || !BB.dash) {
    throw new Error('MMU BeeBoard is not loaded on this page.');
  }

  function clone(value) {
    return value === undefined ? null : JSON.parse(JSON.stringify(value));
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* 'YYYY-MM-DD' または 'YYYY-MM-DDTHH:mm' → 'YYYY-MM-DD'。読めなければ null。 */
  function isoDay(value) {
    var raw = String(value === undefined || value === null ? '' : value).slice(0, 10);
    var day = BB.date.parse(raw);
    if (!day) return null;
    return day.getFullYear() + '-' + pad2(day.getMonth() + 1) + '-' + pad2(day.getDate());
  }

  /* 科目はそのまま渡すが、点数と出欠だけは落とす。 */
  function publicSubject(subject) {
    var out = {};
    Object.keys(subject).forEach(function (key) {
      if (key === 'marks' || key === 'attendance') return;
      out[key] = clone(subject[key]);
    });
    return out;
  }

  /* 締切 1 件。科目名・課題名・週・締切日・配点・種別だけを持つ。
     due は締切ページが日付として扱う値（sortDue）から作る。週しか持たない
     評価（科目の assessments）は due が null になり、week で位置が分かる。
     学期開始日が未設定だと週をカレンダーに置けないので、due は常に null。 */
  function toAssignment(item, hasStartDate) {
    var assessment = item.assessment || {};
    return {
      subject: item.subject && item.subject.name ? item.subject.name : null,
      name: assessment.name || '',
      week: isFinite(item.week) ? Number(item.week) : null,
      due: hasStartDate ? isoDay(item.sortDue) : null,
      weight: Number(assessment.weight) || 0,
      kind: assessment.kind === 'exam' ? 'exam' : 'coursework'
    };
  }

  function build() {
    var state = BB.store.get();
    var hasStartDate = Boolean(BB.date.start());

    return {
      exportedAt: new Date().toISOString(),
      term: clone(state.term),
      subjects: (state.subjects || []).map(publicSubject),
      customDeadlines: clone(state.customDeadlines || []),
      deadlineDetails: clone(state.deadlineDetails || {}),
      assignments: BB.dash.deadlineItems().map(function (item) {
        return toAssignment(item, hasStartDate);
      })
    };
  }

  BB.snapshot = { build: build };
})(window);
