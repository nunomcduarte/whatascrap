import VideoCard from "./VideoCard";

interface VideoSummary {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
}

interface VideoGridProps {
  videos: VideoSummary[];
}

export default function VideoGrid({ videos }: VideoGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          id={video.id}
          title={video.title}
          channel={video.channel}
          upload_date={video.upload_date}
        />
      ))}
    </div>
  );
}
