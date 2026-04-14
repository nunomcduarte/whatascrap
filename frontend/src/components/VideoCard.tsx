"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  DotsThreeVertical,
  FolderSimple,
  FolderSimpleDashed,
  Check,
} from "@phosphor-icons/react";
import type { Category } from "@/lib/folders";
import { dotClass, tintClass } from "./folderColor";
import { flattenForMenu, getCategoryPath } from "@/lib/categoryTree";

interface VideoCardProps {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
  scraped_at: string;
  category: string | null;
  categories: Category[];
  selected: boolean;
  anySelected: boolean;
  onToggleSelect: (id: string) => void;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk} wk ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo} mo ago`;
  return `${Math.floor(day / 365)} yr ago`;
}

export default function VideoCard({
  id,
  title,
  channel,
  upload_date,
  scraped_at,
  category,
  categories,
  selected,
  anySelected,
  onToggleSelect,
}: VideoCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleAssign = async (e: React.MouseEvent, name: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    await fetch(`/api/videos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: name }),
    });
    router.refresh();
  };

  const handleSelectClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleSelect(id);
  };

  const thumb = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

  return (
    <div className="group flex flex-col gap-3">
      <Link href={`/video/${id}`} className="block">
        <div
          className={`relative aspect-video overflow-hidden rounded-xl bg-[#181818] transition-[box-shadow,transform] duration-200 ${
            selected
              ? "ring-2 ring-[#cc2121] shadow-[0_0_0_4px_rgba(204,33,33,0.15)]"
              : "ring-1 ring-white/[0.04] group-hover:ring-white/[0.10]"
          }`}
        >
          {!imgFailed ? (
            <Image
              src={thumb}
              alt={title}
              fill
              sizes="(min-width:1280px) 22vw, (min-width:768px) 33vw, 100vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              unoptimized
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
              <FolderSimple size={32} />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

          <button
            type="button"
            onClick={handleSelectClick}
            aria-label={selected ? "Deselect video" : "Select video"}
            aria-pressed={selected}
            className={`absolute top-2 left-2 z-10 h-6 w-6 rounded-md flex items-center justify-center transition-all duration-150 ${
              selected
                ? "bg-[#cc2121] border border-[#cc2121] text-white scale-100"
                : "bg-black/50 border border-white/70 text-transparent hover:border-[#cc2121] hover:bg-black/70 hover:text-white/90 scale-95 group-hover:scale-100"
            } ${selected || anySelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"} backdrop-blur-sm`}
          >
            <Check size={14} weight="bold" />
          </button>
        </div>
      </Link>

      <div className="flex items-start gap-3">
        <Link
          href={`/video/${id}`}
          className="flex-1 min-w-0"
        >
          <h3 className="text-[14px] font-semibold text-zinc-50 leading-snug tracking-tight line-clamp-2 transition-colors group-hover:text-white">
            {title}
          </h3>
          <p className="mt-1 text-[12px] text-[#aaaaaa] truncate">{channel}</p>
          <p className="mt-0.5 text-[12px] text-[#aaaaaa] flex items-center gap-1.5">
            <span>added {formatRelative(scraped_at)}</span>
            {upload_date && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{upload_date}</span>
              </>
            )}
          </p>
          {category && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {getCategoryPath(category, categories).map((cat, i, arr) => (
                <span key={cat.name} className="inline-flex items-center gap-1">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md ring-1 ring-inset ${tintClass(
                      cat.color
                    )}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${dotClass(cat.color)}`}
                    />
                    {cat.name}
                  </span>
                  {i < arr.length - 1 && (
                    <span className="text-zinc-600 text-[10px]" aria-hidden="true">
                      /
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </Link>

        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            aria-label="More actions"
            className="p-1.5 rounded-full text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] hover:text-zinc-50 transition-all"
          >
            <DotsThreeVertical size={18} weight="bold" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 w-56 rounded-xl bg-[#282828] border border-white/[0.12] shadow-[0_12px_32px_rgba(0,0,0,0.7)] py-1.5 anim-fade-scale origin-top-right">
              <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                Move to folder
              </p>
              <button
                onClick={(e) => handleAssign(e, null)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-zinc-100 hover:bg-white/[0.06]"
              >
                <FolderSimpleDashed size={16} className="text-zinc-400" />
                <span className="flex-1 text-left">Uncategorized</span>
                {!category && <Check size={14} className="text-zinc-400" />}
              </button>
              <div className="my-1 border-t border-white/[0.06]" />
              {categories.length === 0 ? (
                <p className="px-3 py-2 text-xs text-zinc-500">
                  No folders yet.
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  {flattenForMenu(categories).map(({ cat, depth }) => (
                    <button
                      key={cat.name}
                      onClick={(e) => handleAssign(e, cat.name)}
                      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-zinc-100 hover:bg-white/[0.06]"
                      style={{ paddingLeft: 12 + depth * 14 }}
                    >
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${dotClass(cat.color)}`}
                      />
                      <FolderSimple
                        size={14}
                        weight={category === cat.name ? "fill" : "regular"}
                        className="text-zinc-400 shrink-0"
                      />
                      <span className="flex-1 text-left truncate">
                        {cat.name}
                      </span>
                      {category === cat.name && (
                        <Check size={14} className="text-zinc-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
