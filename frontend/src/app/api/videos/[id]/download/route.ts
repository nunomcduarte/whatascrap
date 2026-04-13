import { NextRequest, NextResponse } from "next/server";
import { getVideoById } from "@/lib/db";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const video = getVideoById(id);
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const markdown = `# ${video.title}

**Channel:** ${video.channel}
**Upload Date:** ${video.upload_date || "Unknown"}
**Scraped Date:** ${video.scraped_at.split("T")[0]}

## Transcript

${video.transcript}
`;

  const filename = `${slugify(video.channel)}-${slugify(video.title)}.md`;

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
