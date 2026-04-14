export const FOLDER_COLORS = [
  "slate",
  "rose",
  "amber",
  "lime",
  "emerald",
  "sky",
  "violet",
  "fuchsia",
] as const;

export type FolderColor = (typeof FOLDER_COLORS)[number];

export function isFolderColor(value: unknown): value is FolderColor {
  return typeof value === "string" && (FOLDER_COLORS as readonly string[]).includes(value);
}

export interface Category {
  name: string;
  parent: string | null;
  color: string | null;
  count: number;
}

export interface VideoSummary {
  id: string;
  title: string;
  channel: string;
  upload_date: string | null;
  scraped_at: string;
  category: string | null;
}
