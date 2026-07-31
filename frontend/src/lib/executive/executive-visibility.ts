import "server-only";

import {
  canCurrentUserAccessAppCapability,
  requireCurrentUserAppCapability,
} from "@/lib/app-capabilities";

/**
 * One role boundary for every consumer of the governed executive model.
 * Briefing access is deliberately summary-only; claims, evidence excerpts and
 * URLs, named actions, lineage, health detail, and full artifacts require the
 * explicit detail capability. Callers must never infer this from UI state.
 */
export type ExecutiveVisibility = "summary" | "detail";

export async function loadCurrentUserExecutiveVisibility(): Promise<ExecutiveVisibility | null> {
  if (!await canCurrentUserAccessAppCapability("view_executive_briefing")) return null;
  return await canCurrentUserAccessAppCapability("view_executive_details") ? "detail" : "summary";
}

export async function requireCurrentUserExecutiveDetail(where: string) {
  await requireCurrentUserAppCapability(
    "view_executive_briefing",
    where,
    "Executive briefing access required.",
  );
  return requireCurrentUserAppCapability(
    "view_executive_details",
    where,
    "Executive detail access is required. This role can view the briefing summary but not claims, evidence, actions, lineage, health detail, or artifacts.",
  );
}
