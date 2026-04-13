"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import VideoGrid from "@/components/VideoGrid";
import EmptyState from "@/components/EmptyState";
import AddModal from "@/components/AddModal";

interface VideoSummary {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
  scraped_at: string;
}

interface LibraryClientProps {
  videos: VideoSummary[];
  total: number;
  initialQuery: string;
}

export default function LibraryClient({ videos, total, initialQuery }: LibraryClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <>
      <Navbar videoCount={total} onAddClick={() => setModalOpen(true)} />
      <div className="mt-4 mb-6">
        <SearchBar />
      </div>
      {videos.length === 0 ? (
        <EmptyState />
      ) : (
        <VideoGrid videos={videos} />
      )}
      <AddModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
