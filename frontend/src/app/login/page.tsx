import { login, signup } from "./actions";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form className="w-full max-w-sm flex flex-col gap-4 bg-surface rounded-2xl p-6 border border-border">
        <h1 className="text-xl font-medium">Sign in to your library</h1>

        {error ? (
          <div className="text-sm text-accent rounded-lg border border-accent/40 bg-accent/10 px-3 py-2">
            {error}
          </div>
        ) : null}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Email</span>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-lg bg-background border border-border px-3 py-2 outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Password</span>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            className="rounded-lg bg-background border border-border px-3 py-2 outline-none focus:border-accent"
          />
        </label>

        <div className="flex gap-2 mt-2">
          <button
            formAction={login}
            className="flex-1 rounded-lg bg-accent text-foreground px-4 py-2 font-medium hover:opacity-90"
          >
            Log in
          </button>
          <button
            formAction={signup}
            className="flex-1 rounded-lg bg-surface-hover text-foreground px-4 py-2 font-medium border border-border hover:opacity-90"
          >
            Sign up
          </button>
        </div>
      </form>
    </main>
  );
}
