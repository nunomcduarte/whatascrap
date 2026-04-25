"use client";

import { useState } from "react";

interface CopyTranscriptButtonProps {
  transcript: string;
}

export default function CopyTranscriptButton({ transcript }: CopyTranscriptButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="text-sm text-zinc-400 hover:text-zinc-50 border border-zinc-800
                 px-4 py-1.5 rounded-lg hover:border-zinc-700
                 active:scale-[0.98] transition-all duration-200"
    >
      {copied ? "Copied" : "Copy transcript"}
    </button>
  );
}
