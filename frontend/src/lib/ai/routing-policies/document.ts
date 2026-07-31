import type { AssistantToolRoutingPolicy } from "@/lib/ai/tool-registry";

export const documentRoutingPolicy: AssistantToolRoutingPolicy = {
  useWhen: [
    "User asks to search across documents, RAG chunks, OneDrive/SharePoint files, specs, drawings, or broad unstructured evidence.",
    "User asks a cross-source investigation spanning more than one source family.",
  ],
  doNotUseWhen: [
    "A narrower source-specific path exists for same-day Teams, Outlook inbox, or meeting-date questions.",
    "User asks for structured project/accounting rows rather than unstructured evidence.",
  ],
  preferredFreshness:
    "Use source-specific live/structured retrieval before broad semantic search when the user names one current communication source.",
  emptyResultBehavior:
    "State that document/RAG search returned no matching passages and identify the queried source scope.",
  citationRule:
    "Cite as document/RAG result with title, source type, and date when available.",
  regressionPrompts: [
    "search documents for the insurance requirement",
    "research the emails, Teams, and meetings to see where this started",
  ],
};
