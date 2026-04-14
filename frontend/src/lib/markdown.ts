import type { Video } from "./db";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-");
}

export function renderVideoMarkdown(video: Video): string {
  return `# ${video.title}

**Channel:** ${video.channel}
**Upload Date:** ${video.upload_date || "Unknown"}
**Scraped Date:** ${video.scraped_at.split("T")[0]}
**URL:** ${video.url}

## Transcript

${video.transcript}
`;
}

export function videoFilename(video: Video): string {
  return `${slugify(video.channel)}-${slugify(video.title)}.md`;
}
