import { NextRequest, NextResponse } from "next/server";
import { cancelJob } from "@/lib/jobs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = cancelJob(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Job not found or already finished" },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
