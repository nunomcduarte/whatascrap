"use client";

import { useEffect, useRef, useState } from "react";
import {
  DownloadSimple,
  FolderSimple,
  FolderSimpleDashed,
  Trash,
  X,
} from "@phosphor-icons/react";
import type { Category } from "@/lib/folders";
import { flattenForMenu } from "@/lib/categoryTree";
import { dotClass } from "./folderColor";

interface BulkActionBarProps {
  selected: Set<string>;
  categories: Category[];
  allVisibleIds: string[];
  onClear: () => void;
  onSelectAll: () => void;
  onAfterMutate: () => void;
}

export default function BulkActionBar({
  selected,
  categories,
  allVisibleIds,
  onClear,
  onSelectAll,
  onAfterMutate,
}: BulkActionBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<null | "category" | "delete" | "download">(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const count = selected.size;
  const allSelected = count > 0 && count === allVisibleIds.length;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const ids = () => Array.from(selected);

  const handleAssign = async (category: string | null) => {
    setMenuOpen(false);
    setError(null);
    setBusy("category");
    try {
      const res = await fetch("/api/videos/bulk/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids(), category }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onAfterMutate();
    } catch (e) {
      setError(`Assign failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteClick = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    void runDelete();
  };

  const runDelete = async () => {
    setError(null);
    setConfirmingDelete(false);
    setBusy("delete");
    try {
      const res = await fetch("/api/videos/bulk/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onAfterMutate();
    } catch (e) {
      setError(`Delete failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = () => {
    setError(null);
    setBusy("download");
    const url = `/api/videos/bulk/download?ids=${encodeURIComponent(ids().join(","))}`;
    window.location.href = url;
    setTimeout(() => setBusy(null), 800);
  };

  return (
    <div className="sticky top-14 z-30 -mx-6 lg:-mx-10 mb-6 px-6 lg:px-10 py-3 bg-[#181818]/90 backdrop-blur-md border-y border-white/[0.10] shadow-[0_4px_24px_rgba(0,0,0,0.55)] anim-slide-down">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onClear}
          className="inline-flex items-center justify-center h-8 w-8 rounded-full text-zinc-300 hover:text-zinc-50 hover:bg-white/[0.08] transition-colors active:scale-[0.95]"
          aria-label="Clear selection"
          title="Clear selection"
        >
          <X size={16} />
        </button>

        <span className="text-sm text-zinc-50 font-medium tabular-nums">
          {count} selected
        </span>

        {allVisibleIds.length > count && (
          <button
            onClick={onSelectAll}
            className="text-xs font-medium text-sky-300 hover:text-sky-200 px-2 py-1 rounded-md hover:bg-sky-400/10 transition-colors"
          >
            Select all {allVisibleIds.length}
          </button>
        )}
        {allSelected && allVisibleIds.length > 0 && (
          <span className="text-xs text-zinc-500">All on page selected</span>
        )}

        <div className="flex-1" />

        <div ref={menuRef} className="relative">
          <button
            disabled={busy !== null}
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-sm h-8 px-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-50 disabled:opacity-50 transition-colors active:scale-[0.97] border border-white/[0.06] hover:border-white/[0.12]"
          >
            <FolderSimple size={16} />
            <span>{busy === "category" ? "Assigning…" : "Assign category"}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-30 w-60 rounded-xl bg-[#282828] border border-white/[0.12] shadow-[0_12px_32px_rgba(0,0,0,0.7)] py-1.5 anim-fade-scale origin-top-right">
              <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                Move to folder
              </p>
              <button
                onClick={() => handleAssign(null)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-zinc-100 hover:bg-white/[0.06]"
              >
                <FolderSimpleDashed size={16} className="text-zinc-400" />
                <span className="flex-1 text-left">Uncategorized</span>
              </button>
              <div className="my-1 border-t border-white/[0.06]" />
              {categories.length === 0 ? (
                <p className="px-3 py-2 text-xs text-zinc-500">No folders yet.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  {flattenForMenu(categories).map(({ cat, depth }) => (
                    <button
                      key={cat.name}
                      onClick={() => handleAssign(cat.name)}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-zinc-100 hover:bg-white/[0.06]"
                      style={{ paddingLeft: 12 + depth * 14 }}
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass(cat.color)}`} />
                      <FolderSimple size={14} className="text-zinc-400 shrink-0" />
                      <span className="flex-1 text-left truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          disabled={busy !== null}
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 text-sm h-8 px-4 rounded-full bg-zinc-50 hover:bg-white text-zinc-950 font-medium disabled:opacity-50 transition-all active:scale-[0.97] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_10px_rgba(255,255,255,0.1)]"
        >
          <DownloadSimple size={16} weight="bold" />
          <span>{busy === "download" ? "Preparing…" : "Download .md"}</span>
        </button>

        {confirmingDelete ? (
          <div className="inline-flex items-center gap-2 anim-fade-scale">
            <span className="text-sm text-rose-300">
              Delete {count} video{count === 1 ? "" : "s"}?
            </span>
            <button
              disabled={busy !== null}
              onClick={() => void runDelete()}
              className="inline-flex items-center gap-1.5 text-sm h-8 px-3 rounded-full bg-rose-500/20 hover:bg-rose-500/35 text-rose-100 ring-1 ring-inset ring-rose-500/40 disabled:opacity-50 transition-all active:scale-[0.97]"
            >
              <Trash size={16} />
              <span>{busy === "delete" ? "Deleting…" : "Yes, delete"}</span>
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="text-sm text-zinc-400 hover:text-zinc-50 px-2 py-1 rounded-full transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            disabled={busy !== null}
            onClick={handleDeleteClick}
            className="inline-flex items-center justify-center h-8 w-8 rounded-full text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 disabled:opacity-50 transition-all active:scale-[0.95]"
            aria-label="Delete selected"
            title="Delete selected"
          >
            <Trash size={16} />
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
