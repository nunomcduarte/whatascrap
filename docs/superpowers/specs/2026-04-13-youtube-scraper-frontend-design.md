# YouTube Scraper Frontend — Design Spec

**Date:** 2026-04-13
**Type:** Small team tool — polished, no auth
**Stack:** Next.js (App Router) + Tailwind CSS + SQLite (better-sqlite3)
**Architecture:** Monorepo — Next.js wraps existing Python scraper via subprocess

---

## Overview

A dark-themed, minimalist frontend for the existing YouTube scraper CLI. Acts as a searchable video transcript library. Users paste YouTube URLs, the app scrapes metadata + transcripts, stores them in SQLite, and presents a browsable card grid with full reading views.

---

## Project Structure

```
scripts/
  scrape.py              # Existing CLI (one addition: --json flag)
  requirements.txt       # Existing
  tests/                 # Existing
  frontend/              # New Next.js app
    src/
      app/
        page.tsx          # Library grid view
        video/[id]/
          page.tsx        # Video detail/reading view
        api/
          scrape/
            route.ts      # POST — triggers scrape.py subprocess
          videos/
            route.ts      # GET — list/search all videos
            [id]/
              route.ts    # GET — single video, DELETE — remove
              download/
                route.ts  # GET — download .md file
      components/
        Navbar.tsx
        SearchBar.tsx
        VideoGrid.tsx
        VideoCard.tsx
        AddModal.tsx
        VideoDetail.tsx
        DownloadButton.tsx
        DeleteButton.tsx
        EmptyState.tsx
        LoadingSkeleton.tsx
        ErrorInline.tsx
      lib/
        db.ts             # SQLite setup + queries
    public/
    tailwind.config.ts
    package.json
```

---

## Data Model

Single `videos` table in SQLite:

```sql
CREATE TABLE videos (
  id            TEXT PRIMARY KEY,   -- YouTube video ID (natural key)
  title         TEXT NOT NULL,
  channel       TEXT NOT NULL,
  upload_date   TEXT,               -- YYYY-MM-DD
  transcript    TEXT NOT NULL,
  scraped_at    TEXT NOT NULL,      -- ISO 8601 timestamp
  url           TEXT NOT NULL       -- Original YouTube URL
);
```

- Video ID as primary key prevents duplicate scrapes.
- Transcript stored as plain text (same format the scraper produces).
- No tags, folders, or categories. Search handles discovery.
- Re-scraping an existing video returns the existing record unless explicitly requested.

---

## API Routes

| Method   | Route                       | Purpose |
|----------|-----------------------------|---------|
| `POST`   | `/api/scrape`               | Accepts `{ urls: string[] }`. Runs `scrape.py --json <url>` per URL via subprocess. Stores results in SQLite. Returns array of created/existing video records. |
| `GET`    | `/api/videos`               | Returns all videos (metadata only, no transcript). Accepts `?q=search` for full-text search across title, channel, transcript. |
| `GET`    | `/api/videos/[id]`          | Returns single video with full transcript. |
| `GET`    | `/api/videos/[id]/download` | Returns `.md` file as download (`Content-Disposition: attachment`). Generates Markdown on the fly from DB record. |
| `DELETE` | `/api/videos/[id]`          | Removes video from SQLite. |

### Scrape endpoint details

- Runs `python scrape.py --json <url>` as a subprocess.
- `--json` flag is the only change to `scrape.py` — outputs `{ "title": "...", "channel": "...", "upload_date": "...", "transcript": "..." }` to stdout instead of writing a file.
- Batch scrapes run sequentially to avoid rate limiting.
- If a video ID already exists in the DB, skip the scrape and return the existing record.
- Errors (invalid URL, no transcript) return `{ error: "message" }` with appropriate HTTP status.

---

## Pages & User Flows

### Library Page (`/`)

- **Navbar:** App name ("Scrape") with red dot logo, video count, "+ Add" button.
- **Search bar:** Below navbar. Debounced input filters by title, channel, or transcript content. Updates URL query params for server-side filtering.
- **Card grid:** Responsive — 1 col mobile, 2 col tablet, 3 col desktop. Each card shows title, channel, upload date tag. Clicking navigates to detail view.
- **Empty state:** "No videos yet. Add a YouTube URL to start building your library."

### Add Modal (triggered by "+ Add")

- Default: single URL input + "Scrape" button.
- "Batch mode" toggle switches to textarea (one URL per line).
- Loading state: spinner + "Scraping..." text on the button.
- Success: modal closes, new card(s) appear in grid.
- Error: inline red text below input (e.g., "No transcript available for this video").

### Video Detail Page (`/video/[id]`)

- Back arrow to return to library.
- Header: title (large), channel, upload date, scraped date.
- Action bar: Download .md button, Delete button (with confirmation dialog).
- Full transcript below as readable text, `max-w-[65ch]` for comfortable line length.

### Scrape Flow

1. User clicks "+ Add" — modal opens.
2. Pastes URL(s) — clicks "Scrape".
3. API route runs `python scrape.py --json <url>` via subprocess.
4. Parses JSON output, stores in SQLite.
5. Modal closes, new card(s) appear in grid.
6. On error: inline error message in modal, modal stays open.

---

## Visual Design

### Palette (Dark Zinc)

- Background: `#09090B` (zinc-950)
- Card surfaces: `#18181B` (zinc-900) with `border-zinc-800`
- Text primary: `#FAFAFA` (zinc-50)
- Text secondary: `#71717A` (zinc-500)
- Text muted: `#52525B` (zinc-600)
- Accent: `#EF4444` (red-500) — single accent, used sparingly (logo dot, active states, destructive actions)
- Input/tag surfaces: `#27272A` (zinc-800)

### Typography

- Font: `Geist Sans` + `Geist Mono` for metadata tags.
- Headings: `tracking-tighter leading-none font-semibold`.
- Body/transcript: `text-base text-zinc-400 leading-relaxed max-w-[65ch]`.
- Tags/metadata: `text-xs font-mono text-zinc-500`.

### Spacing & Layout

- Page container: `max-w-[1400px] mx-auto`.
- Card grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.
- Card padding: `p-5`.
- Card radius: `rounded-xl`.
- Section gaps: `gap-6`.
- Full-height sections use `min-h-[100dvh]`, never `h-screen`.

### Interactions

- Cards: `hover:border-zinc-700 transition-colors duration-200`.
- Active press: `active:scale-[0.98] transition-transform`.
- Buttons: solid zinc-50 on zinc-900 for primary, ghost for secondary.
- Modal: centered overlay with `backdrop-blur-sm bg-black/60`.

### States

- **Loading:** Skeleton shimmer cards matching grid dimensions.
- **Empty:** Centered message — "No videos yet. Add a YouTube URL to start building your library."
- **Error:** Inline `text-red-400` below the input in the modal.

---

## Components

| Component          | Purpose |
|--------------------|---------|
| `Navbar.tsx`        | Top bar: logo (red dot + "Scrape"), video count, "+ Add" button |
| `SearchBar.tsx`     | Debounced search input, updates URL query params |
| `VideoGrid.tsx`     | Responsive card grid container |
| `VideoCard.tsx`     | Individual card: title, channel, tags. Links to detail page |
| `AddModal.tsx`      | Modal with single/batch URL input + scrape trigger |
| `VideoDetail.tsx`   | Full reading view: header, metadata, transcript |
| `DownloadButton.tsx`| Triggers .md file download via `/api/videos/[id]/download` |
| `DeleteButton.tsx`  | Delete with confirmation dialog |
| `EmptyState.tsx`    | Shown when library is empty |
| `LoadingSkeleton.tsx`| Skeleton cards matching grid layout during loading |
| `ErrorInline.tsx`   | Inline error messages for scrape failures |

All components are flat (no nested folders). Interactive components are Client Components (`'use client'`). Layout wrappers are Server Components.

---

## Changes to Existing Code

**Only one change:** Add a `--json` flag to `scrape.py`.

When `--json` is passed:
- Output structured JSON to stdout instead of writing a `.md` file.
- Format: `{ "title": "...", "channel": "...", "upload_date": "...", "transcript": "..." }`
- All existing behavior (file writing, CLI usage) remains unchanged.
- Existing tests unaffected. New tests added for the `--json` flag.

---

## Out of Scope

- Authentication / user accounts
- Tags, folders, or categorization
- Video thumbnail previeval
- Transcript timestamps or chapter markers
- Export formats other than Markdown
- Real-time collaboration
- Mobile native app
