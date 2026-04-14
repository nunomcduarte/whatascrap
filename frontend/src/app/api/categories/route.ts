import { NextRequest, NextResponse } from "next/server";
import {
  listCategories,
  createCategory,
  countUncategorized,
  countVideos,
  isFolderColor,
} from "@/lib/db";

export async function GET() {
  const categories = listCategories();
  const uncategorized = countUncategorized();
  const total = countVideos();
  return NextResponse.json({ categories, uncategorized, total });
}

export async function POST(request: NextRequest) {
  let body: { name?: string; parent?: string | null; color?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Folder name required" }, { status: 400 });
  }
  if (name.length > 64) {
    return NextResponse.json({ error: "Folder name too long" }, { status: 400 });
  }

  const parent = body.parent?.trim() || null;
  const color = body.color && isFolderColor(body.color) ? body.color : null;

  const created = createCategory(name, parent, color);
  if (!created) {
    return NextResponse.json(
      { error: parent ? "Parent folder not found or name already exists" : "Folder already exists" },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, name, parent, color }, { status: 201 });
}
