"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CaretDown, SpinnerGap, X } from "@phosphor-icons/react";

interface Job {
  id: string;
  type: "playlist" | "batch" | "single";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
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

interface JobsPanelProps {
  onJobCompleted: () => void;
}

export default function JobsPanel({ onJobCompleted }: JobsPanelProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState(true);
  const prevActiveIds = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs?status=active", { cache: "no-store" });
      if (!res.ok) return;
      const data: { jobs: Job[] } = await res.json();

      const activeIds = new Set(data.jobs.map((j) => j.id));
      const finished = [...prevActiveIds.current].filter((id) => !activeIds.has(id));
      prevActiveIds.current = activeIds;

      setJobs(data.jobs);
      if (finished.length > 0) onJobCompleted();
    } catch {}
  }, [onJobCompleted]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  if (jobs.length === 0) return null;

  const cancel = async (id: string) => {
    await fetch(`/api/jobs/${id}/cancel`, { method: "POST" });
    refresh();
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[320px] bg-[#181818] border border-white/[0.12] rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.7)] overflow-hidden anim-slide-up">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-100 bg-[#272727] border-b border-white/[0.08] hover:bg-[#2f2f2f] transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-medium tracking-tight">
          <SpinnerGap size={14} weight="bold" className="text-[#cc2121] animate-spin" />
          {jobs.length} job{jobs.length === 1 ? "" : "s"} running
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-zinc-400 bg-[#0f0f0f] px-1.5 py-0.5 rounded border border-white/[0.06] tabular-nums">
            {jobs.length}
          </span>
          <CaretDown
            size={12}
            weight="bold"
            className={`text-zinc-400 transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </span>
      </button>
      {open && (
        <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.05]">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} onCancel={() => cancel(job.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow({ job, onCancel }: { job: Job; onCancel: () => void }) {
  const pct =
    job.total === 0 ? 0 : Math.round(((job.completed + job.failed) / job.total) * 100);
  const label =
    job.title ||
    (job.type === "playlist"
      ? "Playlist"
      : job.type === "batch"
        ? `Batch (${job.total})`
        : "Video");
  const running = job.status === "running" || job.status === "queued";

  return (
    <div className="px-4 py-3 hover:bg-white/[0.02] transition-colors group">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-zinc-100 truncate font-medium" title={label}>
            {label}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 tabular-nums mt-0.5">
            {job.completed}/{job.total}
            {job.failed > 0 && (
              <span className="text-rose-400 ml-1">·{job.failed} failed</span>
            )}
            <span className="ml-1.5 text-zinc-600">· {pct}%</span>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="h-6 w-6 rounded-full flex items-center justify-center text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
          title="Cancel job"
          aria-label="Cancel job"
        >
          <X size={12} weight="bold" />
        </button>
      </div>
      <div className="h-1.5 w-full bg-[#0f0f0f] rounded-full overflow-hidden border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
        <div
          className="h-full bg-[#cc2121] rounded-full relative transition-[width] duration-500 ease-out shadow-[0_0_8px_rgba(204,33,33,0.6)]"
          style={{ width: `${pct}%` }}
        >
          {running && pct > 0 && pct < 100 && (
            <div className="anim-progress-gloss" />
          )}
        </div>
      </div>
    </div>
  );
}
