import Link from "next/link";

import { Footer } from "./footer";

export function ConnectLinear({ error }: { error?: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16">
      <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/60 p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600 text-2xl font-bold text-primary-foreground">
          ◣
        </div>

        <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
          Vercel Connect
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Connect your Linear workspace
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
          Authorize your Linear to see your upcoming deadlines, SLA risk, and
          assigned issues.
        </p>

        {error ? (
          <p className="mt-5 rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <Link
          href="/api/linear/authorize"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          Authorize Linear
          <span aria-hidden>→</span>
        </Link>
      </div>

      <Footer />
    </main>
  );
}
