import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}

interface IngestPayload {
  videoId: string;
  title: string;
  channel: string;
  author?: string;
  lengthSeconds?: number;
  thumbnailUrl?: string | null;
  uploadDate?: string | null;
  url: string;
  transcript: TranscriptSegment[];
}

function corsHeaders(origin: string | null): Record<string, string> {
  // Allow the dev web app and any chrome extension installed from this user.
  const allowed =
    origin?.startsWith("chrome-extension://") || origin === "http://localhost:3000"
      ? origin
      : "http://localhost:3000";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: NextRequest) {
  const cors = corsHeaders(request.headers.get("origin"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: cors });
  }

  const body = (await request.json().catch(() => null)) as IngestPayload | null;
  if (
    !body?.videoId ||
    !body?.title ||
    !body?.url ||
    !Array.isArray(body?.transcript) ||
    body.transcript.length === 0
  ) {
    return NextResponse.json(
      { error: "invalid payload" },
      { status: 400, headers: cors },
    );
  }

  // Idempotent: skip if user already saved this YouTube id.
  const { data: existing } = await supabase
    .from("videos")
    .select("youtube_id")
    .eq("youtube_id", body.videoId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, alreadySaved: true }, { headers: cors });
  }

  const transcriptText = body.transcript
    .map((s) => `[${formatTime(s.startMs)}] ${s.text}`)
    .join("\n");

  const { error } = await supabase.from("videos").insert({
    user_id: user.id,
    youtube_id: body.videoId,
    title: body.title,
    channel: body.channel || "Unknown",
    upload_date: body.uploadDate || null,
    url: body.url,
    transcript: transcriptText,
  });

  if (error) {
    console.error("ingest insert failed", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: cors },
    );
  }

  return NextResponse.json({ ok: true, alreadySaved: false }, { headers: cors });
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
