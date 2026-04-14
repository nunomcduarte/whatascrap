import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);
const SCRAPER_PATH = path.join(process.cwd(), "..", "scrape.py");
const PYTHON = process.env.PYTHON_BIN || "python3";

export interface PlaylistEntry {
  id: string;
  url: string;
  title: string;
}

export interface PlaylistInfo {
  title: string;
  entries: PlaylistEntry[];
}

export interface ScrapedVideo {
  title: string;
  channel: string;
  upload_date: string;
  transcript: string;
}

export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "youtube.com" ||
      parsed.hostname === "m.youtube.com"
    ) {
      return parsed.searchParams.get("v");
    }
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }
  } catch {
    return null;
  }
  return null;
}

export function extractPlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "youtube.com" ||
      parsed.hostname === "m.youtube.com"
    ) {
      return parsed.searchParams.get("list");
    }
  } catch {
    return null;
  }
  return null;
}

export async function expandPlaylist(url: string): Promise<PlaylistInfo> {
  const { stdout } = await execFileAsync(
    PYTHON,
    [SCRAPER_PATH, "--playlist-ids", url],
    { timeout: 120_000, maxBuffer: 32 * 1024 * 1024 }
  );
  return JSON.parse(stdout.trim()) as PlaylistInfo;
}

export async function scrapeVideo(url: string): Promise<ScrapedVideo> {
  const { stdout } = await execFileAsync(
    PYTHON,
    [SCRAPER_PATH, "--json", url],
    { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 }
  );
  return JSON.parse(stdout.trim()) as ScrapedVideo;
}
