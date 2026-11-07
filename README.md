# MMU BeeBoard

A personal study dashboard for MMU (Multimedia University) students. Static HTML, CSS and
vanilla JavaScript — no backend, no build step required to run, no tracking.

> **Not an official MMU system.** This is an independent personal project. It is not
> affiliated with, endorsed by, or connected to Multimedia University. Course codes,
> timetables and assessment weightings are included as demo data only — always confirm
> against your official student portal.

---

## Features

- **Weekly timetable** rendered from session data, with a "next class" card that handles
  week rollover and the pre-trimester preview state
- **Attendance tracking** with the 80% barring threshold, per-module rates and remaining
  allowable absences
- **Grade simulator** — enter coursework marks to see secured marks, the predicted grade,
  and the final exam score still required for a target
- **Deadline timeline** grouped by week, with weight-at-stake totals and custom deadlines
- **Study log** with a timer and manual entry
- **Dark mode** (light / dark / system) driven entirely by CSS variables
- **Trimester switching** that archives the previous trimester instead of deleting it
- Everything persists in `localStorage` — nothing leaves the browser

## Quick start

Open `index.html` in a browser. That is the whole setup.

A local server is recommended if your browser restricts `file://` storage:

```bash
python -m http.server 8000
# then visit http://localhost:8000/
```

## Demo data

The app ships with a real Trimester 2630 (Oct/Nov 2026) timetable for B.C.S (Hons) Year 2:

| Code | Module | Credits |
|---|---|---|
| CCP6114 | Programming Fundamentals | 4 |
| CMA6114 | Calculus | 4 |
| CMA6124 | Discrete Structures & Probability | 4 |
| CPT6114 | Professional Development | 4 |

That is 4 modules, 11 weekly class blocks, and the full assessment structure with weights.
The student identity is a placeholder (`Student`, no student ID, no contact details).

## Customising

`assets/js/data.js` is the single source of truth. Edit it to make the dashboard yours:

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
- `SETTINGS` — CGPA target, attendance threshold, weekly study target, day bounds
- `GRADING_SCALE` — grade bands and grade points

**Subject colours live only in `data.js`.** Chips and tinted badges derive their pale
variants from that one colour, so changing it in one place updates the whole UI.

To start over, use **Settings → Reset all data**, or clear the `mmu-beeboard` key from
`localStorage`.

## Project structure

```
.
├── index.html            # dashboard
├── simulator.html        # grade simulator
├── deadlines.html        # deadline timeline
├── attendance.html       # attendance tracker
├── studylog.html         # study log
├── settings.html         # preferences, trimester switching, data export
├── subject-edit.html     # per-module editor
├── assets/
│   ├── css/
│   │   ├── fonts.css     # @font-face for the self-hosted fonts
│   │   ├── tokens.css    # colour / radius / shadow / type tokens
│   │   ├── components.css# shared component classes (.bb-*)
│   │   ├── tailwind.src.css  # Tailwind input
│   │   └── app.css       # built Tailwind output (committed)
│   ├── fonts/            # woff2, self-hosted
│   ├── js/
│   │   ├── data.js       # seed data — the single source of truth
│   │   ├── store.js      # localStorage persistence + colour/date helpers
│   │   ├── theme.js      # applies the saved theme before first paint
│   │   ├── app.js        # shared UI shell, dashboard logic, calculations
│   │   └── pages/        # one file per page
│   ├── logo.svg
│   └── favicon.svg
├── tailwind.config.js
└── package.json
```

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
