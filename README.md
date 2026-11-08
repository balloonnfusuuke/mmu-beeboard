# MMU BeeBoard

A personal study dashboard for MMU (Multimedia University) students. Static HTML, CSS and
vanilla JavaScript — no backend, no build step required to run, no tracking.

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
- **Trimester switching** that archives the previous trimester instead of deleting it
- **Safe with several tabs open** — every save re-reads the stored state first, and other
  tabs pick up the change through the `storage` event
- **Reversible deletes** — destructive actions ask in an in-page dialog, and single-item
  deletes offer an Undo
- Everything persists in `localStorage` — nothing leaves the browser

### Deliberately not included

There is no interface language switcher, no date-format setting, no configurable timetable
day bounds and no reminder notifications. Earlier builds exposed those controls but nothing
in the app honoured them, so they were removed rather than left as dead switches. The UI is
English and dates are shown as `DD Mon YYYY`.

## Quick start

Open `index.html` in a browser. That is the whole setup.

A local server is recommended if your browser restricts `file://` storage:

```bash
python -m http.server 8000
# then visit http://localhost:8000/
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

`sw.js` precaches every page and asset into a versioned cache (`mmu-beeboard-v1`) and serves
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

No network requests, no analytics, no cookies, no third-party scripts. All state lives in
your browser's `localStorage` under the key `mmu-beeboard`. Use **Settings → Export data** to
take a JSON backup, or **Reset all data** to wipe it.

## License

[MIT](LICENSE)
