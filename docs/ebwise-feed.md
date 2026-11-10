# eBwise feed (ebwise-feed/1)

Local only. A separate program on this PC writes `ebwise-feed.json` into the folder BeeBoard already has permission for (next to `beeboard-snapshot.json`). BeeBoard reads it at runtime only. Never commit a real feed.

```
{
  "schema": "ebwise-feed/1",                 // anything else: reject
  "generatedAt": "2026-11-10T07:03:10+08:00",
  "site": "https://ebwise.mmu.edu.my",       // https origin; links must share this origin
  "windowDays": 21,
  "lastSync": { "result": "ok|partial|token_invalid|no_token|error", "finishedAt": "...+08:00", "messageJa": "..." },
  "filesRoot": "C:\\Users\\ballo\\local-ai\\ebwise\\files",
  "courses": [ { "code": "CMA6114", "shortname": "UGRD-FCI-CMA6114-2630", "fullname": "...", "url": "https://...",
                 "counts": { "files": 40, "recentNew": 3, "recentUpdated": 1 } } ],
  "materials": [ { "id": "ebw:file:<16hex>" | "ebw:mod:<cmid>", "course": "CMA6114",
                   "kind": "file|module", "status": "new|updated", "title": "...", "fileName": "...",
                   "section": "...", "module": "...", "modtype": "...",
                   "changedAt": "ISO+08:00", "moodleModified": "ISO+08:00|null", "size": 123|null,
                   "localPath": "CMA6114/01 .../x.pdf" (relative to filesRoot, '/' separated, may be ""),
                   "url": "https://..." } ],          // newest changedAt first, max 300
  "deadlines": [ { "id": "ebw:assign:<id>|ebw:quiz:<id>|ebw:event:<id>", "course": "CCP6114",
                   "kind": "assignment|quiz|event", "name": "...",
                   "dueAt": "ISO+08:00", "dueDate": "YYYY-MM-DD", "dueTime": "HH:mm",
                   "opensAt": "ISO|null", "cutoffAt": "ISO|null",
                   "submission": "new|submitted|draft|null", "url": "https://..." } ]   // max 200
}
```

Rules for BeeBoard:
- Reject when: not JSON, larger than 1 MB, schema !== 'ebwise-feed/1', or site is not https. Items missing id/course (and title for materials, name/dueDate for deadlines) are dropped and counted.
- Never trust strings: always escape when rendering. Link only URLs that start with https:// AND have the same origin as `site`; otherwise show text only.
- Use dueDate/dueTime as given (already Malaysia time). Do not recompute from dueAt.
- Never store materials in localStorage. Only `state.ebwise` = { schema: 1, mapping: {}, suggested: {}, seenAt: {}, filesLinked: false } is saved.
- No contents of course files are ever in the feed.
