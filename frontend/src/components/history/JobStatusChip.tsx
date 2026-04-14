import type { JobItemStatus, JobStatus } from "@/lib/jobs";

type AnyStatus = JobStatus | JobItemStatus;

const JOB_STYLE: Record<AnyStatus, string> = {
  queued: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  running: "bg-sky-500/15 text-sky-200 ring-sky-500/30",
  completed: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
  failed: "bg-rose-500/15 text-rose-200 ring-rose-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  pending: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  done: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
  skipped: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
};

const LABEL: Record<AnyStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  pending: "Pending",
  done: "Done",
  skipped: "Skipped",
};

export default function JobStatusChip({
  status,
  size = "md",
}: {
  status: AnyStatus;
  size?: "sm" | "md";
}) {
  const pulsing = status === "running";
  const sizing =
    size === "sm"
      ? "text-[10px] px-1.5 py-0.5"
      : "text-[11px] px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md ring-1 ring-inset font-medium ${JOB_STYLE[status]} ${sizing}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "running"
            ? "bg-sky-400"
            : status === "completed" || status === "done"
              ? "bg-emerald-400"
              : status === "failed"
                ? "bg-rose-400"
                : status === "cancelled" || status === "skipped"
                  ? "bg-zinc-400"
                  : "bg-amber-400"
        } ${pulsing ? "animate-pulse" : ""}`}
      />
      {LABEL[status]}
    </span>
  );
}
