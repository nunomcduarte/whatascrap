import { FilmSlate } from "@phosphor-icons/react/dist/ssr";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export default function EmptyState({
  title = "No videos here yet",
  description = "Add a YouTube URL to start building your library, then drop it into a folder.",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start py-24 max-w-[60ch]">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.06] text-zinc-300">
        <FilmSlate size={22} />
      </div>
      <h2 className="text-2xl tracking-tight font-semibold text-zinc-50">
        {title}
      </h2>
      <p className="mt-2 text-sm text-[#aaaaaa] leading-relaxed">
        {description}
      </p>
    </div>
  );
}
