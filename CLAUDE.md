# whatascrap — Claude context

Personal YouTube transcript library. A Python scraper downloads transcripts and
a Next.js + SQLite frontend organizes them into folders, lets the user bulk-edit
them, and tracks every scrape run in a jobs history.

## Stack at a glance

- **Python 3.9 scraper** — `scrape.py` at repo root. Uses `youtube-transcript-api`
  with a `yt-dlp` subtitle-extraction fallback, plus `yt-dlp` for metadata and
  playlist expansion. Emits JSON on stdout for the worker.
- **Next.js 16 + React 19 app** in `frontend/` (Turbopack, Tailwind v4 with inline
  `@theme` tokens). Server components talk directly to SQLite via
  `better-sqlite3`; client components call JSON APIs under `app/api/`.
- **SQLite** — `frontend/scrape.db`. Two domain tables (`videos`, `categories`)
  and two job-queue tables (`jobs`, `job_items`). No migrations — schema is
  created/patched idempotently at startup in `frontend/src/lib/db.ts`.
- **Background worker** (`frontend/src/worker.ts`, run via `npm run worker`)
  drains `job_items`, calls `scrape.py` per item, stores transcripts.

## Running locally

From `frontend/`:

```bash
npm install
npm run dev:all    # Next dev server + worker in one terminal (concurrently)
# or split:
npm run dev        # Next only
npm run worker     # worker only
```

Python deps: `pip install -r requirements.txt` at repo root.

Tests: `pytest` at repo root (14 passing, 2 pre-existing failures about a stale
`{video_id}.md` filename assumption — do not chase these without confirmation).

## Project-specific conventions

- **Don't amend or force-push.** Always create a new commit.
- **Don't create documentation or markdown files** unless the user explicitly
  asks. `PROGRESS.md`, `CLAUDE.md`, and `frontend/AGENTS.md` are the only
  sanctioned ones.
- **Match the existing dark-mode aesthetic** (Material 3 × YouTube, see palette
  in `frontend/src/app/globals.css`). Keep `@phosphor-icons/react` for icons.
- **`frontend/AGENTS.md` warns**: Next.js 16 has breaking changes. When unsure,
  read `frontend/node_modules/next/dist/docs/01-app/03-api-reference/` before
  inventing route-handler shapes. Route handler params are `Promise<{…}>` now.
- **React 19 lint rules are strict.** `react-hooks/set-state-in-effect` and
  `react-hooks/refs` will reject common pre-React-19 patterns. Prefer the
  "reset state with key" trick (see `SelectableGrid` in `LibraryClient.tsx`)
  over `useEffect` state resets. Pre-existing errors in `JobsPanel.tsx` and
  `Sidebar.tsx` are known — leave them alone unless explicitly asked.
- **Two polling patterns in the codebase** — both use `fetch` + `setState`
  (never `router.refresh()` from a setInterval; it races with navigation and
  causes bouncing between routes).

## Key paths

- `scrape.py` — tiered transcript fetch (`youtube-transcript-api` → yt-dlp
  subs). Exits non-zero on total failure with a classified message:
  `blocked:`, `no_captions:`, `unavailable:`, `age_restricted:`, etc.
- `frontend/src/lib/db.ts` — all SQLite access; exported helpers for videos,
  categories, bulk ops.
- `frontend/src/lib/jobs.ts` — job queue API. `createJob`, `claimNextItem`,
  `markItemDone`, `markItemFailed` (3 attempts), `retryFailedItems`,
  `cancelJob`, `countActiveJobs`.
- `frontend/src/lib/scraper.ts` — thin TS wrapper that shells out to
  `python3 scrape.py`. Honors `PYTHON_BIN` env var.
- `frontend/src/lib/markdown.ts` — canonical markdown renderer for
  single-file and bulk-zip downloads. Includes the YouTube URL.
- `frontend/src/app/history/` — list + detail pages for job runs.
- `frontend/src/components/history/` — shared `JobRow`, `JobDetail`,
  `JobStatusChip`, `JobProgress`, `ErrorHint`.

## YouTube IP blocks (operational)

`youtube-transcript-api` and `yt-dlp` both get rate-limited from the same IP.
The worker defaults to concurrency=1 with a 1.5 s delay between items and
exponential backoff (60 s → cap 5 min) when a block is detected. Env vars:

- `WORKER_CONCURRENCY` (default 1) — only raise with cookies configured.
- `WORKER_MIN_DELAY_MS` (default 1500)
- `WORKER_BLOCK_BACKOFF_MS` (default 60000)
- `YT_COOKIES_FROM_BROWSER` — `chrome`/`firefox`/`safari`/`brave`. Biggest win
  when you hit blocks. User must be signed into YouTube in that browser.
- `YT_COOKIES_FILE` — absolute path to a Netscape-format cookies.txt as
  alternative to the browser option.
- `PYTHON_BIN` — override `python3`.

## Memory / progress

Session-by-session notes live in `PROGRESS.md` at repo root — append there
when meaningful work lands. `frontend/CLAUDE.md` re-exports `frontend/AGENTS.md`
(the "Next.js 16 is different" warning).
