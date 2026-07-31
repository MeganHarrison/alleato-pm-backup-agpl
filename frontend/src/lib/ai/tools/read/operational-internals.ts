/**
 * Shared closure shape for operational read-tool domain factories.
 *
 * Each domain factory receives this bundle instead of reaching into the
 * closure directly, making dependencies explicit and the modules testable
 * in isolation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Database as RagDatabase } from "@/types/rag-database.types";
import type { ToolContext } from "../tool-context";
import type { ToolGuardrails } from "../guardrails";
import type { createProjectRepo } from "@/lib/ai/data/project-repo";

export type CreateOperationalToolsOptions = {
  onTrace?: (trace: import("../tool-utils").ToolTracePayload) => void;
  pinnedProjectId?: number;
  ctx?: ToolContext;
};

export type OperationalToolInternals = {
  userId: string;
  options: CreateOperationalToolsOptions;
  ctx: ToolContext;
  supabase: SupabaseClient<Database>;
  ragSupabase: SupabaseClient<RagDatabase>;
  guardrails: ToolGuardrails;
  repo: ReturnType<typeof createProjectRepo>;
  requireAdminForCommunications: (
    sourceLabel: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
};
