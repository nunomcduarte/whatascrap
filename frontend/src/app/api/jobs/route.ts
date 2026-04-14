import { NextRequest, NextResponse } from "next/server";
import { createJob, listJobs, type JobStatus } from "@/lib/jobs";
import {
  expandPlaylist,
  extractPlaylistId,
  extractVideoId,
} from "@/lib/scraper";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const jobs = listJobs({ status: (status || undefined) as JobStatus | "active" | undefined });
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  let body: { url?: string; urls?: string[]; category?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const category =
    typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : null;

  // Multi-URL batch: no playlist expansion, just enqueue each as a single item.
  if (Array.isArray(body.urls) && body.urls.length > 0) {
    const items = body.urls
      .map((u) => u.trim())
      .filter(Boolean)
      .map((url) => ({ url, video_id: extractVideoId(url) }));
    if (items.length === 0) {
      return NextResponse.json({ error: "No valid URLs" }, { status: 400 });
    }
    const job = createJob({
      type: items.length === 1 ? "single" : "batch",
      category,
      items,
      title: items.length === 1 ? null : `Batch (${items.length})`,
    });
    return NextResponse.json({ jobId: job.id, job });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json(
      { error: "url or urls is required" },
      { status: 400 }
    );
  }

  const playlistId = extractPlaylistId(url);

  if (playlistId) {
    try {
      const info = await expandPlaylist(url);
      if (info.entries.length === 0) {
        return NextResponse.json(
          { error: "Playlist is empty or unavailable" },
          { status: 400 }
        );
      }
      const job = createJob({
        type: "playlist",
        source_url: url,
        title: info.title,
        category,
        items: info.entries.map((e) => ({
          url: e.url,
          video_id: e.id,
          title: e.title,
        })),
      });
      return NextResponse.json({ jobId: job.id, job });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { error: `Failed to expand playlist: ${msg}` },
        { status: 400 }
      );
    }
  }

  if (!extractVideoId(url)) {
    return NextResponse.json(
      { error: "Not a recognized YouTube video or playlist URL" },
      { status: 400 }
    );
  }

  const job = createJob({
    type: "single",
    source_url: url,
    category,
    items: [{ url, video_id: extractVideoId(url) }],
  });
  return NextResponse.json({ jobId: job.id, job });
}
