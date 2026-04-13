"use client";

import { useState } from "react";
import ErrorInline from "./ErrorInline";

interface AddModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddModal({ open, onClose, onSuccess }: AddModalProps) {
  const [batchMode, setBatchMode] = useState(false);
  const [singleUrl, setSingleUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleScrape = async () => {
    setError("");
    const urls = batchMode
      ? batchUrls.split("\n").map((u) => u.trim()).filter(Boolean)
      : [singleUrl.trim()];

    if (urls.length === 0 || urls[0] === "") {
      setError("Please enter at least one URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();

      if (!res.ok && !data.results) {
        setError(data.error || "Scraping failed.");
        return;
      }

      const errors = data.results?.filter((r: { error?: string }) => r.error) || [];
      if (errors.length > 0 && errors.length === urls.length) {
        setError(errors[0].error);
        return;
      }

      setSingleUrl("");
      setBatchUrls("");
      onSuccess();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-50">
            Add Videos
          </h2>
          <button
            onClick={() => setBatchMode(!batchMode)}
            className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {batchMode ? "Single mode" : "Batch mode"}
          </button>
        </div>

        {batchMode ? (
          <textarea
            placeholder={"Paste URLs, one per line...\nhttps://youtube.com/watch?v=...\nhttps://youtu.be/..."}
            value={batchUrls}
            onChange={(e) => setBatchUrls(e.target.value)}
            rows={5}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3
                       text-sm text-zinc-50 placeholder:text-zinc-600
                       focus:outline-none focus:border-zinc-700
                       transition-colors duration-200 resize-none font-mono"
          />
        ) : (
          <input
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={singleUrl}
            onChange={(e) => setSingleUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleScrape()}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5
                       text-sm text-zinc-50 placeholder:text-zinc-600
                       focus:outline-none focus:border-zinc-700
                       transition-colors duration-200"
          />
        )}

        {error && <ErrorInline message={error} />}

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="text-sm text-zinc-500 hover:text-zinc-300 px-4 py-2
                       transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleScrape}
            disabled={loading}
            className="bg-zinc-50 text-zinc-950 text-sm font-medium px-5 py-2 rounded-lg
                       hover:bg-zinc-200 active:scale-[0.98] transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Scraping..." : "Scrape"}
          </button>
        </div>
      </div>
    </div>
  );
}
