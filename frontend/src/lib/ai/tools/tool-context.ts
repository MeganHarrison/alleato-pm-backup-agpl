/**
 * ToolContext — the request-scoped data seam for AI tools.
 *
 * Before this module, every tool factory and service reached past its own
 * interface to construct its own dependencies: `createServiceClient()`,
 * `createRagServiceClient()`, and `getOpenAI()` were duplicated across ~45
 * files / ~89 call sites. That made each factory untestable without mocking the
 * import boundary, and turned any env/key/RLS-client-strategy change into a
 * repo-wide sweep.
 *
 * ToolContext is the single interface those dependencies now sit behind. There
 * are two adapters:
 *   - createToolContext()      — the production adapter (real clients).
 *   - createFakeToolContext()  — the test adapter (stubs supplied by the test).
 *
 * Two adapters mean the seam is real, not hypothetical. A factory accepts a
 * ToolContext and never learns where its `db` came from.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpenAI } from "openai";

import type { Database } from "@/types/database.types";
import type { Database as RagDatabase } from "@/types/rag-database.types";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";

import { createToolGuardrails, type ToolGuardrails } from "./guardrails";
import { getOpenAI } from "./tool-utils";

/**
 * The data dependencies a tool factory needs at runtime. Scope-agnostic on
 * purpose: this is the *only* thing a factory must learn to read/write data and
 * embed text. The chat model provider is deliberately NOT here — that is the
 * orchestration layer's concern (ChatDeps), not the data tools' concern.
 */
export interface ToolContext {
  /** PM APP project DB (service role, RLS-bypassing). */
  db: SupabaseClient<Database>;
  /** AI Database project: document_chunks / rag_* (service role). */
  rag: SupabaseClient<RagDatabase>;
  /** Embeddings + lightweight OpenAI calls used inside tool execution. */
  openai: OpenAI;
  /** Per-user/project access scope (already a deep module of its own). */
  guardrails: ToolGuardrails;
}

export interface CreateToolContextInput {
  userId: string;
  pinnedProjectId?: number;
  /** Override any port — used by callers that already hold a client, and tests. */
  overrides?: Partial<ToolContext>;
}

/**
 * Production adapter. The ONE place that owns env-var resolution, dual-DB key
 * selection, and guardrail wiring. Build it once per request and thread it
 * through the factory tree; composed sub-factories share the same context, so
 * the whole tree collapses to a single set of clients per request.
 */
export function createToolContext(input: CreateToolContextInput): ToolContext {
  const db = input.overrides?.db ?? createServiceClient();
  const rag = input.overrides?.rag ?? createRagServiceClient();
  const openai = input.overrides?.openai ?? getOpenAI();
  const guardrails =
    input.overrides?.guardrails ??
    createToolGuardrails(input.userId, {
      pinnedProjectId: input.pinnedProjectId,
      db,
    });

  return { db, rag, openai, guardrails };
}

/**
 * Test adapter. Pass whatever ports the test needs to drive; the rest throw on
 * use so a test can't accidentally reach a real client. This is the second
 * adapter that makes the seam real.
 */
export function createFakeToolContext(
  overrides: Partial<ToolContext> = {},
): ToolContext {
  const unset = (name: keyof ToolContext) =>
    new Proxy(
      {},
      {
        get() {
          throw new Error(
            `createFakeToolContext: '${name}' was used but not provided to the fake ToolContext.`,
          );
        },
      },
    );

  return {
    db: overrides.db ?? (unset("db") as ToolContext["db"]),
    rag: overrides.rag ?? (unset("rag") as ToolContext["rag"]),
    openai: overrides.openai ?? (unset("openai") as ToolContext["openai"]),
    guardrails:
      overrides.guardrails ?? (unset("guardrails") as ToolContext["guardrails"]),
  };
}
