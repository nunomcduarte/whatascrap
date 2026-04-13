from scrape import extract_video_id


def test_extract_video_id_standard_url():
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    assert extract_video_id(url) == "dQw4w9WgXcQ"


def test_extract_video_id_short_url():
    url = "https://youtu.be/dQw4w9WgXcQ"
    assert extract_video_id(url) == "dQw4w9WgXcQ"


def test_extract_video_id_with_extra_params():
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&amp;t=120"
    assert extract_video_id(url) == "dQw4w9WgXcQ"


def test_extract_video_id_invalid_url():
    import pytest
    with pytest.raises(SystemExit):
        extract_video_id("https://example.com/not-a-video")


from unittest.mock import patch
from scrape import fetch_metadata


def test_fetch_metadata_returns_title_and_channel():
    fake_info = {"title": "Test Video", "channel": "Test Channel", "upload_date": "20250615"}
    with patch("scrape.yt_dlp.YoutubeDL") as mock_ydl_class:
        mock_ydl = mock_ydl_class.return_value.__enter__.return_value
        mock_ydl.extract_info.return_value = fake_info
        title, channel, upload_date = fetch_metadata("dQw4w9WgXcQ")
    assert title == "Test Video"
    assert channel == "Test Channel"
    assert upload_date == "2025-06-15"


def test_fetch_metadata_failure_exits():
    import pytest
    with patch("scrape.yt_dlp.YoutubeDL") as mock_ydl_class:
        mock_ydl = mock_ydl_class.return_value.__enter__.return_value
        mock_ydl.extract_info.side_effect = Exception("Video not found")
        with pytest.raises(SystemExit):
            fetch_metadata("invalid_id_xx")


from scrape import fetch_transcript


def test_fetch_transcript_returns_joined_text():
    from types import SimpleNamespace
    fake_segments = [
        SimpleNamespace(text="Hello everyone."),
        SimpleNamespace(text="Welcome to the video."),
        SimpleNamespace(text="Today we talk about Python."),
    ]
    with patch("scrape.YouTubeTranscriptApi.fetch") as mock_fetch:
        mock_fetch.return_value = fake_segments
        result = fetch_transcript("dQw4w9WgXcQ")
    assert result == "Hello everyone. Welcome to the video. Today we talk about Python."


def test_fetch_transcript_failure_exits():
    import pytest
    with patch("scrape.YouTubeTranscriptApi.fetch") as mock_fetch:
        mock_fetch.side_effect = Exception("No transcript available")
        with pytest.raises(SystemExit):
            fetch_transcript("dQw4w9WgXcQ")


import os
from scrape import write_markdown


def test_write_markdown_creates_file(tmp_path):
    from datetime import date

    write_markdown(
        video_id="abc123xyz00",
        title="My Video Title",
        channel="My Channel",
        transcript="This is the transcript text.",
        upload_date="2025-06-15",
        output_dir=str(tmp_path),
    )
    output_file = tmp_path / "abc123xyz00.md"
    assert output_file.exists()
    content = output_file.read_text()
    assert content == (
        "# My Video Title\n"
        "\n"
        "**Channel:** My Channel\n"
        "**Upload Date:** 2025-06-15\n"
        f"**Scraped Date:** {date.today().isoformat()}\n"
        "\n"
        "## Transcript\n"
        "\n"
        "This is the transcript text.\n"
    )


from scrape import main


def test_main_processes_url(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    with (
        patch("scrape.fetch_metadata", return_value=("Test Title", "Test Channel", "2025-06-15")),
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
