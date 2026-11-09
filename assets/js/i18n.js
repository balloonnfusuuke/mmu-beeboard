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
        subjectEdit: 'MMU BeeBoard — Edit Subject',
        deadlineDetail: 'MMU BeeBoard — Deadline details',
        sessionDetail: 'MMU BeeBoard — Session details',
        notes: 'MMU BeeBoard — Notes',
        guide: 'MMU BeeBoard — How to use',
        faq: 'MMU BeeBoard — FAQ',
        contact: 'MMU BeeBoard — Ask the developer',
        roadmap: 'MMU BeeBoard — Assessment roadmap'
      },
      brand: { tagline: 'Personal study dashboard' },
      nav: { settings: 'Settings', backToDashboard: 'Back to dashboard', guide: 'How to use' },
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
      update: {
        available: 'A new version is available',
        action: 'Update',
        dismiss: 'Dismiss'
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
        roomWord: 'Room',
        roomTbd: 'Room TBD',
        openSimulator: 'Open Course Simulator',
        details: 'Session details',
        attendance: 'Attendance'
      },
      tt: {
        time: 'Time',
        today: '(Today)',
        noClass: 'No class',
        transfer: 'Transfer',
        online: 'Online',
        prevWeek: 'Previous week',
        nextWeek: 'Next week',
        dayDate: '{d}',
        dayDateWithMonth: '{mon} {d}',
        overridesElsewhere: {
          one: '{n} no-class or transfer in another week',
          other: '{n} no-class or transfers in other weeks'
        }
      },
      ws: {
        title: 'Week {n} summary',
        sessions: 'Sessions',
        deadlines: 'Deadlines',
        study: 'Study time',
        attendance: 'Attendance',
        breakdown: '{held} held · {cancelled} cancelled · {transferred} transferred',
        more: '+{n} more',
        none: 'None',
        target: 'of {n} hrs target',
        records: '{present} present · {absent} absent'
      },
      rm: {
        title: 'Assessment roadmap',
        subtitle: 'Every assessment in week order, across all subjects.',
        progress: 'Graded so far',
        progressNote: '{graded} of {total} weight graded',
        weight: 'Weight {n}%',
        notYet: 'Not yet',
        secured: '{score} / {max} · {points} pts',
        empty: 'No assessments yet.',
        emptyHint: 'Add assessments on a subject page to see the roadmap.',
        link: 'Roadmap'
      },
      detail: {
        nextClass: 'Next class: {code} {name}',
        lecturer: 'Lecturer: {name}',
        openSimulator: 'Open Course Simulator',
        thisWeekTopic: "This week's topic",
        attendance: 'Attendance',
        securedMarks: 'Secured marks',
        nextAssessment: 'Next assessment',
        noSessionsYet: 'no sessions yet',
        absences: { one: '{n} absence', other: '{n} absences' },
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
          viewItems: 'View {n} items',
          empty: 'No deadlines yet. Add one on the Deadlines page.',
          emptyHint: 'Assessments from your subjects appear here automatically.'
        },
        attendance: {
          title: 'Attendance',
          overall: 'Overall Status',
          noSessions: 'No sessions yet',
          eligible: 'Eligible (≥{n}% req)',
          below: 'Below {n}%',
          held: { one: '({n} session held)', other: '({n} sessions held)' },
          barred: 'Barred below {n}%',
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
        homeworkBadge: 'Homework',
        listTitle: 'All notes',
        listSubtitle: 'Every memo and homework, newest first.',
        listAria: 'All notes',
        viewAll: 'View all notes',
        filterSubject: 'Subject',
        filterKind: 'Type',
        allSubjects: 'All subjects',
        allKinds: 'All types',
        dateHeading: '{date} ({day})',
        noDate: 'No date',
        done: 'Done',
        empty: 'No notes yet.',
        emptyFiltered: 'No notes match these filters.'
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
          programmeHint: 'Shown in the header next to your year.',
          year: 'Year',
          yearOption: 'Year {n}',
          yearHint: 'Shown in the header next to the programme.',
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
          themeHint: 'Subject colours look the same in light and dark themes.',
          light: 'Light',
          dark: 'Dark',
          system: 'System',
          taxonomy: 'Subject colours',
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
          title: 'Current Term Timetable',
          subtitle: 'Start date and length of the term you are in now.',
          startDate: 'Term Start Date',
          startDateHint: 'Week 1 Monday. Leave empty to keep every week number at Week 1.',
          startDateMissing: 'Not set — week numbers and dates stay at Week 1 until you pick a date.',
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
          scopeHint:
            "These fields describe the new trimester. The current trimester's start date and length are in " +
            'the Timetable section above.',
          label: 'Trimester label',
          labelPlaceholder: 'Trimester Feb/Mar 2027',
          week1: 'New term — Week 1 starts (Monday)',
          weeks: 'New term — number of weeks',
          examWeek: 'New term — exam week',
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
          snapshot: 'Export for local AI',
          snapshotHint:
            'Writes beeboard-snapshot.json to a folder you pick. If the browser cannot write ' +
            'files, the same file is downloaded instead.',
          hint: 'All data is stored locally in this browser. Nothing is sent to MMU.'
        },
        install: {
          title: 'Install app',
          subtitle: 'Open BeeBoard in its own window, without the browser frame.',
          body:
            'Add MMU BeeBoard to your home screen or desktop. It opens in its own window and keeps ' +
            'working offline.',
          button: 'Install app',
          toastInstalled: 'App installed'
        },
        help: {
          title: 'Help and support',
          subtitle: 'Guides, answers, and a way to reach the developer.',
          guide: 'How to use guide',
          faq: 'FAQ',
          contact: 'Ask the developer'
        },
        toast: {
          fillAll: 'Fill in label, start date and weeks',
          switched: 'Switched to {label}',
          themeSet: 'Theme set to {theme}',
          backup: 'Backup downloaded',
          snapshotSaved: 'beeboard-snapshot.json saved',
          snapshotDownloaded: 'beeboard-snapshot.json downloaded',
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
        undetermined: 'Undetermined — some assessments are not entered yet',
        reachableMax: 'Max reachable: {n}%',
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
        dateExample: 'Example: 2026-11-30 23:59',
        memoField: 'Memo (optional)',
        memoPlaceholder: 'What to prepare, where to submit…',
        memoHint: 'Saved with the deadline and shown on its detail page.',
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
        nextDeadlineNoRange: 'Next deadline: {code} {name} — Week {n}',
        noWeight: 'No weight',
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
      pe: {
        add: 'Add event',
        title: 'Personal event',
        subtitle: 'Your own plans, shown next to classes. They never affect attendance, Next Class or deadlines.',
        editTitle: 'Edit event',
        name: 'Title',
        namePlaceholder: 'Study group',
        nameRequired: 'Title is required',
        kind: 'Repeats',
        kindOnce: 'Once',
        kindWeekly: 'Every week',
        date: 'Date',
        weekday: 'Day',
        start: 'Start',
        end: 'End',
        timeInvalid: 'End time must be after the start time',
        dateRequired: 'Pick a date for a one-off event',
        color: 'Colour',
        memo: 'Notes',
        memoPlaceholder: 'Where to meet, what to bring.',
        save: 'Save event',
        saved: 'Event saved',
        deleted: 'Event deleted',
        restored: 'Event restored',
        remove: 'Delete event',
        confirmTitle: 'Delete this event?',
        confirmBody: '"{name}" will be removed from the timetable.',
        confirmOk: 'Delete event',
        legend: 'Personal',
        overlapNote: 'Shown in the right half when it overlaps a class.'
      },
      dd: {
        title: 'Deadline details',
        subtitle: 'Links and notes for this deadline.',
        back: 'Back to deadlines',
        notFound: 'This deadline no longer exists.',
        notFoundHint: 'It may have been deleted, or it belongs to another term.',
        subject: 'Subject',
        week: 'Week',
        due: 'Due',
        weight: 'Weight',
        kind: 'Type',
        links: 'Links',
        linksHint: 'Add as many as you need — brief, submission portal, reference.',
        linkLabel: 'Label',
        linkLabelPlaceholder: 'Submission portal',
        linkUrl: 'URL',
        linkUrlPlaceholder: 'https://',
        addLink: 'Add link',
        removeLink: 'Remove link',
        memo: 'Notes',
        memoPlaceholder: 'What to prepare, questions to ask, anything worth remembering.',
        save: 'Save details',
        saved: 'Details saved',
        editTitle: 'Edit this deadline',
        editHint: 'Only deadlines you added yourself can be edited here.',
        name: 'Title',
        date: 'Date & time',
        saveEdit: 'Save changes',
        editSaved: 'Deadline updated',
        nameRequired: 'Title is required',
        dateInvalid: 'Enter a valid date and time',
        hasDetail: 'Has links or notes',
        chipLinksTitle: '{n} link(s) attached',
        chipMemo: 'Note',
        chipMemoTitle: 'Has a note',
        noLinks: 'No links yet.',
        noMemo: 'No notes yet.',
        openLink: 'Open link'
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
      sd: {
        title: 'Session details',
        subtitle: 'Everything recorded for this one class.',
        back: 'Back to dashboard',
        notFound: 'This session could not be found.',
        notFoundHint: 'The link may be incomplete, or the date is outside this trimester.',
        type: { LEC: 'Lecture', TUT: 'Tutorial', LAB: 'Lab' },
        time: 'Time',
        roomTbd: 'Room TBD',
        status: 'This session',
        noException: 'No exception for this session.',
        exception: 'Exception',
        removeException: 'Remove exception',
        removeRecord: 'Remove record',
        onlineTitle: 'Hold this session online',
        onlineUrl: 'Meeting URL',
        onlineUrlPlaceholder: 'https://',
        onlineSave: 'Save meeting link',
        toast: {
          onlineSaved: 'Meeting link saved',
          onlineRemoved: 'Online exception removed',
          urlRequired: 'Enter a meeting URL'
        },
        online: 'Online',
        onlineHint: 'This session is held online.',
        openMeeting: 'Open meeting',
        notRecorded: 'Not recorded',
        notes: 'Notes & homework',
        notesHint: 'Add or edit notes on the Notes page.',
        notesEmpty: 'Nothing saved for this session yet.',
        openNotes: 'Open Notes',
        overview: 'Subject overview',
        secured: 'Secured marks',
        attendanceRate: 'Attendance',
        attendanceHeld: '{attended} of {held} attended',
        noAttendance: 'No sessions recorded yet.',
        nextDeadline: 'Next deadline',
        noDeadline: 'No deadline left for this subject.',
        assessments: 'Assessment',
        openDeadlines: 'Open deadlines',
        prev: 'Previous session',
        next: 'Next session'
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
      },
      guide: {
        title: 'How to use BeeBoard',
        subtitle: 'A guided tour of the whole app, one step at a time.',
        hero: {
          eyebrow: 'Getting started',
          heading: 'Your whole trimester on one screen',
          body:
            'BeeBoard brings your timetable, grades, deadlines, attendance and study log together, so you can ' +
            'see how the term is going without opening five different things.',
          p1Title: 'No sign-up',
          p1Body: 'There is no account and no login. Open the page and start working.',
          p2Title: 'Data stays in this browser',
          p2Body: 'Subjects, marks and notes are stored locally. Nothing is uploaded to a server.',
          p3Title: 'Works offline',
          p3Body: 'After the first visit the app opens without a connection.',
          startTour: 'Start the tour',
          openDashboard: 'Open the dashboard',
          readFaq: 'Read the FAQ'
        },
        tour: {
          label: 'Guided tour',
          stepOf: 'Step {n} of {total}',
          progressAria: 'Tour progress',
          prev: 'Back',
          next: 'Next',
          finish: 'Finish',
          restart: 'Start over',
          done: 'That is the whole tour. Open the dashboard and try it with your own subjects.',
          openPage: 'Open this page',
          todoTitle: 'What to do',
          mockLabel: 'Screen preview'
        },
        steps: {
          s1: {
            title: 'Set up your trimester',
            body:
              'Start with the term label and the first Monday. Every week number, deadline and attendance ' +
              'figure is counted from that date.',
            todo1: 'Open Settings and set the trimester label and start date.',
            todo2: 'Set the number of teaching weeks, 14 by default.',
            todo3: 'Add your subjects, or skip and add them later.',
            cta: 'Open settings'
          },
          s2: {
            title: 'Add subjects and assessment weightings',
            body:
              'Each subject holds its weekly sessions and its assessment components. The weighting total ' +
              'should reach 100%.',
            todo1: 'Open a subject and fill in the code, name and credit hours.',
            todo2: 'Add each assessment with its weight and full marks.',
            todo3: 'Set the type of the final assessment to Final exam so the simulator can compute the mark you need.',
            cta: 'Open subject editor'
          },
          s3: {
            title: 'Read the dashboard and the next class',
            body: 'The dashboard answers two questions: what is happening today, and what is coming next.',
            todo1: 'Check the next class card for room, time and how long until it starts.',
            todo2: 'Use the today card for memos and unfinished homework.',
            todo3: 'Follow the deadline countdown to see what is closest.',
            cta: 'Open the dashboard'
          },
          s4: {
            title: 'See the mark you need in the final',
            body:
              'Enter the marks you already have. The simulator shows the final exam mark that still gets you ' +
              'to your target grade.',
            todo1: 'Pick a subject and a target grade.',
            todo2: 'Type the marks you have received so far.',
            todo3: 'Read the needed final mark, or the undetermined note while components are still unentered.',
            cta: 'Open the simulator'
          },
          s5: {
            title: 'Track deadlines and attendance',
            body: 'Deadlines are grouped by week. Attendance counts only the classes that actually happened.',
            todo1: 'Open Deadlines and work through the list week by week.',
            todo2: 'Mark a class cancelled when it does not run; it leaves the attendance denominator.',
            todo3: 'Record a replacement class as a transfer so it counts in the right week.',
            cta: 'Open attendance'
          },
          s6: {
            title: 'Log study time, back up, and move to the next term',
            body:
              'The study log keeps a record of what you actually did. Export a backup before you change ' +
              'anything big.',
            todo1: 'Start the timer, or add a session by hand.',
            todo2: 'Export your data from Settings and keep the file somewhere safe.',
            todo3: 'When the term ends, archive it and start the next one from Settings.',
            cta: 'Open the study log'
          }
        },
        features: {
          title: 'Every feature, one by one',
          subtitle: 'What each screen does, how to use it, and what to watch out for.',
          stepsLabel: 'How to use',
          tipsLabel: 'Tips and cautions',
          f1: {
            title: 'Dashboard',
            body: 'One screen with the next class, today, deadlines and study progress.',
            step1: 'Open the home page; it is the dashboard.',
            step2: 'Read the next class card for room and start time.',
            step3: 'Use the quick actions to jump to the simulator or add a memo.',
            tip: 'The card shows today and unfinished homework only. Past memos live in Notes.'
          },
          f2: {
            title: 'Weekly timetable',
            body: 'Monday to Friday in one grid, with rooms, cancellations and personal events.',
            step1: 'Open the dashboard and scroll to the timetable.',
            step2: 'Read a room code such as CQAR3002: campus, building, wing, floor and room.',
            step3: 'Add a personal event for anything that is not a class.',
            tip:
              'Building letters: Q is FCI, R is FOM, L is FAIE, J is FCM, N is CNMX. CNMX is the large ' +
              'lecture hall and has no wing.'
          },
          f3: {
            title: 'Grade simulator',
            body: 'Turns the marks you have into the mark you still need.',
            step1: 'Choose the subject and the target grade.',
            step2: 'Enter the marks you already received.',
            step3: 'Read the needed final mark, or the undetermined note.',
            tip: 'A mark above the full score is clamped to the maximum, and a toast tells you when that happens.'
          },
          f4: {
            title: 'Deadlines and deadline details',
            body: 'Every assessment in week order, with the detail you need on the day.',
            step1: 'Open Deadlines to see the list grouped by week.',
            step2: 'Open a deadline to add a link or a memo.',
            step3: 'Add your own deadline when something is not part of a subject.',
            tip: 'A week that adds up to more than 100% is flagged, because weightings are counted per subject.'
          },
          f5: {
            title: 'Attendance',
            body: 'Percentage per subject against the threshold you set.',
            step1: 'Open Attendance and pick a subject.',
            step2: 'Mark each class attended or absent.',
            step3: 'Change the threshold in Settings if your faculty uses a different one.',
            tip: 'Cancelled classes leave the denominator. A transfer class counts in the week it is held.'
          },
          f6: {
            title: 'Notes and homework',
            body: 'Short memos and homework items, attached to a subject and a date.',
            step1: 'Add a memo from the dashboard or from Notes.',
            step2: 'Mark homework as done when you finish it.',
            step3: 'Open Notes to see every memo, newest first.',
            tip: 'Finished homework leaves the dashboard and Deadlines but stays in Notes.'
          },
          f7: {
            title: 'Study log',
            body: 'A record of the time you actually spent studying.',
            step1: 'Start the timer when you begin and stop it when you finish.',
            step2: 'Or add a session by hand with a date and a duration.',
            step3: 'Compare the week against your weekly target.',
            tip: 'The date defaults to today in your own time zone.'
          },
          f8: {
            title: 'Settings',
            body: 'Theme, language, goals, term and data, all in one place.',
            step1: 'Switch between light, dark and system theme.',
            step2: 'Set the CGPA target, attendance threshold and weekly study target.',
            step3: 'Export or import your data, or reset it.',
            tip: 'Import replaces the data in this browser. Export first if you are unsure.'
          },
          f9: {
            title: 'Install, offline and updates',
            body: 'BeeBoard can be installed like an app and opened without a connection.',
            step1: 'Open Settings and press Install app when the button appears.',
            step2: 'On a phone, use Add to home screen from the browser menu.',
            step3: 'After an update, reload twice so the new version is picked up.',
            tip: 'The first reload downloads the new version; the second one shows it.'
          }
        },
        mock: {
          term: 'Trimester',
          start: 'First Monday',
          save: 'Save',
          subject: 'Subject',
          weight: 'Weight',
          total: 'Total',
          nextClass: 'Next class',
          quiz: 'Quiz',
          test: 'Test',
          final: 'Final exam',
          needed: 'Needed in the final',
          attendance: 'Attendance',
          deadline: 'Deadline',
          timer: 'Timer',
          export: 'Export'
        },
        help: {
          title: 'Stuck?',
          body: 'The FAQ answers the common questions. If yours is not there, open an issue on GitHub.',
          faq: 'Read the FAQ',
          contact: 'Ask the developer'
        }
      },
      faq: {
        title: 'Frequently asked questions',
        subtitle: 'Short answers to the questions that come up most often.',
        searchPlaceholder: 'Search questions',
        searchAria: 'Search questions',
        all: 'All',
        count: {
          one: '1 question',
          other: '{n} questions'
        },
        empty: 'No question matches that search.',
        clear: 'Clear the filters',
        categories: {
          start: 'Getting started',
          data: 'Data and privacy',
          grades: 'Grades',
          attendance: 'Attendance',
          install: 'Install and updates',
          trouble: 'When something is wrong'
        },
        items: {
          q1: {
            q: 'Is BeeBoard an official MMU system?',
            a:
              'No. It is a personal study aid and is not connected to MMU or to any official portal. Treat the ' +
              'figures here as your own notes, and check official sources for anything that counts.'
          },
          q2: {
            q: 'Do I need an account?',
            a:
              'No. There is no sign-up and no login. The app opens straight into your dashboard and keeps ' +
              'everything in this browser.'
          },
          q3: {
            q: 'Where is my data stored?',
            a:
              'In this browser, on this device, using local storage. Nothing is uploaded to a server, and there ' +
              'is no account that could hold a copy.',
            link: 'Open the data settings'
          },
          q4: {
            q: 'Can I use the same data on my phone and on my PC?',
            a:
              'Not automatically. Each browser keeps its own copy. To move data, export a file on one device and ' +
              'import it on the other.'
          },
          q5: {
            q: 'How do I back up, or move to a new device?',
            a:
              'Open Settings, export your data, and keep the JSON file somewhere safe. On the new device, open ' +
              'Settings and import that file.',
            link: 'Open settings'
          },
          q6: {
            q: 'Can I get my data back if I clear the browser data?',
            a:
              'No. Clearing site data removes everything, and there is no server copy to restore from. Export a ' +
              'backup before you clear anything.'
          },
          q7: {
            q: 'Does it work offline?',
            a:
              'Yes, after the first visit. The pages are cached, so the app opens without a connection. Changes ' +
              'are saved locally as usual.'
          },
          q8: {
            q: 'How do I install it?',
            a:
              'Open Settings and press Install app when the button appears. On a phone, use Add to home screen ' +
              'from the browser menu.',
            link: 'Open settings'
          },
          q9: {
            q: 'The update does not show up. What now?',
            a:
              'Reload twice. The first reload downloads the new version in the background, and the second one ' +
              'shows it. If it still looks old, close the installed app and open it again.'
          },
          q10: {
            q: 'Why does the simulator say undetermined?',
            a:
              'Some assessment components have no mark yet. While they are empty the final mark you need cannot ' +
              'be stated exactly, so the app shows the highest score still reachable instead.',
            link: 'Open the simulator'
          },
          q11: {
            q: 'What does unreachable mean?',
            a:
              'It means the target cannot be reached even if every remaining component scores full marks. Lower ' +
              'the target grade, or check that the weightings and marks are entered correctly.',
            link: 'Open the simulator'
          },
          q12: {
            q: 'I typed a mark above the full score.',
            a:
              'It is clamped to the maximum, and a toast tells you when that happens. The stored value never ' +
              'exceeds the full marks, so the weighted total stays correct.'
          },
          q13: {
            q: 'The needed final mark is not shown.',
            a:
              'The simulator needs one component with the type Final exam. Open the subject editor and set the ' +
              'type of the final assessment.',
            link: 'Open the subject editor'
          },
          q14: {
            q: 'Do the weightings have to add up to 100%?',
            a:
              'They should. The editor warns when the total is not 100%, and the simulator assumes the weights ' +
              'are the real ones. A total above 100% makes the needed mark look easier than it is.'
          },
          q15: {
            q: 'How is attendance calculated, and can I change the threshold?',
            a:
              'Attendance is the share of classes you attended, counted per subject. The threshold defaults to ' +
              '80% and can be changed in Settings.',
            link: 'Open settings'
          },
          q16: {
            q: 'How do cancelled and replacement classes affect attendance?',
            a:
              'A cancelled class leaves the denominator, so it cannot hurt your percentage. A replacement class ' +
              'counts in the week it is actually held.'
          },
          q17: {
            q: 'What do the room codes mean?',
            a:
              'A code such as CQAR3002 reads as campus, building, wing, floor and room. Building letters are Q ' +
              'for FCI, R for FOM, L for FAIE, J for FCM and N for CNMX, the large lecture hall.'
          },
          q18: {
            q: 'How do I change the language?',
            a:
              'Open Settings and pick English or Japanese. The choice is saved in this browser and applies to ' +
              'every page.',
            link: 'Open settings'
          },
          q19: {
            q: 'How do I start the next trimester, or restore a past one?',
            a:
              'Open Settings and archive the current term, then start a new one with its own label and first ' +
              'Monday. Archived terms can be restored from the same section.',
            link: 'Open settings'
          },
          q20: {
            q: 'Where do I report a bug or ask a question?',
            a:
              'Use the contact page. It builds a GitHub issue for you, with a template you can review before ' +
              'anything is posted.',
            link: 'Open the contact page'
          },
          q21: {
            q: 'The page looks broken or nothing responds.',
            a:
              'Reload once, then reload again to pick up the latest version. If it persists, open the browser ' +
              'console and note any error message before reporting it.'
          }
        }
      },
      contact: {
        title: 'Ask the developer',
        subtitle: 'This app has no server, so nothing is sent from here. Build the text, then post it on GitHub.',
        form: {
          type: 'Type',
          typeQuestion: 'Question',
          typeBug: 'Bug report',
          typeFeature: 'Feature request',
          typeOther: 'Something else',
          title: 'Title',
          titlePlaceholder: 'One line that sums it up',
          details: 'Details',
          detailsPlaceholder: 'What happened, and what you expected instead',
          page: 'Page',
          pageOther: 'Not sure',
          repro: 'Steps to reproduce',
          reproPlaceholder: '1. Open the simulator\n2. Enter 80 for Quiz\n3. ...',
          reproHint: 'Optional. Numbered steps are the easiest to follow.',
          optional: 'Optional'
        },
        pages: {
          dashboard: 'Dashboard',
          simulator: 'Grade simulator',
          deadlines: 'Deadlines',
          deadlineDetail: 'Deadline details',
          attendance: 'Attendance',
          studylog: 'Study log',
          notes: 'Notes',
          settings: 'Settings',
          subjectEdit: 'Subject editor',
          setup: 'First-time setup',
          guide: 'How to use guide',
          faq: 'FAQ',
          contact: 'Ask the developer',
          other: 'Not sure'
        },
        privacy: {
          title: 'Before you post',
          body:
            'GitHub Issues are public. Anyone can read them, and search engines can index them. Do not include your ' +
            'student ID, your name, your marks, or a screenshot that shows personal information.',
          check: 'I have not included any personal information',
          hint: 'The button stays disabled until this is checked.'
        },
        actions: {
          open: 'Open the issue on GitHub',
          copy: 'Copy the text',
          copyDiagnostics: 'Copy diagnostics',
          copied: 'Copied to the clipboard',
          copyFailed: 'Could not copy. Select the text and copy it by hand.',
          needCheck: 'Confirm that the text has no personal information first.'
        },
        template: {
          type: 'Type',
          page: 'Page',
          details: 'Details',
          repro: 'Steps to reproduce'
        },
        links: {
          title: 'Other places to look',
          repo: 'GitHub repository',
          repoBody: 'Source code, releases and the issue tracker.',
          faq: 'FAQ',
          faqBody: 'Short answers to the questions that come up most often.',
          guide: 'How to use guide',
          guideBody: 'A step-by-step tour of every screen.'
        },
        diagnostics: {
          title: 'Diagnostics',
          body:
            'Copies the page name, language, browser user agent, window size and the service worker cache name. ' +
            'It never reads your subjects, marks, notes or any other saved data.',
          copied: 'Diagnostics copied',
          page: 'Page',
          lang: 'Language',
          width: 'Window',
          ua: 'User agent',
          cache: 'Service worker cache'
        }
      },
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
        subjectEdit: 'MMU BeeBoard — 科目の編集',
        deadlineDetail: 'MMU BeeBoard — 締切の詳細',
        sessionDetail: 'MMU BeeBoard — セッション詳細',
        notes: 'MMU BeeBoard — メモ',
        guide: 'MMU BeeBoard — 使い方ガイド',
        faq: 'MMU BeeBoard — よくある質問',
        contact: 'MMU BeeBoard — 開発者への質問',
        roadmap: 'MMU BeeBoard — 評価ロードマップ'
      },
      brand: { tagline: '個人用学習ダッシュボード' },
      nav: { settings: '設定', backToDashboard: 'ダッシュボードに戻る', guide: '使い方' },
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
      update: {
        available: '新しいバージョンがあります',
        action: '更新',
        dismiss: '閉じる'
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
        roomWord: '教室',
        roomTbd: '教室未定',
        openSimulator: '成績シミュレーターを開く',
        details: 'セッション詳細',
        attendance: '出席'
      },
      tt: {
        time: '時刻',
        today: '(今日)',
        noClass: '休講',
        transfer: '振替',
        online: 'オンライン',
        prevWeek: '前の週',
        nextWeek: '次の週',
        dayDate: '{d}日',
        dayDateWithMonth: '{m}/{d}',
        overridesElsewhere: {
          one: 'ほかの週に休講・振替が {n} 件',
          other: 'ほかの週に休講・振替が {n} 件'
        }
      },
      ws: {
        title: '第{n}週のサマリー',
        sessions: 'コマ数',
        deadlines: '締切',
        study: '学習時間',
        attendance: '出席記録',
        breakdown: '実施 {held} · 休講 {cancelled} · 振替 {transferred}',
        more: 'ほか {n} 件',
        none: 'なし',
        target: '目標 {n} 時間',
        records: '出席 {present} · 欠席 {absent}'
      },
      rm: {
        title: '評価ロードマップ',
        subtitle: '全科目の評価項目を週順に並べています。',
        progress: '採点済みの割合',
        progressNote: '配点 {total} のうち {graded} を採点済み',
        weight: '配点 {n}%',
        notYet: '未実施',
        secured: '{score} / {max} · 確保 {points}',
        empty: '評価項目はまだありません。',
        emptyHint: '科目ページで評価項目を追加すると、ここに並びます。',
        link: 'ロードマップ'
      },
      detail: {
        nextClass: '次の授業: {code} {name}',
        lecturer: '担当: {name}',
        openSimulator: '成績シミュレーターを開く',
        thisWeekTopic: '今週のトピック',
        attendance: '出席',
        securedMarks: '確保済みの点数',
        nextAssessment: '次の評価',
        noSessionsYet: 'まだ授業なし',
        absences: { one: '欠席{n}回', other: '欠席{n}回' },
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
          viewItems: '{n}件を表示',
          empty: '締切はまだありません。締切ページから追加できます。',
          emptyHint: '科目の評価課題は自動でここに並びます。'
        },
        attendance: {
          title: '出席',
          overall: '全体の状況',
          noSessions: 'まだ授業なし',
          eligible: '受験資格あり（{n}%以上）',
          below: '{n}%未満',
          held: { one: '（実施{n}回）', other: '（実施{n}回）' },
          barred: '受験不可の基準: {n}%未満',
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
        homeworkBadge: '宿題',
        listTitle: 'すべてのメモ',
        listSubtitle: '過去のメモも宿題も、新しい順にすべて表示します。',
        listAria: 'すべてのメモ',
        viewAll: 'すべてのメモを見る',
        filterSubject: '科目',
        filterKind: '種別',
        allSubjects: 'すべての科目',
        allKinds: 'すべての種別',
        dateHeading: '{date}（{day}）',
        noDate: '日付なし',
        done: '完了',
        empty: 'メモはまだありません。',
        emptyFiltered: '条件に合うメモはありません。'
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
          programmeHint: 'ヘッダーで学年の横に表示されます。',
          year: '学年',
          yearOption: '{n}年次',
          yearHint: 'ヘッダーでプログラム名の横に表示されます。',
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
          themeHint: '科目の色は、ライトでもダークでも同じに見えます。',
          light: 'ライト',
          dark: 'ダーク',
          system: 'システム',
          taxonomy: '科目カラー',
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
          title: '現在の学期の時間割',
          subtitle: 'いま履修している学期の開始日と週数です。',
          startDate: '学期開始日',
          startDateHint: '第1週の月曜日です。空のままにすると週番号は第1週のままになります。',
          startDateMissing: '未設定です。日付を選ぶまで週番号と日付は第1週のままになります。',
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
          scopeHint: 'ここは新しい学期の設定です。いまの学期の開始日と週数は上の「時間割」にあります。',
          label: '学期名',
          labelPlaceholder: '2027年2/3月学期',
          week1: '新学期の第1週開始日（月曜）',
          weeks: '新学期の週数',
          examWeek: '新学期の試験週',
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
          snapshot: 'ローカルAI用に書き出す',
          snapshotHint:
            '選んだフォルダに beeboard-snapshot.json を書き出します。書き込めないブラウザでは同じ名前でダウンロードします。',
          hint: 'データはすべてこのブラウザ内に保存されます。MMU に送信されることはありません。'
        },
        install: {
          title: 'アプリをインストール',
          subtitle: 'ブラウザの枠なしで、単独のウィンドウで開きます。',
          body:
            'ホーム画面やデスクトップに追加すると、単独のウィンドウで開き、オフラインでも使えます。',
          button: 'アプリをインストール',
          toastInstalled: 'アプリをインストールしました'
        },
        help: {
          title: 'ヘルプとサポート',
          subtitle: '使い方・よくある質問・開発者への連絡。',
          guide: '使い方ガイド',
          faq: 'FAQ',
          contact: '開発者への質問'
        },
        toast: {
          fillAll: '学期名・開始日・週数を入力してください',
          switched: '{label} に切り替えました',
          themeSet: 'テーマを {theme} にしました',
          backup: 'バックアップを書き出しました',
          snapshotSaved: 'beeboard-snapshot.json を保存しました',
          snapshotDownloaded: 'beeboard-snapshot.json をダウンロードしました',
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
        undetermined: '未入力の評価があるため未確定',
        reachableMax: '到達可能最大: {n}%',
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
        dateExample: '例: 2026-11-30 23:59',
        memoField: 'メモ（任意）',
        memoPlaceholder: '何を準備するか、どこに提出するか…',
        memoHint: '締切と一緒に保存され、詳細ページに表示されます。',
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
        nextDeadlineNoRange: '次の締切: {code} {name} — 第{n}週',
        noWeight: '配点なし',
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
      pe: {
        add: '予定を追加',
        title: '個人予定',
        subtitle: '授業と並べて自分の予定を表示します。出席・次の授業・締切には影響しません。',
        editTitle: '予定を編集',
        name: 'タイトル',
        namePlaceholder: '勉強会',
        nameRequired: 'タイトルは必須です',
        kind: '繰り返し',
        kindOnce: '単発',
        kindWeekly: '毎週',
        date: '日付',
        weekday: '曜日',
        start: '開始',
        end: '終了',
        timeInvalid: '終了時刻は開始時刻より後にしてください',
        dateRequired: '単発の予定には日付を入れてください',
        color: '色',
        memo: 'メモ',
        memoPlaceholder: '集合場所、持ち物など。',
        save: '予定を保存',
        saved: '予定を保存しました',
        deleted: '予定を削除しました',
        restored: '予定を復元しました',
        remove: '予定を削除',
        confirmTitle: 'この予定を削除しますか？',
        confirmBody: '「{name}」を時間割から削除します。',
        confirmOk: '予定を削除',
        legend: '個人予定',
        overlapNote: '授業と重なる時間帯では右半分に表示します。'
      },
      dd: {
        title: '締切の詳細',
        subtitle: 'この締切にリンクとメモを付けます。',
        back: '締切一覧に戻る',
        notFound: 'この締切はもう存在しません。',
        notFoundHint: '削除されたか、別の学期の締切です。',
        subject: '科目',
        week: '週',
        due: '期限',
        weight: '配点',
        kind: '種別',
        links: 'リンク',
        linksHint: '必要なだけ追加できます（課題概要・提出ポータル・参考資料など）。',
        linkLabel: 'ラベル',
        linkLabelPlaceholder: '提出ポータル',
        linkUrl: 'URL',
        linkUrlPlaceholder: 'https://',
        addLink: 'リンクを追加',
        removeLink: 'リンクを削除',
        memo: 'メモ',
        memoPlaceholder: '準備するもの、質問したいこと、覚えておきたいこと。',
        save: '詳細を保存',
        saved: '詳細を保存しました',
        editTitle: 'この締切を編集',
        editHint: 'ここで編集できるのは自分で追加した締切だけです。',
        name: 'タイトル',
        date: '日付・時刻',
        saveEdit: '変更を保存',
        editSaved: '締切を更新しました',
        nameRequired: 'タイトルは必須です',
        dateInvalid: '日付と時刻を正しく入力してください',
        hasDetail: 'リンクまたはメモあり',
        chipLinksTitle: 'リンク{n}件',
        chipMemo: 'メモ',
        chipMemoTitle: 'メモあり',
        noLinks: 'リンクはまだありません。',
        noMemo: 'メモはまだありません。',
        openLink: 'リンクを開く'
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
      sd: {
        title: 'セッション詳細',
        subtitle: 'この回の記録をまとめて表示します。',
        back: 'ダッシュボードへ戻る',
        notFound: 'この回は見つかりませんでした。',
        notFoundHint: 'リンクが不完全か、日付がこの学期の範囲外です。',
        type: { LEC: '講義', TUT: '演習', LAB: 'ラボ' },
        time: '時間',
        roomTbd: '教室未定',
        status: 'この回の状態',
        noException: 'この回の例外はありません。',
        exception: '例外',
        removeException: '例外を削除',
        removeRecord: '記録を取り消す',
        onlineTitle: 'この回をオンラインで実施',
        onlineUrl: '会議 URL',
        onlineUrlPlaceholder: 'https://',
        onlineSave: '会議 URL を保存',
        toast: {
          onlineSaved: '会議 URL を保存しました',
          onlineRemoved: 'オンラインの例外を削除しました',
          urlRequired: '会議 URL を入力してください'
        },
        online: 'オンライン',
        onlineHint: 'この回はオンラインで実施されます。',
        openMeeting: '会議を開く',
        notRecorded: '未記録',
        notes: 'メモ・宿題',
        notesHint: '追加・編集はメモページで行えます。',
        notesEmpty: 'この回のメモはまだありません。',
        openNotes: 'メモを開く',
        overview: '科目の概要',
        secured: '確保点',
        attendanceRate: '出席率',
        attendanceHeld: '{held}回中{attended}回出席',
        noAttendance: '出席の記録はまだありません。',
        nextDeadline: '次の締切',
        noDeadline: 'この科目の残りの締切はありません。',
        assessments: '評価項目',
        openDeadlines: '締切を開く',
        prev: '前の回',
        next: '次の回'
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
      },
      guide: {
        title: '使い方ガイド',
        subtitle: 'アプリ全体をステップごとに案内します。',
        hero: {
          eyebrow: 'はじめに',
          heading: '学期のすべてを、1画面に',
          body:
            'BeeBoard は時間割・成績・締切・出席・学習ログを1か所にまとめます。5つの画面を開き回らなくても、' +
            '学期の進み具合が分かります。',
          p1Title: '登録不要',
          p1Body: 'アカウントもログインもありません。ページを開けばすぐ使えます。',
          p2Title: 'データはこのブラウザの中だけ',
          p2Body: '科目・点数・メモはこのブラウザに保存されます。サーバーへは送信しません。',
          p3Title: 'オフラインでも動く',
          p3Body: '一度開けば、通信がなくても起動できます。',
          startTour: 'ツアーを始める',
          openDashboard: 'ダッシュボードを開く',
          readFaq: 'FAQを見る'
        },
        tour: {
          label: 'ツアー',
          stepOf: 'ステップ {n} / {total}',
          progressAria: 'ツアーの進み具合',
          prev: '前へ',
          next: '次へ',
          finish: '完了',
          restart: '最初から',
          done: 'ツアーはここまでです。ダッシュボードを開いて、自分の科目で試してみてください。',
          openPage: 'このページを開く',
          todoTitle: 'やること',
          mockLabel: '画面イメージ'
        },
        steps: {
          s1: {
            title: '学期を設定する',
            body:
              '学期名と最初の月曜日から始めます。週番号・締切・出席の集計は、すべてこの日付を基準に数えます。',
            todo1: '設定を開き、学期名と開始日を入れます。',
            todo2: '授業週数を設定します（既定は14週）。',
            todo3: '科目を登録します。あとから追加しても構いません。',
            cta: '設定を開く'
          },
          s2: {
            title: '科目と評価項目を登録する',
            body: '科目ごとに毎週のコマと評価項目を持ちます。配点の合計は100%にそろえます。',
            todo1: '科目を開き、科目コード・科目名・単位数を入れます。',
            todo2: '評価項目ごとに配点と満点を追加します。',
            todo3: '期末の評価項目は種別を「期末試験」にします。シミュレーターが必要点数を計算できるようになります。',
            cta: '科目エディタを開く'
          },
          s3: {
            title: 'ダッシュボードと次の授業を読む',
            body: 'ダッシュボードが答えるのは2つだけです。今日なにがあるか、次に何が来るか。',
            todo1: '「次の授業」カードで教室・時刻・開始までの残り時間を確認します。',
            todo2: '「今日」カードでメモと未完了の宿題を確認します。',
            todo3: '締切のカウントダウンで、いちばん近いものを確認します。',
            cta: 'ダッシュボードを開く'
          },
          s4: {
            title: '期末で必要な点を見る',
            body: 'すでに取った点数を入れます。目標グレードに届く期末の点数が表示されます。',
            todo1: '科目と目標グレードを選びます。',
            todo2: 'これまでに受け取った点数を入力します。',
            todo3: '必要Final点、または未入力がある間は「未確定」の表示を読みます。',
            cta: 'シミュレーターを開く'
          },
          s5: {
            title: '締切と出席を追う',
            body: '締切は週ごとにまとまります。出席は実際に行われた授業だけを数えます。',
            todo1: '締切を開き、週ごとにリストを確認します。',
            todo2: '実施されなかった授業は休講にすると、出席の分母から外れます。',
            todo3: '振替の授業は振替として記録すると、実施した週で数えます。',
            cta: '出席を開く'
          },
          s6: {
            title: '学習ログ、バックアップ、次の学期へ',
            body: '学習ログは実際にやったことの記録です。大きく変える前にエクスポートで控えを取ります。',
            todo1: 'タイマーを開始するか、手入力でセッションを追加します。',
            todo2: '設定からデータをエクスポートし、安全な場所に保管します。',
            todo3: '学期が終わったらアーカイブし、設定から次の学期を始めます。',
            cta: '学習ログを開く'
          }
        },
        features: {
          title: '機能をひとつずつ',
          subtitle: '各画面が何をするか、使い方、気をつける点。',
          stepsLabel: '使い方',
          tipsLabel: 'コツ／注意',
          f1: {
            title: 'ダッシュボード',
            body: '次の授業・今日・締切・学習の進み具合を1画面にまとめます。',
            step1: 'ホームページを開きます。それがダッシュボードです。',
            step2: '「次の授業」カードで教室と開始時刻を確認します。',
            step3: 'クイック操作からシミュレーターへ移動したり、メモを追加できます。',
            tip: 'カードに出るのは今日分と未完了の宿題だけです。過去のメモは Notes にあります。'
          },
          f2: {
            title: '週間時間割',
            body: '月曜から金曜までを1つのグリッドに。教室・休講・個人予定もここに入ります。',
            step1: 'ダッシュボードを開き、時間割までスクロールします。',
            step2: 'CQAR3002 のような教室コードを読みます。キャンパス・建物・ウイング・階・部屋です。',
            step3: '授業以外の予定は個人予定として追加します。',
            tip:
              '建物の記号は Q が FCI、R が FOM、L が FAIE、J が FCM、N が CNMX です。CNMX は大講義棟で、' +
              'ウイングを持ちません。'
          },
          f3: {
            title: '成績シミュレーター',
            body: '取った点数から、まだ必要な点数を計算します。',
            step1: '科目と目標グレードを選びます。',
            step2: 'すでに受け取った点数を入力します。',
            step3: '必要Final点、または未確定の表示を読みます。',
            tip: '満点を超える入力は満点に丸められ、そのときにトーストで知らせます。'
          },
          f4: {
            title: '締切と締切詳細',
            body: 'すべての評価を週の順に。当日に必要な情報もここにまとまります。',
            step1: '締切を開くと、週ごとにまとまったリストが出ます。',
            step2: '締切を開くと、リンクやメモを追加できます。',
            step3: '科目に属さない締切は自分で追加できます。',
            tip: '配点は科目ごとに数えるため、同じ週で合計が100%を超えると警告が出ます。'
          },
          f5: {
            title: '出席',
            body: '科目ごとの出席率を、設定したしきい値と比べます。',
            step1: '出席を開き、科目を選びます。',
            step2: '各コマを出席・欠席で記録します。',
            step3: '学部ごとの基準が違う場合は、設定でしきい値を変えます。',
            tip: '休講は分母から外れます。振替は実施した週で数えます。'
          },
          f6: {
            title: 'メモと宿題',
            body: '科目と日付に紐づく、短いメモと宿題。',
            step1: 'ダッシュボードまたは Notes からメモを追加します。',
            step2: '終わった宿題は完了にします。',
            step3: 'Notes を開くと、すべてのメモが新しい順に並びます。',
            tip: '完了した宿題はダッシュボードと締切から消えますが、Notes には残ります。'
          },
          f7: {
            title: '学習ログ',
            body: '実際に勉強した時間の記録。',
            step1: '始めるときにタイマーを開始し、終わったら停止します。',
            step2: '日付と時間を入れて手入力で追加することもできます。',
            step3: '週の合計を週間目標と比べます。',
            tip: '日付の初期値は、自分のタイムゾーンでの今日です。'
          },
          f8: {
            title: '設定',
            body: 'テーマ・言語・目標・学期・データを1か所に。',
            step1: 'ライト・ダーク・システムのテーマを切り替えます。',
            step2: 'CGPA目標・出席しきい値・週間学習目標を設定します。',
            step3: 'データのエクスポート・インポート・リセットを行います。',
            tip: 'インポートはこのブラウザのデータを置き換えます。不安なときは先にエクスポートしてください。'
          },
          f9: {
            title: 'インストール・オフライン・更新',
            body: 'BeeBoard はアプリのようにインストールでき、通信なしでも開けます。',
            step1: '設定を開き、ボタンが出ていれば「アプリをインストール」を押します。',
            step2: 'スマホではブラウザのメニューから「ホーム画面に追加」を使います。',
            step3: '更新後は2回再読み込みすると新しい版が反映されます。',
            tip: '1回目の再読み込みで新しい版を取得し、2回目で表示が切り替わります。'
          }
        },
        mock: {
          term: '学期',
          start: '最初の月曜日',
          save: '保存',
          subject: '科目',
          weight: '配点',
          total: '合計',
          nextClass: '次の授業',
          quiz: 'Quiz',
          test: 'Test',
          final: '期末試験',
          needed: '期末で必要',
          attendance: '出席',
          deadline: '締切',
          timer: 'タイマー',
          export: 'エクスポート'
        },
        help: {
          title: '困ったら',
          body: 'よくある質問は FAQ にまとめています。そこに無いときは GitHub で Issue を立ててください。',
          faq: 'FAQを見る',
          contact: '開発者に質問する'
        }
      },
      faq: {
        title: 'よくある質問',
        subtitle: 'よく出る疑問に、短く答えます。',
        searchPlaceholder: '質問を検索',
        searchAria: '質問を検索',
        all: 'すべて',
        count: {
          one: '1件の質問',
          other: '{n}件の質問'
        },
        empty: '条件に合う質問がありません。',
        clear: '絞り込みを解除',
        categories: {
          start: 'はじめる',
          data: 'データとプライバシー',
          grades: '成績',
          attendance: '出席',
          install: 'インストールと更新',
          trouble: '困ったとき'
        },
        items: {
          q1: {
            q: 'BeeBoard は MMU の公式システムですか？',
            a:
              'いいえ。個人用の学習補助ツールで、MMU や公式ポータルとは接続していません。ここに出る数字は自分用のメモとして扱い、' +
              '評価に関わることは公式の情報で確認してください。'
          },
          q2: {
            q: 'アカウントは必要ですか？',
            a: 'いいえ。登録もログインもありません。開くとすぐダッシュボードになり、データはこのブラウザに保存されます。'
          },
          q3: {
            q: 'データはどこに保存されますか？',
            a:
              'この端末の、このブラウザの中です（ローカルストレージ）。サーバーへの送信はなく、コピーを持つアカウントもありません。',
            link: 'データ設定を開く'
          },
          q4: {
            q: 'スマホとPCで同じデータは使えますか？',
            a: '自動では同期しません。ブラウザごとに別のデータを持ちます。移すときは、片方でエクスポートし、もう片方でインポートします。'
          },
          q5: {
            q: 'バックアップと機種変更の方法は？',
            a:
              '設定を開いてデータをエクスポートし、JSON ファイルを安全な場所に保管します。新しい端末では、設定からそのファイルを' +
              'インポートします。',
            link: '設定を開く'
          },
          q6: {
            q: 'ブラウザのデータを消したら復元できますか？',
            a: 'できません。サイトデータを消すとすべて失われ、復元できるサーバー側のコピーはありません。消す前にエクスポートしてください。'
          },
          q7: {
            q: 'オフラインで使えますか？',
            a: '一度開いたあとなら使えます。ページがキャッシュされるので、通信がなくても起動します。変更はこれまでどおりローカルに保存されます。'
          },
          q8: {
            q: 'インストール方法は？',
            a: '設定を開き、ボタンが出ていれば「アプリをインストール」を押します。スマホではブラウザのメニューから「ホーム画面に追加」を使います。',
            link: '設定を開く'
          },
          q9: {
            q: '更新が反映されません。',
            a:
              '2回再読み込みしてください。1回目で新しい版を裏で取得し、2回目で表示が切り替わります。それでも古いままなら、' +
              'インストールしたアプリを閉じて開き直します。'
          },
          q10: {
            q: 'シミュレーターが「未確定」と出るのはなぜですか？',
            a:
              'まだ点数を入れていない評価項目があるためです。空の項目がある間は必要Final点を断定できないので、' +
              '代わりに到達可能な最大点を示します。',
            link: 'シミュレーターを開く'
          },
          q11: {
            q: '「到達できません」の意味は？',
            a:
              '残りの項目がすべて満点でも目標に届かない、という意味です。目標グレードを下げるか、配点と点数の入力が' +
              '正しいか確認してください。',
            link: 'シミュレーターを開く'
          },
          q12: {
            q: '満点を超える点数を入れてしまいました。',
            a: '満点に丸められ、そのときにトーストで知らせます。保存される値が満点を超えることはないので、加重の合計は正しいままです。'
          },
          q13: {
            q: '「期末試験の点数」が出ません。',
            a: '種別が「期末試験」の項目が1つ必要です。科目エディタを開き、期末の評価項目の種別を「期末試験」にしてください。',
            link: '科目エディタを開く'
          },
          q14: {
            q: '配点は合計100%でないといけませんか？',
            a:
              'そろえるべきです。100%でないとエディタが警告します。シミュレーターは入力された配点をそのまま本当の配点として' +
              '計算するため、100%を超えると必要点が実際より低く見えます。'
          },
          q15: {
            q: '出席はどう計算され、しきい値は変えられますか？',
            a: '出席率は、科目ごとに出席したコマの割合です。しきい値の既定は80%で、設定から変更できます。',
            link: '設定を開く'
          },
          q16: {
            q: '休講と振替は出席にどう影響しますか？',
            a: '休講は分母から外れるので、出席率を下げません。振替は、実際に実施した週のコマとして数えます。'
          },
          q17: {
            q: '教室コードの意味は？',
            a:
              'CQAR3002 のようなコードは、キャンパス・建物・ウイング・階・部屋を表します。建物の記号は Q が FCI、' +
              'R が FOM、L が FAIE、J が FCM、N が CNMX（大講義棟）です。'
          },
          q18: {
            q: '言語はどう切り替えますか？',
            a: '設定を開き、English か 日本語 を選びます。選択はこのブラウザに保存され、すべてのページに反映されます。',
            link: '設定を開く'
          },
          q19: {
            q: '次の学期の始め方と、過去学期の復元は？',
            a:
              '設定を開いて現在の学期をアーカイブし、学期名と最初の月曜日を入れて次の学期を始めます。' +
              'アーカイブした学期は同じ場所から復元できます。',
            link: '設定を開く'
          },
          q20: {
            q: '不具合の報告や質問はどこへ？',
            a: '開発者への質問ページを使ってください。GitHub の Issue の文面を組み立てるので、投稿前に内容を確認できます。',
            link: '開発者への質問を開く'
          },
          q21: {
            q: '画面が崩れる、操作しても反応しません。',
            a:
              'まず再読み込みし、もう一度再読み込みして最新版を反映してください。それでも直らないときは、' +
              'ブラウザのコンソールにエラーが出ていないか確認してから報告してください。'
          }
        }
      },
      contact: {
        title: '開発者への質問',
        subtitle: 'このアプリはサーバーを持たないので、ここから何かが送信されることはありません。文面を作って GitHub に投稿します。',
        form: {
          type: '種別',
          typeQuestion: '質問',
          typeBug: '不具合報告',
          typeFeature: '機能リクエスト',
          typeOther: 'その他',
          title: 'タイトル',
          titlePlaceholder: 'ひとことで表すと',
          details: '詳細',
          detailsPlaceholder: '何が起きたか、どうなってほしかったか',
          page: '起きたページ',
          pageOther: 'わからない',
          repro: '再現手順',
          reproPlaceholder: '1. シミュレーターを開く\n2. Quiz に 80 を入れる\n3. …',
          reproHint: '任意です。番号付きの手順が一番伝わります。',
          optional: '任意'
        },
        pages: {
          dashboard: 'ダッシュボード',
          simulator: '成績シミュレーター',
          deadlines: '締切',
          deadlineDetail: '締切の詳細',
          attendance: '出席',
          studylog: '学習ログ',
          notes: 'メモ',
          settings: '設定',
          subjectEdit: '科目エディタ',
          setup: '初回セットアップ',
          guide: '使い方ガイド',
          faq: 'FAQ',
          contact: '開発者への質問',
          other: 'わからない'
        },
        privacy: {
          title: '投稿する前に',
          body:
            'GitHub の Issue は公開されます。誰でも読めて、検索エンジンにも拾われます。学籍番号・氏名・成績・' +
            '個人が写ったスクリーンショットは入れないでください。',
          check: '個人情報を入れていません',
          hint: 'チェックするまでボタンは押せません。'
        },
        actions: {
          open: 'GitHubでIssueを開く',
          copy: '文面をコピー',
          copyDiagnostics: '診断情報をコピー',
          copied: 'クリップボードにコピーしました',
          copyFailed: 'コピーできませんでした。テキストを選択して手動でコピーしてください。',
          needCheck: '先に、個人情報が入っていないことを確認してください。'
        },
        template: {
          type: '種別',
          page: 'ページ',
          details: '詳細',
          repro: '再現手順'
        },
        links: {
          title: 'ほかの見どころ',
          repo: 'GitHub リポジトリ',
          repoBody: 'ソースコード・リリース・Issue の一覧。',
          faq: 'FAQ',
          faqBody: 'よく出る疑問への短い答え。',
          guide: '使い方ガイド',
          guideBody: '全画面をステップごとに案内します。'
        },
        diagnostics: {
          title: '診断情報',
          body:
            'ページ名・言語・ブラウザのユーザーエージェント・画面幅・Service Worker のキャッシュ名をコピーします。' +
            '科目・点数・メモなど、保存されているデータは一切読みません。',
          copied: '診断情報をコピーしました',
          page: 'ページ',
          lang: '言語',
          width: '画面',
          ua: 'ユーザーエージェント',
          cache: 'Service Worker のキャッシュ'
        }
      },
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
