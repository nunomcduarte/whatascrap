import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "scrape.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS videos (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        channel     TEXT NOT NULL,
        upload_date TEXT,
        transcript  TEXT NOT NULL,
        scraped_at  TEXT NOT NULL,
        url         TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories (
        name        TEXT PRIMARY KEY,
        created_at  TEXT NOT NULL
      );
    `);
    const vcols = db.prepare(`PRAGMA table_info(videos)`).all() as { name: string }[];
    if (!vcols.some((c) => c.name === "category")) {
      db.exec(`ALTER TABLE videos ADD COLUMN category TEXT`);
    }
    const ccols = db.prepare(`PRAGMA table_info(categories)`).all() as { name: string }[];
    if (!ccols.some((c) => c.name === "parent")) {
      db.exec(`ALTER TABLE categories ADD COLUMN parent TEXT`);
    }
    if (!ccols.some((c) => c.name === "color")) {
      db.exec(`ALTER TABLE categories ADD COLUMN color TEXT`);
    }
  }
  return db;
}

export interface Video {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
  transcript: string;
  scraped_at: string;
  url: string;
  category: string | null;
}

export {
  FOLDER_COLORS,
  isFolderColor,
  type Category,
  type FolderColor,
  type VideoSummary,
} from "./folders";

import type { Category, VideoSummary } from "./folders";

export function insertVideo(video: Omit<Video, "category"> & { category?: string | null }): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO videos (id, title, channel, upload_date, transcript, scraped_at, url, category)
    VALUES (@id, @title, @channel, @upload_date, @transcript, @scraped_at, @url, @category)
  `).run({ ...video, category: video.category ?? null });
}

export function getVideoById(id: string): Video | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM videos WHERE id = ?").get(id) as Video | undefined;
}

export interface ListVideosOptions {
  query?: string;
  category?: string;
  uncategorized?: boolean;
}

export function listVideos(opts: ListVideosOptions = {}): VideoSummary[] {
  const db = getDb();
  const wheres: string[] = [];
  const params: unknown[] = [];

  if (opts.query) {
    const pattern = `%${opts.query}%`;
    wheres.push("(title LIKE ? OR channel LIKE ? OR transcript LIKE ?)");
    params.push(pattern, pattern, pattern);
  }
  if (opts.uncategorized) {
    wheres.push("(category IS NULL OR category = '')");
  } else if (opts.category) {
    wheres.push("category = ?");
    params.push(opts.category);
  }

  const sql = `
    SELECT id, title, channel, upload_date, scraped_at, category
    FROM videos
    ${wheres.length ? `WHERE ${wheres.join(" AND ")}` : ""}
    ORDER BY scraped_at DESC
  `;
  return db.prepare(sql).all(...params) as VideoSummary[];
}

export function deleteVideo(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM videos WHERE id = ?").run(id);
  return result.changes > 0;
}

export function countVideos(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM videos").get() as { count: number };
  return row.count;
}

export function setVideoCategory(id: string, category: string | null): boolean {
  const db = getDb();
  const result = db.prepare("UPDATE videos SET category = ? WHERE id = ?").run(category, id);
  return result.changes > 0;
}

export function listCategories(): Category[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.name   AS name,
           c.parent AS parent,
           c.color  AS color,
           COALESCE(v.count, 0) AS count
    FROM categories c
    LEFT JOIN (
      SELECT category, COUNT(*) AS count
      FROM videos
      WHERE category IS NOT NULL AND category <> ''
      GROUP BY category
    ) v ON v.category = c.name
    ORDER BY c.created_at ASC
  `).all() as Category[];
  return rows;
}

export function getCategory(name: string): Category | undefined {
  const db = getDb();
  return db.prepare(`
    SELECT c.name AS name,
           c.parent AS parent,
           c.color  AS color,
           COALESCE(v.count, 0) AS count
    FROM categories c
    LEFT JOIN (
      SELECT category, COUNT(*) AS count
      FROM videos GROUP BY category
    ) v ON v.category = c.name
    WHERE c.name = ?
  `).get(name) as Category | undefined;
}

export function createCategory(
  name: string,
  parent: string | null = null,
  color: string | null = null
): boolean {
  const db = getDb();
  const trimmed = name.trim();
  if (!trimmed) return false;

  if (parent) {
    const parentRow = db.prepare("SELECT name FROM categories WHERE name = ?").get(parent);
    if (!parentRow) return false;
  }

  const result = db.prepare(
    "INSERT OR IGNORE INTO categories (name, parent, color, created_at) VALUES (?, ?, ?, ?)"
  ).run(trimmed, parent, color, new Date().toISOString());
  return result.changes > 0;
}

export function deleteCategory(name: string): boolean {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("UPDATE videos SET category = NULL WHERE category = ?").run(name);
    db.prepare("UPDATE categories SET parent = NULL WHERE parent = ?").run(name);
    db.prepare("DELETE FROM categories WHERE name = ?").run(name);
  });
  tx();
  return true;
}

export function renameCategory(oldName: string, newName: string): {
  ok: boolean;
  reason?: "missing" | "exists" | "invalid";
} {
  const db = getDb();
  const trimmed = newName.trim();
  if (!trimmed) return { ok: false, reason: "invalid" };
  if (trimmed === oldName) return { ok: true };

  const exists = db.prepare("SELECT name FROM categories WHERE name = ?").get(oldName);
  if (!exists) return { ok: false, reason: "missing" };

  const collision = db.prepare("SELECT name FROM categories WHERE name = ?").get(trimmed);
  if (collision) return { ok: false, reason: "exists" };

  const tx = db.transaction(() => {
    db.prepare("UPDATE categories SET name = ? WHERE name = ?").run(trimmed, oldName);
    db.prepare("UPDATE categories SET parent = ? WHERE parent = ?").run(trimmed, oldName);
    db.prepare("UPDATE videos SET category = ? WHERE category = ?").run(trimmed, oldName);
  });
  tx();
  return { ok: true };
}

export function setCategoryColor(name: string, color: string | null): boolean {
  const db = getDb();
  const result = db.prepare("UPDATE categories SET color = ? WHERE name = ?").run(color, name);
  return result.changes > 0;
}

export function countUncategorized(): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT COUNT(*) AS count FROM videos WHERE category IS NULL OR category = ''"
  ).get() as { count: number };
  return row.count;
}
