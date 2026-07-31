import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireAdmin } from "@/app/api/admin/_shared";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const dynamic = "force-dynamic";

const WHERE = "api.admin.eval-runs#GET";
const RUN_ID_PATTERN = /^[A-Za-z0-9._-]+$/;
const MAX_ANSWER_CHARS = 8000;
// Cap how many runs the list reads so the directory (which accumulates over
// time) never makes the page slow. Newest-first; older runs stay on disk.
const LIST_LIMIT = 150;

interface RawScore {
  status?: string;
  toolNames?: string[];
  failures?: string[];
  warnings?: string[];
  finalText?: string;
}

interface RawCase {
  id: string;
  intent?: string;
  prompt?: string;
  durationMs?: number;
  selectedProjectId?: number;
  expectedToolNames?: string[];
  score?: RawScore;
}

interface RawBundle {
  name?: string;
  description?: string;
  criteria?: string[];
}

interface RawRun {
  generatedAt?: string;
  baseUrl?: string;
  bundle?: RawBundle;
  filter?: string;
  totalCases?: number;
  passed?: number;
  failed?: number;
  warningCount?: number;
  results?: RawCase[];
}

// Eval runs are written to repo-root docs/ai-plan/evals/runs/ by the CLI runner
// (gitignored — local only). The API route process usually runs from frontend/,
// so the directory is one level up.
async function findRunsDir(): Promise<string | null> {
  const candidates = [
    path.resolve(process.cwd(), "..", "docs", "ai-plan", "evals", "runs"),
    path.resolve(process.cwd(), "docs", "ai-plan", "evals", "runs"),
  ];
  for (const dir of candidates) {
    try {
      const stat = await fs.stat(dir);
      if (stat.isDirectory()) return dir;
    } catch (error) {
      console.warn(`${WHERE}: eval runs directory candidate unavailable`, {
        dir,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return null;
}

async function readRun(dir: string, runId: string): Promise<RawRun | null> {
  try {
    const raw = await fs.readFile(path.join(dir, runId, "results.json"), "utf8");
    return JSON.parse(raw) as RawRun;
  } catch (error) {
    console.warn(`${WHERE}: eval run results could not be read`, {
      runId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function summarize(runId: string, run: RawRun) {
  return {
    runId,
    generatedAt: run.generatedAt ?? null,
    baseUrl: run.baseUrl ?? null,
    bundleName: run.bundle?.name ?? run.filter ?? "(ad-hoc filter)",
    bundleDescription: run.bundle?.description ?? null,
    totalCases: run.totalCases ?? run.results?.length ?? 0,
    passed: run.passed ?? 0,
    failed: run.failed ?? 0,
    warningCount: run.warningCount ?? 0,
  };
}

function buildDetail(runId: string, run: RawRun) {
  return {
    ...summarize(runId, run),
    bundleCriteria: run.bundle?.criteria ?? [],
    filter: run.filter ?? null,
    cases: (run.results ?? []).map((entry) => ({
      id: entry.id,
      intent: entry.intent ?? null,
      prompt: entry.prompt ?? "",
      durationMs: entry.durationMs ?? null,
      selectedProjectId: entry.selectedProjectId ?? null,
      status: entry.score?.status ?? "unknown",
      expectedToolNames: entry.expectedToolNames ?? [],
      toolsFired: entry.score?.toolNames ?? [],
      failures: entry.score?.failures ?? [],
      warnings: entry.score?.warnings ?? [],
      answer:
        typeof entry.score?.finalText === "string"
          ? entry.score.finalText.slice(0, MAX_ANSWER_CHARS)
          : "",
    })),
  };
}

export const GET = withApiGuardrails(WHERE, async ({ request }) => {
  await requireAdmin(WHERE);

  const dir = await findRunsDir();
  if (!dir) {
    return NextResponse.json({ available: false, runs: [], selectedRun: null });
  }

  const requestedRunId = request.nextUrl.searchParams.get("runId");
  const safeRequestedId =
    requestedRunId && RUN_ID_PATTERN.test(requestedRunId) ? requestedRunId : null;
  const detailOnly = request.nextUrl.searchParams.get("detailOnly") === "1";

  // Fast path: selecting a run only needs that one run's detail (1 file read).
  // The client keeps the existing list in state, so we skip rebuilding it.
  if (detailOnly && safeRequestedId) {
    const run = await readRun(dir, safeRequestedId);
    return NextResponse.json({
      available: true,
      runs: [],
      selectedRun: run ? buildDetail(safeRequestedId, run) : null,
    });
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const runIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a)) // newest first (timestamp-prefixed names)
    .slice(0, LIST_LIMIT);

  // Read all summaries in parallel — sequential awaits made this take ~7s.
  const summaries = (
    await Promise.all(
      runIds.map(async (runId) => {
        const run = await readRun(dir, runId);
        return run ? summarize(runId, run) : null;
      }),
    )
  ).filter((entry): entry is ReturnType<typeof summarize> => entry !== null);

  summaries.sort((a, b) =>
    String(b.generatedAt ?? b.runId).localeCompare(String(a.generatedAt ?? a.runId)),
  );

  const targetRunId = safeRequestedId ?? summaries[0]?.runId;
  let selectedRun = null;
  if (targetRunId) {
    const run = await readRun(dir, targetRunId);
    if (run) selectedRun = buildDetail(targetRunId, run);
  }

  return NextResponse.json({ available: true, runs: summaries, selectedRun });
});
