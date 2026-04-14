# PROGRESS

Chronological log of meaningful changes. Newest at the top. Entries here
should answer "what changed and why" — implementation details belong in the
commit messages.

---

## 2026-04-14 — Resilience pass: transcript fallback, worker pacing, hydration fix

**Problem:** YouTube started IP-blocking the scraper on ~a third of videos
(`IpBlocked`, HTTP 429). `scrape.py` only used `youtube-transcript-api`, the
worker fired 2 concurrent requests back-to-back, and the user had no visibility
into why items failed.

**What shipped:**

- `scrape.py` now has a **two-tier transcript fetch**: primary
  `youtube-transcript-api`, fallback to `yt-dlp`'s subtitle extraction
  (different endpoint, often survives blocks). Permanent errors
  (`TranscriptsDisabled`, `NoTranscriptFound`, `VideoUnavailable`,
  `AgeRestricted`, `InvalidVideoId`) short-circuit — no point retrying.
  Failures now report a classified prefix (`blocked:`, `no_captions:`,
  `unavailable:`, `age_restricted:`) instead of raw stack text.
- `scrape.py` reads `YT_COOKIES_FROM_BROWSER=chrome` and `YT_COOKIES_FILE=…`
  env vars. Scoped to the tier-2 sub-fetch only (cookies on the metadata
  call broke yt-dlp's format selection).
- **Worker pacing & backoff** in `frontend/src/worker.ts`: default
  `WORKER_CONCURRENCY=1` (was 2), 1.5 s between items, exponential backoff
  60 s → cap 5 min when the error message matches the blocked regex.
- **Error-category chip** in `JobDetail` — failed items now render a friendly
  "YouTube rate-limit" / "No captions available" / "Video unavailable" /
  "Age-restricted" badge above the raw error with next-step hint copy.
- **Hydration fix**: `fmtTs` in `JobDetail.tsx` was using
  `toLocaleString(undefined, …)`. macOS Node resolved to day-first 24h, the
  browser resolved to month-first 12h → React regenerated the tree on
  hydration. Pinned locale to `"en-US"` and added `suppressHydrationWarning`
  on time-rendering nodes in `Meta`, `JobRow`, `VideoCard`.
- Tests: added `test_fetch_transcript_falls_back_to_ytdlp` and
  `test_fetch_transcript_skips_fallback_on_permanent_error`; updated the
  existing failure test to patch both tiers. `14 passed`, 2 pre-existing
  failures unchanged.

**Operational note:** the fix doesn't un-block an already-429'd IP. Options:
wait for YouTube's cooldown, or set `YT_COOKIES_FROM_BROWSER=chrome` before
starting the worker. Concurrency=1 + delays + backoff should keep you out
of future blocks.

---

## 2026-04-14 — History tab + nav-bounce fix

**Problem:** `JobsPanel` only showed running jobs. Once a job finished the
user had no way to audit which items failed and why.

**What shipped:**

- New `/history` route with filter pills (Active · Completed · Failed ·
  Cancelled · All). Live polling on Active via `fetch`+`setState` (not
  `router.refresh()` — see nav-bug below).
- New `/history/[id]` job detail page: status chip, progress bar with green
  success + rose failed split, meta grid (created/started/finished/duration),
  Retry / Cancel / Source buttons wired to existing `/api/jobs/[id]/retry|cancel`
  endpoints, and per-status item groups with Failed expanded by default,
  errors rendered in a `<pre>` block.
- Shared primitives: `JobRow`, `JobDetail`, `JobStatusChip`, `JobProgress`,
  `ErrorHint` under `frontend/src/components/history/`.
- Sidebar gains a `History` entry (`ClockCounterClockwise` icon) with a live
  count of unfinished jobs. `showZero={false}` on `SideLink` so the count
  quietly disappears when 0.
- New db helper `countActiveJobs()` in `jobs.ts`, threaded through
  `page.tsx` → `LibraryClient` → `Sidebar` and the history pages.

**Bonus bug fix:** `Header.tsx`'s debounced search was calling
`router.push("/")` on every mount because `value === ""` on pages without a
`q` param. Mounting the Header on `/history` kicked the user back to `/`
after 300 ms. Fixed by no-op'ing when `value === sp.get("q")` and scoping
the library-specific param-preserving logic to `pathname === "/"` via
`usePathname()`.

Also converted the polling loops on `HistoryClient` and `JobDetail` from
`router.refresh()` to plain `fetch` + `setState` — `router.refresh()` races
with in-flight navigation and was causing the detail page to bounce back to
the list.

Commit: `2306846`

---

## 2026-04-14 — Bulk actions + AIDesigner-driven polish pass

**Problem:** Library only supported per-video actions. After a playlist
scrape the user had no way to reorganize or export in bulk. Also the UI was
functional but not polished.

**What shipped:**

- Multi-select on `VideoCard` with a hover-revealed checkbox; `SelectableGrid`
  owns the state, keyed on `sp.toString()` so filter/search changes reset it
  (React docs' "reset state with key" pattern — satisfies React 19 lint).
- `BulkActionBar.tsx` sticky below header when anything is selected: Assign
  category (reuses `flattenForMenu`), Download .md (ZIP), inline two-step
  Delete confirm (replaced `confirm()` dialog — browsers were suppressing it).
- New API routes: `POST /api/videos/bulk/category`, `POST /api/videos/bulk/delete`,
  `GET /api/videos/bulk/download?ids=…`. All cap `ids` at 1000 and wrap the
  mutations in a db transaction. ZIP via `jszip` (pure-JS dep, no native).
- Shared `renderVideoMarkdown` in `frontend/src/lib/markdown.ts` used by
  single-download and bulk-zip routes. **Added `**URL:**` line** to the
  rendered markdown (previously URL was in the DB but not in the output).
- Extracted `flattenForMenu` + `getCategoryPath` to
  `frontend/src/lib/categoryTree.ts` so `VideoCard` and `BulkActionBar` share
  one implementation.
- **Design polish**: generated a Material 3 × YouTube artifact via AIDesigner
  MCP (run `022cbc3d-bbf8-4d54-aa78-0fc4a9897f07`) and ported its decisions
  into the React components. New motion tokens in `globals.css`
  (`anim-slide-down`, `anim-fade-scale`, `anim-slide-up`,
  `anim-progress-gloss`), `prefers-reduced-motion` guard, focus-visible
  default ring. Red-accent "Add video" pill in `Header`, red-accent selected
  state on `VideoCard`, rounded-2xl `JobsPanel` float with gloss sweep on
  active progress bar, M3-tonal sidebar active state.
- `.aidesigner/` run artifacts gitignored.

Commits: `9c27f23` (bulk + polish).

---

## Pre-existing baseline (before these sessions)

- `4338894` background job queue for playlist and batch scraping
- `eca7d70` nested folders, sidebar nav, YouTube-style redesign
- `eee595b` remove SQLite WAL files from tracking
- `e41664b` initial YouTube scraper + transcript library frontend

## Known pre-existing issues (don't fix without asking)

- `tests/test_scrape.py::test_write_markdown_creates_file` and
  `::test_main_processes_url` — asserting a `{video_id}.md` filename that
  the code has never produced (it writes `{slug}-{slug}.md`). Failing on
  `main` since before any of the above sessions.
- `JobsPanel.tsx:46` and `Sidebar.tsx:333` — two `react-hooks/set-state-in-effect`
  lint errors. Both are "safe" uses (polling + prop sync). Leaving as-is
  until the user wants a React-19-idiomatic rewrite.
