"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import VideoGrid from "@/components/VideoGrid";
import EmptyState from "@/components/EmptyState";
import AddModal from "@/components/AddModal";
import Link from "next/link";
import { dotClass, tintClass } from "@/components/folderColor";
import type { Category, VideoSummary } from "@/lib/folders";

interface LibraryClientProps {
  videos: VideoSummary[];
  categories: Category[];
  total: number;
  uncategorized: number;
}

export default function LibraryClient({
  videos,
  categories,
  total,
  uncategorized,
}: LibraryClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const sp = useSearchParams();

  const activeCategory = sp.get("category");
  const isUncategorized = sp.get("uncategorized") === "1";
  const query = sp.get("q") || "";

  const heading = activeCategory
    ? activeCategory
    : isUncategorized
      ? "Uncategorized"
      : query
        ? `Results for "${query}"`
        : "All Videos";

  const subtitle = `${videos.length} ${videos.length === 1 ? "video" : "videos"}`;

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
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />

        <main className="flex-1 min-w-0 px-6 lg:px-10 py-8">
          <div className="flex items-end justify-between mb-7 gap-4">
            <div className="min-w-0">
              {activeCategory && (
                <Breadcrumbs name={activeCategory} categories={categories} />
              )}
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-50 truncate flex items-center gap-3">
                {activeCategory && (
                  <span
                    className={`h-3 w-3 rounded-full shrink-0 ${dotClass(
                      categories.find((c) => c.name === activeCategory)?.color ?? null
                    )}`}
                    aria-hidden="true"
                  />
                )}
                <span className="truncate">{heading}</span>
              </h1>
              <p className="mt-1 text-sm font-mono text-[#aaaaaa] tabular-nums">
                {subtitle}
              </p>
            </div>
          </div>

          {videos.length === 0 ? (
            <EmptyState
              title={
                query
                  ? "No matches"
                  : isUncategorized
                    ? "Nothing uncategorized"
                    : activeCategory
                      ? `"${activeCategory}" is empty`
                      : "No videos here yet"
              }
              description={
                query
                  ? "Try a different keyword, channel, or transcript phrase."
                  : activeCategory
                    ? "Open a video and assign it to this folder from the menu."
                    : "Add a YouTube URL to start building your library."
              }
            />
          ) : (
            <VideoGrid videos={videos} categories={categories} />
          )}
        </main>
      </div>

      <AddModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}

function Breadcrumbs({
  name,
  categories,
}: {
  name: string;
  categories: Category[];
}) {
  const byName = new Map(categories.map((c) => [c.name, c]));
  const path: Category[] = [];
  const seen = new Set<string>();
  let current: Category | undefined = byName.get(name);
  while (current && !seen.has(current.name)) {
    seen.add(current.name);
    path.unshift(current);
    current = current.parent ? byName.get(current.parent) : undefined;
  }
  if (path.length <= 1) return null;
  return (
    <nav className="mb-2 flex flex-wrap items-center gap-1.5" aria-label="Folder path">
      {path.slice(0, -1).map((cat) => (
        <span key={cat.name} className="inline-flex items-center gap-1.5">
          <Link
            href={`/?category=${encodeURIComponent(cat.name)}`}
            className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md ring-1 ring-inset hover:brightness-125 transition ${tintClass(
              cat.color
            )}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${dotClass(cat.color)}`}
            />
            {cat.name}
          </Link>
          <span className="text-zinc-600 text-xs" aria-hidden="true">
            /
          </span>
        </span>
      ))}
    </nav>
  );
}
