"use client";

interface DownloadButtonProps {
  videoId: string;
}

export default function DownloadButton({ videoId }: DownloadButtonProps) {
  const handleDownload = () => {
    window.location.href = `/api/videos/${videoId}/download`;
  };

  return (
    <button
      onClick={handleDownload}
      className="text-sm text-zinc-400 hover:text-zinc-50 border border-zinc-800
                 px-4 py-1.5 rounded-lg hover:border-zinc-700
                 active:scale-[0.98] transition-all duration-200"
    >
      Download .md
    </button>
  );
}
