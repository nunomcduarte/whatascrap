import { Suspense } from "react";
import { listVideos, countVideos } from "@/lib/db";
import LibraryClient from "./LibraryClient";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const videos = listVideos(q);
  const total = countVideos();

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-4">
      <Suspense>
        <LibraryClient videos={videos} total={total} initialQuery={q || ""} />
      </Suspense>
    </main>
  );
}
