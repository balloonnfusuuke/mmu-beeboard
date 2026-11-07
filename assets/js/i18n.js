/* MMU BeeBoard — internationalisation.
   辞書（en / ja）と BB.i18n.t() / BB.i18n.apply() だけを持つ。
   言語を増やすときは DICT に 1 言語ぶんのオブジェクトを足し、LANGUAGES に
   { id, label } を 1 行足す。それ以外のコードは触らなくてよい。

   保存先は state.settings.lang。未設定ならブラウザ言語で決める（ja 以外は English）。
   <head> で theme.js の直後に読み込み、<html lang> を初回描画前に確定させる。 */
(function (global) {
  'use strict';

  var KEY = 'mmu-beeboard';
  var FALLBACK = 'en';

  /* 表示名は各言語の自称を使う。翻訳しない。 */
  var LANGUAGES = [
    { id: 'en', label: 'English' },
    { id: 'ja', label: '日本語' }
  ];

  var DICT = {
    en: {
      page: {
        dashboard: 'MMU BeeBoard — Dashboard',
        attendance: 'MMU BeeBoard — Attendance',
        deadlines: 'MMU BeeBoard — Deadlines',
        settings: 'MMU BeeBoard — Settings',
        setup: 'MMU BeeBoard — First-time setup',
        simulator: 'MMU BeeBoard — Grade Simulator',
        studylog: 'MMU BeeBoard — Study Log',
        subjectEdit: 'MMU BeeBoard — Edit Subject'
      },
      brand: { tagline: 'Personal study dashboard' },
      nav: { settings: 'Settings', backToDashboard: 'Back to dashboard' },
      common: {
        cancel: 'Cancel',
        confirm: 'Confirm',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        add: 'Add',
        back: 'Back',
        continue: 'Continue',
        skip: 'Skip',
        undo: 'Undo',
        close: 'Close',
        details: 'Details',
        change: 'Change',
        restore: 'Restore',
        remove: 'Remove',
        saved: 'Saved',
        notSet: 'Not set',
        dash: '—',
        today: 'Today',
        tomorrow: 'Tomorrow',
        thisWeek: 'This week',
        week: 'Week {n}',
        weekOf: 'Week {n} of {total}',
        examWeek: 'Week {n} (Exam Week)',
        weekLabel: 'Week',
        credits: '{n} Credits',
        creditHours: '{n} Credit Hours',
        sessions: '{n} Sessions',
        components: '{n} Components',
        modules: '{n} modules',
        moduleCount: { one: '{n} module', other: '{n} modules' },
        marks: '{a} / {b} Marks',
        hours: '{n} hrs',
        target: 'Target',
        date: 'Date',
        day: 'Day',
        start: 'Start',
        end: 'End',
        type: 'Type',
        room: 'Room',
        weight: 'Weight',
        maxMarks: 'Max marks',
        title: 'Title',
        module: 'Module',
        notes: 'Notes',
        subject: 'Subject',
        duration: 'Duration (minutes)',
        areYouSure: 'Are you sure?'
      },
      day: {
        sun: 'Sun',
        mon: 'Mon',
        tue: 'Tue',
        wed: 'Wed',
        thu: 'Thu',
        fri: 'Fri',
        sat: 'Sat'
      },
      month: {
        jan: 'Jan',
        feb: 'Feb',
        mar: 'Mar',
        apr: 'Apr',
        may: 'May',
        jun: 'Jun',
        jul: 'Jul',
        aug: 'Aug',
        sep: 'Sep',
        oct: 'Oct',
        nov: 'Nov',
        dec: 'Dec'
      },
      date: {
        short: '{day} {d} {mon}',
        shortFull: '{day} {d} {mon} {year}',
        weekSameMonth: '{d1}–{d2} {mon} {year}',
        weekCrossMonth: '{d1} {mon1}–{d2} {mon2} {year}'
      },
      duration: {
        hour: '1 Hour',
        hours: '{n} Hours',
        hm: '{h}h {mm}m'
      },
      countdown: {
        now: 'Starting now',
        min: 'Starts in {n} min',
        hour: 'Starts in {n} h',
        days: 'In {n} days'
      },
      preview: {
        weekStarts: 'Week 1 starts {date}',
        body: '— showing a preview of the trimester.',
        noSessions: 'no sessions held yet.'
      },
      header: {
        starts: 'Starts {date}',
        programmeYear: '{programme} • Year {year}',
        studentIdSuffix: ' • Student ID: {id}',
        cgpaTarget: '{value} CGPA'
      },
      dash: {
        scholarshipTarget: 'Scholarship Target:',
        cgpa: 'CGPA:',
        weeklyTimetable: 'Weekly Timetable',
        timetableSubtitle: '{term} • {weeks} teaching weeks • Click any class to open its Grade Simulator',
        thisWeekTopics: "This Week's Topics",
        syllabusRoadmap: 'Trimester Syllabus Roadmap',
        gradesAssessments: 'Grades & Assessments',
        gradesHint: 'Tap any subject row to open its Grade Simulator',
        targetGrade: 'Target Grade:',
        targetGradeValue: 'A (80%+)',
        footer: 'MMU BeeBoard — a personal study dashboard. Not an official MMU system.',
        aria: {
          nextClass: 'Next class',
          timetable: 'Weekly timetable',
          topics: "This week's topics",
          summary: 'Academic summary',
          grades: 'Grades and assessments'
        }
      },
      next: {
        emptyTitle: 'No classes on the timetable yet',
        emptyBody: 'Add a subject and its weekly sessions to fill this card.',
        emptyCta: 'Add a subject',
        notFound: 'No upcoming class found in the next {days} days.',
        termStarts: 'Term starts {date}',
        today: 'Today',
        room: 'Room {room}',
        openSimulator: 'Open Course Simulator',
        attendance: 'Attendance'
      },
      tt: { time: 'Time', today: '(Today)', noClass: 'No class', transfer: 'Transfer' },
      detail: {
        nextClass: 'Next class: {code} {name}',
        lecturer: 'Lecturer: {name}',
        openSimulator: 'Open Course Simulator',
        thisWeekTopic: "This week's topic",
        attendance: 'Attendance',
        securedMarks: 'Secured marks',
        nextAssessment: 'Next assessment',
        noSessionsYet: 'no sessions yet',
        absences: '{n} absences',
        courseworkPending: 'coursework pending',
        notPublishedYet: 'not published yet'
      },
      topics: { empty: "This week's topics appear here once you add a subject." },
      card: {
        details: 'Details',
        deadlines: {
          title: 'Deadlines',
          nextUpcoming: 'Next Upcoming',
          scheduled: '{n} assessments scheduled this trimester',
          allTracked: 'All modules tracked',
          viewItems: 'View {n} items'
        },
        attendance: {
          title: 'Attendance',
          overall: 'Overall Status',
          noSessions: 'No sessions yet',
          eligible: 'Eligible (≥{n}% req)',
          below: 'Below {n}%',
          held: { one: '({n} session held)', other: '({n} sessions held)' },
          barred: 'Barred threshold: <{n}%',
          detail: 'Attendance detail'
        },
        studyLog: {
          title: 'Study Log',
          currentWeek: 'Current Week Logged',
          target: '/ {n}h Target',
          justBegun: 'Week {n} just begun. Ready for your first focused study session?',
          keepGoing: 'Keep the streak going.',
          targetSubject: 'Target subject:',
          noSubject: 'No subject yet',
          startTimer: 'Start timer'
        }
      },
      notes: {
        title: 'Notes & Homework',
        subtitle: 'Quick memos for today and homework with a due date.',
        aria: 'Notes and homework',
        add: 'Add',
        addTitle: 'New note',
        editTitle: 'Edit note',
        kind: 'Type',
        kindHomework: 'Homework',
        kindMemo: 'Memo',
        text: 'Note',
        textPlaceholder: 'What do you need to remember?',
        subject: 'Subject',
        noSubject: 'No subject',
        date: 'Date',
        due: 'Due (optional)',
        save: 'Save',
        cancel: 'Cancel',
        todayMemos: "Today's memos",
        openHomework: 'Open homework',
        noMemos: 'No memos for today.',
        noHomework: 'No open homework.',
        markDone: 'Mark as done',
        markOpen: 'Mark as not done',
        edit: 'Edit',
        delete: 'Delete',
        deleteTitle: 'Delete this note?',
        deleteBody: '"{text}" will be removed.',
        deleteOk: 'Delete note',
        toastSaved: 'Note saved',
        toastDeleted: 'Note deleted',
        toastRestored: 'Note restored',
        toastTextRequired: 'Enter the note text',
        addFromClass: 'Add a note for this class',
        dueOn: 'Due {when}',
        noDue: 'No due date',
        overdue: 'Overdue',
        homeworkBadge: 'Homework'
      },
      grades: {
        empty: 'No subjects to grade yet.',
        addSubject: 'Add a subject',
        notPublished: 'Assessment structure not published yet.',
        secured: 'Secured —',
        courseworkSecured: 'Coursework Secured',
        marks: '{a} / {b} Marks',
        simulator: 'Simulator',
        creditHours: '{n} Credit Hours'
      },
      setupCard: {
        title: 'Continue setup',
        body:
          'You have no subjects yet. Run the setup wizard to set your trimester and add your first module — ' +
          'it takes about a minute.',
        cta: 'Continue setup'
      },
      room: {
        floor: 'Floor {n}',
        room: 'Room {n}',
        wing: '{w} Wing',
        tutorial: 'Tutorial room',
        lecture: 'Lecture room'
      },
      form: {
        preset: {
          mmuBlue: 'MMU Blue',
          cyan: 'Cyan',
          teal: 'Teal',
          green: 'Green',
          olive: 'Olive',
          orange: 'Orange',
          pink: 'Pink',
          purple: 'Purple',
          indigo: 'Indigo',
          brown: 'Brown',
          slate: 'Slate'
        },
        customHex: 'Custom HEX',
        inUseBy: 'In use by {id}',
        available: 'Available',
        removeSession: 'Remove session',
        removeComponent: 'Remove component',
        subjectDetails: 'Subject Details',
        subjectDetailsHint: 'Core academic profile and visual indicators for timetabling.',
        subjectCode: 'Subject Code *',
        subjectName: 'Subject Name *',
        creditHours: 'Credit Hours',
        lecturer: 'Lecturer',
        accentColor: 'Subject Accent Color',
        accentHint:
          'Colour is used for timetable blocks, chips, and progress bars. Tints are derived automatically ' +
          'from this single value.',
        codePlaceholder: 'ABC1234',
        namePlaceholder: 'Introduction to Programming',
        classSessions: 'Class Sessions',
        classSessionsHint: 'Weekly recurring lectures, tutorials, and practical labs.',
        sessionCount: { one: '{n} Session', other: '{n} Sessions' },
        addSession: 'Add session',
        assessmentComponents: 'Assessment Components',
        assessmentComponentsHint: 'Define continuous assessment weightings and submission targets.',
        componentCount: { one: '{n} Component', other: '{n} Components' },
        addComponent: 'Add component',
        totalWeighting: 'Total Weighting: {n}%',
        totalWeightingMust: 'Total Weighting: {n}% — must equal 100%',
        deleteSubject: 'Delete subject',
        saveChanges: 'Save changes',
        component: 'Component',
        weightPercent: 'Weight %',
        maxMarks: 'Max marks',
        week: 'Week',
        type: 'Type',
        coursework: 'Coursework',
        finalExam: 'Final exam',
        newComponent: 'New component',
        defaultTopicLabel: 'Module 1',
        defaultTopicTitle: 'Introduction',
        defaultTopicResource: 'Course outline',
        err: {
          codeAndName: 'Subject code and name are required',
          credits: 'Credit hours must be at least 1',
          colorUsed: 'Colour already used by {id}',
          weights: 'Assessment weights must total 100%',
          duplicate: 'Subject code {id} already exists',
          hex: 'Enter a HEX colour like #003DA5'
        }
      },
      settings: {
        title: 'Settings & Preferences',
        subtitle:
          'Manage your student profile, portal appearance, academic benchmarks, and timetable preferences.',
        profile: {
          title: 'Profile',
          subtitle: 'Personal and academic information displayed across the portal.',
          fullName: 'Full Name',
          fullNameHint: 'The avatar initials follow this name.',
          programme: 'Programme',
          programmeHint: 'Fixed placeholder — edit STUDENT in assets/js/data.js to change it.',
          studentId: 'Student ID',
          studentIdHint: 'Optional. Shown in the footer when filled in.',
          activeTrimester: 'Active Trimester',
          activeTrimesterHint: 'Change it in the Trimester section below.'
        },
        subjects: {
          title: 'Subjects & Timetable',
          subtitle: 'Manage active subjects, session timings, and assessment weightings.',
          activeCycle: 'Active Cycle',
          count: { one: '{n} subject', other: '{n} subjects' },
          empty: 'No subjects yet.',
          hint: 'Add a module for this trimester, or edit an existing one.',
          add: 'Add subject'
        },
        setup: {
          title: 'First-time setup',
          subtitle: 'Re-run the guided setup for your trimester and first subject.',
          body:
            'The wizard walks through the trimester label, Week 1 start date, week count and your first ' +
            'subject. Skipping it is fine — nothing is locked.',
          cta: 'Open setup wizard'
        },
        appearance: {
          title: 'Appearance',
          subtitle: 'Customize the theme and subject palette across timetables and dashboards.',
          themeMode: 'Theme Mode',
          themeHint:
            'Dark palette is applied through CSS variables; subject colours stay identical in both themes.',
          light: 'Light',
          dark: 'Dark',
          system: 'System',
          taxonomy: 'Subject Color Taxonomy',
          change: 'Change'
        },
        language: {
          title: 'Language',
          subtitle: 'Choose the language used across every page of the app.',
          label: 'Interface language',
          hint: 'Applies immediately to every page and is remembered in this browser.'
        },
        goals: {
          title: 'Goals & Alerts',
          subtitle: 'Set the academic benchmarks used across the dashboard.',
          cgpa: 'CGPA Target',
          cgpaHint: 'Shown in the header and used by the Grade Simulator.',
          attendance: 'Attendance Warning Threshold (%)',
          attendanceHint: 'Drives the attendance page, dashboard card and policy text.',
          study: 'Weekly Study Target (hours)',
          studyHint: 'Used by the Study Log and the dashboard summary.'
        },
        timetable: {
          title: 'Timetable',
          subtitle: 'Schedule boundaries and calendar configuration.',
          startDate: 'Term Start Date',
          startDateHint: 'Week 1 Monday. Leave empty to keep every week number at Week 1.',
          weeks: 'Number of Weeks',
          weeksHint: 'Teaching weeks before the exam week.'
        },
        term: {
          title: 'Trimester',
          subtitle: 'Move to the next trimester and keep past records archived in this browser.',
          active: 'Active',
          starts: 'Starts {date}',
          startNotSet: 'Start date not set',
          weeksExam: '{weeks} weeks • exam week {exam}',
          startNext: 'Start next trimester',
          label: 'Trimester label',
          labelPlaceholder: 'Trimester Feb/Mar 2027',
          week1: 'Week 1 starts (Monday)',
          weeks: 'Number of weeks',
          examWeek: 'Exam week',
          whatHappens: 'What happens on switch',
          kept: {
            one: 'Kept: {n} module with its sessions, colours and assessment weightings.',
            other: 'Kept: {n} modules with their sessions, colours and assessment weightings.'
          },
          cleared:
            'Cleared: marks, attendance records, study log and custom deadlines. The current trimester is ' +
            'archived first, so nothing is lost for good.',
          adjust: 'Adjust modules afterwards in the Subject Editor.',
          start: 'Start trimester',
          archived: 'Archived trimesters',
          none: 'No archived trimesters yet.',
          archivedMeta: 'Starts {date} • {modules} • archived {when}',
          restore: 'Restore'
        },
        data: {
          title: 'Data & Storage',
          subtitle: 'Export backup files or reset local browser state.',
          export: 'Export data (JSON)',
          import: 'Import data',
          reset: 'Reset all data',
          hint: 'All data is stored locally in this browser. Nothing is sent to MMU.'
        },
        toast: {
          fillAll: 'Fill in label, start date and weeks',
          switched: 'Switched to {label}',
          themeSet: 'Theme set to {theme}',
          backup: 'Backup downloaded',
          imported: 'Data imported',
          importFailed: 'Import failed: invalid file',
          restored: 'Trimester restored'
        },
        confirm: {
          startTitle: 'Start "{label}"?',
          startBody:
            'The current trimester is archived and marks, attendance, study log and custom deadlines are ' +
            'cleared. Your modules carry over.',
          startConfirm: 'Start trimester',
          restoreTitle: 'Restore this trimester?',
          restoreBody: 'The current trimester is archived first, then the selected one becomes active.',
          restoreConfirm: 'Restore',
          resetTitle: 'Reset all local data?',
          resetBody:
            'Every subject, mark, attendance record and study session in this browser is deleted and the ' +
            'setup wizard runs again. Export a backup first if you want to keep it.',
          resetConfirm: 'Reset everything'
        }
      },
      wizard: {
        title: 'First-time setup',
        step: { welcome: 'Welcome', term: 'Trimester', subjects: 'Subjects', done: 'Done' },
        welcome: {
          badge: 'First-time setup',
          title: 'Welcome to MMU BeeBoard',
          body:
            'A personal study dashboard for your trimester. Three short steps and your timetable is yours.',
          privacyTitle: 'Your data stays in this browser.',
          privacyBody:
            "Everything you enter is saved to this browser's local storage only — no account, no server, " +
            'no analytics, no network requests. Clearing site data removes it.',
          skip: 'Skip setup',
          start: 'Get started',
          f1t: 'Weekly timetable',
          f1d: 'Class blocks on a Mon–Fri grid with a next-class card.',
          f2t: 'Attendance',
          f2d: 'Track the exam-eligibility threshold per module.',
          f3t: 'Grade simulator',
          f3d: 'Secured marks and the final exam score still needed.',
          f4t: 'Deadlines',
          f4d: 'Assessment timeline grouped by week and weight.',
          f5t: 'Study log',
          f5d: 'A timer and manual entries against a weekly target.'
        },
        term: {
          title: 'Set up your trimester',
          body:
            'The label and week count drive the header, the timetable subtitle, and every week number in the app.',
          label: 'Trimester label',
          labelPlaceholder: 'My Trimester',
          week1: 'Week 1 starts (Monday)',
          week1Hint: 'Optional. Leave it empty and week numbers stay at Week 1 until you set a date in Settings.',
          weeks: 'Number of weeks',
          weeksHint: 'Defaults to 14 teaching weeks.',
          name: 'Your name (optional)',
          namePlaceholder: 'Student',
          nameHint: 'Shown in the header and footer. You can change it any time in Settings.',
          back: 'Back',
          continue: 'Continue'
        },
        subject: {
          title: 'Add your first subject',
          body:
            'Same fields as the subject editor: code, name, credits, colour, weekly sessions and assessment ' +
            'weightings. The colour is picked from the unused presets.',
          addedSoFar: 'Added so far',
          count: { one: '{n} subject', other: '{n} subjects' },
          edit: 'Edit',
          save: 'Save subject',
          addAnother: 'Add another subject',
          finish: 'Go to finish',
          savedTitle: '{name} added',
          savedBody:
            'It is already on your timetable, deadlines, attendance and study log. Add another module, or ' +
            'finish setup and open the dashboard.'
        },
        done: {
          title: 'Setup complete',
          body: 'Everything is stored in this browser. You can change any of it later in Settings.',
          trimester: 'Trimester',
          week1: 'Week 1 starts',
          teachingWeeks: 'Teaching weeks',
          notSet: 'Not set yet',
          ready: { one: '{n} subject ready: {list}', other: '{n} subjects ready: {list}' },
          none:
            'No subjects yet — the dashboard will show an empty state and a "Continue setup" card until ' +
            'you add one.',
          addSubject: 'Add a subject',
          open: 'Open dashboard'
        },
        toast: { weeks: 'Number of weeks must be 1 or more' }
      },
      sim: {
        title: 'Grade Simulator',
        subtitle: 'Enter coursework marks to project the grade and the final exam score still required.',
        empty: 'No subjects to simulate yet.',
        addSubject: 'Add a subject',
        gpa: 'Predicted Trimester GPA',
        noScores: 'No scores yet',
        ofFour: 'of 4.00',
        graded: { one: '{n} of {total} module graded', other: '{n} of {total} modules graded' },
        provisional: ' — provisional',
        awaiting: 'Awaiting coursework marks',
        provisionalNote:
          'Only graded modules are counted, so this figure will move as the remaining marks come in.',
        threshold: 'Scholarship Retention Threshold',
        scholarship: 'JPA / High Achiever',
        minRequired: 'Min. Required',
        maintenance: 'Requires continuous maintenance each trimester.',
        distance: 'Distance to Target',
        cutoffTitle: 'Scholarship minimum {n}',
        cutoff: '{n} Cutoff',
        modulesCounted: 'Modules Counted',
        creditsOf: '{a} of {b} Cr.',
        enterAll: 'Enter marks for every component of a module to predict its grade.',
        countsWhenComplete: 'A module counts once all of its components have marks.',
        week: 'Week {n}',
        scoreAria: 'Score obtained for {name}',
        maxAria: 'Full marks for {name}',
        maxTitle: 'Full marks for this component',
        gradedStatus: 'Graded',
        pendingStatus: 'Pending',
        notPublished: 'Assessment structure not published yet.',
        noFinal:
          'No final exam component — set one component\'s Type to “Final exam” in the Subject Editor.',
        alreadySecured: 'Already secured',
        notReachable: 'Not reachable',
        creditHours: '{n} Credit Hours',
        currentSecured: 'Current Secured',
        predictedGrade: 'Predicted Grade',
        assessmentsTitle: 'Continuous Assessments & Weighted Components',
        th: {
          component: 'Component',
          weight: 'Weight',
          score: 'Score / Full marks',
          weighted: 'Weighted',
          status: 'Status'
        },
        denominatorNote:
          'The second box is the denominator (full marks) for that component, not a button. ' +
          'Marks save as you type.',
        structureNotPublished: 'The assessment structure for this module has not been published yet.',
        neededFor: 'Final exam score needed for {n}%:',
        securedLine:
          'Current coursework secured: {a} / {b}%. Enter marks above to recompute the target buffer.',
        securedSummary: '{a} / {b} secured • {n} components',
        inProgress: 'In progress',
        noScoresYet: 'No scores yet',
        cr: '({n} Cr.)',
        gradingScale: 'MMU Grading Scale',
        gradingHint: 'Indicative bands — confirm with your faculty handbook',
        targetNote:
          '(Target) marks the band that contains the {n}% target. A and A+ both carry 4.00 grade points, ' +
          'so the band only affects the percentage, not the GPA.',
        scholarshipNote:
          'A minimum grade point average of {n} is mandatory across two consecutive trimesters to retain ' +
          'the full scholarship endowment.',
        gp: 'GP',
        target: '(Target)',
        toastCapped: 'Score capped at the full marks for this component'
      },
      dl: {
        title: 'Deadlines',
        subtitle: 'Track assessment timelines, deliverables, and weight at stake across the trimester.',
        addFirst: 'Add a subject first — deadlines are tracked per module.',
        addSubject: 'Add a subject',
        addDeadline: 'Add a deadline',
        addDeadlineHint: 'for anything the module outline does not list',
        titleField: 'Title',
        titlePlaceholder: 'Lab report submission',
        module: 'Module',
        week: 'Week',
        weight: 'Weight (%)',
        due: 'Due / note',
        duePlaceholder: 'Sun 6 Dec, 23:59',
        dateField: 'Date & time',
        dateHint: 'Optional — the week is filled in from the date',
        kindField: 'Type',
        kind: {
          homework: 'Homework',
          assignment: 'Assignment',
          testPrep: 'Test prep',
          other: 'Other'
        },
        submit: 'Add deadline',
        allModules: 'All modules',
        highStakesHint: "High Stakes marks a week where {n}% or more of a module's grade is due.",
        noUpcoming: 'No upcoming deadlines for this filter.',
        thisWeek: 'This week',
        tomorrow: 'Tomorrow',
        inDays: 'In {n} days',
        milestone: 'Upcoming Milestone',
        nextDeadline: 'Next deadline: {code} {name} — Week {n} ({range})',
        noAssessments: 'No assessments for this filter.',
        dueInWeek: 'Due in the week of {range}',
        custom: '(custom)',
        homework: 'Homework',
        openDetail: 'Open details',
        removeCustom: 'Remove this custom deadline',
        openSim: 'Open Grade Simulator',
        overWeighted:
          '{id} adds up to {total}% this week — more than a module can carry. Check the weightings in the ' +
          'Subject Editor.',
        examWeek: 'Week {n} (Exam Week)',
        datesNotSet: 'Dates not set',
        highStakes: 'High Stakes · {id}',
        highStakesTitle: "{n}% or more of {id}'s grade is due this week",
        totalWeight: 'Total Weight:',
        toast: {
          titleRequired: 'Title is required',
          week: 'Week must be 1 or later',
          dateInvalid: 'Enter a valid date and time',
          added: 'Deadline added',
          removed: 'Deadline removed',
          restored: 'Deadline restored'
        },
        confirm: {
          title: 'Remove this deadline?',
          body: '"{name}" will be removed from the timeline.',
          ok: 'Remove deadline'
        }
      },
      att: {
        title: 'Attendance',
        subtitle: {
          one:
            'Monitor attendance across your {n} module and maintain the {t}% threshold for MMU exam eligibility.',
          other:
            'Monitor attendance across your {n} modules and maintain the {t}% threshold for MMU exam eligibility.'
        },
        subtitleEmpty: 'Track attendance per module and keep the {t}% threshold for MMU exam eligibility.',
        noSessions: 'No sessions held yet — attendance tracking starts in Week 1.',
        eligible: 'Status: Exam Eligible (All Subjects)',
        below: {
          one: 'Status: {n} module below the {t}% threshold',
          other: 'Status: {n} modules below the {t}% threshold'
        },
        policyTitle: 'MMU Attendance Policy:',
        policyBody:
          'Minimum {t}% total attendance is required per subject to sit for final examinations. Falling ' +
          'below {t}% triggers an automatic exam bar.',
        session: 'Session',
        noSessionsDefined: 'No sessions defined',
        addSessionsHint: 'Add weekly sessions in the Subject Editor to record per class.',
        empty: 'No subjects to track yet.',
        addSubject: 'Add a subject',
        credits: '{n} Credits',
        perWeek: {
          one: '{n} session per week · {total} trimester sessions total',
          other: '{n} sessions per week · {total} trimester sessions total'
        },
        standing: 'Current Standing',
        attended: 'Sessions Attended',
        absences: 'Absences Recorded',
        belowNote: 'You are below the {t}% threshold. Attend the next sessions to recover.',
        canMiss: {
          one: 'You can miss <strong>{n} more session</strong> before dropping below {t}%.',
          other: 'You can miss <strong>{n} more sessions</strong> before dropping below {t}%.'
        },
        date: 'Date',
        lastSession: 'Last session: {value}',
        markPresent: 'Mark attended',
        markAbsent: 'Mark absent',
        markNoClass: 'No class',
        noClassHint: 'Holiday or cancelled class — excluded from the attendance total.',
        overridesTitle: 'No class & transfers',
        noClassBadge: 'No class',
        transferBadge: 'Transfer',
        transferTitle: 'Transfer this class',
        transferEditTitle: 'Edit transfer',
        transferSource: 'Original: {date} · {session}',
        transferDate: 'New date',
        transferStart: 'Start',
        transferEnd: 'End',
        transferRoom: 'Room (optional)',
        transferRoomTbd: 'Room TBD',
        transferSave: 'Save transfer',
        transferEdit: 'Edit transfer',
        transferRemove: 'Cancel transfer',
        transferTo: 'Transferred to {date} {start}–{end}',
        transferFrom: 'Transferred from {date}',
        present: 'Present',
        absent: 'Absent',
        deleteRecord: 'Delete this record',
        logEmpty: 'No attendance recorded yet.',
        logEmptyHint: 'Mark a session above to start the log for {term}.',
        logEmptyNoSubject: 'Add a subject to start tracking attendance.',
        logTitle: 'Attendance Log',
        entry: { one: '{n} entry', other: '{n} entries' },
        toast: {
          present: 'Marked attended',
          absent: 'Marked absent',
          removed: 'Record removed',
          deleted: 'Record deleted',
          restored: 'Record restored',
          noClass: 'Marked as no class',
          noClassRemoved: 'No class removed',
          transferSaved: 'Transfer saved',
          transferRemoved: 'Transfer removed',
          transferRequired: 'Date, start and end are required for a transfer',
          transferRange: 'End time must be after the start time',
          noClassOnTransfer: 'This is a transferred session — cancel the transfer from the list instead'
        },
        confirm: {
          title: 'Delete this attendance record?',
          body: '{code} · {date}{session} ({status}) will be removed and the totals recalculated.',
          ok: 'Delete record'
        }
      },
      sl: {
        title: 'Study Log',
        subtitle: 'Track focused revision and module study time towards your academic goals.',
        empty: 'Add a subject to start logging study time.',
        addSubject: 'Add a subject',
        active: 'Active Session',
        focusInterval: 'Focus Interval',
        selectModule: 'Select module to log',
        meta: '{term} • Week {week} • Target {target} hrs/week',
        start: 'Start',
        stop: 'Stop',
        thisWeek: 'This Week',
        targetMeta: 'Target: {n} hrs/week • Week {w}',
        target: '/ {n}h',
        hrs: '{n} hrs',
        manual: 'Manual Entry',
        manualEmpty: 'Add a subject to log sessions manually.',
        manualHint: 'Log offline sessions or group tutorial revisions directly.',
        subject: 'Subject',
        duration: 'Duration (minutes)',
        durationHint: 'Any whole number of minutes, e.g. 30, 45, 60 or 90.',
        date: 'Date',
        notes: 'Notes',
        notesPlaceholder: 'e.g. Tutorial sheet 1 revision',
        addSession: 'Add session',
        historyEmpty: 'No sessions yet',
        historyHint: 'Start the timer or add a session manually.',
        history: 'Session History',
        count: { one: '{n} Session', other: '{n} Sessions' },
        deleteSession: 'Delete session',
        toast: {
          noSubject: 'Add a subject before logging a session',
          tooShort: 'Session under a minute was discarded',
          saved: 'Session saved',
          duration: 'Enter a duration in minutes',
          added: 'Session added',
          deleted: 'Session deleted',
          restored: 'Session restored'
        },
        confirm: {
          title: 'Delete this session?',
          body: '{label} will be removed from your study log.',
          ok: 'Delete session'
        }
      },
      se: {
        addTitle: 'Add Subject',
        editTitle: 'Edit Subject',
        addSubtitle:
          'Register a module for this trimester: code, name, credits, colour, weekly sessions and weightings.',
        editSubtitle: 'Configure subject metadata, weekly sessions, and continuous assessment weightings.',
        cancel: 'Cancel',
        add: 'Add subject',
        save: 'Save changes',
        toastAdded: '{id} added',
        toastSaved: 'Subject saved',
        confirm: {
          title: 'Delete {id}?',
          body:
            '{name} and its sessions, assessment weightings, marks and attendance records are removed from ' +
            'this trimester. This cannot be undone.',
          ok: 'Delete subject'
        }
      }
    },

    ja: {
      page: {
        dashboard: 'MMU BeeBoard — ダッシュボード',
        attendance: 'MMU BeeBoard — 出席',
        deadlines: 'MMU BeeBoard — 締切',
        settings: 'MMU BeeBoard — 設定',
        setup: 'MMU BeeBoard — 初回セットアップ',
        simulator: 'MMU BeeBoard — 成績シミュレーター',
        studylog: 'MMU BeeBoard — 学習ログ',
        subjectEdit: 'MMU BeeBoard — 科目の編集'
      },
      brand: { tagline: '個人用学習ダッシュボード' },
      nav: { settings: '設定', backToDashboard: 'ダッシュボードに戻る' },
      common: {
        cancel: 'キャンセル',
        confirm: '実行',
        save: '保存',
        delete: '削除',
        edit: '編集',
        add: '追加',
        back: '戻る',
        continue: '次へ',
        skip: 'スキップ',
        undo: '元に戻す',
        close: '閉じる',
        details: '詳細',
        change: '変更',
        restore: '復元',
        remove: '削除',
        saved: '保存しました',
        notSet: '未設定',
        dash: '—',
        today: '今日',
        tomorrow: '明日',
        thisWeek: '今週',
        week: '第{n}週',
        weekOf: '第{n}週（全{total}週）',
        examWeek: '第{n}週（試験週）',
        weekLabel: '週',
        credits: '{n}単位',
        creditHours: '{n}単位',
        sessions: '{n}コマ',
        components: '{n}項目',
        modules: '{n}科目',
        moduleCount: { one: '{n}科目', other: '{n}科目' },
        marks: '{a} / {b}点',
        hours: '{n}時間',
        target: '目標',
        date: '日付',
        day: '曜日',
        start: '開始',
        end: '終了',
        type: '種別',
        room: '教室',
        weight: '配点',
        maxMarks: '満点',
        title: 'タイトル',
        module: '科目',
        notes: 'メモ',
        subject: '科目',
        duration: '時間（分）',
        areYouSure: '実行しますか？'
      },
      day: {
        sun: '日',
        mon: '月',
        tue: '火',
        wed: '水',
        thu: '木',
        fri: '金',
        sat: '土'
      },
      month: {
        jan: '1月',
        feb: '2月',
        mar: '3月',
        apr: '4月',
        may: '5月',
        jun: '6月',
        jul: '7月',
        aug: '8月',
        sep: '9月',
        oct: '10月',
        nov: '11月',
        dec: '12月'
      },
      date: {
        short: '{mon}{d}日({day})',
        shortFull: '{year}年{mon}{d}日({day})',
        weekSameMonth: '{mon}{d1}日–{d2}日',
        weekCrossMonth: '{mon1}{d1}日–{mon2}{d2}日'
      },
      duration: {
        hour: '1時間',
        hours: '{n}時間',
        hm: '{h}時間{m}分'
      },
      countdown: {
        now: 'まもなく開始',
        min: 'あと{n}分',
        hour: 'あと{n}時間',
        days: 'あと{n}日'
      },
      preview: {
        weekStarts: '第1週は{date}開始',
        body: '— 学期のプレビューを表示しています。',
        noSessions: 'まだ授業は実施されていません。'
      },
      header: {
        starts: '{date}開始',
        programmeYear: '{programme} • {year}年次',
        studentIdSuffix: ' • 学籍番号: {id}',
        cgpaTarget: 'CGPA {value}'
      },
      dash: {
        scholarshipTarget: '奨学金目標:',
        cgpa: 'CGPA:',
        weeklyTimetable: '週間時間割',
        timetableSubtitle: '{term} ・ 全{weeks}週 ・ コマをクリックすると成績シミュレーターが開きます',
        thisWeekTopics: '今週のトピック',
        syllabusRoadmap: '学期シラバス一覧',
        gradesAssessments: '成績と評価',
        gradesHint: '科目の行をタップすると成績シミュレーターが開きます',
        targetGrade: '目標グレード:',
        targetGradeValue: 'A (80%+)',
        footer: 'MMU BeeBoard — 個人用の学習ダッシュボードです。MMU 公式システムではありません。',
        aria: {
          nextClass: '次の授業',
          timetable: '週間時間割',
          topics: '今週のトピック',
          summary: '学業サマリー',
          grades: '成績と評価'
        }
      },
      next: {
        emptyTitle: '時間割にまだ授業がありません',
        emptyBody: '科目と週次のコマを追加すると、ここに次の授業が表示されます。',
        emptyCta: '科目を追加',
        notFound: '今後{days}日間に予定されている授業はありません。',
        termStarts: '学期開始 {date}',
        today: '今日',
        room: '教室 {room}',
        openSimulator: '成績シミュレーターを開く',
        attendance: '出席'
      },
      tt: { time: '時刻', today: '(今日)', noClass: '休講', transfer: '振替' },
      detail: {
        nextClass: '次の授業: {code} {name}',
        lecturer: '担当: {name}',
        openSimulator: '成績シミュレーターを開く',
        thisWeekTopic: '今週のトピック',
        attendance: '出席',
        securedMarks: '確保済みの点数',
        nextAssessment: '次の評価',
        noSessionsYet: 'まだ授業なし',
        absences: '欠席{n}回',
        courseworkPending: '課題の点数待ち',
        notPublishedYet: '未公表'
      },
      topics: { empty: '科目を追加すると、今週のトピックがここに表示されます。' },
      card: {
        details: '詳細',
        deadlines: {
          title: '締切',
          nextUpcoming: '直近の締切',
          scheduled: 'この学期の評価は{n}件',
          allTracked: '全科目を追跡中',
          viewItems: '{n}件を表示'
        },
        attendance: {
          title: '出席',
          overall: '全体の状況',
          noSessions: 'まだ授業なし',
          eligible: '受験資格あり（{n}%以上）',
          below: '{n}%未満',
          held: { one: '（実施{n}回）', other: '（実施{n}回）' },
          barred: '受験不可の基準: <{n}%',
          detail: '出席の詳細'
        },
        studyLog: {
          title: '学習ログ',
          currentWeek: '今週の記録',
          target: '/ 目標{n}時間',
          justBegun: '第{n}週が始まったばかりです。最初の集中学習を記録しませんか？',
          keepGoing: 'この調子で続けましょう。',
          targetSubject: '対象科目:',
          noSubject: '科目がありません',
          startTimer: 'タイマー開始'
        }
      },
      notes: {
        title: 'メモと宿題',
        subtitle: '今日のメモと、締切のある宿題をまとめて管理します。',
        aria: 'メモと宿題',
        add: '追加',
        addTitle: '新しいメモ',
        editTitle: 'メモを編集',
        kind: '種別',
        kindHomework: '宿題',
        kindMemo: 'メモ',
        text: '内容',
        textPlaceholder: '覚えておきたいことを入力',
        subject: '科目',
        noSubject: '科目なし',
        date: '日付',
        due: '締切（任意）',
        save: '保存',
        cancel: 'キャンセル',
        todayMemos: '今日のメモ',
        openHomework: '未完了の宿題',
        noMemos: '今日のメモはありません。',
        noHomework: '未完了の宿題はありません。',
        markDone: '完了にする',
        markOpen: '未完了に戻す',
        edit: '編集',
        delete: '削除',
        deleteTitle: 'このメモを削除しますか？',
        deleteBody: '「{text}」を削除します。',
        deleteOk: 'メモを削除',
        toastSaved: 'メモを保存しました',
        toastDeleted: 'メモを削除しました',
        toastRestored: 'メモを復元しました',
        toastTextRequired: '内容を入力してください',
        addFromClass: 'この授業のメモを追加',
        dueOn: '締切 {when}',
        noDue: '締切なし',
        overdue: '期限切れ',
        homeworkBadge: '宿題'
      },
      grades: {
        empty: '採点対象の科目がまだありません。',
        addSubject: '科目を追加',
        notPublished: '評価構成はまだ公表されていません。',
        secured: '確保済み —',
        courseworkSecured: '確保済みの課題点',
        marks: '{a} / {b}点',
        simulator: 'シミュレーター',
        creditHours: '{n}単位'
      },
      setupCard: {
        title: 'セットアップを続ける',
        body:
          '科目がまだありません。セットアップウィザードで学期を設定し、最初の科目を追加してください。' +
          '1分ほどで終わります。',
        cta: 'セットアップを続ける'
      },
      room: {
        floor: '{n}階',
        room: '部屋 {n}',
        wing: '{w}ウィング',
        tutorial: 'チュートリアル室',
        lecture: '講義室'
      },
      form: {
        preset: {
          mmuBlue: 'MMUブルー',
          cyan: 'シアン',
          teal: 'ティール',
          green: 'グリーン',
          olive: 'オリーブ',
          orange: 'オレンジ',
          pink: 'ピンク',
          purple: 'パープル',
          indigo: 'インディゴ',
          brown: 'ブラウン',
          slate: 'スレート'
        },
        customHex: 'カスタムHEX',
        inUseBy: '{id} が使用中',
        available: '使用可能',
        removeSession: 'コマを削除',
        removeComponent: '評価項目を削除',
        subjectDetails: '科目の詳細',
        subjectDetailsHint: '時間割に表示する基本情報と色を設定します。',
        subjectCode: '科目コード *',
        subjectName: '科目名 *',
        creditHours: '単位数',
        lecturer: '担当教員',
        accentColor: '科目のアクセントカラー',
        accentHint: '色は時間割のコマ・チップ・進捗バーに使われます。淡色はこの1色から自動で作られます。',
        codePlaceholder: 'ABC1234',
        namePlaceholder: 'プログラミング入門',
        classSessions: '授業コマ',
        classSessionsHint: '毎週繰り返される講義・チュートリアル・実習です。',
        sessionCount: { one: '{n}コマ', other: '{n}コマ' },
        addSession: 'コマを追加',
        assessmentComponents: '評価項目',
        assessmentComponentsHint: '平常評価の配点と提出目標を設定します。',
        componentCount: { one: '{n}項目', other: '{n}項目' },
        addComponent: '評価項目を追加',
        totalWeighting: '配点合計: {n}%',
        totalWeightingMust: '配点合計: {n}% — 100% にしてください',
        deleteSubject: '科目を削除',
        saveChanges: '変更を保存',
        component: '評価項目',
        weightPercent: '配点 %',
        maxMarks: '満点',
        week: '週',
        type: '種別',
        coursework: '平常評価',
        finalExam: '期末試験',
        newComponent: '新しい評価項目',
        defaultTopicLabel: 'モジュール1',
        defaultTopicTitle: 'はじめに',
        defaultTopicResource: 'コース概要',
        err: {
          codeAndName: '科目コードと科目名は必須です',
          credits: '単位数は1以上にしてください',
          colorUsed: '{id} がすでにこの色を使っています',
          weights: '配点の合計を100%にしてください',
          duplicate: '科目コード {id} はすでに存在します',
          hex: '#003DA5 のようなHEXカラーを入力してください'
        }
      },
      settings: {
        title: '設定',
        subtitle: 'プロフィール、表示、学業の目標値、時間割の設定を管理します。',
        profile: {
          title: 'プロフィール',
          subtitle: 'アプリ全体に表示される個人情報と学籍情報です。',
          fullName: '氏名',
          fullNameHint: 'アバターのイニシャルはこの名前から作られます。',
          programme: 'プログラム',
          programmeHint: '固定値です。変更するには assets/js/data.js の STUDENT を編集してください。',
          studentId: '学籍番号',
          studentIdHint: '任意です。入力するとフッターに表示されます。',
          activeTrimester: '現在の学期',
          activeTrimesterHint: '下の「学期」セクションで変更できます。'
        },
        subjects: {
          title: '科目と時間割',
          subtitle: '履修中の科目、コマの時間、配点を管理します。',
          activeCycle: '現在の学期',
          count: { one: '{n}科目', other: '{n}科目' },
          empty: '科目がまだありません。',
          hint: 'この学期の科目を追加するか、既存の科目を編集してください。',
          add: '科目を追加'
        },
        setup: {
          title: '初回セットアップ',
          subtitle: '学期と最初の科目のガイド付きセットアップをやり直します。',
          body:
            '学期名、第1週の開始日、週数、最初の科目を順に設定します。スキップしても問題ありません。' +
            '何も固定されません。',
          cta: 'セットアップウィザードを開く'
        },
        appearance: {
          title: '表示',
          subtitle: 'テーマと科目の配色を、時間割とダッシュボード全体に反映します。',
          themeMode: 'テーマ',
          themeHint: 'ダークテーマはCSS変数で切り替わります。科目の色はどちらのテーマでも同じです。',
          light: 'ライト',
          dark: 'ダーク',
          system: 'システム',
          taxonomy: '科目の色一覧',
          change: '変更'
        },
        language: {
          title: '言語',
          subtitle: 'アプリの全ページで使う言語を選びます。',
          label: '表示言語',
          hint: 'すべてのページにすぐ反映され、このブラウザに保存されます。'
        },
        goals: {
          title: '目標とアラート',
          subtitle: 'ダッシュボード全体で使う学業の目標値を設定します。',
          cgpa: 'CGPA目標',
          cgpaHint: 'ヘッダーに表示され、成績シミュレーターでも使われます。',
          attendance: '出席警告のしきい値（%）',
          attendanceHint: '出席ページ、ダッシュボードのカード、ポリシー文に反映されます。',
          study: '週間学習目標（時間）',
          studyHint: '学習ログとダッシュボードのサマリーで使われます。'
        },
        timetable: {
          title: '時間割',
          subtitle: '学期の期間とカレンダーの設定です。',
          startDate: '学期開始日',
          startDateHint: '第1週の月曜日です。空のままにすると週番号は第1週のままになります。',
          weeks: '週数',
          weeksHint: '試験週の前までの授業週数です。'
        },
        term: {
          title: '学期',
          subtitle: '次の学期に進み、過去の記録はこのブラウザに保存します。',
          active: '現在',
          starts: '{date}開始',
          startNotSet: '開始日が未設定です',
          weeksExam: '{weeks}週 • 試験週 {exam}',
          startNext: '次の学期を開始',
          label: '学期名',
          labelPlaceholder: '2027年2/3月学期',
          week1: '第1週の開始日（月曜）',
          weeks: '週数',
          examWeek: '試験週',
          whatHappens: '切り替えるとどうなるか',
          kept: {
            one: '引き継ぐ: {n}科目（コマ・色・配点を含む）。',
            other: '引き継ぐ: {n}科目（コマ・色・配点を含む）。'
          },
          cleared:
            '消去する: 点数、出席記録、学習ログ、カスタム締切。現在の学期は先に保存されるので、' +
            '完全に失われることはありません。',
          adjust: '科目はあとから科目エディタで調整できます。',
          start: '学期を開始',
          archived: '保存済みの学期',
          none: '保存済みの学期はまだありません。',
          archivedMeta: '{date}開始 • {modules} • {when} に保存',
          restore: '復元'
        },
        data: {
          title: 'データと保存',
          subtitle: 'バックアップの書き出し、ブラウザ内データのリセットを行います。',
          export: 'データを書き出す（JSON）',
          import: 'データを読み込む',
          reset: '全データをリセット',
          hint: 'データはすべてこのブラウザ内に保存されます。MMU に送信されることはありません。'
        },
        toast: {
          fillAll: '学期名・開始日・週数を入力してください',
          switched: '{label} に切り替えました',
          themeSet: 'テーマを {theme} にしました',
          backup: 'バックアップを書き出しました',
          imported: 'データを読み込みました',
          importFailed: '読み込みに失敗しました: ファイルが不正です',
          restored: '学期を復元しました'
        },
        confirm: {
          startTitle: '「{label}」を開始しますか？',
          startBody:
            '現在の学期は保存され、点数・出席・学習ログ・カスタム締切は消去されます。科目は引き継がれます。',
          startConfirm: '学期を開始',
          restoreTitle: 'この学期を復元しますか？',
          restoreBody: '現在の学期を先に保存してから、選んだ学期を有効にします。',
          restoreConfirm: '復元',
          resetTitle: 'ブラウザ内の全データをリセットしますか？',
          resetBody:
            'このブラウザ内の科目・点数・出席記録・学習セッションがすべて削除され、セットアップ' +
            'ウィザードが再び表示されます。残したい場合は先にバックアップを書き出してください。',
          resetConfirm: 'すべてリセット'
        }
      },
      wizard: {
        title: '初回セットアップ',
        step: { welcome: 'ようこそ', term: '学期', subjects: '科目', done: '完了' },
        welcome: {
          badge: '初回セットアップ',
          title: 'MMU BeeBoard へようこそ',
          body: '学期のための個人用学習ダッシュボードです。3つの短いステップで、あなたの時間割になります。',
          privacyTitle: 'データはこのブラウザ内に残ります。',
          privacyBody:
            '入力した内容はこのブラウザのローカルストレージにのみ保存されます。アカウントもサーバーも' +
            '解析も通信もありません。サイトデータを消去すると削除されます。',
          skip: 'セットアップをスキップ',
          start: 'はじめる',
          f1t: '週間時間割',
          f1d: '月〜金のグリッドにコマを表示し、次の授業カードも出します。',
          f2t: '出席',
          f2d: '科目ごとに受験資格のしきい値を追跡します。',
          f3t: '成績シミュレーター',
          f3d: '確保済みの点数と、期末試験で必要な点数を計算します。',
          f4t: '締切',
          f4d: '評価のスケジュールを週と配点でまとめて表示します。',
          f5t: '学習ログ',
          f5d: 'タイマーと手入力で、週間目標に対する学習時間を記録します。'
        },
        term: {
          title: '学期を設定する',
          body: '学期名と週数は、ヘッダー・時間割の副題・アプリ内のすべての週番号に反映されます。',
          label: '学期名',
          labelPlaceholder: '私の学期',
          week1: '第1週の開始日（月曜）',
          week1Hint: '任意です。空のままにすると、設定で日付を入れるまで週番号は第1週のままです。',
          weeks: '週数',
          weeksHint: '既定は14授業週です。',
          name: '氏名（任意）',
          namePlaceholder: '学生',
          nameHint: 'ヘッダーとフッターに表示されます。設定からいつでも変更できます。',
          back: '戻る',
          continue: '次へ'
        },
        subject: {
          title: '最初の科目を追加する',
          body:
            '科目エディタと同じ項目です。コード・科目名・単位数・色・週次のコマ・配点を入力します。' +
            '色は未使用のプリセットから自動で選ばれます。',
          addedSoFar: '追加済み',
          count: { one: '{n}科目', other: '{n}科目' },
          edit: '編集',
          save: '科目を保存',
          addAnother: 'さらに科目を追加',
          finish: '完了へ進む',
          savedTitle: '{name} を追加しました',
          savedBody:
            '時間割・締切・出席・学習ログにすでに反映されています。続けて科目を追加するか、' +
            'セットアップを終えてダッシュボードを開いてください。'
        },
        done: {
          title: 'セットアップ完了',
          body: 'すべてこのブラウザ内に保存されました。あとから設定でいつでも変更できます。',
          trimester: '学期',
          week1: '第1週の開始日',
          teachingWeeks: '授業週数',
          notSet: '未設定',
          ready: { one: '{n}科目の準備ができました: {list}', other: '{n}科目の準備ができました: {list}' },
          none:
            '科目がまだありません。ダッシュボードには空の状態と「セットアップを続ける」カードが' +
            '表示されます。',
          addSubject: '科目を追加',
          open: 'ダッシュボードを開く'
        },
        toast: { weeks: '週数は1以上にしてください' }
      },
      sim: {
        title: '成績シミュレーター',
        subtitle: '課題の点数を入力すると、予測グレードと期末試験で必要な点数が計算されます。',
        empty: 'シミュレーションできる科目がまだありません。',
        addSubject: '科目を追加',
        gpa: '予測学期GPA',
        noScores: '点数がまだありません',
        ofFour: '/ 4.00',
        graded: { one: '{total}科目中{n}科目を採点済み', other: '{total}科目中{n}科目を採点済み' },
        provisional: ' — 暫定値',
        awaiting: '課題の点数を待っています',
        provisionalNote: '採点済みの科目だけで計算しているため、残りの点数が入るとこの値は動きます。',
        threshold: '奨学金維持のしきい値',
        scholarship: 'JPA / ハイアチーバー',
        minRequired: '最低要件',
        maintenance: '学期ごとに継続して維持する必要があります。',
        distance: '目標との差',
        cutoffTitle: '奨学金の最低ライン {n}',
        cutoff: '{n} ライン',
        modulesCounted: '集計対象の科目',
        creditsOf: '{b}単位中{a}単位',
        enterAll: '科目のすべての評価項目に点数を入れると、グレードを予測できます。',
        countsWhenComplete: '科目はすべての評価項目に点数が入ると集計されます。',
        week: '第{n}週',
        scoreAria: '{name} の獲得点',
        maxAria: '{name} の満点',
        maxTitle: 'この評価項目の満点',
        gradedStatus: '採点済み',
        pendingStatus: '未入力',
        notPublished: '評価構成はまだ公表されていません。',
        noFinal: '期末試験の項目がありません。科目エディタでいずれかの項目の種別を「期末試験」にしてください。',
        alreadySecured: 'すでに確保済み',
        notReachable: '到達できません',
        creditHours: '{n}単位',
        currentSecured: '現在の確保点',
        predictedGrade: '予測グレード',
        assessmentsTitle: '平常評価と配点',
        th: {
          component: '評価項目',
          weight: '配点',
          score: '得点 / 満点',
          weighted: '加重',
          status: '状態'
        },
        denominatorNote:
          '右側の入力欄はその項目の満点（分母）で、ボタンではありません。点数は入力と同時に保存されます。',
        structureNotPublished: 'この科目の評価構成はまだ公表されていません。',
        neededFor: '{n}% に必要な期末試験の点数:',
        securedLine: '現在の確保点: {a} / {b}%。上の点数を入れると目標までの残りが再計算されます。',
        securedSummary: '{a} / {b} 確保 • {n}項目',
        inProgress: '入力中',
        noScoresYet: '点数がまだありません',
        cr: '（{n}単位）',
        gradingScale: 'MMU グレーディングスケール',
        gradingHint: '目安の区分です。学部のハンドブックで確認してください',
        targetNote:
          '（目標）は {n}% の目標を含む区分です。A と A+ はどちらも 4.00 なので、区分は割合にだけ' +
          '影響し、GPA は変わりません。',
        scholarshipNote: '奨学金を全額維持するには、2学期連続で最低 GPA {n} が必要です。',
        gp: 'GP',
        target: '（目標）',
        toastCapped: '点数はこの項目の満点に丸めました'
      },
      dl: {
        title: '締切',
        subtitle: '学期を通した評価のスケジュール、提出物、かかっている配点を追跡します。',
        addFirst: '先に科目を追加してください。締切は科目ごとに管理します。',
        addSubject: '科目を追加',
        addDeadline: '締切を追加',
        addDeadlineHint: 'シラバスに載っていないものに使います',
        titleField: 'タイトル',
        titlePlaceholder: '実験レポート提出',
        module: '科目',
        week: '週',
        weight: '配点（%）',
        due: '期限 / メモ',
        duePlaceholder: '12月6日(日) 23:59',
        dateField: '日付・時刻',
        dateHint: '任意 — 入力すると週が自動で決まります',
        kindField: '種別',
        kind: {
          homework: '宿題',
          assignment: '課題',
          testPrep: 'テスト対策',
          other: 'その他'
        },
        submit: '締切を追加',
        allModules: 'すべての科目',
        highStakesHint: '「高負荷」は、ある科目の配点の{n}%以上が同じ週に集中している週を示します。',
        noUpcoming: 'この絞り込みに該当する今後の締切はありません。',
        thisWeek: '今週',
        tomorrow: '明日',
        inDays: 'あと{n}日',
        milestone: '直近のマイルストーン',
        nextDeadline: '次の締切: {code} {name} — 第{n}週（{range}）',
        noAssessments: 'この絞り込みに該当する評価はありません。',
        dueInWeek: '{range} の週が期限',
        custom: '（カスタム）',
        homework: '宿題',
        openDetail: '詳細を開く',
        removeCustom: 'このカスタム締切を削除',
        openSim: '成績シミュレーターを開く',
        overWeighted:
          '{id} は今週だけで合計{total}%になります。1科目として大きすぎます。科目エディタで配点を' +
          '確認してください。',
        examWeek: '第{n}週（試験週）',
        datesNotSet: '日付未設定',
        highStakes: '高負荷 · {id}',
        highStakesTitle: '{id} の配点の{n}%以上が今週に集中しています',
        totalWeight: '配点合計:',
        toast: {
          titleRequired: 'タイトルは必須です',
          week: '週は1以上にしてください',
          dateInvalid: '日付と時刻を正しく入力してください',
          added: '締切を追加しました',
          removed: '締切を削除しました',
          restored: '締切を復元しました'
        },
        confirm: {
          title: 'この締切を削除しますか？',
          body: '「{name}」をタイムラインから削除します。',
          ok: '締切を削除'
        }
      },
      att: {
        title: '出席',
        subtitle: {
          one: '{n}科目の出席を確認し、MMU の受験資格である{t}%のしきい値を維持します。',
          other: '{n}科目の出席を確認し、MMU の受験資格である{t}%のしきい値を維持します。'
        },
        subtitleEmpty: '科目ごとの出席を記録し、MMU の受験資格である{t}%のしきい値を維持します。',
        noSessions: 'まだ授業が実施されていません。出席の記録は第1週から始まります。',
        eligible: '状況: 受験資格あり（全科目）',
        below: {
          one: '状況: {n}科目が{t}%のしきい値を下回っています',
          other: '状況: {n}科目が{t}%のしきい値を下回っています'
        },
        policyTitle: 'MMU 出席ポリシー:',
        policyBody:
          '期末試験を受けるには、科目ごとに合計{t}%以上の出席が必要です。{t}%を下回ると自動的に' +
          '受験不可となります。',
        session: 'コマ',
        noSessionsDefined: 'コマが設定されていません',
        addSessionsHint: '科目エディタで週次のコマを追加すると、授業ごとに記録できます。',
        empty: '追跡する科目がまだありません。',
        addSubject: '科目を追加',
        credits: '{n}単位',
        perWeek: {
          one: '週{n}コマ · 学期合計{total}コマ',
          other: '週{n}コマ · 学期合計{total}コマ'
        },
        standing: '現在の出席率',
        attended: '出席したコマ',
        absences: '記録された欠席',
        belowNote: '{t}%のしきい値を下回っています。次の授業に出席して回復してください。',
        canMiss: {
          one: 'あと<strong>{n}回</strong>欠席すると{t}%を下回ります。',
          other: 'あと<strong>{n}回</strong>欠席すると{t}%を下回ります。'
        },
        date: '日付',
        lastSession: '直近の記録: {value}',
        markPresent: '出席を記録',
        markAbsent: '欠席を記録',
        markNoClass: '休講',
        noClassHint: '休講・休日は出席の総回数から除外されます。',
        overridesTitle: '休講・振替',
        noClassBadge: '休講',
        transferBadge: '振替',
        transferTitle: 'この回を振替にする',
        transferEditTitle: '振替を編集',
        transferSource: '元の回: {date} · {session}',
        transferDate: '振替先の日付',
        transferStart: '開始',
        transferEnd: '終了',
        transferRoom: '教室（任意）',
        transferRoomTbd: '教室未定',
        transferSave: '振替を保存',
        transferEdit: '振替を編集',
        transferRemove: '振替を取消',
        transferTo: '{date} {start}–{end} に振替',
        transferFrom: '{date} から振替',
        present: '出席',
        absent: '欠席',
        deleteRecord: 'この記録を削除',
        logEmpty: '出席の記録はまだありません。',
        logEmptyHint: '上のボタンで記録すると、{term} のログが始まります。',
        logEmptyNoSubject: '科目を追加すると出席の記録を始められます。',
        logTitle: '出席ログ',
        entry: { one: '{n}件', other: '{n}件' },
        toast: {
          present: '出席を記録しました',
          absent: '欠席を記録しました',
          removed: '記録を取り消しました',
          deleted: '記録を削除しました',
          restored: '記録を復元しました',
          noClass: '休講として記録しました',
          noClassRemoved: '休講を取り消しました',
          transferSaved: '振替を保存しました',
          transferRemoved: '振替を取り消しました',
          transferRequired: '振替先の日付・開始・終了は必須です',
          transferRange: '終了時刻は開始時刻より後にしてください',
          noClassOnTransfer: '振替で作られた回です。一覧から振替を取消してください'
        },
        confirm: {
          title: 'この出席記録を削除しますか？',
          body: '{code} · {date}{session}（{status}）を削除し、集計を計算し直します。',
          ok: '記録を削除'
        }
      },
      sl: {
        title: '学習ログ',
        subtitle: '集中して復習した時間と科目ごとの学習時間を、目標に向けて記録します。',
        empty: '科目を追加すると学習時間を記録できます。',
        addSubject: '科目を追加',
        active: '進行中のセッション',
        focusInterval: '集中タイマー',
        selectModule: '記録する科目を選択',
        meta: '{term} • 第{week}週 • 目標 週{target}時間',
        start: '開始',
        stop: '停止',
        thisWeek: '今週',
        targetMeta: '目標: 週{n}時間 • 第{w}週',
        target: '/ {n}時間',
        hrs: '{n}時間',
        manual: '手入力',
        manualEmpty: '科目を追加すると手入力で記録できます。',
        manualHint: 'オフラインの学習やグループでの復習もここから記録できます。',
        subject: '科目',
        duration: '時間（分）',
        durationHint: '分単位の整数で入力してください（例: 30、45、60、90）。',
        date: '日付',
        notes: 'メモ',
        notesPlaceholder: '例: チュートリアル配布資料1の復習',
        addSession: 'セッションを追加',
        historyEmpty: 'セッションがまだありません',
        historyHint: 'タイマーを開始するか、手入力で追加してください。',
        history: 'セッション履歴',
        count: { one: '{n}件', other: '{n}件' },
        deleteSession: 'セッションを削除',
        toast: {
          noSubject: '記録する前に科目を追加してください',
          tooShort: '1分未満のセッションは破棄しました',
          saved: 'セッションを保存しました',
          duration: '時間を分で入力してください',
          added: 'セッションを追加しました',
          deleted: 'セッションを削除しました',
          restored: 'セッションを復元しました'
        },
        confirm: {
          title: 'このセッションを削除しますか？',
          body: '{label} を学習ログから削除します。',
          ok: 'セッションを削除'
        }
      },
      se: {
        addTitle: '科目を追加',
        editTitle: '科目を編集',
        addSubtitle: 'この学期の科目を登録します。コード・科目名・単位数・色・週次のコマ・配点を入力します。',
        editSubtitle: '科目の基本情報、週次のコマ、平常評価の配点を設定します。',
        cancel: 'キャンセル',
        add: '科目を追加',
        save: '変更を保存',
        toastAdded: '{id} を追加しました',
        toastSaved: '科目を保存しました',
        confirm: {
          title: '{id} を削除しますか？',
          body: '{name} とそのコマ・配点・点数・出席記録をこの学期から削除します。元に戻せません。',
          ok: '科目を削除'
        }
      }
    }
  };

  /* ---------- resolution ---------- */

  var current = null;

  function savedLang() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return '';
      var state = JSON.parse(raw);
      return (state && state.settings && state.settings.lang) || '';
    } catch (e) {
      return '';
    }
  }

  function detect() {
    var nav = global.navigator || {};
    var list = nav.languages && nav.languages.length ? nav.languages : [nav.language || ''];
    for (var i = 0; i < list.length; i++) {
      var tag = String(list[i] || '').toLowerCase();
      if (!tag) continue;
      var base = tag.split('-')[0];
      if (DICT[base]) return base;
    }
    return FALLBACK;
  }

  function lang() {
    if (current) return current;
    var saved = savedLang();
    if (saved && DICT[saved]) return saved;
    return detect();
  }

  function walk(dict, key) {
    var parts = String(key).split('.');
    var node = dict;
    for (var i = 0; i < parts.length; i++) {
      if (!node || typeof node !== 'object') return undefined;
      node = node[parts[i]];
    }
    return node;
  }

  function interpolate(text, vars) {
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match;
    });
  }

  /* 辞書に無いキーはキー名をそのまま返す。空欄で隠すより気づける。 */
  function t(key, vars) {
    var code = lang();
    var value = walk(DICT[code], key);
    if (typeof value !== 'string') value = walk(DICT[FALLBACK], key);
    if (typeof value !== 'string') return key;
    return interpolate(value, vars);
  }

  /* 単数・複数の切り替え。base.one / base.other を引く。 */
  function tn(base, n, vars) {
    var merged = vars || {};
    if (merged.n === undefined) merged.n = n;
    return t(base + (Number(n) === 1 ? '.one' : '.other'), merged);
  }

  /* 静的 HTML の data-i18n / data-i18n-<attr> を埋める。 */
  function apply(root) {
    var scope = root || document;
    if (!scope || !scope.querySelectorAll) return;

    var nodes = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }

    var all = scope.querySelectorAll('*');
    for (var j = 0; j < all.length; j++) {
      var attrs = all[j].attributes;
      for (var k = 0; k < attrs.length; k++) {
        var name = attrs[k].name;
        if (name.indexOf('data-i18n-') !== 0) continue;
        all[j].setAttribute(name.slice('data-i18n-'.length), t(attrs[k].value));
      }
    }

    document.documentElement.lang = lang();
  }

  /* 言語を切り替えて保存する。呼び出し側が再描画する。 */
  function setLang(code) {
    if (!DICT[code]) return lang();
    current = code;
    if (global.BB && global.BB.store) {
      global.BB.store.update(function (state) {
        state.settings = state.settings || {};
        state.settings.lang = code;
      });
    }
    document.documentElement.lang = code;
    return code;
  }

  global.BB = global.BB || {};
  global.BB.i18n = {
    t: t,
    tn: tn,
    lang: lang,
    setLang: setLang,
    apply: apply,
    languages: LANGUAGES,
    dict: DICT
  };

  /* 初回描画前に <html lang> を確定させる。 */
  document.documentElement.lang = lang();

  /* 静的 HTML の適用と、他タブ・設定画面からの言語変更の取り込み。 */
  function boot() {
    apply();
    if (!global.BB || !global.BB.store) return;
    var last = lang();
    global.BB.store.subscribe(function () {
      var next = lang();
      if (next === last) return;
      last = next;
      apply();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
