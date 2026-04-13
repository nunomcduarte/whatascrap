import { notFound } from "next/navigation";
import Link from "next/link";
import { getVideoById } from "@/lib/db";
import VideoDetail from "@/components/VideoDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VideoPage({ params }: PageProps) {
  const { id } = await params;
  const video = getVideoById(id);

  if (!video) {
    notFound();
  }

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-4">
      <div className="py-4">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-200"
        >
          &larr; Back to library
        </Link>
      </div>
      <VideoDetail
        id={video.id}
        title={video.title}
        channel={video.channel}
        upload_date={video.upload_date}
        scraped_at={video.scraped_at}
        transcript={video.transcript}
      />
    </main>
  );
}
