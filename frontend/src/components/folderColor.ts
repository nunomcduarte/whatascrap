import type { FolderColor } from "@/lib/folders";

export const COLOR_DOT: Record<FolderColor, string> = {
  slate: "bg-slate-400",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  lime: "bg-lime-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  fuchsia: "bg-fuchsia-500",
};

export const COLOR_TINT: Record<FolderColor, string> = {
  slate: "bg-slate-400/15 text-slate-200 ring-slate-400/30",
  rose: "bg-rose-500/15 text-rose-200 ring-rose-500/30",
  amber: "bg-amber-500/15 text-amber-100 ring-amber-500/30",
  lime: "bg-lime-500/15 text-lime-100 ring-lime-500/30",
  emerald: "bg-emerald-500/15 text-emerald-100 ring-emerald-500/30",
  sky: "bg-sky-500/15 text-sky-100 ring-sky-500/30",
  violet: "bg-violet-500/15 text-violet-100 ring-violet-500/30",
  fuchsia: "bg-fuchsia-500/15 text-fuchsia-100 ring-fuchsia-500/30",
};

export function dotClass(color: string | null | undefined): string {
  if (color && color in COLOR_DOT) return COLOR_DOT[color as FolderColor];
  return "bg-zinc-500";
}

export function tintClass(color: string | null | undefined): string {
  if (color && color in COLOR_TINT) return COLOR_TINT[color as FolderColor];
  return "bg-white/[0.06] text-zinc-300 ring-white/[0.08]";
}
