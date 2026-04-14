import { NextRequest, NextResponse } from "next/server";
import { deleteVideos } from "@/lib/db";

const MAX_IDS = 1000;

export async function POST(request: NextRequest) {
  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? (body.ids.filter((v) => typeof v === "string") as string[])
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty string array" }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `too many ids (max ${MAX_IDS})` }, { status: 400 });
  }

  const affected = deleteVideos(ids);
  return NextResponse.json({ ok: true, affected });
}
