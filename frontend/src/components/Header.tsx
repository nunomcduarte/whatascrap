"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { List, MagnifyingGlass, Plus } from "@phosphor-icons/react";

interface HeaderProps {
  onAddClick: () => void;
  onToggleSidebar: () => void;
}

export default function Header({ onAddClick, onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get("q") || "");
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      const qs = params.toString();
      router.push(qs ? `/?${qs}` : "/");
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, router, sp]);

  return (
    <header className="sticky top-0 z-40 h-14 bg-[#0f0f0f]/95 backdrop-blur-md border-b border-white/[0.06] flex items-center px-4 gap-4">
      <div className="flex items-center gap-3 shrink-0 min-w-[208px]">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="p-2 rounded-full hover:bg-white/[0.08] active:scale-[0.95] transition-all text-zinc-200"
        >
          <List size={22} />
        </button>
        <Link href="/" className="flex items-center gap-2 group">
          <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#cc2121]">
            <span className="absolute inset-0 rounded-md bg-[#cc2121] blur-md opacity-30" />
            <span className="relative h-2 w-2 rounded-sm bg-zinc-50" />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-zinc-50">
            scrape
          </span>
        </Link>
      </div>

      <div className="flex-1 max-w-2xl mx-auto">
        <div
          className={`flex items-center h-10 rounded-full border transition-colors ${
            focused
              ? "border-white/20 bg-[#121212]"
              : "border-white/[0.08] bg-[#121212]"
          }`}
        >
          <div className="pl-4 pr-2 text-zinc-500">
            <MagnifyingGlass size={16} />
          </div>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search transcripts, titles, channels"
            className="flex-1 bg-transparent text-sm text-zinc-50 placeholder:text-zinc-500 outline-none py-2 pr-4"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onAddClick}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[#272727] hover:bg-[#3a3a3a] text-zinc-50 text-sm font-medium tracking-tight transition active:scale-[0.97]"
        >
          <Plus size={16} weight="bold" />
          <span className="hidden sm:inline">Add video</span>
        </button>
      </div>
    </header>
  );
}
