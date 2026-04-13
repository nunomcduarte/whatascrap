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
