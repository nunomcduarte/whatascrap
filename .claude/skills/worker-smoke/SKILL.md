---
name: worker-smoke
description: Enqueue a single video or playlist URL via /api/jobs and poll the worker until it lands a classified result. Use when verifying scrape.py / worker.ts changes against real YouTube state.
disable-model-invocation: true
---

# /worker-smoke `<url>`

Smoke-test the scraper → worker → SQLite path with a real URL. Requires `npm run dev:all` to be running in `frontend/`.

## Steps

1. Enqueue:
   ```bash
   curl -s -X POST http://localhost:3000/api/jobs \
     -H 'Content-Type: application/json' \
     -d "{\"url\":\"$URL\"}"
   ```
   Capture `jobId` from the response.
2. Poll until terminal:
   ```bash
   curl -s "http://localhost:3000/api/jobs/$JOB_ID"
   ```
   Stop when `status` is `completed`, `failed`, or `cancelled`.
3. If items failed, inspect their `error` strings — they should match the classified prefixes from `scrape.py`:
   `blocked:`, `no_captions:`, `unavailable:`, `age_restricted:`.
4. For completed items, sanity-check transcript content:
   ```bash
   curl -s http://localhost:3000/api/videos/$VIDEO_ID/download
   ```

## Reporting

Print a short summary: `jobId`, `total/completed/failed`, classified failure reasons (if any), and the first ~100 chars of one transcript.

## Recovery hints

- `blocked:` → suggest `YT_COOKIES_FROM_BROWSER=chrome` (or `firefox`/`safari`/`brave`) and a single retry. Do not lower `WORKER_MIN_DELAY_MS` to chase faster runs — see `CLAUDE.md`.
- `no_captions:` → expected for some videos; not a regression unless all items return it.
- `unavailable:` / `age_restricted:` → URL-specific, not a worker bug.
