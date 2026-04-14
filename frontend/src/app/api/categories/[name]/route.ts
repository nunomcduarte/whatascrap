import { NextRequest, NextResponse } from "next/server";
import {
  deleteCategory,
  renameCategory,
  setCategoryColor,
  isFolderColor,
} from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  deleteCategory(decoded);
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);

  let body: { name?: string; color?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let nextName = decoded;

  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Folder name required" }, { status: 400 });
    }
    if (trimmed.length > 64) {
      return NextResponse.json({ error: "Folder name too long" }, { status: 400 });
    }
    const result = renameCategory(decoded, trimmed);
    if (!result.ok) {
      if (result.reason === "exists") {
        return NextResponse.json({ error: "A folder with that name already exists" }, { status: 409 });
      }
      if (result.reason === "missing") {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
    }
    nextName = trimmed;
  }

  if (body.color !== undefined) {
    const color = body.color === null ? null : isFolderColor(body.color) ? body.color : null;
    setCategoryColor(nextName, color);
  }

  return NextResponse.json({ ok: true, name: nextName });
}
