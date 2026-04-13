"use client";

interface NavbarProps {
  videoCount: number;
  onAddClick: () => void;
}

export default function Navbar({ videoCount, onAddClick }: NavbarProps) {
  return (
    <nav className="flex items-center justify-between py-6">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-base font-semibold tracking-tighter text-zinc-50">
          Scrape
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs font-mono text-zinc-500">
          {videoCount} {videoCount === 1 ? "video" : "videos"}
        </span>
        <button
          onClick={onAddClick}
          className="bg-zinc-50 text-zinc-950 text-sm font-medium px-4 py-1.5 rounded-lg
                     hover:bg-zinc-200 active:scale-[0.98] transition-all duration-200"
        >
          + Add
        </button>
      </div>
    </nav>
  );
}
