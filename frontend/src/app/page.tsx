import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-medium">whatascrap</h1>
          <span className="text-sm text-muted">{user.email}</span>
        </header>

        <section className="rounded-2xl border border-border bg-surface p-8 text-center">
          <h2 className="text-lg font-medium mb-2">Your library is empty</h2>
          <p className="text-sm text-muted">
            Save videos via the Chrome extension (coming Week 2) or paste URLs
            once Week 3 ports the import flow.
          </p>
        </section>

        <form action="/auth/signout" method="post">
          <button className="text-sm text-muted hover:text-foreground underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
