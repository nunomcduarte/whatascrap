import Link from "next/link";

interface VideoCardProps {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
}

export default function VideoCard({ id, title, channel, upload_date }: VideoCardProps) {
  return (
    <Link href={`/video/${id}`}>
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-5
                    hover:border-zinc-700 active:scale-[0.98]
                    transition-all duration-200 cursor-pointer"
      >
        <h3 className="text-sm font-semibold text-zinc-50 tracking-tight leading-snug line-clamp-2">
          {title}
        </h3>
        <p className="text-xs text-zinc-500 mt-2">{channel}</p>
        {upload_date && (
          <div className="mt-3">
            <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
              {upload_date}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
