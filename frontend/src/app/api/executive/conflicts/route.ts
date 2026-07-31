import { NextResponse } from "next/server";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { createExecutiveClaimConflict } from "@/lib/executive/executive-attention-conflicts";
import { createExecutiveConflictRequestSchema, ownershipRoutes } from "@/lib/executive/executive-conflict-contract";
import { loadExecutiveConflictFeed } from "@/lib/executive/executive-conflicts";
import { GuardrailError } from "@/lib/guardrails/errors";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { createServiceClient } from "@/lib/supabase/service";

function requireCurrentBrief(feed: Awaited<ReturnType<typeof loadExecutiveConflictFeed>>, briefId: string) {
  if (feed.canonicalPacket.id !== briefId) {
    throw new GuardrailError({ code: "PRECONDITION_FAILED", where: "api.executive.conflicts", status: 409, message: "Conflict resolution is available only for the current canonical Daily Brief. Open the current brief before recording or resolving a conflict." });
  }
}

export const GET = withApiGuardrails(
  "api.executive.conflicts.GET",
  async ({ request }) => {
    await requireCurrentUserExecutiveDetail("api.executive.conflicts.GET");
    const briefId = new URL(request.url).searchParams.get("briefId");
    if (!briefId) throw new GuardrailError({ code: "BAD_REQUEST", where: "api.executive.conflicts.GET", status: 400, message: "A Daily Brief id is required to load executive conflicts." });
    const feed = await loadExecutiveConflictFeed();
    requireCurrentBrief(feed, briefId);
    return NextResponse.json(feed);
  },
);

export const POST = withApiGuardrails(
  "api.executive.conflicts.POST",
  async ({ request }) => {
    const { user } = await requireCurrentUserExecutiveDetail("api.executive.conflicts.POST");
    const body = await parseJsonBody(request, createExecutiveConflictRequestSchema, "api.executive.conflicts.POST");
    const feed = await loadExecutiveConflictFeed();
    requireCurrentBrief(feed, body.briefId);
    const attention = feed.attention.find((item) => item.id === body.attentionId);
    if (!attention || ["resolved", "dismissed"].includes(attention.lifecycle)) {
      throw new GuardrailError({ code: "PRECONDITION_FAILED", where: "api.executive.conflicts.POST", status: 409, message: "A conflict must attach to an open Executive Attention item from the current Daily Brief." });
    }
    const conflictId = await createExecutiveClaimConflict(createServiceClient(), {
      attention_id: attention.id,
      subject: body.subject,
      priority: body.priority,
      resolution_due_at: body.dueAt,
      accountable_resolver_label: body.accountableResolverLabel,
      actor_kind: "human",
      actor_label: user.email || user.id,
      metadata: {
        domain: body.domain,
        ownership_route: ownershipRoutes[body.domain],
        impact_of_delay: body.impactOfDelay,
        canonical_packet_id: feed.canonicalPacket.id,
        canonical_packet_authority: feed.canonicalPacket.authority,
        canonical_packet_freshness: feed.canonicalPacket.freshness,
      },
      claims: body.claims.map((claim) => ({
        claim_label: claim.label,
        claim_value: { statement: claim.statement, authority: claim.authority, freshness: claim.freshness },
        source_type: claim.sourceType,
        source_id: claim.sourceId,
        source_hash: claim.sourceHash,
        source_url: claim.sourceUrl,
        source_excerpt: claim.sourceExcerpt,
        asserted_at: claim.assertedAt,
      })),
    });
    return NextResponse.json({ conflictId }, { status: 201 });
  },
);
