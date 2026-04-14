"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { List, MagnifyingGlass, Plus } from "@phosphor-icons/react";

interface HeaderProps {
  onAddClick: () => void;
  onToggleSidebar: () => void;
}

export default function Header({ onAddClick, onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [value, setValue] = useState(sp.get("q") || "");
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const currentQ = sp.get("q") ?? "";
    if (value === currentQ) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (pathname === "/") {
        const params = new URLSearchParams(sp.toString());
        if (value) params.set("q", value);
        else params.delete("q");
        const qs = params.toString();
        router.push(qs ? `/?${qs}` : "/");
      } else if (value) {
        router.push(`/?q=${encodeURIComponent(value)}`);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, router, sp, pathname]);

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
          <span
            className="relative inline-flex h-[22px] w-[30px] items-center justify-center rounded-[6px] bg-[#cc2121] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_8px_rgba(204,33,33,0.35)] transition-transform group-hover:scale-[1.04]"
          >
            <span className="absolute inset-0 rounded-[6px] bg-[#cc2121] blur-md opacity-25" />
            <span
              className="relative border-y-[4px] border-l-[6px] border-y-transparent border-l-white"
              style={{ marginLeft: 1 }}
            />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-zinc-50">
            scrape
          </span>
        </Link>
      </div>

      <div className="flex-1 max-w-2xl mx-auto">
        <div
          className={`flex items-center h-10 rounded-full border transition-all ${
            focused
              ? "border-white/25 bg-[#121212] shadow-[inset_0_1px_2px_rgba(0,0,0,0.6),0_0_0_3px_rgba(59,130,246,0.15)]"
              : "border-white/[0.08] bg-[#121212] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
          }`}
        >
          <div
            className={`pl-4 pr-2 transition-colors ${
              focused ? "text-zinc-200" : "text-zinc-500"
            }`}
          >
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
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#cc2121] hover:bg-[#e22828] text-white text-sm font-medium tracking-tight transition-all active:scale-[0.97] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_14px_rgba(204,33,33,0.35)]"
        >
          <Plus size={16} weight="bold" />
          <span className="hidden sm:inline">Add video</span>
        </button>
      </div>
    </header>
  );
}
