# YouTube Scraper Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dark-themed, minimalist Next.js frontend that wraps the existing YouTube scraper CLI as a searchable video transcript library.

**Architecture:** Next.js App Router monorepo. API routes shell out to `scrape.py --json` via subprocess. SQLite (better-sqlite3) stores video metadata and transcripts. Card grid library view + detail reading view.

**Tech Stack:** Next.js 14+ (App Router), Tailwind CSS, SQLite via better-sqlite3, Geist font, TypeScript

---

## File Map

### Modified
- `scrape.py` — Add `--json` flag for structured JSON output to stdout

### Created
- `frontend/package.json` — Next.js app dependencies
- `frontend/tsconfig.json` — TypeScript config
- `frontend/tailwind.config.ts` — Tailwind with zinc palette
- `frontend/postcss.config.js` — PostCSS for Tailwind
- `frontend/src/app/layout.tsx` — Root layout with Geist font, dark bg
- `frontend/src/app/page.tsx` — Library page (Server Component)
- `frontend/src/app/LibraryClient.tsx` — Client-side library wrapper (modal state, refresh)
- `frontend/src/app/video/[id]/page.tsx` — Video detail page
- `frontend/src/app/api/scrape/route.ts` — POST scrape endpoint
- `frontend/src/app/api/videos/route.ts` — GET list/search videos
- `frontend/src/app/api/videos/[id]/route.ts` — GET single video, DELETE
- `frontend/src/app/api/videos/[id]/download/route.ts` — GET .md download
- `frontend/src/lib/db.ts` — SQLite setup + query helpers
- `frontend/src/components/Navbar.tsx` — Top bar
- `frontend/src/components/SearchBar.tsx` — Debounced search
- `frontend/src/components/VideoGrid.tsx` — Responsive card grid
- `frontend/src/components/VideoCard.tsx` — Individual video card
- `frontend/src/components/AddModal.tsx` — URL input modal
- `frontend/src/components/VideoDetail.tsx` — Reading view
- `frontend/src/components/DownloadButton.tsx` — .md download trigger
- `frontend/src/components/DeleteButton.tsx` — Delete with confirmation
- `frontend/src/components/EmptyState.tsx` — Empty library message
- `frontend/src/components/LoadingSkeleton.tsx` — Skeleton loader cards
- `frontend/src/components/ErrorInline.tsx` — Inline error display
- `tests/test_scrape_json.py` — Tests for --json flag

---

### Task 1: Add `--json` flag to scrape.py

**Files:**
- Modify: `scrape.py`
- Create: `tests/test_scrape_json.py`

- [ ] **Step 1: Write failing tests for --json flag**

Create `tests/test_scrape_json.py`:

```python
import json
from unittest.mock import patch
from scrape import main


def test_json_flag_outputs_json(tmp_path, monkeypatch, capsys):
    monkeypatch.chdir(tmp_path)
    with (
        patch("scrape.fetch_metadata", return_value=("Test Title", "Test Channel", "2025-06-15")),
        patch("scrape.fetch_transcript", return_value="Hello world."),
    ):
        main(["--json", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"])
    captured = capsys.readouterr()
    data = json.loads(captured.out)
    assert data["title"] == "Test Title"
    assert data["channel"] == "Test Channel"
    assert data["upload_date"] == "2025-06-15"
    assert data["transcript"] == "Hello world."


def test_json_flag_does_not_write_file(tmp_path, monkeypatch, capsys):
    monkeypatch.chdir(tmp_path)
    with (
        patch("scrape.fetch_metadata", return_value=("Test Title", "Test Channel", "2025-06-15")),
        patch("scrape.fetch_transcript", return_value="Hello world."),
    ):
        main(["--json", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"])
    md_files = list(tmp_path.glob("*.md"))
    assert len(md_files) == 0


def test_without_json_flag_still_writes_file(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with (
        patch("scrape.fetch_metadata", return_value=("Test Title", "Test Channel", "2025-06-15")),
        patch("scrape.fetch_transcript", return_value="Hello world."),
    ):
        main(["https://www.youtube.com/watch?v=dQw4w9WgXcQ"])
    md_files = list(tmp_path.glob("*.md"))
    assert len(md_files) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/nunoduarte/Desktop/scripts && python -m pytest tests/test_scrape_json.py -v`

Expected: FAIL — `main()` doesn't recognize `--json`.

- [ ] **Step 3: Implement --json flag in scrape.py**

Modify `scrape.py` — update the `main` function:

```python
def main(args=None):
    """Process YouTube URLs and save as Markdown files."""
    import json as json_module

    if args is None:
        args = sys.argv[1:]

    if not args:
        print("Usage: python scrape.py [--json] URL [URL ...]", file=sys.stderr)
        sys.exit(1)

    json_output = False
    if args[0] == "--json":
        json_output = True
        args = args[1:]

    if not args:
        print("Usage: python scrape.py [--json] URL [URL ...]", file=sys.stderr)
        sys.exit(1)

    for url in args:
        video_id = extract_video_id(url)
        title, channel, upload_date = fetch_metadata(video_id)
        transcript = fetch_transcript(video_id)

        if json_output:
            print(json_module.dumps({
                "title": title,
                "channel": channel,
                "upload_date": upload_date,
                "transcript": transcript,
            }))
        else:
            filepath = write_markdown(video_id, title, channel, transcript, upload_date)
            print(f"Saved: {os.path.basename(filepath)}")
```

- [ ] **Step 4: Run all tests to verify they pass**

Run: `cd /Users/nunoduarte/Desktop/scripts && python -m pytest tests/ -v`

Expected: All tests PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add scrape.py tests/test_scrape_json.py
git commit -m "feat: add --json flag to scrape.py for structured output"
```

---

### Task 2: Scaffold Next.js App

**Files:**
- Create: `frontend/` directory with Next.js boilerplate

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/nunoduarte/Desktop/scripts
npx create-next-app@latest frontend \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --no-import-alias \
  --use-npm
```

- [ ] **Step 2: Install additional dependencies**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

- [ ] **Step 3: Install Geist font**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend
npm install geist
```

- [ ] **Step 4: Verify dev server starts**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend && npm run dev
```

Expected: Server starts on `http://localhost:3000` without errors. Stop it after confirming.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold Next.js frontend app"
```

---

### Task 3: Configure Tailwind + Global Styles + Layout

**Files:**
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Update tailwind.config.ts**

Replace `frontend/tailwind.config.ts` with:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 2: Update globals.css**

Replace `frontend/src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #09090b;
  color: #fafafa;
}
```

- [ ] **Step 3: Update root layout with Geist font**

Replace `frontend/src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scrape",
  description: "YouTube transcript library",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased min-h-[100dvh]">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Replace page.tsx with placeholder**

Replace `frontend/src/app/page.tsx` with:

```tsx
export default function Home() {
  return (
    <main className="max-w-[1400px] mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tighter">Scrape</h1>
      <p className="text-zinc-500 mt-2">YouTube transcript library</p>
    </main>
  );
}
```

- [ ] **Step 5: Verify dev server renders correctly**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend && npm run dev
```

Open `http://localhost:3000`. Expected: dark background (#09090B), white "Scrape" heading, zinc-500 subtitle, Geist font rendering.

- [ ] **Step 6: Commit**

```bash
git add frontend/tailwind.config.ts frontend/src/app/globals.css frontend/src/app/layout.tsx frontend/src/app/page.tsx
git commit -m "feat: configure Tailwind dark theme and Geist font"
```

---

### Task 4: SQLite Database Layer

**Files:**
- Create: `frontend/src/lib/db.ts`

- [ ] **Step 1: Create database module**

Create `frontend/src/lib/db.ts`:

```ts
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "scrape.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        channel     TEXT NOT NULL,
        upload_date TEXT,
        transcript  TEXT NOT NULL,
        scraped_at  TEXT NOT NULL,
        url         TEXT NOT NULL
      )
    `);
  }
  return db;
}

export interface Video {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
  transcript: string;
  scraped_at: string;
  url: string;
}

export interface VideoSummary {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
  scraped_at: string;
}

export function insertVideo(video: Video): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO videos (id, title, channel, upload_date, transcript, scraped_at, url)
    VALUES (@id, @title, @channel, @upload_date, @transcript, @scraped_at, @url)
  `).run(video);
}

export function getVideoById(id: string): Video | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM videos WHERE id = ?").get(id) as Video | undefined;
}

export function listVideos(query?: string): VideoSummary[] {
  const db = getDb();
  if (query) {
    const pattern = `%${query}%`;
    return db.prepare(`
      SELECT id, title, channel, upload_date, scraped_at
      FROM videos
      WHERE title LIKE ? OR channel LIKE ? OR transcript LIKE ?
      ORDER BY scraped_at DESC
    `).all(pattern, pattern, pattern) as VideoSummary[];
  }
  return db.prepare(`
    SELECT id, title, channel, upload_date, scraped_at
    FROM videos
    ORDER BY scraped_at DESC
  `).all() as VideoSummary[];
}

export function deleteVideo(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM videos WHERE id = ?").run(id);
  return result.changes > 0;
}

export function countVideos(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM videos").get() as { count: number };
  return row.count;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/db.ts
git commit -m "feat: add SQLite database layer with video CRUD"
```

---

### Task 5: API Route — POST /api/scrape

**Files:**
- Create: `frontend/src/app/api/scrape/route.ts`

- [ ] **Step 1: Create scrape API route**

Create `frontend/src/app/api/scrape/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { insertVideo, getVideoById, Video } from "@/lib/db";

const execFileAsync = promisify(execFile);

const SCRAPER_PATH = path.join(process.cwd(), "..", "scrape.py");

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "www.youtube.com" || parsed.hostname === "youtube.com") {
      return parsed.searchParams.get("v");
    }
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1);
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  let body: { urls: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.urls) || body.urls.length === 0) {
    return NextResponse.json({ error: "urls must be a non-empty array" }, { status: 400 });
  }

  const results: { video?: Video; error?: string; url: string }[] = [];

  for (const url of body.urls) {
    const videoId = extractVideoId(url);

    if (videoId) {
      const existing = getVideoById(videoId);
      if (existing) {
        results.push({ video: existing, url });
        continue;
      }
    }

    try {
      const { stdout } = await execFileAsync("python3", [SCRAPER_PATH, "--json", url], {
        timeout: 60000,
      });

      const data = JSON.parse(stdout.trim());
      const id = videoId || extractVideoId(url) || url;

      const video: Video = {
        id,
        title: data.title,
        channel: data.channel,
        upload_date: data.upload_date || null,
        transcript: data.transcript,
        scraped_at: new Date().toISOString(),
        url,
      };

      insertVideo(video);
      results.push({ video, url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ error: message, url });
    }
  }

  const hasErrors = results.some((r) => r.error);
  return NextResponse.json({ results }, { status: hasErrors ? 207 : 200 });
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/scrape/route.ts
git commit -m "feat: add POST /api/scrape endpoint"
```

---

### Task 6: API Routes — Videos CRUD + Download

**Files:**
- Create: `frontend/src/app/api/videos/route.ts`
- Create: `frontend/src/app/api/videos/[id]/route.ts`
- Create: `frontend/src/app/api/videos/[id]/download/route.ts`

- [ ] **Step 1: Create GET /api/videos route**

Create `frontend/src/app/api/videos/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { listVideos, countVideos } from "@/lib/db";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || undefined;
  const videos = listVideos(query);
  const total = countVideos();
  return NextResponse.json({ videos, total });
}
```

- [ ] **Step 2: Create GET/DELETE /api/videos/[id] route**

Create `frontend/src/app/api/videos/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getVideoById, deleteVideo } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const video = getVideoById(id);
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }
  return NextResponse.json(video);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteVideo(id);
  if (!deleted) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create GET /api/videos/[id]/download route**

Create `frontend/src/app/api/videos/[id]/download/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getVideoById } from "@/lib/db";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const video = getVideoById(id);
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const markdown = `# ${video.title}

**Channel:** ${video.channel}
**Upload Date:** ${video.upload_date || "Unknown"}
**Scraped Date:** ${video.scraped_at.split("T")[0]}

## Transcript

${video.transcript}
`;

  const filename = `${slugify(video.channel)}-${slugify(video.title)}.md`;

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 4: Verify all routes compile**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/api/videos/
git commit -m "feat: add videos API routes (list, get, delete, download)"
```

---

### Task 7: Navbar + EmptyState + LoadingSkeleton Components

**Files:**
- Create: `frontend/src/components/Navbar.tsx`
- Create: `frontend/src/components/EmptyState.tsx`
- Create: `frontend/src/components/LoadingSkeleton.tsx`

- [ ] **Step 1: Create Navbar component**

Create `frontend/src/components/Navbar.tsx`:

```tsx
"use client";

interface NavbarProps {
  videoCount: number;
  onAddClick: () => void;
}

export default function Navbar({ videoCount, onAddClick }: NavbarProps) {
  return (
    <nav className="flex items-center justify-between py-6">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-base font-semibold tracking-tighter text-zinc-50">
          Scrape
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs font-mono text-zinc-500">
          {videoCount} {videoCount === 1 ? "video" : "videos"}
        </span>
        <button
          onClick={onAddClick}
          className="bg-zinc-50 text-zinc-950 text-sm font-medium px-4 py-1.5 rounded-lg
                     hover:bg-zinc-200 active:scale-[0.98] transition-all duration-200"
        >
          + Add
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Create EmptyState component**

Create `frontend/src/components/EmptyState.tsx`:

```tsx
export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <p className="text-zinc-500 text-sm">
        No videos yet. Add a YouTube URL to start building your library.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create LoadingSkeleton component**

Create `frontend/src/components/LoadingSkeleton.tsx`:

```tsx
function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse">
      <div className="h-4 bg-zinc-800 rounded w-3/4 mb-3" />
      <div className="h-3 bg-zinc-800 rounded w-1/2 mb-4" />
      <div className="flex gap-2">
        <div className="h-5 bg-zinc-800 rounded w-16" />
        <div className="h-5 bg-zinc-800 rounded w-20" />
      </div>
    </div>
  );
}

export default function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify they compile**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Navbar.tsx frontend/src/components/EmptyState.tsx frontend/src/components/LoadingSkeleton.tsx
git commit -m "feat: add Navbar, EmptyState, and LoadingSkeleton components"
```

---

### Task 8: VideoCard + VideoGrid + ErrorInline Components

**Files:**
- Create: `frontend/src/components/VideoCard.tsx`
- Create: `frontend/src/components/VideoGrid.tsx`
- Create: `frontend/src/components/ErrorInline.tsx`

- [ ] **Step 1: Create VideoCard component**

Create `frontend/src/components/VideoCard.tsx`:

```tsx
import Link from "next/link";

interface VideoCardProps {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
}

export default function VideoCard({ id, title, channel, upload_date }: VideoCardProps) {
  return (
    <Link href={`/video/${id}`}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-5
                    hover:border-zinc-700 active:scale-[0.98]
                    transition-all duration-200 cursor-pointer"
      >
        <h3 className="text-sm font-semibold text-zinc-50 tracking-tight leading-snug line-clamp-2">
          {title}
        </h3>
        <p className="text-xs text-zinc-500 mt-2">{channel}</p>
        {upload_date && (
          <div className="mt-3">
            <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
              {upload_date}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create VideoGrid component**

Create `frontend/src/components/VideoGrid.tsx`:

```tsx
import VideoCard from "./VideoCard";

interface VideoSummary {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
}

interface VideoGridProps {
  videos: VideoSummary[];
}

export default function VideoGrid({ videos }: VideoGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          id={video.id}
          title={video.title}
          channel={video.channel}
          upload_date={video.upload_date}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create ErrorInline component**

Create `frontend/src/components/ErrorInline.tsx`:

```tsx
interface ErrorInlineProps {
  message: string;
}

export default function ErrorInline({ message }: ErrorInlineProps) {
  return (
    <p className="text-red-400 text-sm mt-2">{message}</p>
  );
}
```

- [ ] **Step 4: Verify they compile**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/VideoCard.tsx frontend/src/components/VideoGrid.tsx frontend/src/components/ErrorInline.tsx
git commit -m "feat: add VideoCard, VideoGrid, and ErrorInline components"
```

---

### Task 9: SearchBar Component

**Files:**
- Create: `frontend/src/components/SearchBar.tsx`

- [ ] **Step 1: Create SearchBar with debounced input**

Create `frontend/src/components/SearchBar.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") || "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      router.push(`/?${params.toString()}`);
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, router, searchParams]);

  return (
    <input
      type="text"
      placeholder="Search transcripts..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5
                 text-sm text-zinc-50 placeholder:text-zinc-600
                 focus:outline-none focus:border-zinc-700
                 transition-colors duration-200"
    />
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SearchBar.tsx
git commit -m "feat: add SearchBar component with debounced filtering"
```

---

### Task 10: AddModal Component

**Files:**
- Create: `frontend/src/components/AddModal.tsx`

- [ ] **Step 1: Create AddModal with single/batch toggle**

Create `frontend/src/components/AddModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import ErrorInline from "./ErrorInline";

interface AddModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddModal({ open, onClose, onSuccess }: AddModalProps) {
  const [batchMode, setBatchMode] = useState(false);
  const [singleUrl, setSingleUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleScrape = async () => {
    setError("");
    const urls = batchMode
      ? batchUrls.split("\n").map((u) => u.trim()).filter(Boolean)
      : [singleUrl.trim()];

    if (urls.length === 0 || urls[0] === "") {
      setError("Please enter at least one URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();

      if (!res.ok && !data.results) {
        setError(data.error || "Scraping failed.");
        return;
      }

      const errors = data.results?.filter((r: { error?: string }) => r.error) || [];
      if (errors.length > 0 && errors.length === urls.length) {
        setError(errors[0].error);
        return;
      }

      setSingleUrl("");
      setBatchUrls("");
      onSuccess();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-50">
            Add Videos
          </h2>
          <button
            onClick={() => setBatchMode(!batchMode)}
            className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {batchMode ? "Single mode" : "Batch mode"}
          </button>
        </div>

        {batchMode ? (
          <textarea
            placeholder={"Paste URLs, one per line...\nhttps://youtube.com/watch?v=...\nhttps://youtu.be/..."}
            value={batchUrls}
            onChange={(e) => setBatchUrls(e.target.value)}
            rows={5}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3
                       text-sm text-zinc-50 placeholder:text-zinc-600
                       focus:outline-none focus:border-zinc-700
                       transition-colors duration-200 resize-none font-mono"
          />
        ) : (
          <input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={singleUrl}
            onChange={(e) => setSingleUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleScrape()}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5
                       text-sm text-zinc-50 placeholder:text-zinc-600
                       focus:outline-none focus:border-zinc-700
                       transition-colors duration-200"
          />
        )}

        {error && <ErrorInline message={error} />}

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="text-sm text-zinc-500 hover:text-zinc-300 px-4 py-2
                       transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleScrape}
            disabled={loading}
            className="bg-zinc-50 text-zinc-950 text-sm font-medium px-5 py-2 rounded-lg
                       hover:bg-zinc-200 active:scale-[0.98] transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Scraping..." : "Scrape"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AddModal.tsx
git commit -m "feat: add AddModal component with single/batch URL input"
```

---

### Task 11: Library Page (Home)

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Build the library page**

Replace `frontend/src/app/page.tsx` with:

```tsx
import { Suspense } from "react";
import { listVideos, countVideos } from "@/lib/db";
import LibraryClient from "./LibraryClient";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const videos = listVideos(q);
  const total = countVideos();

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-4">
      <Suspense>
        <LibraryClient videos={videos} total={total} initialQuery={q || ""} />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 2: Create LibraryClient component**

Create `frontend/src/app/LibraryClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import VideoGrid from "@/components/VideoGrid";
import EmptyState from "@/components/EmptyState";
import AddModal from "@/components/AddModal";

interface VideoSummary {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
  scraped_at: string;
}

interface LibraryClientProps {
  videos: VideoSummary[];
  total: number;
  initialQuery: string;
}

export default function LibraryClient({ videos, total, initialQuery }: LibraryClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <Navbar videoCount={total} onAddClick={() => setModalOpen(true)} />
      <div className="mt-4 mb-6">
        <SearchBar />
      </div>
      {videos.length === 0 ? (
        <EmptyState />
      ) : (
        <VideoGrid videos={videos} />
      )}
      <AddModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
```

- [ ] **Step 3: Verify dev server renders the library page**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend && npm run dev
```

Open `http://localhost:3000`. Expected: dark background, Navbar with "Scrape" + red dot + "0 videos" + "+ Add" button, search bar, empty state message. Clicking "+ Add" should open the modal.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/app/LibraryClient.tsx
git commit -m "feat: build library page with card grid and add modal"
```

---

### Task 12: Video Detail Page + DownloadButton + DeleteButton

**Files:**
- Create: `frontend/src/app/video/[id]/page.tsx`
- Create: `frontend/src/components/DownloadButton.tsx`
- Create: `frontend/src/components/DeleteButton.tsx`
- Create: `frontend/src/components/VideoDetail.tsx`

- [ ] **Step 1: Create DownloadButton component**

Create `frontend/src/components/DownloadButton.tsx`:

```tsx
"use client";

interface DownloadButtonProps {
  videoId: string;
}

export default function DownloadButton({ videoId }: DownloadButtonProps) {
  const handleDownload = () => {
    window.location.href = `/api/videos/${videoId}/download`;
  };

  return (
    <button
      onClick={handleDownload}
      className="text-sm text-zinc-400 hover:text-zinc-50 border border-zinc-800
                 px-4 py-1.5 rounded-lg hover:border-zinc-700
                 active:scale-[0.98] transition-all duration-200"
    >
      Download .md
    </button>
  );
}
```

- [ ] **Step 2: Create DeleteButton component**

Create `frontend/src/components/DeleteButton.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteButtonProps {
  videoId: string;
}

export default function DeleteButton({ videoId }: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    await fetch(`/api/videos/${videoId}`, { method: "DELETE" });
    router.push("/");
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-400">Delete this video?</span>
        <button
          onClick={handleDelete}
          className="text-sm text-red-400 border border-red-400/30 px-3 py-1 rounded-lg
                     hover:bg-red-400/10 active:scale-[0.98] transition-all duration-200"
        >
          Yes, delete
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-sm text-zinc-500 hover:text-zinc-300 px-3 py-1
                     transition-colors duration-200"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm text-zinc-600 hover:text-red-400 px-4 py-1.5 rounded-lg
                 active:scale-[0.98] transition-all duration-200"
    >
      Delete
    </button>
  );
}
```

- [ ] **Step 3: Create VideoDetail component**

Create `frontend/src/components/VideoDetail.tsx`:

```tsx
import DownloadButton from "./DownloadButton";
import DeleteButton from "./DeleteButton";

interface VideoDetailProps {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
  scraped_at: string;
  transcript: string;
}

export default function VideoDetail({
  id,
  title,
  channel,
  upload_date,
  scraped_at,
  transcript,
}: VideoDetailProps) {
  return (
    <article>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter leading-none text-zinc-50">
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <span className="text-sm text-zinc-400">{channel}</span>
          {upload_date && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-xs font-mono text-zinc-500">{upload_date}</span>
            </>
          )}
          <span className="text-zinc-700">·</span>
          <span className="text-xs font-mono text-zinc-600">
            Scraped {scraped_at.split("T")[0]}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-5">
          <DownloadButton videoId={id} />
          <DeleteButton videoId={id} />
        </div>
      </header>

      <div className="border-t border-zinc-800 pt-8">
        <p className="text-base text-zinc-400 leading-relaxed max-w-[65ch]">
          {transcript}
        </p>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Create video detail page**

Create `frontend/src/app/video/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getVideoById } from "@/lib/db";
import VideoDetail from "@/components/VideoDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VideoPage({ params }: PageProps) {
  const { id } = await params;
  const video = getVideoById(id);

  if (!video) {
    notFound();
  }

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-4">
      <div className="py-4">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-200"
        >
          &larr; Back to library
        </Link>
      </div>
      <VideoDetail
        id={video.id}
        title={video.title}
        channel={video.channel}
        upload_date={video.upload_date}
        scraped_at={video.scraped_at}
        transcript={video.transcript}
      />
    </main>
  );
}
```

- [ ] **Step 5: Verify it compiles**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/video/ frontend/src/components/DownloadButton.tsx frontend/src/components/DeleteButton.tsx frontend/src/components/VideoDetail.tsx
git commit -m "feat: add video detail page with download and delete"
```

---

### Task 13: End-to-End Manual Smoke Test

**Files:** None — testing only.

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/nunoduarte/Desktop/scripts/frontend && npm run dev
```

- [ ] **Step 2: Test the empty state**

Open `http://localhost:3000`. Verify:
- Dark background (#09090B)
- Navbar shows "Scrape" with red dot, "0 videos", "+ Add" button
- Search bar visible
- Empty state message: "No videos yet. Add a YouTube URL to start building your library."

- [ ] **Step 3: Test adding a video**

Click "+ Add". In the modal:
- Paste a real YouTube URL (pick any video with a transcript)
- Click "Scrape"
- Verify loading state appears ("Scraping..." on button)
- After completion: modal closes, card appears in grid
- Navbar count updates to "1 video"

- [ ] **Step 4: Test the detail page**

Click the video card. Verify:
- Back arrow link works
- Title, channel, dates display correctly
- Transcript is readable with comfortable line length
- "Download .md" button downloads a file
- "Delete" button shows confirmation, then deletes and redirects to library

- [ ] **Step 5: Test search**

Add a second video. Type part of a video title in the search bar. Verify:
- Grid filters after ~300ms debounce
- Clearing search shows all videos

- [ ] **Step 6: Test batch mode**

Click "+ Add", toggle "Batch mode". Paste two URLs (one per line). Click "Scrape". Verify both videos appear in the grid.

- [ ] **Step 7: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address issues found during smoke test"
```

Only commit if fixes were made. Skip if everything works.
