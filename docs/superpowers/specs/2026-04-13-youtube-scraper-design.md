# YouTube Scraper — Design Spec

## Overview

A Python CLI script that extracts video title, channel name, and transcript from one or more YouTube URLs, outputting each as a Markdown file.

## Usage

```bash
python scrape.py URL1 URL2 URL3
```

- Each URL produces a file named `{video_id}.md` in the current directory.
- Stdout confirms each saved file: `Saved: {video_id}.md`
- On any failure (bad URL, missing transcript), prints error to stderr and exits with code 1 immediately. No partial processing of remaining URLs.

## Output Format

Each `.md` file:

```markdown
# Video Title Here

**Channel:** Channel Name Here

## Transcript

Full transcript text, joined into flowing paragraphs. Timestamps stripped.
```

Transcript segments are joined into clean readable text. Per-segment line breaks from the API are collapsed into paragraphs based on natural pauses.

## Dependencies

- `yt-dlp` — metadata extraction (title, channel). Metadata-only call, no video download.
- `youtube-transcript-api` — transcript fetching. Tries manual captions first, then auto-generated.

Listed in `requirements.txt`.

## File Structure

```
scrape.py
requirements.txt
```

Single script, no modules, no config.

## Processing Flow (per URL)

1. Extract video ID from the URL.
2. Call yt-dlp to fetch title and channel name (metadata only).
3. Call youtube-transcript-api to fetch transcript.
4. If transcript fetch fails → print error to stderr, exit with code 1.
5. Join transcript segments into clean paragraphs, strip timestamps.
6. Write Markdown file to current directory as `{video_id}.md`.

## Error Handling

- Invalid URL or video not found → error to stderr, exit 1.
- Transcript unavailable (no manual or auto-generated captions) → error to stderr, exit 1.
- Fail fast: no partial results, no continuing past errors.

## Non-Goals

- No GUI or web interface.
- No JSON or other output formats.
- No playlist support (individual video URLs only).
- No video/audio downloading.
