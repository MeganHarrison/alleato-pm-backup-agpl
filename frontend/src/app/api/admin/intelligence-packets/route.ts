export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { serviceDb } from "@/lib/supabase/service-db";

import { requireAdmin } from "../_shared";

export const GET = withApiGuardrails(
  "/api/admin/intelligence-packets#GET",
  async () => {
    await requireAdmin("/api/admin/intelligence-packets#GET");


    const { data: packets, error: packetsError } = await serviceDb.from("intelligence_packets")
      .select(
        "id, packet_type, packet_version, compiler_version, generated_at, created_at, executive_summary, freshness_status, current_status, target_id, review_queue_count, stale_item_count, covered_start_at, covered_end_at, strategic_read, why_it_matters, recommended_next_moves, confidence_summary, source_coverage",
      )
      .order("generated_at", { ascending: false })
      .limit(500);

    if (packetsError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/admin/intelligence-packets#GET",
        message: "Failed to load intelligence packets.",
        details: { reason: packetsError.message },
        cause: packetsError,
      });
    }

    const rows = packets ?? [];

    if (rows.length === 0) {
      return NextResponse.json([]);
    }

    const targetIds = [...new Set(rows.map((r) => r.target_id).filter(Boolean))];

    const { data: targets, error: targetsError } = await serviceDb.from("intelligence_targets")
      .select("id, name, slug, target_type, project_id")
      .in("id", targetIds);

    if (targetsError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "/api/admin/intelligence-packets#GET",
        message: "Failed to load intelligence targets.",
        details: { reason: targetsError.message },
        cause: targetsError,
      });
    }

    const targetById = new Map((targets ?? []).map((t) => [t.id, t]));

    const enriched = rows.map((row) => {
      const target = targetById.get(row.target_id);
      return {
        id: row.id,
        packet_type: row.packet_type,
        packet_version: row.packet_version,
        compiler_version: row.compiler_version,
        generated_at: row.generated_at,
        created_at: row.created_at,
        executive_summary: row.executive_summary,
        freshness_status: row.freshness_status,
        current_status: row.current_status,
        target_id: row.target_id,
        target_name: target?.name ?? null,
        target_type: target?.target_type ?? null,
        target_slug: target?.slug ?? null,
        project_id: target?.project_id ?? null,
        review_queue_count: row.review_queue_count,
        stale_item_count: row.stale_item_count,
        covered_start_at: row.covered_start_at,
        covered_end_at: row.covered_end_at,
        strategic_read: row.strategic_read,
        why_it_matters: row.why_it_matters,
        recommended_next_moves: row.recommended_next_moves ?? [],
        confidence_summary: row.confidence_summary ?? null,
        source_coverage: row.source_coverage ?? null,
      };
    });

    return NextResponse.json(enriched);
  },
);
