import { NextRequest, NextResponse } from "next/server";
import { listVideos, countVideos } from "@/lib/db";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const query = sp.get("q") || undefined;
  const category = sp.get("category") || undefined;
  const uncategorized = sp.get("uncategorized") === "1";
  const videos = listVideos({ query, category, uncategorized });
  const total = countVideos();
  return NextResponse.json({ videos, total });
}
