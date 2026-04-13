"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteButtonProps {
  videoId: string;
}

export default function DeleteButton({ videoId }: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    await fetch(`/api/videos/${videoId}`, { method: "DELETE" });
    router.push("/");
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-400">Delete this video?</span>
        <button
          onClick={handleDelete}
          className="text-sm text-red-400 border border-red-400/30 px-3 py-1 rounded-lg
                     hover:bg-red-400/10 active:scale-[0.98] transition-all duration-200"
        >
          Yes, delete
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-sm text-zinc-500 hover:text-zinc-300 px-3 py-1
                     transition-colors duration-200"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm text-zinc-600 hover:text-red-400 px-4 py-1.5 rounded-lg
                 active:scale-[0.98] transition-all duration-200"
    >
      Delete
    </button>
  );
}
