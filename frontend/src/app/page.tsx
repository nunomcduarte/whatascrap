import { Suspense } from "react";
import {
  listVideos,
  countVideos,
  listCategories,
  countUncategorized,
} from "@/lib/db";
import { countActiveJobs } from "@/lib/jobs";
import LibraryClient from "./LibraryClient";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    uncategorized?: string;
  }>;
}

export default async function Home({ searchParams }: PageProps) {
  const { q, category, uncategorized } = await searchParams;
  const videos = listVideos({
    query: q,
    category,
    uncategorized: uncategorized === "1",
  });
  const total = countVideos();
  const categories = listCategories();
  const uncategorizedCount = countUncategorized();
  const activeJobs = countActiveJobs();

  return (
    <Suspense>
      <LibraryClient
        videos={videos}
        categories={categories}
        total={total}
        uncategorized={uncategorizedCount}
        activeJobs={activeJobs}
      />
    </Suspense>
  );
}
