import VideoCard from "./VideoCard";
import type { Category, VideoSummary } from "@/lib/folders";

interface VideoGridProps {
  videos: VideoSummary[];
  categories: Category[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
}

export default function VideoGrid({
  videos,
  categories,
  selected,
  onToggleSelect,
}: VideoGridProps) {
  const anySelected = selected.size > 0;
  return (
    <div className="grid gap-x-4 gap-y-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          id={video.id}
          title={video.title}
          channel={video.channel}
          upload_date={video.upload_date}
          scraped_at={video.scraped_at}
          category={video.category}
          categories={categories}
          selected={selected.has(video.id)}
          anySelected={anySelected}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
