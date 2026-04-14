import { NextRequest, NextResponse } from "next/server";
import { retryFailedItems } from "@/lib/jobs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requeued = retryFailedItems(id);
  return NextResponse.json({ ok: true, requeued });
}
