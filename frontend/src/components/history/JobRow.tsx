import Link from "next/link";
import {
  FilmSlate,
  ListBullets,
  Playlist,
} from "@phosphor-icons/react/dist/ssr";
import type { Job } from "@/lib/jobs";
import JobStatusChip from "./JobStatusChip";
import JobProgress from "./JobProgress";

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

function formatDuration(startIso: string | null, endIso: string | null): string | null {
  if (!startIso) return null;
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const ms = end - start;
  if (isNaN(ms) || ms < 0) return null;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rSec = sec % 60;
  if (min < 60) return rSec ? `${min}m ${rSec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const rMin = min % 60;
  return rMin ? `${hr}h ${rMin}m` : `${hr}h`;
}

function jobLabel(job: Job): string {
  if (job.title) return job.title;
  if (job.type === "batch") return `Batch (${job.total})`;
  if (job.type === "playlist") return "Playlist";
  return job.source_url ?? "Video";
}

function TypeIcon({ type }: { type: Job["type"] }) {
  if (type === "playlist") return <Playlist size={16} weight="bold" />;
  if (type === "batch") return <ListBullets size={16} weight="bold" />;
  return <FilmSlate size={16} weight="bold" />;
}

export default function JobRow({ job }: { job: Job }) {
  const duration = formatDuration(job.started_at, job.finished_at);
  const running = job.status === "running" || job.status === "queued";
  const pct = job.total === 0 ? 0 : Math.round(((job.completed + job.failed) / job.total) * 100);

  return (
    <Link
      href={`/history/${job.id}`}
      className="block rounded-xl border border-white/[0.06] bg-[#181818] hover:bg-[#1e1e1e] hover:border-white/[0.12] transition-colors p-4"
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300">
          <TypeIcon type={job.type} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14px] font-semibold text-zinc-50 truncate max-w-full">
              {jobLabel(job)}
            </h3>
            <JobStatusChip status={job.status} size="sm" />
            {job.category && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded text-zinc-400 bg-white/[0.04] border border-white/[0.06]">
                {job.category}
              </span>
            )}
          </div>

          <p
            className="mt-1 text-[11px] font-mono text-zinc-500 tabular-nums"
            suppressHydrationWarning
          >
            {formatRelative(job.created_at)}
            {duration && <> · {duration}</>}
            <> · </>
            <span className="text-emerald-400">{job.completed} done</span>
            {job.failed > 0 && (
              <>
                {" "}
                · <span className="text-rose-400">{job.failed} failed</span>
              </>
            )}
            <> / {job.total} total</>
            <> · {pct}%</>
          </p>

          <div className="mt-2.5">
            <JobProgress
              completed={job.completed}
              failed={job.failed}
              total={job.total}
              running={running}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
