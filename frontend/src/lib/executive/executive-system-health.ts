import "server-only";

import { loadCanonicalExecutiveState, type CanonicalExecutiveState, type ExecutiveStateInput } from "./executive-state";
import { loadExecutiveConflictFeed } from "./executive-conflicts";

export type ExecutiveHealthImpact = "decision_blocker" | "material_risk" | "delivery_risk" | "advisory";
export type ExecutiveHealthException = { id: string; businessImpact: ExecutiveHealthImpact; title: string; affectedSurface: string; owner: string; recoveryPath: string; evidenceOwner: string; detail: string };
export type ExecutiveOperatingSystemNode = { id: string; title: string; owner: string; health: "healthy" | "exception"; lastSuccessfulUpdate: string | null; affectedSurface: string };
export type ExecutiveSystemHealth = { nodes: ExecutiveOperatingSystemNode[]; exceptions: ExecutiveHealthException[]; claimIds: string[] };

const impactOrder: Record<ExecutiveHealthImpact, number> = { decision_blocker: 0, material_risk: 1, delivery_risk: 2, advisory: 3 };
function node(input: ExecutiveStateInput, title: string, affectedSurface: string): ExecutiveOperatingSystemNode { return { id: input.id, title, owner: input.readOwner, health: input.freshness === "fresh" && input.evidenceCount > 0 ? "healthy" : "exception", lastSuccessfulUpdate: null, affectedSurface }; }

/** Bounded executive exception reducer. It returns recovery decisions, never raw telemetry. */
export async function loadExecutiveSystemHealth(): Promise<ExecutiveSystemHealth> {
  const [state, conflicts] = await Promise.all([loadCanonicalExecutiveState(), loadExecutiveConflictFeed()]);
  const input = (id: ExecutiveStateInput["id"]) => state.inputs.find((item) => item.id === id)!;
  const nodes = [node(input("canonical_packet"), "Source to canonical packet", "Daily Brief"), node(input("project_operating_record"), "Controlled operating projection", "Project impact"), node(input("delivery_receipts"), "Packet-correlated delivery", "Executive delivery")];
  const exceptions: ExecutiveHealthException[] = [];
  const packet = input("canonical_packet");
  if (packet.freshness !== "fresh" || packet.evidenceCount < 1) exceptions.push({ id: "canonical-packet", businessImpact: "decision_blocker", title: "Canonical packet is stale or missing evidence", affectedSurface: "Daily Brief decisions", owner: "Daily Brief compiler owner", recoveryPath: "Recompile the canonical packet; do not regenerate in the UI.", evidenceOwner: "intelligence_packets", detail: `Packet freshness is ${packet.freshness} with ${packet.evidenceCount} evidence references.` });
  const projection = input("project_operating_record");
  if (projection.freshness !== "fresh" || state.projects.some((project) => !project.projectionWriter || !project.projectionGeneratedAt || !project.projectionEnvelopeId)) exceptions.push({ id: "projection-provenance", businessImpact: "material_risk", title: "Project projection lacks current provenance", affectedSurface: "Project impact", owner: "Projection owner", recoveryPath: "Repair or replay the controlled projection; never write page-local state.", evidenceOwner: "project_current_state provenance", detail: "At least one project impact record is missing a current controlled projection provenance chain." });
  for (const conflict of conflicts.conflicts.filter((item) => !["resolved", "dismissed"].includes(item.status))) exceptions.push({ id: `conflict-${conflict.id}`, businessImpact: "decision_blocker", title: `Unresolved authoritative conflict: ${conflict.subject}`, affectedSurface: "Executive decision", owner: conflict.resolver || "Domain resolver", recoveryPath: "Human resolves through the controlled conflict RPC.", evidenceOwner: "AAI-1097 executive conflict history", detail: conflict.impactOfDelay });
  const delivery = input("delivery_receipts");
  if (delivery.evidenceCount < 1) exceptions.push({ id: "delivery-unproven", businessImpact: "delivery_risk", title: "Packet delivery is unproven", affectedSurface: "Executive delivery", owner: "Delivery owner", recoveryPath: "Retry or inspect packet-correlated delivery; do not claim sent.", evidenceOwner: "ai_work_run_artifacts + ai_work_run_delivery_attempts", detail: "No sent or delivered receipt is correlated to the canonical packet." });
  return { nodes, exceptions: exceptions.sort((a, b) => impactOrder[a.businessImpact] - impactOrder[b.businessImpact] || a.title.localeCompare(b.title)), claimIds: conflicts.conflicts.flatMap((conflict) => conflict.claims.map((claim) => claim.id)) };
}
