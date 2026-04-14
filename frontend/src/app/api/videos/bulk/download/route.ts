import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getVideosByIds } from "@/lib/db";
import { renderVideoMarkdown, videoFilename } from "@/lib/markdown";

const MAX_IDS = 1000;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ error: "ids query param required" }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `too many ids (max ${MAX_IDS})` }, { status: 400 });
  }

  const videos = getVideosByIds(ids);
  if (videos.length === 0) {
    return NextResponse.json({ error: "No videos found" }, { status: 404 });
  }

  const zip = new JSZip();
  const used = new Map<string, number>();
  for (const v of videos) {
    const base = videoFilename(v);
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    const name = n === 0 ? base : base.replace(/\.md$/, `-${n + 1}.md`);
    zip.file(name, renderVideoMarkdown(v));
  }

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `transcripts-${new Date().toISOString().slice(0, 10)}.zip`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buf.length),
    },
  });
}
