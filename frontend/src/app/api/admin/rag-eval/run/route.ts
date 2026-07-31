import { NextRequest } from "next/server";
import { z } from "zod";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

/**
 * POST /api/admin/rag-eval/run
 *
 * This route spawns Python eval scripts — it only works in local development.
 * On Vercel, it returns 503 since there's no Python venv available.
 */
const RagEvalTypeSchema = z.enum(["l1", "l2", "reranker", "coverage", "e2e"]);
const RagEvalRequestSchema = z.object({
  type: RagEvalTypeSchema,
});

export const POST = withApiGuardrails("/api/admin/rag-eval/run#POST", async ({ request }) => {
  // OWASP A01:2021 - Broken Access Control: require authenticated admin
  const supabase = await createClient();
  const user = await getApiRouteUser();
  const authError = null as Error | null;
  if (authError || !user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/admin/rag-eval/run#POST",
      message: "Unauthorized RAG eval request.",
      status: 401,
      severity: "medium",
      details: authError ? { reason: authError.message } : undefined,
      cause: authError ?? undefined,
    });
  }
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where: "/api/admin/rag-eval/run#POST",
      message: "Admin access required.",
      status: 403,
      severity: "medium",
    });
  }

  // This route requires a local Python venv and backend scripts.
  // It cannot function on Vercel.
  if (process.env.VERCEL) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "/api/admin/rag-eval/run#POST",
      message: "RAG eval runner is only available in local development.",
      status: 503,
      severity: "low",
      details: { reason: "Requires local Python environment; unavailable on Vercel." },
    });
  }

  // Dynamic imports to avoid bundling child_process/fs/path at trace time
  const { spawn } = await import("child_process");
  const path = await import("path");
  const fs = await import("fs");

  const REPO_ROOT = path.resolve(process.cwd(), "..");
  const PYTHON = process.env.RAG_EVAL_PYTHON_BIN || "python3";
  const RAG_DIR = path.join(REPO_ROOT, "tmp/rag-evals");
  fs.mkdirSync(RAG_DIR, { recursive: true });

  type EvalType = z.infer<typeof RagEvalTypeSchema>;

  const EVAL_CONFIGS: Record<EvalType, { script: string; args: (outputPath: string) => string[]; description: string }> = {
    l1: {
      script: "backend/src/scripts/rag_eval.py",
      args: (out) => ["--verbose", "--output", out],
      description: "L1 Retrieval Eval (MRR, pass rate, source match)",
    },
    l2: {
      script: "backend/src/scripts/rag_answer_eval.py",
      args: (out) => ["--verbose", "--output", out],
      description: "L2 Answer Quality Eval (LLM judge, 5 dimensions)",
    },
    reranker: {
      script: "backend/src/scripts/rag_reranker_eval.py",
      args: (out) => ["--verbose", "--output", out],
      description: "Reranker A/B Eval (with vs. without LLM reranker)",
    },
    coverage: {
      script: "backend/src/scripts/rag_source_coverage.py",
      args: (out) => ["--output", out],
      description: "Source Coverage Diagnostic (chunk counts by source type)",
    },
    e2e: {
      script: "backend/src/scripts/rag_e2e_eval.py",
      args: (out) => ["--verbose", "--output", out],
      description: "L3 End-to-End Eval (SQL tools + vector, financial questions fixed)",
    },
  };

  const body = await parseJsonBody(
    request,
    RagEvalRequestSchema,
    "/api/admin/rag-eval/run#POST",
  );
  const evalType: EvalType = body.type;

  const config = EVAL_CONFIGS[evalType];
  const scriptPath = path.join(REPO_ROOT, config.script);
  const timestamp = new Date().toISOString().slice(0, 10);
  const outputFile = path.join(RAG_DIR, `rag-${evalType}-eval-${timestamp}.json`);
  const args = [scriptPath, ...config.args(outputFile)];

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      function send(event: string, data: unknown) {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      send("start", { type: evalType, description: config.description, timestamp: new Date().toISOString() });

      const proc = spawn(PYTHON, args, {
        cwd: REPO_ROOT,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });

      proc.stdout.on("data", (chunk: Buffer) => {
        const lines = chunk.toString().split("\n").filter(Boolean);
        for (const line of lines) send("log", { line });
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        const lines = chunk.toString().split("\n").filter(Boolean);
        for (const line of lines) send("log", { line });
      });

      proc.on("close", (code) => {
        const success = code === 0;
        let resultData: unknown = null;

        if (success && fs.existsSync(outputFile)) {
          try {
            resultData = JSON.parse(fs.readFileSync(outputFile, "utf-8"));
          } catch (error) {
            send("result_parse_error", {
              message:
                error instanceof Error
                  ? error.message
                  : "Could not parse evaluation result file.",
              outputFile: path.relative(REPO_ROOT, outputFile),
            });
          }
        }

        send("complete", { success, exitCode: code, outputFile: path.relative(REPO_ROOT, outputFile), result: resultData });
        controller.close();
      });

      proc.on("error", (err) => {
        send("error", { message: err.message });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
