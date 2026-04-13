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
