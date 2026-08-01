# Handoff: Vercel build OOM correction

## Intake Block

1) Session ID: SOOM0731
2) Task ID: AAI-VERCEL-OOM
3) Current status: Ready for one production deployment
4) Owned files: build runner, focused memory-policy test, task, and handoff
5) Overlap: `frontend/next.config.ts` is owned by active session SEVEA0731 / AAI-1304
6) Exact next step: publish the combined cache/heap candidate based on current
   `origin/main`, then observe one Vercel build
7) Migration ledger evidence: Not applicable

## Root cause

The first production failure began immediately after commit `eb6c96ad4` removed
the Vercel Webpack cache disable. The build runner always removes `.next`, so the
cache cannot accelerate the next build and only adds peak serialization memory.
Raising V8 from 7168 MB to 11264 MB masked the parent-process heap error but
caused the 16 GB container to kill Next.js after compilation.

## Evidence

- Ready: `5323c2771`, deployment
  `project-management-agent-8sa0tgz8u-the-alleato-group.vercel.app`.
- First failed regression: `eb6c96ad4`, deployment
  `project-management-agent-fpe7ct3q9-the-alleato-group.vercel.app`.
- Plane deployment: `47533d670`, explicit Vercel OOM/SIGKILL after 8.5 minutes.
- Newer `20976467c` deployment failed identically, proving the issue persists on
  post-Plane main.
- Latest combined candidate includes `origin/main` commit `ee50c3d749`, which
  already reduces source-map emission and removes generated database types from
  the route graph.
- Focused memory-policy test: 2 passed; candidate diff check: passed.
