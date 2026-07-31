import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { createExecutiveAttentionItem } from "@/lib/executive/executive-attention-conflicts";
import { loadExecutiveAttentionFeed } from "@/lib/executive/executive-attention";
import { categoryForExecutiveAttentionType, createExecutiveAttentionRequestSchema } from "@/lib/executive/executive-attention-contract";
import { loadCanonicalExecutiveState } from "@/lib/executive/executive-state";
import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createServiceClient } from "@/lib/supabase/service";

function canonicalEvidenceTimestamp(value: string): string {
  // Postgres serializes a UTC offset as `+00` in this seam; JavaScript only
  // recognizes the equivalent RFC 3339 `+00:00` form before converting to Z.
  const normalized = value.replace(/([+-]\d{2})$/, "$1:00");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new GuardrailError({
      code: "PRECONDITION_FAILED",
      where: "api.executive.attention.POST",
      message: "Executive attention requires a canonical packet with a valid generated timestamp.",
      status: 409,
    });
  }
  return date.toISOString();
}

export const GET = withApiGuardrails(
  "api.executive.attention.GET",
  async () => {
    await requireCurrentUserExecutiveDetail("api.executive.attention.GET");
    return NextResponse.json(await loadExecutiveAttentionFeed());
  },
);

export const POST = withApiGuardrails(
  "api.executive.attention.POST",
  async ({ request }) => {
    const { user } = await requireCurrentUserExecutiveDetail("api.executive.attention.POST");
    const body = await parseJsonBody(
      request,
      createExecutiveAttentionRequestSchema,
      "api.executive.attention.POST",
    );
    const state = await loadCanonicalExecutiveState();
    const packetInput = state.inputs.find((input) => input.id === "canonical_packet");
    if (!packetInput || packetInput.freshness !== "fresh" || packetInput.evidenceCount < 1) {
      throw new GuardrailError({
        code: "PRECONDITION_FAILED",
        where: "api.executive.attention.POST",
        message: "Executive attention requires a fresh canonical Daily Brief with source evidence.",
        status: 409,
      });
    }

    const packetHash = createHash("sha256")
      .update(`${state.packet.id}:${state.generatedAt}:${packetInput.evidenceCount}`)
      .digest("hex");
    const packetOccurredAt = canonicalEvidenceTimestamp(state.generatedAt);
    // The database contract deliberately permits creation to service_role only.
    // Capability verification above is the authenticated executive boundary;
    // browser clients cannot invoke this RPC directly and bypass it.
    const db = createServiceClient();
    const attentionId = await createExecutiveAttentionItem(db, {
      category: categoryForExecutiveAttentionType(body.type),
      title: body.title,
      summary: body.summary,
      priority: body.priority,
      accountable_owner_label: body.accountableOwnerLabel,
      due_at: body.dueAt,
      assigned_at: new Date().toISOString(),
      actor_kind: "human",
      metadata: {
        attention_type: body.type,
        impact_of_delay: body.impactOfDelay,
        canonical_packet_id: state.packet.id,
        canonical_packet_generated_at: state.generatedAt,
        canonical_packet_freshness: packetInput.freshness,
        created_by_label: user.email || user.id,
      },
      evidence: [{
        source_type: "intelligence_packet",
        source_id: state.packet.id,
        source_hash: packetHash,
        source_excerpt: body.summary,
        // The state seam may carry a PostgreSQL offset timestamp; the AAI-1097
        // contract intentionally accepts only canonical ISO UTC evidence times.
        source_occurred_at: packetOccurredAt,
        metadata: { canonical_packet: true, evidence_count: packetInput.evidenceCount },
      }],
    });
    return NextResponse.json({ attentionId }, { status: 201 });
  },
);
