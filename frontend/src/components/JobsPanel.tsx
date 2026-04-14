"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
    <div className="fixed bottom-4 right-4 z-40 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800/60 transition"
      >
        <span className="font-medium">
          {jobs.length} job{jobs.length === 1 ? "" : "s"} running
        </span>
        <span className="text-zinc-500 text-xs">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800">
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

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="text-xs text-zinc-200 truncate" title={label}>
          {label}
        </div>
        <button
          onClick={onCancel}
          className="text-[10px] font-mono uppercase text-zinc-500 hover:text-rose-400 transition"
          title="Cancel job"
        >
          Cancel
        </button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-zinc-100 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[11px] font-mono text-zinc-500 tabular-nums w-16 text-right">
          {job.completed}/{job.total}
          {job.failed > 0 && (
            <span className="text-rose-400 ml-1">·{job.failed}</span>
          )}
        </div>
      </div>
    </div>
  );
}
