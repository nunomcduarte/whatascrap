import { NextRequest, NextResponse } from "next/server";
import { getVideoById, deleteVideo, setVideoCategory } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const video = getVideoById(id);
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }
  return NextResponse.json(video);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteVideo(id);
  if (!deleted) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { category?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const category = body.category === undefined ? null : body.category;
  const normalized = typeof category === "string" ? category.trim() || null : null;

  const ok = setVideoCategory(id, normalized);
  if (!ok) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, category: normalized });
}
