# YouTube Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python CLI script that extracts video title, channel name, and transcript from YouTube URLs and saves each as a Markdown file.

**Architecture:** Single-file CLI script using `yt-dlp` for metadata and `youtube-transcript-api` for transcripts. Each URL is processed sequentially — extract video ID, fetch metadata, fetch transcript, write Markdown. Fail-fast on any error.

**Tech Stack:** Python 3, yt-dlp, youtube-transcript-api, pytest

---

## File Structure

```
scrape.py          # CLI entry point and all logic
requirements.txt   # Dependencies
tests/
  test_scrape.py   # All tests
```

---

### Task 1: Project setup and dependencies

**Files:**
- Create: `requirements.txt`

- [ ] **Step 1: Create requirements.txt**

```
yt-dlp
youtube-transcript-api
pytest
```

- [ ] **Step 2: Install dependencies**

Run: `pip install -r requirements.txt`
Expected: All packages install successfully.

- [ ] **Step 3: Commit**

```bash
git add requirements.txt
git commit -m "feat: add requirements.txt with dependencies"
```

---

### Task 2: Video ID extraction

**Files:**
- Create: `tests/test_scrape.py`
- Create: `scrape.py`

- [ ] **Step 1: Write failing tests for video ID extraction**

Create `tests/test_scrape.py`:

```python
from scrape import extract_video_id


def test_extract_video_id_standard_url():
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert extract_video_id(url) == "dQw4w9WgXcQ"


def test_extract_video_id_short_url():
    url = "https://youtu.be/dQw4w9WgXcQ"
    assert extract_video_id(url) == "dQw4w9WgXcQ"


def test_extract_video_id_with_extra_params():
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120"
    assert extract_video_id(url) == "dQw4w9WgXcQ"


def test_extract_video_id_invalid_url():
    import pytest
    with pytest.raises(SystemExit):
        extract_video_id("https://example.com/not-a-video")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_scrape.py -v`
Expected: FAIL — `scrape` module does not exist yet.

- [ ] **Step 3: Implement extract_video_id**

Create `scrape.py`:

```python
import sys
import re
from urllib.parse import urlparse, parse_qs


def extract_video_id(url):
    """Extract YouTube video ID from a URL. Exits with code 1 on failure."""
    parsed = urlparse(url)

    if parsed.hostname in ("www.youtube.com", "youtube.com"):
        video_id = parse_qs(parsed.query).get("v", [None])[0]
    elif parsed.hostname == "youtu.be":
        video_id = parsed.path.lstrip("/")
    else:
        print(f"Error: not a YouTube URL: {url}", file=sys.stderr)
        sys.exit(1)

    if not video_id or not re.match(r"^[a-zA-Z0-9_-]{11}$", video_id):
        print(f"Error: could not extract video ID from: {url}", file=sys.stderr)
        sys.exit(1)

    return video_id
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_scrape.py -v`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scrape.py tests/test_scrape.py
git commit -m "feat: add video ID extraction from YouTube URLs"
```

---

### Task 3: Metadata fetching (title + channel)

**Files:**
- Modify: `tests/test_scrape.py`
- Modify: `scrape.py`

- [ ] **Step 1: Write failing test for metadata fetching**

Append to `tests/test_scrape.py`:

```python
from unittest.mock import patch
from scrape import fetch_metadata


def test_fetch_metadata_returns_title_and_channel():
    fake_info = {"title": "Test Video", "channel": "Test Channel"}
    with patch("scrape.yt_dlp.YoutubeDL") as mock_ydl_class:
        mock_ydl = mock_ydl_class.return_value.__enter__.return_value
        mock_ydl.extract_info.return_value = fake_info
        title, channel = fetch_metadata("dQw4w9WgXcQ")
    assert title == "Test Video"
    assert channel == "Test Channel"


def test_fetch_metadata_failure_exits():
    import pytest
    with patch("scrape.yt_dlp.YoutubeDL") as mock_ydl_class:
        mock_ydl = mock_ydl_class.return_value.__enter__.return_value
        mock_ydl.extract_info.side_effect = Exception("Video not found")
        with pytest.raises(SystemExit):
            fetch_metadata("invalid_id_xx")
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `pytest tests/test_scrape.py::test_fetch_metadata_returns_title_and_channel -v`
Expected: FAIL — `fetch_metadata` not defined.

- [ ] **Step 3: Implement fetch_metadata**

Add to `scrape.py`:

```python
import yt_dlp


def fetch_metadata(video_id):
    """Fetch video title and channel name. Exits with code 1 on failure."""
    ydl_opts = {"quiet": True, "no_warnings": True, "skip_download": True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(
                f"https://www.youtube.com/watch?v={video_id}", download=False
            )
            return info["title"], info["channel"]
    except Exception as e:
        print(f"Error fetching metadata for {video_id}: {e}", file=sys.stderr)
        sys.exit(1)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_scrape.py -v`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scrape.py tests/test_scrape.py
git commit -m "feat: add metadata fetching via yt-dlp"
```

---

### Task 4: Transcript fetching

**Files:**
- Modify: `tests/test_scrape.py`
- Modify: `scrape.py`

- [ ] **Step 1: Write failing test for transcript fetching**

Append to `tests/test_scrape.py`:

```python
from scrape import fetch_transcript


def test_fetch_transcript_returns_joined_text():
    fake_segments = [
        {"text": "Hello everyone."},
        {"text": "Welcome to the video."},
        {"text": "Today we talk about Python."},
    ]
    with patch("scrape.YouTubeTranscriptApi.get_transcript") as mock_get:
        mock_get.return_value = fake_segments
        result = fetch_transcript("dQw4w9WgXcQ")
    assert result == "Hello everyone. Welcome to the video. Today we talk about Python."


def test_fetch_transcript_failure_exits():
    import pytest
    with patch("scrape.YouTubeTranscriptApi.get_transcript") as mock_get:
        mock_get.side_effect = Exception("No transcript available")
        with pytest.raises(SystemExit):
            fetch_transcript("dQw4w9WgXcQ")
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `pytest tests/test_scrape.py::test_fetch_transcript_returns_joined_text -v`
Expected: FAIL — `fetch_transcript` not defined.

- [ ] **Step 3: Implement fetch_transcript**

Add to `scrape.py`:

```python
from youtube_transcript_api import YouTubeTranscriptApi


def fetch_transcript(video_id):
    """Fetch and join transcript segments. Exits with code 1 on failure."""
    try:
        segments = YouTubeTranscriptApi.get_transcript(video_id)
        return " ".join(segment["text"] for segment in segments)
    except Exception as e:
        print(f"Error fetching transcript for {video_id}: {e}", file=sys.stderr)
        sys.exit(1)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_scrape.py -v`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scrape.py tests/test_scrape.py
git commit -m "feat: add transcript fetching via youtube-transcript-api"
```

---

### Task 5: Markdown file writing

**Files:**
- Modify: `tests/test_scrape.py`
- Modify: `scrape.py`

- [ ] **Step 1: Write failing test for Markdown output**

Append to `tests/test_scrape.py`:

```python
import os
from scrape import write_markdown


def test_write_markdown_creates_file(tmp_path):
    write_markdown(
        video_id="abc123xyz00",
        title="My Video Title",
        channel="My Channel",
        transcript="This is the transcript text.",
        output_dir=str(tmp_path),
    )
    output_file = tmp_path / "abc123xyz00.md"
    assert output_file.exists()
    content = output_file.read_text()
    assert content == (
        "# My Video Title\n"
        "\n"
        "**Channel:** My Channel\n"
        "\n"
        "## Transcript\n"
        "\n"
        "This is the transcript text.\n"
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_scrape.py::test_write_markdown_creates_file -v`
Expected: FAIL — `write_markdown` not defined.

- [ ] **Step 3: Implement write_markdown**

Add to `scrape.py`:

```python
import os


def write_markdown(video_id, title, channel, transcript, output_dir="."):
    """Write video data as a Markdown file."""
    content = (
        f"# {title}\n"
        f"\n"
        f"**Channel:** {channel}\n"
        f"\n"
        f"## Transcript\n"
        f"\n"
        f"{transcript}\n"
    )
    filepath = os.path.join(output_dir, f"{video_id}.md")
    with open(filepath, "w") as f:
        f.write(content)
    return filepath
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_scrape.py -v`
Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scrape.py tests/test_scrape.py
git commit -m "feat: add Markdown file writing"
```

---

### Task 6: CLI entry point (main)

**Files:**
- Modify: `tests/test_scrape.py`
- Modify: `scrape.py`

- [ ] **Step 1: Write failing test for main**

Append to `tests/test_scrape.py`:

```python
from scrape import main


def test_main_processes_url(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with (
        patch("scrape.fetch_metadata", return_value=("Test Title", "Test Channel")),
        patch("scrape.fetch_transcript", return_value="Hello world."),
    ):
        main(["https://www.youtube.com/watch?v=dQw4w9WgXcQ"])
    output_file = tmp_path / "dQw4w9WgXcQ.md"
    assert output_file.exists()
    content = output_file.read_text()
    assert "# Test Title" in content
    assert "**Channel:** Test Channel" in content
    assert "Hello world." in content


def test_main_no_args_exits():
    import pytest
    with pytest.raises(SystemExit):
        main([])
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `pytest tests/test_scrape.py::test_main_processes_url -v`
Expected: FAIL — `main` not defined.

- [ ] **Step 3: Implement main**

Add to `scrape.py`:

```python
def main(args=None):
    """Process YouTube URLs and save as Markdown files."""
    if args is None:
        args = sys.argv[1:]

    if not args:
        print("Usage: python scrape.py URL [URL ...]", file=sys.stderr)
        sys.exit(1)

    for url in args:
        video_id = extract_video_id(url)
        title, channel = fetch_metadata(video_id)
        transcript = fetch_transcript(video_id)
        filepath = write_markdown(video_id, title, channel, transcript)
        print(f"Saved: {os.path.basename(filepath)}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_scrape.py -v`
Expected: All 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scrape.py tests/test_scrape.py
git commit -m "feat: add CLI entry point for YouTube scraper"
```

---

### Task 7: Manual end-to-end test

**Files:** None (verification only)

- [ ] **Step 1: Run the script against a real YouTube video**

Run: `python scrape.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ"`
Expected: Prints `Saved: dQw4w9WgXcQ.md` and creates the file.

- [ ] **Step 2: Verify the output file**

Run: `cat dQw4w9WgXcQ.md`
Expected: Markdown file with title, channel name, and transcript text.

- [ ] **Step 3: Test with multiple URLs**

Run: `python scrape.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ" "https://youtu.be/jNQXAC9IVRw"`
Expected: Two `.md` files created, both confirmed on stdout.

- [ ] **Step 4: Test error case — invalid URL**

Run: `python scrape.py "https://example.com/nope"`
Expected: Error message to stderr, exit code 1.

- [ ] **Step 5: Clean up test files and commit**

```bash
rm -f dQw4w9WgXcQ.md jNQXAC9IVRw.md
git add -A
git commit -m "feat: YouTube scraper complete"
```
