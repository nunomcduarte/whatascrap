"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  ArrowSquareOut,
  FilmSlate,
  ListBullets,
  Playlist,
  Prohibit,
} from "@phosphor-icons/react";
import type { Job, JobItem, JobItemStatus } from "@/lib/jobs";
import JobStatusChip from "./JobStatusChip";
import JobProgress from "./JobProgress";

function fmtTs(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fmtDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso) return "—";
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const ms = end - start;
  if (isNaN(ms) || ms < 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rSec = sec % 60;
  if (min < 60) return rSec ? `${min}m ${rSec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const rMin = min % 60;
  return rMin ? `${hr}h ${rMin}m` : `${hr}h`;
}

function TypeIcon({ type }: { type: Job["type"] }) {
  if (type === "playlist") return <Playlist size={18} weight="bold" />;
  if (type === "batch") return <ListBullets size={18} weight="bold" />;
  return <FilmSlate size={18} weight="bold" />;
}

function jobLabel(job: Job): string {
  if (job.title) return job.title;
  if (job.type === "batch") return `Batch (${job.total})`;
  if (job.type === "playlist") return "Playlist";
  return job.source_url ?? "Video";
}

const ITEM_GROUP_ORDER: JobItemStatus[] = [
  "failed",
  "running",
  "pending",
  "skipped",
  "done",
];

export default function JobDetail({
  job: initialJob,
  items: initialItems,
}: {
  job: Job;
  items: JobItem[];
}) {
  const [busy, setBusy] = useState<null | "retry" | "cancel">(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [job, setJob] = useState<Job>(initialJob);
  const [items, setItems] = useState<JobItem[]>(initialItems);

  useEffect(() => {
    setJob(initialJob);
  }, [initialJob]);
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${initialJob.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { job: Job; items: JobItem[] };
      setJob(data.job);
      setItems(data.items);
    } catch {}
  }, [initialJob.id]);

  const inFlight = job.status === "queued" || job.status === "running";
  useEffect(() => {
    if (!inFlight) return;
    const t = setInterval(refetch, 2000);
    return () => clearInterval(t);
  }, [inFlight, refetch]);

  const grouped = useMemo(() => {
    const map = new Map<JobItemStatus, JobItem[]>();
    for (const it of items) {
      const arr = map.get(it.status) ?? [];
      arr.push(it);
      map.set(it.status, arr);
    }
    return map;
  }, [items]);

  const handleRetry = async () => {
    setFlash(null);
    setBusy("retry");
    try {
      const res = await fetch(`/api/jobs/${job.id}/retry`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { ok: true; requeued: number };
      setFlash(`Requeued ${data.requeued} item${data.requeued === 1 ? "" : "s"}.`);
      refetch();
    } catch (e) {
      setFlash(`Retry failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel this job? Pending items will be skipped.")) return;
    setFlash(null);
    setBusy("cancel");
    try {
      const res = await fetch(`/api/jobs/${job.id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refetch();
    } catch (e) {
      setFlash(`Cancel failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(null);
    }
  };

  const running = job.status === "running" || job.status === "queued";

  return (
    <div>
      <div className="flex flex-wrap items-start gap-4 mb-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-200">
          <TypeIcon type={job.type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-50 truncate">
              {jobLabel(job)}
            </h1>
            <JobStatusChip status={job.status} />
          </div>
          <p className="mt-1 text-[12px] font-mono text-zinc-500">
            <span className="uppercase tracking-wider">{job.type}</span>
            {job.category && (
              <>
                {" "}
                ·{" "}
                <span className="text-zinc-400">
                  folder: {job.category}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {job.source_url && (
            <a
              href={job.source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-sm h-9 px-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-100 border border-white/[0.06] transition-colors"
              title="Open source URL"
            >
              <ArrowSquareOut size={15} />
              Source
            </a>
          )}
          {job.failed > 0 && job.status !== "running" && (
            <button
              disabled={busy !== null}
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 text-sm h-9 px-4 rounded-full bg-[#cc2121] hover:bg-[#e22828] text-white font-medium disabled:opacity-50 transition-all active:scale-[0.97] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_14px_rgba(204,33,33,0.3)]"
            >
              <ArrowClockwise size={15} weight="bold" />
              {busy === "retry" ? "Requeuing…" : `Retry ${job.failed} failed`}
            </button>
          )}
          {running && (
            <button
              disabled={busy !== null}
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 text-sm h-9 px-3 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 ring-1 ring-inset ring-rose-500/30 disabled:opacity-50 transition-all active:scale-[0.97]"
            >
              <Prohibit size={15} />
              {busy === "cancel" ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>
      </div>

      {flash && (
        <p className="mb-4 text-xs text-zinc-300 bg-white/[0.04] border border-white/[0.06] px-3 py-2 rounded-md">
          {flash}
        </p>
      )}

      <div className="mb-6">
        <JobProgress
          completed={job.completed}
          failed={job.failed}
          total={job.total}
          running={running}
        />
        <div className="mt-2 text-[11px] font-mono text-zinc-500 tabular-nums">
          <span className="text-emerald-400">{job.completed} done</span>
          {job.failed > 0 && (
            <>
              {" "}
              · <span className="text-rose-400">{job.failed} failed</span>
            </>
          )}
          {" "}
          / {job.total} total
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 text-[12px]">
        <Meta label="Created" value={fmtTs(job.created_at)} />
        <Meta label="Started" value={fmtTs(job.started_at)} />
        <Meta label="Finished" value={fmtTs(job.finished_at)} />
        <Meta label="Duration" value={fmtDuration(job.started_at, job.finished_at)} />
      </div>

      {job.error && (
        <div className="mb-8 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
          <div className="text-[11px] uppercase tracking-wider text-rose-300 font-semibold mb-1">
            Job error
          </div>
          <pre className="text-[12px] font-mono text-rose-100 whitespace-pre-wrap break-words">
            {job.error}
          </pre>
        </div>
      )}

      <h2 className="text-sm font-semibold text-zinc-200 mb-3 tracking-tight">
        Items ({items.length})
      </h2>
      <div className="space-y-5">
        {ITEM_GROUP_ORDER.map((status) => {
          const group = grouped.get(status);
          if (!group || group.length === 0) return null;
          return (
            <ItemGroup key={status} status={status} items={group} />
          );
        })}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#181818] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
        {label}
      </div>
      <div className="mt-0.5 text-zinc-200 font-mono tabular-nums text-[12px]">
        {value}
      </div>
    </div>
  );
}

function ItemGroup({
  status,
  items,
}: {
  status: JobItemStatus;
  items: JobItem[];
}) {
  const [expanded, setExpanded] = useState(status === "failed");
  const CAP = 50;
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, CAP);
  return (
    <section>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 mb-2 text-left"
        aria-expanded={expanded}
      >
        <JobStatusChip status={status} size="sm" />
        <span className="text-[12px] text-zinc-400 font-mono tabular-nums">
          {items.length}
        </span>
        <span className="text-[11px] text-zinc-600 ml-auto">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>
      {expanded && (
        <ul className="rounded-xl border border-white/[0.06] bg-[#181818] divide-y divide-white/[0.04] overflow-hidden">
          {visible.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
          {!showAll && items.length > CAP && (
            <li className="px-4 py-2">
              <button
                onClick={() => setShowAll(true)}
                className="text-[12px] text-sky-300 hover:text-sky-200"
              >
                Show all {items.length}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function ItemRow({ item }: { item: JobItem }) {
  const label = item.title || item.url;
  const ytUrl = item.video_id
    ? `https://www.youtube.com/watch?v=${item.video_id}`
    : item.url;
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-zinc-100 truncate" title={label}>
            {label}
          </div>
          <div className="mt-0.5 text-[11px] font-mono text-zinc-500 flex items-center gap-2 flex-wrap">
            {item.video_id && (
              <Link
                href={`/video/${item.video_id}`}
                className="text-sky-300 hover:text-sky-200"
              >
                /video/{item.video_id}
              </Link>
            )}
            <a
              href={ytUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1"
            >
              YouTube <ArrowSquareOut size={10} />
            </a>
            <span className="text-zinc-600">· attempts: {item.attempts}</span>
          </div>
          {item.status === "failed" && item.error && (
            <pre className="mt-2 text-[11px] font-mono text-rose-200 bg-rose-500/5 border border-rose-500/20 rounded-md px-2 py-1.5 whitespace-pre-wrap break-words">
              {item.error}
            </pre>
          )}
        </div>
      </div>
    </li>
  );
}
