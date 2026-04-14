"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import EmptyState from "@/components/EmptyState";
import AddModal from "@/components/AddModal";
import JobsPanel from "@/components/JobsPanel";
import JobRow from "@/components/history/JobRow";
import type { Category } from "@/lib/folders";
import type { Job, JobStatus } from "@/lib/jobs";

type FilterValue = "all" | "active" | JobStatus;

interface HistoryClientProps {
  jobs: Job[];
  filter: FilterValue;
  categories: Category[];
  total: number;
  uncategorized: number;
  activeJobs: number;
}

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

export default function HistoryClient({
  jobs: initialJobs,
  filter,
  categories,
  total,
  uncategorized,
  activeJobs,
}: HistoryClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    const live = filter === "active" || filter === "running" || filter === "queued";
    if (!live) return;
    let cancelled = false;
    const qs = filter === "active" ? "?status=active" : `?status=${filter}`;
    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs${qs}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { jobs: Job[] };
        if (!cancelled) setJobs(data.jobs);
      } catch {}
    };
    const t = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [filter]);

  const subtitle = `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"}`;

  return (
    <>
      <Header
        onAddClick={() => setModalOpen(true)}
        onToggleSidebar={() => setCollapsed((c) => !c)}
      />

      <div className="flex">
        <Sidebar
          categories={categories}
          total={total}
          uncategorized={uncategorized}
          activeJobs={activeJobs}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />

        <main className="flex-1 min-w-0 px-6 lg:px-10 py-8">
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-50">
              History
            </h1>
            <p className="mt-1 text-sm font-mono text-[#aaaaaa] tabular-nums">
              {subtitle}
            </p>
          </div>

          <div className="mb-6 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = f.value === filter;
              return (
                <button
                  key={f.value}
                  onClick={() =>
                    router.push(
                      f.value === "active"
                        ? "/history"
                        : `/history?status=${f.value}`
                    )
                  }
                  className={`h-8 px-3 rounded-full text-[12px] font-medium tracking-tight transition-colors ${
                    active
                      ? "bg-zinc-50 text-zinc-950"
                      : "bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {jobs.length === 0 ? (
            <EmptyState
              title={
                filter === "failed"
                  ? "No failed jobs"
                  : filter === "cancelled"
                    ? "No cancelled jobs"
                    : filter === "active"
                      ? "Nothing running right now"
                      : filter === "completed"
                        ? "No completed jobs yet"
                        : "No jobs yet"
              }
              description={
                filter === "active"
                  ? "Kick off a playlist or batch scrape from 'Add video' — it'll appear here in real time."
                  : "Once you start scraping videos, runs will show up here with status, progress, and any errors."
              }
            />
          ) : (
            <div className="flex flex-col gap-2.5 max-w-3xl">
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          )}
        </main>
      </div>

      <AddModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => router.refresh()}
      />

      <JobsPanel onJobCompleted={() => router.refresh()} />
    </>
  );
}
