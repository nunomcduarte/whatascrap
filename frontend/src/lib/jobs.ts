import { randomUUID } from "crypto";
import { getDb } from "./db";

export type JobType = "playlist" | "batch" | "single";
export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type JobItemStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "skipped";

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  source_url: string | null;
  title: string | null;
  category: string | null;
  total: number;
  completed: number;
  failed: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface JobItem {
  id: number;
  job_id: string;
  video_id: string | null;
  url: string;
  title: string | null;
  status: JobItemStatus;
  attempts: number;
  error: string | null;
  updated_at: string;
}

export interface CreateJobInput {
  type: JobType;
  source_url?: string | null;
  title?: string | null;
  category?: string | null;
  items: Array<{ url: string; video_id?: string | null; title?: string | null }>;
}

export function createJob(input: CreateJobInput): Job {
  const db = getDb();
  const now = new Date().toISOString();
  const id = randomUUID();
  const total = input.items.length;

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO jobs (id, type, status, source_url, title, category, total, completed, failed, created_at)
       VALUES (@id, @type, 'queued', @source_url, @title, @category, @total, 0, 0, @created_at)`
    ).run({
      id,
      type: input.type,
      source_url: input.source_url ?? null,
      title: input.title ?? null,
      category: input.category ?? null,
      total,
      created_at: now,
    });

    const insertItem = db.prepare(
      `INSERT INTO job_items (job_id, video_id, url, title, status, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`
    );
    for (const it of input.items) {
      insertItem.run(id, it.video_id ?? null, it.url, it.title ?? null, now);
    }
  });
  tx();

  return getJob(id)!;
}

export function getJob(id: string): Job | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as
    | Job
    | undefined;
}

export function getJobItems(jobId: string): JobItem[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM job_items WHERE job_id = ? ORDER BY id ASC")
    .all(jobId) as JobItem[];
}

export function countActiveJobs(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM jobs WHERE status IN ('queued','running')")
    .get() as { n: number };
  return row.n;
}

export function listJobs(opts: { status?: JobStatus | "active" } = {}): Job[] {
  const db = getDb();
  if (opts.status === "active") {
    return db
      .prepare(
        "SELECT * FROM jobs WHERE status IN ('queued','running') ORDER BY created_at DESC"
      )
      .all() as Job[];
  }
  if (opts.status) {
    return db
      .prepare("SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC")
      .all(opts.status) as Job[];
  }
  return db
    .prepare("SELECT * FROM jobs ORDER BY created_at DESC")
    .all() as Job[];
}

export function claimNextItem(): { job: Job; item: JobItem } | null {
  const db = getDb();
  const now = new Date().toISOString();

  return db.transaction(() => {
    const row = db
      .prepare(
        `SELECT ji.* FROM job_items ji
         JOIN jobs j ON j.id = ji.job_id
         WHERE ji.status = 'pending'
           AND j.status IN ('queued','running')
         ORDER BY ji.id ASC LIMIT 1`
      )
      .get() as JobItem | undefined;
    if (!row) return null;

    db.prepare(
      "UPDATE job_items SET status = 'running', attempts = attempts + 1, updated_at = ? WHERE id = ?"
    ).run(now, row.id);

    db.prepare(
      `UPDATE jobs
         SET status = CASE WHEN status = 'queued' THEN 'running' ELSE status END,
             started_at = COALESCE(started_at, ?)
       WHERE id = ?`
    ).run(now, row.job_id);

    const job = getJob(row.job_id)!;
    return { job, item: { ...row, status: "running", attempts: row.attempts + 1 } };
  })() as { job: Job; item: JobItem } | null;
}

export function markItemDone(
  itemId: number,
  videoId: string,
  title: string | null
): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.transaction(() => {
    const item = db
      .prepare("SELECT * FROM job_items WHERE id = ?")
      .get(itemId) as JobItem | undefined;
    if (!item) return;

    db.prepare(
      "UPDATE job_items SET status = 'done', video_id = ?, title = COALESCE(?, title), updated_at = ? WHERE id = ?"
    ).run(videoId, title, now, itemId);

    db.prepare(
      "UPDATE jobs SET completed = completed + 1 WHERE id = ?"
    ).run(item.job_id);

    finalizeIfDone(item.job_id);
  })();
}

export function markItemFailed(
  itemId: number,
  error: string,
  maxAttempts = 3
): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.transaction(() => {
    const item = db
      .prepare("SELECT * FROM job_items WHERE id = ?")
      .get(itemId) as JobItem | undefined;
    if (!item) return;

    if (item.attempts < maxAttempts) {
      db.prepare(
        "UPDATE job_items SET status = 'pending', error = ?, updated_at = ? WHERE id = ?"
      ).run(error, now, itemId);
      return;
    }

    db.prepare(
      "UPDATE job_items SET status = 'failed', error = ?, updated_at = ? WHERE id = ?"
    ).run(error, now, itemId);
    db.prepare(
      "UPDATE jobs SET failed = failed + 1 WHERE id = ?"
    ).run(item.job_id);

    finalizeIfDone(item.job_id);
  })();
}

function finalizeIfDone(jobId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  const job = getJob(jobId);
  if (!job) return;

  const pending = db
    .prepare(
      "SELECT COUNT(*) AS n FROM job_items WHERE job_id = ? AND status IN ('pending','running')"
    )
    .get(jobId) as { n: number };

  if (pending.n > 0) return;

  const status: JobStatus =
    job.failed > 0 && job.completed === 0 ? "failed" : "completed";
  db.prepare(
    "UPDATE jobs SET status = ?, finished_at = ? WHERE id = ?"
  ).run(status, now, jobId);
}

export function cancelJob(id: string): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const job = getJob(id);
  if (!job) return false;
  if (job.status === "completed" || job.status === "cancelled") return false;

  db.transaction(() => {
    db.prepare(
      "UPDATE job_items SET status = 'skipped', updated_at = ? WHERE job_id = ? AND status = 'pending'"
    ).run(now, id);
    db.prepare(
      "UPDATE jobs SET status = 'cancelled', finished_at = ? WHERE id = ?"
    ).run(now, id);
  })();
  return true;
}

export function retryFailedItems(id: string): number {
  const db = getDb();
  const now = new Date().toISOString();
  const job = getJob(id);
  if (!job) return 0;

  const result = db.transaction(() => {
    const res = db
      .prepare(
        "UPDATE job_items SET status = 'pending', attempts = 0, error = NULL, updated_at = ? WHERE job_id = ? AND status = 'failed'"
      )
      .run(now, id);
    if (res.changes > 0) {
      db.prepare(
        `UPDATE jobs
            SET status = 'queued',
                failed = 0,
                finished_at = NULL,
                error = NULL
          WHERE id = ?`
      ).run(id);
    }
    return res.changes;
  })();

  return result;
}

export function reclaimStuckItems(): number {
  const db = getDb();
  const now = new Date().toISOString();
  const res = db
    .prepare(
      "UPDATE job_items SET status = 'pending', updated_at = ? WHERE status = 'running'"
    )
    .run(now);
  return res.changes;
}
