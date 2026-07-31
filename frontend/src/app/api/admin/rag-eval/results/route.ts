import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import assistantEvalRunsManifest from "@/data/assistant-eval-runs.json";

type AssistantEvalCase = {
  id: string;
  prompt: string;
  intent: string | null;
  status: string;
  durationMs: number | null;
  streamEventCount: number | null;
  toolNames: string[];
  failures: string[];
  warnings: string[];
  observations: string[];
  finalText: string;
  latencyBudget: {
    warnDurationMs: number | null;
    maxDurationMs: number | null;
    durationMs: number | null;
  } | null;
};

type AssistantEvalRun = {
  runId: string;
  generatedAt: string | null;
  baseUrl: string | null;
  bundle: string | null;
  filter: string | null;
  totalCases: number;
  passed: number;
  failed: number;
  warningCount: number;
  slowestCases: Array<{
    id: string;
    intent: string | null;
    durationMs: number | null;
    status: string;
    warnings: string[];
  }>;
  cases: AssistantEvalCase[];
};

/**
 * GET /api/admin/rag-eval/results
 * Returns the latest RAG baselines and AI assistant eval-suite runs from disk.
 * Only works in local development (reads files from repo root).
 */
export const GET = withApiGuardrails("/api/admin/rag-eval/results#GET", async () => {
  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "/api/admin/rag-eval/results#GET", message: "Authentication required.", status: 401 });
  }
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) {
    throw new GuardrailError({ code: "FORBIDDEN", where: "/api/admin/rag-eval/results#GET", message: "Admin access required.", status: 403 });
  }

  const publishedAssistantEvalRuns =
    (assistantEvalRunsManifest as { runs?: AssistantEvalRun[] }).runs ?? [];

  if (process.env.VERCEL) {
    return NextResponse.json({
      l1: {
        data: null,
        file: null,
      },
      l2: {
        data: null,
        file: null,
      },
      assistant: {
        runs: publishedAssistantEvalRuns,
      },
    });
  }

  const fs = await import("fs");
  const path = await import("path");

  const REPO_ROOT = path.resolve(process.cwd(), "..");
  const RAG_DIR = path.join(REPO_ROOT, "tmp/rag-evals");

  function readJsonFile(filePath: string) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function latestFileMatching(dir: string, pattern: RegExp) {
    try {
      const files = fs.readdirSync(dir).filter((f: string) => pattern.test(f));
      if (!files.length) return null;
      files.sort().reverse();
      return path.join(dir, files[0]);
    } catch {
      return null;
    }
  }

  function loadAssistantRuns() {
    const runsDir = path.join(REPO_ROOT, "docs/ai-plan/evals/runs");
    try {
      return fs
        .readdirSync(runsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .reverse()
        .slice(0, 20)
        .map((runId) => {
          const resultPath = path.join(runsDir, runId, "results.json");
          const result = readJsonFile(resultPath);
          if (!result) return null;

          const cases: AssistantEvalCase[] = Array.isArray(result.results)
            ? result.results.map((testCase: Record<string, unknown>) => {
                const score = (testCase.score ?? {}) as Record<string, unknown>;
                const latencyBudget = (score.latencyBudget ?? {}) as Record<string, unknown>;
                return {
                  id: String(testCase.id ?? ""),
                  prompt: String(testCase.prompt ?? ""),
                  intent: typeof testCase.intent === "string" ? testCase.intent : null,
                  status: typeof score.status === "string" ? score.status : "unknown",
                  durationMs:
                    typeof testCase.durationMs === "number" ? testCase.durationMs : null,
                  streamEventCount:
                    typeof testCase.streamEventCount === "number"
                      ? testCase.streamEventCount
                      : null,
                  toolNames: Array.isArray(score.toolNames)
                    ? score.toolNames.filter((tool): tool is string => typeof tool === "string")
                    : [],
                  failures: Array.isArray(score.failures)
                    ? score.failures.filter((failure): failure is string => typeof failure === "string")
                    : [],
                  warnings: Array.isArray(score.warnings)
                    ? score.warnings.filter((warning): warning is string => typeof warning === "string")
                    : [],
                  observations: Array.isArray(score.observations)
                    ? score.observations.filter((observation): observation is string => typeof observation === "string")
                    : [],
                  finalText: typeof score.finalText === "string" ? score.finalText : "",
                  latencyBudget:
                    Object.keys(latencyBudget).length > 0
                      ? {
                          warnDurationMs:
                            typeof latencyBudget.warnDurationMs === "number"
                              ? latencyBudget.warnDurationMs
                              : null,
                          maxDurationMs:
                            typeof latencyBudget.maxDurationMs === "number"
                              ? latencyBudget.maxDurationMs
                              : null,
                          durationMs:
                            typeof latencyBudget.durationMs === "number"
                              ? latencyBudget.durationMs
                              : null,
                        }
                      : null,
                };
              })
            : [];

          return {
            runId,
            generatedAt: typeof result.generatedAt === "string" ? result.generatedAt : null,
            baseUrl: typeof result.baseUrl === "string" ? result.baseUrl : null,
            bundle: typeof result.bundle === "string" ? result.bundle : null,
            filter: typeof result.filter === "string" ? result.filter : null,
            totalCases: typeof result.totalCases === "number" ? result.totalCases : cases.length,
            passed:
              typeof result.passed === "number"
                ? result.passed
                : cases.filter((testCase) => testCase.status === "pass").length,
            failed:
              typeof result.failed === "number"
                ? result.failed
                : cases.filter((testCase) => testCase.status === "fail").length,
            warningCount:
              typeof result.warningCount === "number"
                ? result.warningCount
                : cases.reduce((count, testCase) => count + testCase.warnings.length, 0),
            slowestCases: Array.isArray(result.slowestCases)
              ? result.slowestCases
                  .map((slowCase: Record<string, unknown>) => ({
                    id: String(slowCase.id ?? ""),
                    intent: typeof slowCase.intent === "string" ? slowCase.intent : null,
                    durationMs:
                      typeof slowCase.durationMs === "number" ? slowCase.durationMs : null,
                    status: typeof slowCase.status === "string" ? slowCase.status : "unknown",
                    warnings: Array.isArray(slowCase.warnings)
                      ? slowCase.warnings.filter((warning): warning is string => typeof warning === "string")
                      : [],
                  }))
                  .filter((slowCase: { id: string; intent: string | null; durationMs: number | null; status: string; warnings: string[] }): boolean => Boolean(slowCase.id))
              : [...cases]
                  .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
                  .slice(0, 10)
                  .map((testCase) => ({
                    id: testCase.id,
                    intent: testCase.intent,
                    durationMs: testCase.durationMs,
                    status: testCase.status,
                    warnings: testCase.warnings,
                  })),
            cases,
          };
        })
        .filter((run): run is AssistantEvalRun => Boolean(run));
    } catch (error) {
      console.warn("[rag-eval/results] Unable to load assistant eval runs.", error);
      return [];
    }
  }

  const l1Path = latestFileMatching(RAG_DIR, /^rag-eval-baseline.*\.json$/);
  const l2Path = latestFileMatching(RAG_DIR, /^rag-answer-eval-baseline.*\.json$/);

  const l1 = l1Path ? readJsonFile(l1Path) : null;
  const l2 = l2Path ? readJsonFile(l2Path) : null;
  const assistantRuns = loadAssistantRuns();

  return NextResponse.json({
    l1: {
      data: l1,
      file: l1Path ? path.relative(REPO_ROOT, l1Path) : null,
    },
    l2: {
      data: l2,
      file: l2Path ? path.relative(REPO_ROOT, l2Path) : null,
    },
    assistant: {
      runs: assistantRuns.length > 0 ? assistantRuns : publishedAssistantEvalRuns,
    },
  });
});
