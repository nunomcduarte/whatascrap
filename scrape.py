import json
import os
import re
import sys
import urllib.request
from urllib.parse import urlparse, parse_qs

import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi

MODERN_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
SUB_LANGS_PRIORITY = ["en", "en-US", "en-GB", "en-CA", "en-AU"]

# Exceptions (from youtube_transcript_api) that mean "no transcript exists".
# We should NOT fall back to yt-dlp for these — the video genuinely has none.
_PERMANENT_ERROR_NAMES = {
    "TranscriptsDisabled",
    "NoTranscriptFound",
    "VideoUnavailable",
    "VideoUnplayable",
    "AgeRestricted",
    "InvalidVideoId",
}


def _cookie_opts():
    """Return yt-dlp cookie-related options built from env vars, or {}."""
    browser = os.environ.get("YT_COOKIES_FROM_BROWSER")
    cookie_file = os.environ.get("YT_COOKIES_FILE")
    if browser:
        return {"cookiesfrombrowser": (browser,)}
    if cookie_file:
        return {"cookiefile": cookie_file}
    return {}


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


def fetch_metadata(video_id):
    """Fetch video title, channel name, and upload date. Exits with code 1 on failure."""
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "http_headers": {"User-Agent": MODERN_UA},
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(
                f"https://www.youtube.com/watch?v={video_id}", download=False
            )
            upload_date = info.get("upload_date", "")
            if upload_date:
                upload_date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:]}"
            return info["title"], info["channel"], upload_date
    except Exception as e:
        print(f"Error fetching metadata for {video_id}: {e}", file=sys.stderr)
        sys.exit(1)


def _parse_json3(data):
    """Parse YouTube's json3 subtitle format into plain text."""
    try:
        obj = json.loads(data) if isinstance(data, (str, bytes)) else data
    except Exception:
        return ""
    parts = []
    for ev in obj.get("events") or []:
        for seg in ev.get("segs") or []:
            t = seg.get("utf8")
            if t:
                parts.append(t)
    text = "".join(parts).replace("\n", " ")
    return re.sub(r"\s+", " ", text).strip()


def _parse_vtt(data):
    """Parse a WebVTT subtitle file into plain text."""
    if isinstance(data, bytes):
        data = data.decode("utf-8", errors="replace")
    lines = []
    for raw in data.splitlines():
        s = raw.strip()
        if not s:
            continue
        if s.startswith(("WEBVTT", "NOTE", "Kind:", "Language:", "X-TIMESTAMP-MAP")):
            continue
        if "-->" in s:
            continue
        if re.match(r"^\d+$", s):
            continue
        s = re.sub(r"<[^>]+>", "", s)  # strip timestamp/markup tags
        s = re.sub(r"&nbsp;", " ", s)
        lines.append(s)
    return re.sub(r"\s+", " ", " ".join(lines)).strip()


def _parse_srv_xml(data):
    """Parse srv1/srv2/srv3 XML captions into plain text (best effort)."""
    if isinstance(data, bytes):
        data = data.decode("utf-8", errors="replace")
    text = re.sub(r"<[^>]+>", " ", data)
    return re.sub(r"\s+", " ", text).strip()


def _fetch_url(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": MODERN_UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _pick_subs(tracks):
    """Return (lang, items) for the best matching language track, or None."""
    if not tracks:
        return None
    for lang in SUB_LANGS_PRIORITY:
        items = tracks.get(lang)
        if items:
            return lang, items
    for lang, items in tracks.items():
        if lang.startswith("en") and items:
            return lang, items
    for lang, items in tracks.items():
        if items:
            return lang, items
    return None


def _best_format(items):
    """Prefer json3 > srv3 > srv2 > srv1 > vtt > ttml."""
    prio = {"json3": 0, "srv3": 1, "srv2": 2, "srv1": 3, "vtt": 4, "ttml": 5}
    return sorted(items, key=lambda x: prio.get(x.get("ext"), 99))[0]


def _fetch_subs_via_ytdlp(video_url):
    """Second-tier transcript fetch via yt-dlp subtitle extraction.
    Returns plain-text transcript, or None if no captions available."""
    ydl_opts = {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": ["en.*", "en", "a.en"],
        "quiet": True,
        "no_warnings": True,
        # Permissive format so cookie-gated streams don't fail selection.
        "format": "bestaudio/best/worst",
        "ignore_no_formats_error": True,
        "http_headers": {"User-Agent": MODERN_UA},
        **_cookie_opts(),
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)
    manual = info.get("subtitles") or {}
    auto = info.get("automatic_captions") or {}
    picked = _pick_subs(manual) or _pick_subs(auto)
    if not picked:
        return None
    _lang, items = picked
    best = _best_format(items)
    fmt = best.get("ext")
    sub_url = best.get("url")
    if not sub_url:
        return None
    raw = _fetch_url(sub_url)
    if fmt == "json3":
        return _parse_json3(raw)
    if fmt in ("vtt", "ttml"):
        return _parse_vtt(raw)
    return _parse_srv_xml(raw)


def _classify(exc):
    """Return a short, user-readable error message for a transcript exception."""
    name = type(exc).__name__
    if name in {"IpBlocked", "RequestBlocked", "YouTubeRequestFailed", "PoTokenRequired"}:
        return f"blocked: YouTube rate-limited this IP ({name})"
    if name == "TranscriptsDisabled":
        return "no_captions: transcripts disabled on this video"
    if name == "NoTranscriptFound":
        return "no_captions: no transcript available in any language"
    if name in {"VideoUnavailable", "VideoUnplayable"}:
        return "unavailable: video is not accessible"
    if name == "AgeRestricted":
        return "age_restricted: cookies required (set YT_COOKIES_FROM_BROWSER)"
    if name == "InvalidVideoId":
        return "invalid: video id is not valid"
    msg = str(exc) or name
    return f"{name}: {msg[:300]}"


def fetch_transcript(video_id):
    """Multi-tier transcript fetch:
      1) youtube-transcript-api (fast)
      2) yt-dlp subtitle extraction (slower, different endpoint, survives blocks)
    Exits with code 1 on total failure."""
    primary_exc = None
    try:
        segments = YouTubeTranscriptApi().fetch(video_id)
        text = " ".join(s.text for s in segments).strip()
        if text:
            return text
        primary_exc = RuntimeError("empty transcript from youtube-transcript-api")
    except Exception as e:
        if type(e).__name__ in _PERMANENT_ERROR_NAMES:
            print(f"Error fetching transcript for {video_id}: {_classify(e)}", file=sys.stderr)
            sys.exit(1)
        primary_exc = e

    # Tier 2: yt-dlp.
    ydlp_err = None
    try:
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        text = _fetch_subs_via_ytdlp(video_url)
        if text:
            return text
        ydlp_err = RuntimeError("no captions returned")
    except Exception as e:
        ydlp_err = e

    primary_msg = _classify(primary_exc) if primary_exc else "ok"
    ydlp_msg = _classify(ydlp_err) if ydlp_err else "ok"
    print(
        f"Error fetching transcript for {video_id}: "
        f"both sources failed — primary: {primary_msg}; ytdlp: {ydlp_msg}",
        file=sys.stderr,
    )
    sys.exit(1)


def slugify(text):
    """Convert text to a URL-friendly slug."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s]+", "-", text.strip())
    text = re.sub(r"-+", "-", text)
    return text


def write_markdown(video_id, title, channel, transcript, upload_date="", output_dir="."):
    """Write video data as a Markdown file."""
    from datetime import date

    scraped_date = date.today().isoformat()
    content = (
        f"# {title}\n"
        f"\n"
        f"**Channel:** {channel}\n"
        f"**Upload Date:** {upload_date}\n"
        f"**Scraped Date:** {scraped_date}\n"
        f"\n"
        f"## Transcript\n"
        f"\n"
        f"{transcript}\n"
    )
    filename = f"{slugify(channel)}-{slugify(title)}.md"
    filepath = os.path.join(output_dir, filename)
    with open(filepath, "w") as f:
        f.write(content)
    return filepath


def fetch_playlist_entries(url):
    """Return (playlist_title, [{id, url, title}, ...]) without downloading transcripts."""
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
        "http_headers": {"User-Agent": MODERN_UA},
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:
        print(f"Error expanding playlist {url}: {e}", file=sys.stderr)
        sys.exit(1)

    title = info.get("title") or "Playlist"
    entries = []
    for entry in info.get("entries") or []:
        if not entry:
            continue
        vid = entry.get("id")
        if not vid or not re.match(r"^[a-zA-Z0-9_-]{11}$", vid):
            continue
        entries.append({
            "id": vid,
            "url": f"https://www.youtube.com/watch?v={vid}",
            "title": entry.get("title") or "",
        })
    return title, entries


def main(args=None):
    """Process YouTube URLs and save as Markdown files."""
    import json as json_module

    if args is None:
        args = sys.argv[1:]

    if not args:
        print("Usage: python scrape.py [--json|--playlist-ids] URL [URL ...]", file=sys.stderr)
        sys.exit(1)

    if args[0] == "--playlist-ids":
        if len(args) != 2:
            print("Usage: python scrape.py --playlist-ids URL", file=sys.stderr)
            sys.exit(1)
        title, entries = fetch_playlist_entries(args[1])
        print(json_module.dumps({"title": title, "entries": entries}))
        return

    json_output = False
    if args[0] == "--json":
        json_output = True
        args = args[1:]

    if not args:
        print("Usage: python scrape.py [--json|--playlist-ids] URL [URL ...]", file=sys.stderr)
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


if __name__ == "__main__":
    main()
