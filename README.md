# MMU BeeBoard

A personal study dashboard for MMU (Multimedia University) students. Static HTML, CSS and
vanilla JavaScript — no backend, no build step required to run. The only network
request is Vercel Web Analytics (aggregate page views, no cookies).

> **Not an official MMU system.** This is an independent personal project. It is not
> affiliated with, endorsed by, or connected to Multimedia University. It ships with no
> course data at all — you enter your own modules and weightings, so always confirm them
> against your official student portal.

---

## Features

- **Guided first-time setup** — welcome, trimester, subjects, done, with a Skip on every step
- **Weekly timetable** rendered from session data, with a "next class" card that handles
  week rollover and the pre-trimester preview state
- **Attendance tracking** with the configurable barring threshold, per-module rates, remaining
  allowable absences, and a per-session log you can correct
- **Grade simulator** — enter coursework marks to see secured marks, the predicted grade,
  and the final exam score still required for a target
- **Deadline timeline** grouped by week, with weight-at-stake totals, the week's real dates,
  and custom deadlines
- **Study log** with a timer and manual entry
- **Dark mode** (light / dark / system) driven entirely by CSS variables
- **English and Japanese** — the whole interface switches, and the choice is remembered
- **Local AI bridge** — a folder the app watches for operation files, with approval for
  anything that touches attendance, marks or deletions
- **Trimester switching** that archives the previous trimester instead of deleting it
- **Safe with several tabs open** — every save re-reads the stored state first, and other
  tabs pick up the change through the `storage` event
- **Reversible deletes** — destructive actions ask in an in-page dialog, and single-item
  deletes offer an Undo
- Everything persists in `localStorage` — nothing leaves the browser

### Deliberately not included

There is no date-format setting, no configurable timetable day bounds and no reminder
notifications. Earlier builds exposed those controls but nothing in the app honoured them,
so they were removed rather than left as dead switches. The interface is English or
Japanese, chosen in Settings, and dates follow that choice: `DD Mon YYYY` in English and
`M月D日(曜)` in Japanese.

## Quick start

Open `index.html` in a browser. That is the whole setup.

A local server is recommended if your browser restricts `file://` storage:

```bash
python -m http.server 8000
# then visit http://localhost:8000/
```

### API

`api/` holds Vercel Serverless Functions; `GET /api/v1/health` returns `{"ok": true}`.
Run `npx vercel dev`, then open http://localhost:3000/api/v1/health — the same server still
serves the static pages, so http://localhost:3000/ opens the dashboard as usual.

### Snapshot for a local AI

`assets/js/snapshot.js` writes the whole saved state to JSON — the student profile, settings,
subjects with their marks and attendance, notes, study sessions, personal events, the archive,
custom deadlines and deadline details — plus `exportedAt` and an `assignments` list built with
the same due rule as the Deadlines page. Nothing is filtered out, and nothing is uploaded: the
file is only ever written to this computer.

**Settings → Data & Storage → Export for local AI** writes `beeboard-snapshot.json`. Where it
lands depends on the browser:

- **Chromium browsers (Chrome, Edge)** — a folder picker opens the first time. The file is
  written into the folder you pick, and that folder is remembered. While the permission is
  still granted, every change in the app rewrites the same file after a short debounce, so it
  stays current without pressing the button again. The picker never opens on its own: once the
  permission lapses, automatic writes stop and the next button press asks for the folder again.
- **Firefox, Safari, and anything without the File System Access API** — the same file is
  downloaded through the normal save dialog, and there is no automatic update.

The same JSON is available from the console on any page:

```js
console.log(JSON.stringify(BB.snapshot.build(), null, 2));
```

### Write-back from a local AI

The snapshot is one direction: BeeBoard writes, the AI reads. The bridge adds the other
direction, still without a server. A local AI drops a small JSON file into the folder you
already picked, and BeeBoard applies it to `localStorage`.

```
<the folder you picked>/
├── beeboard-snapshot.json   # written by BeeBoard, for the AI to read
├── bridge-status.json       # written by BeeBoard every 20 seconds
└── inbox/                   # written by the AI, read and emptied by BeeBoard
    └── 2024-11-12-note.json
```

`inbox/` is created on the first run. `bridge-status.json` is a heartbeat: `heartbeatAt`,
whether the tab is visible, which tab holds the import lock, the folder permission, how many
changes are waiting for approval, the service-worker cache name, and when the snapshot was
last written (`snapshotWrittenAt`, `snapshotError`).

#### The operation file

```json
{
  "schema": "beeboard-op/1",
  "opId": "note-2024-11-12-001",
  "type": "note.add",
  "basis": { "termId": "term-1730000000000" },
  "args": {
    "kind": "memo",
    "text": "Ask about the lab report",
    "subjectCode": null,
    "date": "2024-11-12",
    "due": ""
  }
}
```

- `schema` must be `beeboard-op/1`, the file must be under 64 KB, and the name must end in
  `.json`. `.tmp` is ignored, so write to a temporary name and rename when it is complete.
- `opId` is the de-duplication key. The same `opId` is never applied twice, even if the file
  could not be deleted afterwards.
- `basis.termId` must match the current trimester. A file written for another trimester is
  rejected with `term_changed` rather than landing in the wrong term.
- Files older than 7 days are rejected with `stale`. Files are processed oldest first, so a
  backlog that built up while the tab was closed is applied in the order it was written.
- Every result is appended to `aiBridge.results` in the snapshot: `opId`, `type`, `status`
  (`applied`, `pending_approval` or `rejected`), `reason`, `at`, `summaryJa` and the ids that
  changed. The last 100 are kept.

#### What applies on its own, and what needs approval

Low-risk changes apply straight away: notes, personal events, study sessions, custom
deadlines, deadline links and memos, appearance, and undo.

Anything that touches attendance, marks, deletions, class cancellations or subject structure
is only queued. It appears on the dashboard and in **Settings → Local AI**, with the value
before and after, and nothing changes until you press **Approve**. Approving re-checks the
operation against the data as it is at that moment; if you edited the same thing in the
meantime it stops with a conflict instead of overwriting your edit. **Reject** records
`rejected_by_user`. Queued changes expire after 14 days.

Every applied change carries an **Undo**, both on the toast that appears right after it and
in the results list in Settings. **Pause changes from the AI** stops the inbox being read at
all; files stay where they are until you resume.

#### When the tab is closed

Nothing runs while BeeBoard is closed — there is no background process and no server. Files
that pile up in `inbox/` are picked up the next time you open the app, oldest first. Only one
tab imports at a time (`navigator.locks`); the others wait and take over if the holder is
closed.

If the browser drops the folder permission, usually after a restart, the dashboard shows a
short band. Pressing it asks for the permission again — the app never opens that prompt on
its own.

#### Nothing leaves this computer

The bridge reads and writes only inside the folder you picked. There is no upload, no account
and no API call. The AI side is whatever you run locally; BeeBoard only sees the JSON files
it leaves behind.

You can check what an operation would do without saving anything:

```js
BB.bridge.dryRun({
  schema: 'beeboard-op/1',
  opId: 'x',
  type: 'note.add',
  basis: { termId: BB.store.get().term.id },
  args: { kind: 'memo', text: 'hi', subjectCode: null, date: '2024-11-12', due: '' }
});
BB.bridge.status();
```

## First-time setup

The app starts empty — no subjects, no timetable, no marks. On the first visit the dashboard
sends you to a four-step setup wizard (`setup.html`):

1. **Welcome** — what the dashboard does, and a reminder that everything is stored in this
   browser only.
2. **Trimester** — trimester label (defaults to `My Trimester`), Week 1 start date, number of
   weeks (defaults to 14) and an optional display name. The start date can be left empty; week
   numbers then stay at Week 1 until you set one in Settings.
3. **Subjects** — the same fields as the subject editor: code, name, credits, accent colour,
   weekly sessions and assessment weightings. The colour is picked automatically from the
   unused presets. After saving you can add another subject or move on.
4. **Done** — a summary, then the dashboard.

Every step has a **Skip** button. Skipping marks setup as done, so the wizard never opens by
itself again; the dashboard keeps a **Continue setup** card while you have no subjects, and
**Settings → First-time setup** reopens the wizard at any time.

After setup, add or edit modules from **Settings → Subjects & Timetable**: *Add subject* opens
an empty editor, and each row has an *Edit* link. `subject-edit.html` with no `id` parameter
always starts a new subject rather than silently opening an existing one.

The student identity is a placeholder (`Student`, no student ID, no contact details) and the
name is editable in the wizard and in Settings.

## Customising

`assets/js/data.js` holds the empty starting state. Add subjects there if you would rather
ship a pre-filled timetable than start from the wizard:

```js
var STUDENT = {
  name: 'Student',      // your name
  initials: 'S',        // shown in the avatar circle
  studentId: '',        // shown in the footer when non-empty
  programme: 'B.C.S (Hons)',
  year: 2,
  faculty: 'Faculty of Computing and Informatics'
};
```

- `TERM` — trimester label, Week 1 start date (a Monday), number of weeks, exam week
- `SUBJECTS` — code, name, credits, colour, lecturer, weekly `sessions`, `assessments`
- `SETTINGS` — theme, CGPA target, attendance threshold, weekly study target
- `GRADING_SCALE` — grade bands and grade points (indicative; confirm against your faculty handbook)

**Subject colours live in the saved state, not in the CSS.** Chips and tinted badges derive
their pale variants from that one colour, so changing it in one place updates the whole UI.

To start over, use **Settings → Reset all data**, or clear the `mmu-beeboard` key from
`localStorage`. A reset returns to the empty state, so the wizard runs again. Reset, trimester
switching and subject deletion confirm in an in-page dialog; deleting a study session, a custom
deadline or an attendance record also offers an Undo for a few seconds.

## Multiple tabs

Every write re-reads `localStorage` immediately before applying the change, so a tab that has
been open for a while cannot overwrite newer edits made in another tab. Other tabs are notified
through the `storage` event and redraw themselves. Keep in mind that the last write still wins
for the *same* field — two tabs editing the same mark at the same moment is not merged.

## Project structure

```
.
├── index.html            # dashboard
├── simulator.html        # grade simulator
├── deadlines.html        # deadline timeline
├── notes.html            # every memo and homework, newest first
├── attendance.html       # attendance tracker
├── studylog.html         # study log
├── settings.html         # preferences, trimester switching, data export
├── subject-edit.html     # per-module editor
├── setup.html            # first-time setup wizard
├── manifest.webmanifest  # PWA manifest
├── sw.js                 # service worker (bump CACHE to ship an update)
├── assets/
│   ├── css/
│   │   ├── fonts.css     # @font-face for the self-hosted fonts
│   │   ├── tokens.css    # colour / radius / shadow / type tokens
│   │   ├── components.css# shared component classes (.bb-*)
│   │   ├── tailwind.src.css  # Tailwind input
│   │   └── app.css       # built Tailwind output (committed)
│   ├── fonts/            # woff2, self-hosted
│   ├── icons/            # PWA icons (192, 512, maskable, apple-touch)
│   ├── js/
│   │   ├── data.js       # seed data — the single source of truth
│   │   ├── store.js      # localStorage persistence + colour/date helpers
│   │   ├── theme.js      # applies the saved theme before first paint
│   │   ├── app.js        # shared UI shell, dashboard logic, calculations
│   │   ├── subject-form.js   # subject fields shared by the editor and the wizard
│   │   ├── snapshot.js   # JSON snapshot + folder export for a local AI
│   │   ├── bridge.js     # reads inbox/*.json and applies it, with approval
│   │   └── pages/        # one file per page
│   ├── logo.svg
│   └── favicon.svg
├── tailwind.config.js
└── package.json
```

## Install and offline

The app is a PWA. Chrome and Edge show an install icon in the address bar; Android Chrome
offers "Add to Home screen". The install button on Settings appears only when the browser
fires `beforeinstallprompt`, and disappears once the app is installed.

`sw.js` precaches every page and asset into a versioned cache (`mmu-beeboard-v<N>`) and serves
them cache-first, so the app opens offline after the first visit. When you ship a change,
bump `CACHE` in `sw.js`; the old cache is deleted on activate.

## Building the CSS

`assets/css/app.css` is committed, so you do not need Node to run the app. Only rebuild it
if you change styles or add Tailwind classes:

```bash
npm install
npm run build:css     # one-off, minified
npm run watch:css     # during development
```

Tailwind scans `./*.html` and `./assets/js/**/*.js`. Class names must appear **whole** in the
source — `'border-' + colour` will not be picked up.

## Fonts

Both fonts are self-hosted; the app makes no external requests at all.

- **Plus Jakarta Sans** — variable (weight 400–800), four unicode-range subsets
- **Material Symbols Outlined** — subset containing only the 67 icons actually used

Icons are rendered by ligature, so the markup reads `<span class="material-symbols-outlined">schedule</span>`.
If you use a new icon, regenerate the subset or it will render as literal text:

```bash
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
ICONS=$(grep -rhoE 'material-symbols-outlined[^>]*>[a-z_]+' --include=*.js --include=*.html . \
  | grep -v node_modules | sed 's/.*>//' | sort -u | paste -sd, -)
curl -s -H "User-Agent: $UA" \
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=$ICONS&display=block" \
  | grep -o 'url(https[^)]*)' | head -1 | sed 's/url(//;s/)//' \
  | xargs curl -sL -o assets/fonts/material-symbols-outlined.woff2
```

## Privacy

The only network request the app makes is Vercel Web Analytics, which records aggregate
page views (path, referrer, country, device type) with no cookies and no cross-site tracking.
All state lives in your browser's `localStorage` under the key `mmu-beeboard`. Use **Settings →
Export data** to take a JSON backup, or **Reset all data** to wipe it.

## License

[MIT](LICENSE)
