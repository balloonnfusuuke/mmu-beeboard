/* MMU BeeBoard — seed data.
   科目・科目色・コマ・評価構成の唯一の正。ここ以外に科目色を書かない。
   コマは CLiC (Class Schedule, 2026-11-07 取得) に一致させる。
   科目コードは eBwise の My courses 表記（C 付き）を正とする。CLiC のグリッドは
   先頭の C を別カラムに分けて表示するため、raw HTML からは CP6114 等に見える。 */
(function (global) {
  'use strict';

  var TERM = {
    id: '2630',
    label: 'Trimester Oct/Nov 2026',
    shortLabel: 'Oct/Nov 2026',
    startDate: '2026-11-09', // Week 1 の月曜（CLiC: 09/11/2026）
    weeks: 14,
    examWeek: 15
  };

  /* 公開用のダミー学生。氏名・学籍番号・連絡先は空にしている。
     自分のデータで使うときはここを書き換える（localStorage を消せば再シードされる）。 */
  var STUDENT = {
    name: 'Student',
    initials: 'S',
    studentId: '',
    programme: 'B.C.S (Hons)',
    year: 2,
    faculty: 'Faculty of Computing and Informatics'
  };

  /* day: 1=Mon … 5=Fri / start,end: 'HH:MM' / sect: CLiC のクラスセクション */
  var SUBJECTS = [
    {
      id: 'CCP6114',
      name: 'Programming Fundamentals',
      credits: 4,
      color: '#0F766E',
      lecturer: '',
      faculty: 'Faculty of Computing and Informatics',
      sessions: [
        { type: 'LEC', sect: 'TC4L', day: 1, start: '10:00', end: '12:00', room: 'CQAR1009' },
        { type: 'LEC', sect: 'TC4L', day: 5, start: '09:00', end: '10:00', room: 'CQAR1009' },
        { type: 'TUT', sect: 'T13L', day: 2, start: '14:00', end: '16:00', room: 'CQAR3002' }
      ],
      assessments: [], // 評価構成は未公表
      topics: { label: 'Module 1', title: 'Introduction to Programming', resource: 'Python & IDE Setup' }
    },
    {
      id: 'CMA6114',
      name: 'Calculus',
      credits: 4,
      color: '#003DA5',
      lecturer: '',
      faculty: 'Faculty of Computing and Informatics',
      sessions: [
        { type: 'LEC', sect: 'TC4L', day: 2, start: '10:00', end: '11:00', room: 'CNMX1002' },
        { type: 'LEC', sect: 'TC4L', day: 3, start: '12:00', end: '14:00', room: 'CNMX1002' },
        { type: 'TUT', sect: 'T13L', day: 5, start: '15:00', end: '17:00', room: 'CQCR2002' }
      ],
      assessments: [
        { id: 'q1', name: 'Quiz 1', weight: 5, max: 10, week: 4, kind: 'quiz' },
        { id: 'q2', name: 'Quiz 2', weight: 5, max: 10, week: 6, kind: 'quiz' },
        { id: 't1', name: 'Test 1', weight: 15, max: 25, week: 8, kind: 'test', location: 'Lecture Theatre 2' },
        { id: 'q3', name: 'Quiz 3', weight: 5, max: 10, week: 10, kind: 'quiz' },
        { id: 'q4', name: 'Quiz 4', weight: 5, max: 10, week: 12, kind: 'quiz' },
        { id: 't2', name: 'Test 2', weight: 15, max: 25, week: 13, kind: 'test', location: 'In-Person Exam Room A' },
        { id: 'final', name: 'Final Exam', weight: 50, max: 50, week: 15, kind: 'exam', location: 'MMU Examination Hall' }
      ],
      topics: { label: 'Ch. 1', title: 'Functions & Domain', resource: 'Lecture Notes 1.1' }
    },
    {
      id: 'CMA6124',
      name: 'Discrete Structures & Probability',
      credits: 4,
      color: '#E35205',
      lecturer: '',
      faculty: 'Faculty of Computing and Informatics',
      sessions: [
        { type: 'LEC', sect: 'TC4L', day: 1, start: '08:00', end: '10:00', room: 'CNMX1002' },
        { type: 'LEC', sect: 'TC4L', day: 4, start: '17:00', end: '18:00', room: 'CNMX1002' },
        { type: 'TUT', sect: 'T13L', day: 4, start: '10:00', end: '12:00', room: 'CQCR2003' }
      ],
      assessments: [
        { id: 'q1', name: 'Quiz 1', weight: 5, max: 10, week: 3, kind: 'quiz' },
        { id: 'q2', name: 'Quiz 2', weight: 5, max: 10, week: 5, kind: 'quiz' },
        { id: 't1', name: 'Test 1', weight: 15, max: 25, week: 6, kind: 'test', location: 'Midterm Hall' },
        { id: 'q3', name: 'Quiz 3', weight: 5, max: 10, week: 9, kind: 'quiz' },
        { id: 'q4', name: 'Quiz 4', weight: 5, max: 10, week: 12, kind: 'quiz' },
        { id: 't2', name: 'Test 2', weight: 15, max: 25, week: 13, kind: 'test', location: 'In-Person Exam Room B' },
        { id: 'final', name: 'Final Exam', weight: 50, max: 50, week: 15, kind: 'exam', location: 'MMU Examination Hall' }
      ],
      topics: { label: 'Topic 1', title: 'Set Theory and Relations', resource: 'Tutorial Sheet 1' }
    },
    {
      id: 'CPT6114',
      name: 'Professional Development',
      credits: 4,
      color: '#7C3AED',
      lecturer: '',
      faculty: 'Faculty of Computing and Informatics',
      sessions: [
        { type: 'LEC', sect: 'TC4L', day: 4, start: '14:00', end: '16:00', room: 'CNMX1002' },
        { type: 'TUT', sect: 'T13L', day: 1, start: '14:00', end: '16:00', room: 'CQAR4006' }
      ],
      assessments: [
        { id: 'cs1', name: 'Case Study 1', weight: 15, max: 15, week: 4, kind: 'coursework', due: '2026-12-06T23:59', dueLabel: 'Sun 6 Dec, 23:59' },
        { id: 'cs2', name: 'Case Study 2', weight: 15, max: 15, week: 6, kind: 'coursework', due: '2026-12-20T23:59', dueLabel: 'Sun 20 Dec, 23:59' },
        { id: 'test', name: 'Test', weight: 30, max: 30, week: 10, kind: 'test', due: '2027-01-11T18:00', dueLabel: 'Mon 11 Jan 18:00–19:00' },
        { id: 'report', name: 'Assignment Report', weight: 20, max: 20, week: 13, kind: 'coursework', due: '2027-02-07T23:59', dueLabel: 'Sun 7 Feb, 23:59' },
        { id: 'presentation', name: 'Assignment Presentation', weight: 20, max: 20, week: 14, kind: 'coursework', dueLabel: 'Scheduled Tutorial Slot' }
      ],
      topics: { label: 'Intro', title: 'Introduction & Ethics', resource: 'Course Syllabus Brief' }
    }
  ];

  var SETTINGS = {
    theme: 'light', // light | dark | system
    language: 'en',
    dateFormat: 'DD/MM/YYYY',
    cgpaTarget: 3.75,
    attendanceThreshold: 80,
    weeklyStudyTarget: 20,
    deadlineReminders: true,
    classReminder: true,
    classReminderMinutes: 15,
    dayStart: '08:00',
    dayEnd: '18:00'
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
