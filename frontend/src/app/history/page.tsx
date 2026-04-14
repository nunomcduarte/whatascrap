import { Suspense } from "react";
import {
  listJobs,
  countActiveJobs,
  type JobStatus,
} from "@/lib/jobs";
import { listCategories, countVideos, countUncategorized } from "@/lib/db";
import HistoryClient from "./HistoryClient";

type FilterValue = "all" | "active" | JobStatus;

const ALLOWED: ReadonlySet<FilterValue> = new Set([
  "all",
  "active",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function HistoryPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const filter: FilterValue =
    status && ALLOWED.has(status as FilterValue)
      ? (status as FilterValue)
      : "active";

  const jobs =
    filter === "all"
      ? listJobs()
      : listJobs({ status: filter as JobStatus | "active" });

  const categories = listCategories();
  const total = countVideos();
  const uncategorized = countUncategorized();
  const activeJobs = countActiveJobs();

  return (
    <Suspense>
      <HistoryClient
        jobs={jobs}
        filter={filter}
        categories={categories}
        total={total}
        uncategorized={uncategorized}
        activeJobs={activeJobs}
      />
    </Suspense>
  );
}
