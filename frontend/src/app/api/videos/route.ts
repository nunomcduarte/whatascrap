import { NextRequest, NextResponse } from "next/server";
import { listVideos, countVideos } from "@/lib/db";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || undefined;
  const videos = listVideos(query);
  const total = countVideos();
  return NextResponse.json({ videos, total });
}
