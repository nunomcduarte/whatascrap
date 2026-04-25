import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface VideoRow {
  youtube_id: string;
  title: string;
  channel: string;
  scraped_at: string;
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: videos } = await supabase
    .from("videos")
    .select("youtube_id, title, channel, scraped_at")
    .order("scraped_at", { ascending: false })
    .returns<VideoRow[]>();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-medium">whatascrap</h1>
          <span className="text-sm text-muted">{user.email}</span>
        </header>

        {!videos || videos.length === 0 ? (
          <section className="rounded-2xl border border-border bg-surface p-8 text-center">
            <h2 className="text-lg font-medium mb-2">Your library is empty</h2>
            <p className="text-sm text-muted">
              Install the WhatAScrap extension (see <code>extension/README.md</code>),
              open a YouTube video, and click the red <strong>Save to library</strong>{" "}
              button next to its transcript.
            </p>
          </section>
        ) : (
          <ul className="flex flex-col gap-2">
            {videos.map((v) => (
              <li key={v.youtube_id}>
                <a
                  href={`https://www.youtube.com/watch?v=${v.youtube_id}`}
                  className="block rounded-lg border border-border bg-surface hover:bg-surface-hover p-4 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="font-medium">{v.title}</div>
                  <div className="text-sm text-muted mt-1">
                    {v.channel} ·{" "}
                    {new Date(v.scraped_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}

        <form action="/auth/signout" method="post">
          <button className="text-sm text-muted hover:text-foreground underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
