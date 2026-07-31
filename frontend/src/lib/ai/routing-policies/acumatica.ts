import type { AssistantToolRoutingPolicy } from "@/lib/ai/tool-registry";

export const acumaticaRoutingPolicy: AssistantToolRoutingPolicy = {
  useWhen: [
    "User asks about Acumatica, accounting, AP/AR aging, cash, vendor spend, bills, invoices, purchase orders, or project budget from accounting data.",
  ],
  doNotUseWhen: [
    "User asks for meeting/email/Teams commentary about financial issues rather than accounting rows.",
    "User asks for Procore budget line workflow state rather than Acumatica truth.",
  ],
  preferredFreshness:
    "Use the structured Acumatica tool or sync-health-aware accounting source before interpreting communication evidence.",
  emptyResultBehavior:
    "State that Acumatica/accounting retrieval returned no rows or is stale, and do not invent financial totals.",
  citationRule:
    "Cite as Acumatica/accounting data with report/entity name and as-of time when available.",
  regressionPrompts: [
    "pull current AR aging from Acumatica",
    "which vendors have we spent the most with this year?",
  ],
};
