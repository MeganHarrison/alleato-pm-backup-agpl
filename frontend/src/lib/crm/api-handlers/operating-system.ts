import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import {
  assertCrmOwnerOrAdmin,
  requireCrmAccess,
} from "@/lib/crm/server";
import { GuardrailError } from "@/lib/guardrails/errors";

const OperationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("save_connection_preferences"),
    privacy_mode: z.enum(["business_only", "selected_folders", "disabled"]),
    automatic_matching_enabled: z.boolean(),
  }),
  z.object({
    operation: z.literal("capture_forecast"),
  }),
  z.object({
    operation: z.literal("save_deal_controls"),
    deal_id: z.string().uuid(),
    forecast_category: z.enum(["pipeline", "best_case", "commit", "omitted"]),
    pursuit_type: z
      .enum(["negotiated", "invited_bid", "public_bid", "service", "other"])
      .nullable(),
    bid_due_date: z.string().datetime().nullable(),
    qualification_score: z.number().int().min(0).max(100).nullable(),
    win_loss_notes: z.string().trim().max(5000).nullable(),
  }),
  z.object({
    operation: z.literal("save_stage_requirement"),
    stage_id: z.string().uuid(),
    label: z.string().trim().min(1).max(200),
    requirement_key: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9_]+$/),
    guidance: z.string().trim().max(1000).nullable(),
    is_required: z.boolean(),
  }),
  z.object({
    operation: z.literal("save_sales_asset"),
    asset_type: z.enum([
      "cadence",
      "playbook",
      "email_template",
      "meeting_template",
    ]),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).nullable(),
    steps: z
      .array(z.record(z.string(), z.unknown()))
      .min(1)
      .max(50),
    submit_for_review: z.boolean(),
  }),
  z.object({
    operation: z.literal("review_sales_asset"),
    asset_id: z.string().uuid(),
    decision: z.enum(["approved", "retired"]),
  }),
  z.object({
    operation: z.literal("apply_sales_asset"),
    asset_id: z.string().uuid(),
    deal_id: z.string().uuid(),
  }),
  z.object({
    operation: z.literal("save_relationship_intelligence_batch"),
    company_id: z.string().uuid().nullable().optional(),
    lead_id: z.string().uuid().nullable().optional(),
    records: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(240),
          details: z.record(z.string(), z.unknown()),
          source_reference: z.string().trim().max(1000).nullable().optional(),
        }),
      )
      .min(1)
      .max(100),
  }),
  z.object({
    operation: z.literal("save_relationship_intelligence"),
    company_id: z.string().uuid().nullable().optional(),
    lead_id: z.string().uuid().nullable().optional(),
    intelligence_type: z.enum([
      "account_plan",
      "stakeholder",
      "company_hierarchy",
      "duplicate_candidate",
      "subcontractor_qualification",
      "partner_performance",
      "buildingconnected_import",
      "pursuit_outcome",
    ]),
    title: z.string().trim().min(1).max(240),
    status: z
      .enum(["draft", "active", "needs_review"])
      .default("active"),
    details: z.record(z.string(), z.unknown()),
    source_system: z
      .enum(["manual", "buildingconnected_csv", "alleato_pm", "crm"])
      .default("manual"),
    source_reference: z.string().trim().max(1000).nullable().optional(),
  }),
  z.object({
    operation: z.literal("review_relationship_intelligence"),
    record_id: z.string().uuid(),
    decision: z.enum(["approved", "rejected", "archived"]),
  }),
  z.object({
    operation: z.literal("save_ai_artifact"),
    artifact_type: z.enum([
      "deal_summary",
      "account_summary",
      "meeting_prep",
      "task_extraction",
      "follow_up_draft",
      "next_best_action",
      "natural_language_answer",
    ]),
    company_id: z.string().uuid().nullable().optional(),
    lead_id: z.string().uuid().nullable().optional(),
    deal_id: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(240),
    content: z.string().trim().min(1).max(20000),
    citations: z.array(z.record(z.string(), z.unknown())).min(1).max(100),
    explanation: z.string().trim().min(1).max(5000),
  }),
  z.object({
    operation: z.literal("review_ai_artifact"),
    artifact_id: z.string().uuid(),
    decision: z.enum(["approved", "rejected", "applied"]),
  }),
]);

function validationError(issues: unknown): never {
  throw new GuardrailError({
    code: "VALIDATION_ERROR",
    where: "crm/operating-system",
    message: "The CRM operation was not valid.",
    status: 400,
    details: { issues },
  });
}

function taskId(assetId: string, dealId: string, index: number, title: string) {
  const hex = createHash("sha256")
    .update(`crm-sales-asset:${assetId}:${dealId}:${index}:${title}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export async function GET() {
  const { db, personId, isAdmin } = await requireCrmAccess("read");
  const artifactsQuery = db
    .from("crm_ai_artifacts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const [
    connectionResult,
    forecastResult,
    requirementsResult,
    assetsResult,
    intelligenceResult,
    artifactsResult,
  ] = await Promise.all([
    db
      .from("crm_microsoft_connections")
      .select("*")
      .eq("person_id", personId)
      .maybeSingle(),
    db
      .from("crm_forecast_snapshots")
      .select("*")
      .order("snapshot_week", { ascending: false })
      .limit(100),
    db
      .from("crm_stage_requirements")
      .select("*")
      .order("sort_order"),
    db.from("crm_sales_assets").select("*").order("updated_at", { ascending: false }),
    db
      .from("crm_relationship_intelligence")
      .select("*")
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(200),
    isAdmin
      ? artifactsQuery
      : artifactsQuery.eq("created_by_person_id", personId),
  ]);
  const firstError =
    connectionResult.error ??
    forecastResult.error ??
    requirementsResult.error ??
    assetsResult.error ??
    intelligenceResult.error ??
    artifactsResult.error;
  if (firstError) return apiErrorResponse(firstError);

  const connection = connectionResult.data;
  return NextResponse.json({
    data: {
      connection: connection
        ? {
            personId: connection.person_id,
            connectionStatus: connection.connection_status,
            mailConnected: connection.mail_connected,
            calendarConnected: connection.calendar_connected,
            grantedScopes: connection.granted_scopes,
            privacyMode: connection.privacy_mode,
            automaticMatchingEnabled: connection.automatic_matching_enabled,
            lastSuccessfulSyncAt: connection.last_successful_sync_at,
            lastError: connection.last_error,
            updatedAt: connection.updated_at,
          }
        : {
            personId,
            connectionStatus: "consent_required",
            mailConnected: false,
            calendarConnected: false,
            grantedScopes: [],
            privacyMode: "business_only",
            automaticMatchingEnabled: false,
            lastSuccessfulSyncAt: null,
            lastError:
              "Microsoft consent has not been granted. CRM email and calendar sync is off.",
            updatedAt: new Date(0).toISOString(),
          },
      forecastSnapshots: (forecastResult.data ?? []).map((row) => ({
        id: row.id,
        snapshotWeek: row.snapshot_week,
        ownerPersonId: row.owner_person_id,
        category: row.category,
        dealCount: row.deal_count,
        totalValue: Number(row.total_value),
        weightedValue: Number(row.weighted_value),
        capturedAt: row.captured_at,
      })),
      stageRequirements: (requirementsResult.data ?? []).map((row) => ({
        id: row.id,
        stageId: row.stage_id,
        label: row.label,
        requirementKey: row.requirement_key,
        isRequired: row.is_required,
        guidance: row.guidance,
        sortOrder: row.sort_order,
      })),
      salesAssets: (assetsResult.data ?? []).map((row) => ({
        id: row.id,
        assetType: row.asset_type,
        name: row.name,
        description: row.description,
        steps: row.steps,
        approvalStatus: row.approval_status,
        createdByPersonId: row.created_by_person_id,
        approvedAt: row.approved_at,
      })),
      relationshipIntelligence: (intelligenceResult.data ?? []).map((row) => ({
        id: row.id,
        companyId: row.company_id,
        leadId: row.lead_id,
        intelligenceType: row.intelligence_type,
        title: row.title,
        status: row.status,
        details: row.details,
        sourceSystem: row.source_system,
        sourceReference: row.source_reference,
        createdAt: row.created_at,
      })),
      aiArtifacts: (artifactsResult.data ?? []).map((row) => ({
        id: row.id,
        artifactType: row.artifact_type,
        companyId: row.company_id,
        leadId: row.lead_id,
        dealId: row.deal_id,
        title: row.title,
        content: row.content,
        citations: row.citations,
        explanation: row.explanation,
        reviewStatus: row.review_status,
        createdAt: row.created_at,
      })),
    },
  });
}

export async function POST(request: Request) {
  const parsed = OperationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) validationError(parsed.error.flatten());
  const input = parsed.data;
  if (
    (input.operation === "save_relationship_intelligence" ||
      input.operation === "save_relationship_intelligence_batch") &&
    Number(Boolean(input.company_id)) + Number(Boolean(input.lead_id)) !== 1
  ) {
    validationError("Select exactly one company or CRM-native lead.");
  }

  if (input.operation === "save_connection_preferences") {
    const { db, personId } = await requireCrmAccess("write");
    const { data: current, error: currentError } = await db
      .from("crm_microsoft_connections")
      .select("*")
      .eq("person_id", personId)
      .maybeSingle();
    if (currentError) return apiErrorResponse(currentError);
    const { data, error } = await db
      .from("crm_microsoft_connections")
      .upsert(
        {
          person_id: personId,
          connection_status: current?.connection_status ?? "consent_required",
          mail_connected: current?.mail_connected ?? false,
          calendar_connected: current?.calendar_connected ?? false,
          granted_scopes: current?.granted_scopes ?? [],
          privacy_mode: input.privacy_mode,
          automatic_matching_enabled:
            input.automatic_matching_enabled &&
            current?.connection_status === "connected",
          last_successful_sync_at: current?.last_successful_sync_at ?? null,
          last_error:
            current?.last_error ??
            "Microsoft consent has not been granted. CRM email and calendar sync is off.",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "person_id" },
      )
      .select()
      .single();
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data });
  }

  if (input.operation === "capture_forecast") {
    const { db, personId } = await requireCrmAccess("admin");
    const { data: captured, error } = await db.rpc(
      "crm_capture_forecast_snapshot",
      {
        p_captured_by_person_id: personId,
      },
    );
    if (error) return apiErrorResponse(error);
    return NextResponse.json({
      data: {
        captured: captured ?? 0,
        snapshotWeek: new Date().toISOString().slice(0, 10),
      },
    });
  }

  if (input.operation === "save_deal_controls") {
    const { db, personId, isAdmin } = await requireCrmAccess("write");
    const { data: deal, error: dealError } = await db
      .from("crm_deals")
      .select("id, owner_person_id")
      .eq("id", input.deal_id)
      .maybeSingle();
    if (dealError) return apiErrorResponse(dealError);
    if (!deal) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/operating-system#save-deal-controls",
        message: "The CRM deal was not found.",
        status: 404,
      });
    }
    assertCrmOwnerOrAdmin({
      ownerPersonId: deal.owner_person_id,
      personId,
      isAdmin,
      action: "crm/operating-system#save-deal-controls",
    });
    const { data, error } = await db
      .from("crm_deals")
      .update({
        forecast_category: input.forecast_category,
        pursuit_type: input.pursuit_type,
        bid_due_date: input.bid_due_date,
        qualification_score: input.qualification_score,
        win_loss_notes: input.win_loss_notes,
      })
      .eq("id", input.deal_id)
      .select()
      .single();
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data });
  }

  if (input.operation === "save_stage_requirement") {
    const { db, personId } = await requireCrmAccess("admin");
    const { data, error } = await db
      .from("crm_stage_requirements")
      .upsert(
        {
          stage_id: input.stage_id,
          label: input.label,
          requirement_key: input.requirement_key,
          is_required: input.is_required,
          guidance: input.guidance,
          created_by_person_id: personId,
          updated_by_person_id: personId,
        },
        { onConflict: "stage_id,requirement_key" },
      )
      .select()
      .single();
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data });
  }

  if (input.operation === "save_sales_asset") {
    const { db, personId } = await requireCrmAccess("write");
    const { data, error } = await db
      .from("crm_sales_assets")
      .insert({
        asset_type: input.asset_type,
        name: input.name,
        description: input.description,
        steps: input.steps,
        approval_status: input.submit_for_review ? "pending_review" : "draft",
        created_by_person_id: personId,
      })
      .select()
      .single();
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data }, { status: 201 });
  }

  if (input.operation === "review_sales_asset") {
    const { db, personId } = await requireCrmAccess("admin");
    const { data, error } = await db
      .from("crm_sales_assets")
      .update({
        approval_status: input.decision,
        approved_by_person_id:
          input.decision === "approved" ? personId : null,
        approved_at:
          input.decision === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", input.asset_id)
      .select()
      .single();
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data });
  }

  if (input.operation === "apply_sales_asset") {
    const { db, personId, isAdmin, user } = await requireCrmAccess("write");
    const [assetResult, dealResult] = await Promise.all([
      db
        .from("crm_sales_assets")
        .select("*")
        .eq("id", input.asset_id)
        .maybeSingle(),
      db
        .from("crm_deals")
        .select("id, company_id, lead_id, owner_person_id, archived_at")
        .eq("id", input.deal_id)
        .maybeSingle(),
    ]);
    const firstError = assetResult.error ?? dealResult.error;
    if (firstError) return apiErrorResponse(firstError);
    if (!assetResult.data || assetResult.data.approval_status !== "approved") {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/operating-system#apply-sales-asset",
        message: "Only an approved cadence or playbook can create tasks.",
        status: 400,
      });
    }
    if (
      !dealResult.data ||
      dealResult.data.archived_at ||
      !["cadence", "playbook"].includes(assetResult.data.asset_type)
    ) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/operating-system#apply-sales-asset",
        message: "The active deal or task-producing asset was not found.",
        status: 404,
      });
    }
    const asset = assetResult.data;
    const deal = dealResult.data;
    assertCrmOwnerOrAdmin({
      ownerPersonId: deal.owner_person_id,
      personId,
      isAdmin,
      action: "crm/operating-system#apply-sales-asset",
    });
    const today = new Date();
    const steps = asset.steps as Array<Record<string, unknown>>;
    const taskRows = steps.flatMap((step, index) => {
      const title = typeof step.title === "string" ? step.title.trim() : "";
      if (!title) return [];
      const due = new Date(today);
      due.setUTCDate(
        due.getUTCDate() +
          (typeof step.day === "number" && Number.isFinite(step.day)
            ? Math.max(0, Math.floor(step.day))
            : index),
      );
      return [{
        id: taskId(asset.id, deal.id, index, title),
        metadata_id: null,
        source_system: "crm",
        source_type: `crm_${asset.asset_type}`,
        source_url: `/crm/deals/${deal.id}`,
        status: "open",
        title,
        description: `${asset.name}: ${title}`,
        due_date: due.toISOString().slice(0, 10),
        priority: "high",
        assignee_person_id: deal.owner_person_id,
        assigned_by: user.id,
        company_id: deal.company_id,
        crm_lead_id: deal.lead_id,
        crm_deal_id: deal.id,
        project_ids: [],
      }];
    });
    const { data, error } = await db
      .from("tasks")
      .upsert(taskRows, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) return apiErrorResponse(error);
    return NextResponse.json({
      data: { created: data?.length ?? 0, planned: taskRows.length },
    });
  }

  if (input.operation === "save_relationship_intelligence_batch") {
    const { db, personId } = await requireCrmAccess("write");
    const { data, error } = await db
      .from("crm_relationship_intelligence")
      .insert(
        input.records.map((record) => ({
          company_id: input.company_id ?? null,
          lead_id: input.lead_id ?? null,
          intelligence_type: "buildingconnected_import" as const,
          title: record.title,
          status: "needs_review" as const,
          details: record.details,
          source_system: "buildingconnected_csv" as const,
          source_reference: record.source_reference ?? "manual CSV paste",
          created_by_person_id: personId,
        })),
      )
      .select("id");
    if (error) return apiErrorResponse(error);
    return NextResponse.json(
      { data: { created: data?.length ?? 0 } },
      { status: 201 },
    );
  }

  if (input.operation === "save_relationship_intelligence") {
    const { db, personId } = await requireCrmAccess("write");
    const { data, error } = await db
      .from("crm_relationship_intelligence")
      .insert({
        company_id: input.company_id ?? null,
        lead_id: input.lead_id ?? null,
        intelligence_type: input.intelligence_type,
        title: input.title,
        status: input.status,
        details: input.details,
        source_system: input.source_system,
        source_reference: input.source_reference ?? null,
        created_by_person_id: personId,
      })
      .select()
      .single();
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data }, { status: 201 });
  }

  if (input.operation === "review_relationship_intelligence") {
    const { db, personId } = await requireCrmAccess("admin");
    const { data, error } = await db
      .from("crm_relationship_intelligence")
      .update({
        status: input.decision,
        reviewed_by_person_id: personId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", input.record_id)
      .select()
      .single();
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data });
  }

  if (input.operation === "save_ai_artifact") {
    const targetCount = [
      input.company_id,
      input.lead_id,
      input.deal_id,
    ].filter(Boolean).length;
    if (targetCount < 1 || targetCount > 2) {
      validationError("An AI artifact requires one relationship target and may include its deal.");
    }
    const { db, personId } = await requireCrmAccess("write");
    const { data, error } = await db
      .from("crm_ai_artifacts")
      .insert({
        artifact_type: input.artifact_type,
        company_id: input.company_id ?? null,
        lead_id: input.lead_id ?? null,
        deal_id: input.deal_id ?? null,
        title: input.title,
        content: input.content,
        citations: input.citations,
        explanation: input.explanation,
        review_status: "draft",
        created_by_person_id: personId,
      })
      .select()
      .single();
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data }, { status: 201 });
  }

  const { db, personId, isAdmin, user } = await requireCrmAccess("write");
  const { data: artifact, error: artifactError } = await db
    .from("crm_ai_artifacts")
    .select("id, artifact_type, title, content, company_id, lead_id, deal_id, created_by_person_id")
    .eq("id", input.artifact_id)
    .maybeSingle();
  if (artifactError) return apiErrorResponse(artifactError);
  if (!artifact) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "crm/operating-system#review-ai-artifact",
      message: "The CRM AI draft was not found.",
      status: 404,
    });
  }
  assertCrmOwnerOrAdmin({
    ownerPersonId: artifact.created_by_person_id,
    personId,
    isAdmin,
    action: "crm/operating-system#review-ai-artifact",
  });
  if (
    input.decision === "applied" &&
    artifact.artifact_type === "task_extraction"
  ) {
    if (!artifact.deal_id) {
      validationError("A task extraction must be linked to a CRM deal.");
    }
    const { data: deal, error: dealError } = await db
      .from("crm_deals")
      .select("id, company_id, lead_id, owner_person_id, archived_at")
      .eq("id", artifact.deal_id)
      .maybeSingle();
    if (dealError) return apiErrorResponse(dealError);
    if (!deal || deal.archived_at) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "crm/operating-system#apply-ai-task",
        message: "The active CRM deal for this task suggestion was not found.",
        status: 404,
      });
    }
    assertCrmOwnerOrAdmin({
      ownerPersonId: deal.owner_person_id,
      personId,
      isAdmin,
      action: "crm/operating-system#apply-ai-task",
    });
    const due = new Date();
    due.setUTCDate(due.getUTCDate() + 1);
    const { error: taskError } = await db.from("tasks").upsert(
      {
        id: taskId(artifact.id, deal.id, 0, artifact.title),
        metadata_id: null,
        source_system: "crm",
        source_type: "crm_ai_task_extraction",
        source_url: `/crm/deals/${deal.id}`,
        status: "open",
        title: artifact.title,
        description: artifact.content,
        due_date: due.toISOString().slice(0, 10),
        priority: "high",
        assignee_person_id: deal.owner_person_id,
        assigned_by: user.id,
        company_id: deal.company_id,
        crm_lead_id: deal.lead_id,
        crm_deal_id: deal.id,
        project_ids: [],
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (taskError) return apiErrorResponse(taskError);
  }
  const { data, error } = await db
    .from("crm_ai_artifacts")
    .update({
      review_status: input.decision,
      reviewed_by_person_id: personId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.artifact_id)
    .select()
    .single();
  if (error) return apiErrorResponse(error);
  return NextResponse.json({ data });
}
