import { tool } from "ai";
import {
  withTrace as _withTrace,
} from "../tool-utils";
import {
  searchTeamsMessagesDescription,
  searchTeamsMessagesInputSchema,
  searchExternalDocumentsDescription,
  searchExternalDocumentsInputSchema,
} from "@/lib/ai/tool-descriptors";
import { searchDocumentChunksByCategory } from "./shared-search-helpers";
import type { OperationalToolInternals, CreateOperationalToolsOptions } from "./operational-internals";

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateOperationalToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "This operational knowledge source failed during retrieval. Explain the gap plainly and use other available sources before asking for more detail.",
  );
}

export function createCommunicationSearchReadTools(internals: OperationalToolInternals) {
  const { options, supabase, ragSupabase, guardrails } = internals;

  return {
    // -----------------------------------------------------------------
    // 17. searchTeamsMessages — Microsoft Teams channel messages
    // -----------------------------------------------------------------

    searchTeamsMessages: tool({
      description: searchTeamsMessagesDescription,
      inputSchema: searchTeamsMessagesInputSchema,
      execute: withTrace(
        "searchTeamsMessages",
        options,
        async ({ query, matchCount }) => {
          const scope = await guardrails.getScope();
          return searchDocumentChunksByCategory({
            supabase: ragSupabase,
            metadataSupabase: supabase,
            query,
            category: "teams_message",
            matchCount: matchCount ?? 8,
            sourceLabel: "Teams message",
            scope,
          });
        },
      ),
    }),

    // -----------------------------------------------------------------
    // 18. searchExternalDocuments — OneDrive files and uploaded documents
    // -----------------------------------------------------------------

    searchExternalDocuments: tool({
      description: searchExternalDocumentsDescription,
      inputSchema: searchExternalDocumentsInputSchema,
      execute: withTrace(
        "searchExternalDocuments",
        options,
        async ({ query, matchCount }) => {
          const scope = await guardrails.getScope();
          return searchDocumentChunksByCategory({
            supabase: ragSupabase,
            metadataSupabase: supabase,
            query,
            category: "document",
            matchCount: matchCount ?? 8,
            sourceLabel: "document",
            scope,
          });
        },
      ),
    }),
  };
}
