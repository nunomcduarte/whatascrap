import DownloadButton from "./DownloadButton";
import DeleteButton from "./DeleteButton";
import CopyTranscriptButton from "./CopyTranscriptButton";

interface VideoDetailProps {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
  scraped_at: string;
  transcript: string;
}

export default function VideoDetail({
  id,
  title,
  channel,
  upload_date,
  scraped_at,
  transcript,
}: VideoDetailProps) {
  return (
    <article>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter leading-none text-zinc-50">
          {title}
        </h1>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <span className="text-sm text-zinc-400">{channel}</span>
          {upload_date && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-xs font-mono text-zinc-500">{upload_date}</span>
            </>
          )}
          <span className="text-zinc-700">·</span>
          <span className="text-xs font-mono text-zinc-600">
            Scraped {scraped_at.split("T")[0]}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-5">
          <DownloadButton videoId={id} />
          <CopyTranscriptButton transcript={transcript} />
          <DeleteButton videoId={id} />
        </div>
      </header>

      <div className="border-t border-zinc-800 pt-8">
        <p className="text-base text-zinc-400 leading-relaxed max-w-[65ch]">
          {transcript}
        </p>
      </div>
    </article>
  );
}
