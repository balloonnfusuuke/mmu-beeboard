/* MMU BeeBoard — seed data.
   初回起動時の空の状態だけを持つ。学期・科目・コマ・評価構成は初回セットアップ
   （setup.html）と科目エディタで作り、localStorage に保存する。
   ここに科目を書き足せば、セットアップを飛ばした初期データとして使える。 */
(function (global) {
  'use strict';

  /* 初回起動時は学期も科目も空。初回セットアップ（setup.html）で埋める。
     startDate が空のままでも週番号計算は落ちない（store.js の date ヘルパが null を返す）。 */
  var TERM = {
    id: 'term-1',
    label: 'My Trimester',
    shortLabel: 'My Trimester',
    startDate: '', // 未設定。Week 1 の月曜を入れると週番号が動き出す
    weeks: 14,
    examWeek: 15
  };

  /* 公開用のダミー学生。氏名・学籍番号・連絡先は空にしている。
     氏名は初回セットアップと Settings から変更できる。 */
  var STUDENT = {
    name: 'Student',
    initials: 'S',
    studentId: '',
    programme: 'B.C.S (Hons)',
    year: 2,
    faculty: 'Faculty of Computing and Informatics'
  };

  /* 科目は初回セットアップのウィザードで追加する。ここは空のまま。
     形式（id/name/credits/color/sessions/assessments/topics）は subject-form.js が作る。 */
  var SUBJECTS = [];

  /* 設定は「実際に画面へ反映される項目」だけを持つ。
     言語・日付形式・DAY STARTS AT・リマインダー・副次タイトルは、保存しても
     どこにも反映されない「効かない設定」だったため削除した（監査 C5）。 */
  var SETTINGS = {
    theme: 'light', // light | dark | system
    cgpaTarget: 3.75,
    attendanceThreshold: 80,
    weeklyStudyTarget: 20
  };

  var GRADING_SCALE = [
    { grade: 'A+', min: 90, max: 100, point: 4.0 },
    { grade: 'A', min: 80, max: 89, point: 4.0 },
    { grade: 'A-', min: 75, max: 79, point: 3.67 },
    { grade: 'B+', min: 70, max: 74, point: 3.33 },
    { grade: 'B', min: 65, max: 69, point: 3.0 },
    { grade: 'B-', min: 60, max: 64, point: 2.67 },
    { grade: 'C+', min: 55, max: 59, point: 2.33 },
    { grade: 'C', min: 50, max: 54, point: 2.0 },
    { grade: 'F', min: 0, max: 49, point: 0 }
  ];

  global.BB_SEED = {
    term: TERM,
    student: STUDENT,
    subjects: SUBJECTS,
    settings: SETTINGS,
    gradingScale: GRADING_SCALE
  };
})(window);
