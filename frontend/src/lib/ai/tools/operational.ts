import { createToolContext, type ToolContext } from "./tool-context";
import { createProjectRepo } from "@/lib/ai/data/project-repo";
import { createStructuredQueryTools } from "./structured-queries";
import { createProjectDataReadTools } from "./read/project-data-tools";
import { createRagSearchReadTools } from "./read/rag-search-tools";
import { createMemoryReadTools } from "./read/memory-tools";
import { createMeetingReadTools } from "./read/meeting-tools";
import { createEmailSearchReadTools } from "./read/email-search-tools";
import { createCommunicationSearchReadTools } from "./read/communication-search-tools";
import { createImplementationStatusReadTools } from "./read/implementation-status-tools";
import type { OperationalToolInternals } from "./read/operational-internals";

// Re-export the options type so existing consumers don't break.
export type { CreateOperationalToolsOptions } from "./read/operational-internals";

type CreateOperationalToolsOptions = import("./read/operational-internals").CreateOperationalToolsOptions;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOperationalTools(
  userId: string,
  options: CreateOperationalToolsOptions = {},
) {
  const ctx =
    options.ctx ??
    createToolContext({ userId, pinnedProjectId: options.pinnedProjectId });
  const supabase = ctx.db;
  const ragSupabase = ctx.rag;
  const guardrails = ctx.guardrails;
  const repo = createProjectRepo(ctx);

  async function requireAdminForCommunications(sourceLabel: string) {
    const scope = await guardrails.getScope();
    if (scope.isAdmin) return { ok: true as const };
    return {
      ok: false as const,
      error:
        `${sourceLabel} access is admin-only in Alleato. ` +
        `I can still use meetings, project records, and documents you have access to.`,
    };
  }

  const internals: OperationalToolInternals = {
    userId,
    options,
    ctx,
    supabase,
    ragSupabase,
    guardrails,
    repo,
    requireAdminForCommunications,
  };

  return {
    ...createProjectDataReadTools(internals),
    ...createRagSearchReadTools(internals),
    ...createMemoryReadTools(internals),
    ...createMeetingReadTools(internals),
    ...createEmailSearchReadTools(internals),
    ...createCommunicationSearchReadTools(internals),
    ...createImplementationStatusReadTools(internals),
    ...createStructuredQueryTools(supabase, guardrails, options),
  };
}
