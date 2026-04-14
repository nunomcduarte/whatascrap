import { NextRequest, NextResponse } from "next/server";
import { getVideoById } from "@/lib/db";
import { renderVideoMarkdown, videoFilename } from "@/lib/markdown";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const video = getVideoById(id);
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return new NextResponse(renderVideoMarkdown(video), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${videoFilename(video)}"`,
    },
  });
}
