# Supabase Package Conflicts

**Trigger:** Before any Supabase-related work (installing packages, updating auth, modifying client setup).

## The Rule

**NEVER** install both `@supabase/auth-helpers-nextjs` (deprecated) AND `@supabase/ssr` (current). They conflict and cause cryptic webpack errors that crash the dev server.

## Before Any Supabase Work

```bash
npm list | grep "auth-helpers"
```

If `@supabase/auth-helpers-nextjs` is found, remove it immediately:

```bash
cd frontend && npm uninstall @supabase/auth-helpers-nextjs && rm -rf node_modules/.cache && npm install
```

## Correct Package

Use `@supabase/ssr` — it is the current, supported package for Next.js + Supabase.

## Why This Exists

This conflict has crashed the dev server multiple times. The error messages are misleading (webpack module resolution errors) and don't mention the package conflict directly, leading to wasted debugging time.
