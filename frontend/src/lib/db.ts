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
      )
    `);
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
}

export interface VideoSummary {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
  scraped_at: string;
}

export function insertVideo(video: Video): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO videos (id, title, channel, upload_date, transcript, scraped_at, url)
    VALUES (@id, @title, @channel, @upload_date, @transcript, @scraped_at, @url)
  `).run(video);
}

export function getVideoById(id: string): Video | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM videos WHERE id = ?").get(id) as Video | undefined;
}

export function listVideos(query?: string): VideoSummary[] {
  const db = getDb();
  if (query) {
    const pattern = `%${query}%`;
    return db.prepare(`
      SELECT id, title, channel, upload_date, scraped_at
      FROM videos
      WHERE title LIKE ? OR channel LIKE ? OR transcript LIKE ?
      ORDER BY scraped_at DESC
    `).all(pattern, pattern, pattern) as VideoSummary[];
  }
  return db.prepare(`
    SELECT id, title, channel, upload_date, scraped_at
    FROM videos
    ORDER BY scraped_at DESC
  `).all() as VideoSummary[];
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
