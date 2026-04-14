/**
 * Scrape worker. Long-lived process that drains pending job_items.
 *
 * Run with: npm run worker
 */
import {
  claimNextItem,
  markItemDone,
  markItemFailed,
  reclaimStuckItems,
  type JobItem,
} from "./lib/jobs";
import { scrapeVideo } from "./lib/scraper";
import { insertVideo, getVideoById } from "./lib/db";

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 1);
const IDLE_POLL_MS = 1500;
const MIN_DELAY_MS = Number(process.env.WORKER_MIN_DELAY_MS || 1500);
const BLOCK_BACKOFF_START_MS = Number(process.env.WORKER_BLOCK_BACKOFF_MS || 60_000);
const BLOCK_BACKOFF_CAP_MS = 5 * 60_000;
const BLOCKED_RE = /blocked|rate.?limit|requestblocked|ipblocked|too many requests/i;

let stopping = false;

type ItemOutcome = "ok" | "failed" | "blocked";

async function processItem(
  item: JobItem,
  jobCategory: string | null
): Promise<ItemOutcome> {
  try {
    if (item.video_id) {
      const existing = getVideoById(item.video_id);
      if (existing) {
        if (jobCategory && !existing.category) {
          const { setVideoCategory } = await import("./lib/db");
          setVideoCategory(item.video_id, jobCategory);
        }
        markItemDone(item.id, item.video_id, existing.title);
        return "ok";
      }
    }

    const data = await scrapeVideo(item.url);
    const videoId = item.video_id ?? extractIdFromUrl(item.url);
    if (!videoId) {
      markItemFailed(item.id, "Could not extract video ID");
      return "failed";
    }

    insertVideo({
      id: videoId,
      title: data.title,
      channel: data.channel,
      upload_date: data.upload_date || null,
      transcript: data.transcript,
      scraped_at: new Date().toISOString(),
      url: item.url,
      category: jobCategory,
    });

    markItemDone(item.id, videoId, data.title);
    return "ok";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    markItemFailed(item.id, msg);
    return BLOCKED_RE.test(msg) ? "blocked" : "failed";
  }
}

function extractIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith("youtube.com")) {
      return parsed.searchParams.get("v");
    }
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.slice(1) || null;
    }
  } catch {}
  return null;
}

async function workerLoop(slot: number) {
  let blockBackoff = BLOCK_BACKOFF_START_MS;
  while (!stopping) {
    const claim = claimNextItem();
    if (!claim) {
      await sleep(IDLE_POLL_MS);
      continue;
    }
    const { job, item } = claim;
    console.log(
      `[worker ${slot}] job ${job.id.slice(0, 8)} item ${item.id} ${item.url}`
    );
    const outcome = await processItem(item, job.category);
    if (outcome === "blocked") {
      const wait = Math.min(blockBackoff, BLOCK_BACKOFF_CAP_MS);
      console.warn(
        `[worker ${slot}] block detected — backing off ${Math.round(wait / 1000)}s`
      );
      await sleep(wait);
      blockBackoff = Math.min(blockBackoff * 2, BLOCK_BACKOFF_CAP_MS);
    } else {
      if (outcome === "ok") blockBackoff = BLOCK_BACKOFF_START_MS;
      if (MIN_DELAY_MS > 0) await sleep(MIN_DELAY_MS);
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const reclaimed = reclaimStuckItems();
  if (reclaimed > 0) {
    console.log(`[worker] reclaimed ${reclaimed} stuck item(s) from previous run`);
  }

  console.log(
    `[worker] starting with concurrency=${CONCURRENCY} min_delay=${MIN_DELAY_MS}ms block_backoff=${BLOCK_BACKOFF_START_MS}ms`
  );
  const slots = Array.from({ length: CONCURRENCY }, (_, i) => workerLoop(i + 1));

  const shutdown = (sig: string) => {
    console.log(`[worker] ${sig} received, draining...`);
    stopping = true;
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await Promise.all(slots);
  console.log("[worker] stopped");
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
