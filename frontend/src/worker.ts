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

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 2);
const IDLE_POLL_MS = 1500;

let stopping = false;

async function processItem(item: JobItem, jobCategory: string | null) {
  try {
    if (item.video_id) {
      const existing = getVideoById(item.video_id);
      if (existing) {
        if (jobCategory && !existing.category) {
          const { setVideoCategory } = await import("./lib/db");
          setVideoCategory(item.video_id, jobCategory);
        }
        markItemDone(item.id, item.video_id, existing.title);
        return;
      }
    }

    const data = await scrapeVideo(item.url);
    const videoId = item.video_id ?? extractIdFromUrl(item.url);
    if (!videoId) {
      markItemFailed(item.id, "Could not extract video ID");
      return;
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    markItemFailed(item.id, msg);
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
    await processItem(item, job.category);
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

  console.log(`[worker] starting with concurrency=${CONCURRENCY}`);
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
