import os
import sys
import re
from urllib.parse import urlparse, parse_qs
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi


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
    ydl_opts = {"quiet": True, "no_warnings": True, "skip_download": True}
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


def fetch_transcript(video_id):
    """Fetch and join transcript segments. Exits with code 1 on failure."""
    try:
        transcript = YouTubeTranscriptApi().fetch(video_id)
        return " ".join(snippet.text for snippet in transcript)
    except Exception as e:
        print(f"Error fetching transcript for {video_id}: {e}", file=sys.stderr)
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
