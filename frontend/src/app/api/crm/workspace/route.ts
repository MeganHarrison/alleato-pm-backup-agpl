import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { requireCrmAccess } from "@/lib/crm/server";
import { withApiGuardrails } from "@/lib/guardrails/api";

const OPEN_TASK_STATUSES = ["open", "in_progress", "blocked"] as const;

function personName(
  person: {
    first_name: string | null;
    last_name: string | null;
  } | null,
): string {
  return (
    [person?.first_name, person?.last_name].filter(Boolean).join(" ") ||
    "Unassigned"
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export const GET = withApiGuardrails("crm/workspace#GET", async () => {
  const { db, isAdmin } = await requireCrmAccess("read");
  const [
    accountsResult,
    leadsResult,
    dealsResult,
    activitiesResult,
    tasksResult,
    candidatesResult,
    settingsResult,
    stagesResult,
    pipelinesResult,
    aliasesResult,
    documentsResult,
    conversionsResult,
    stageEventsResult,
  ] = await Promise.all([
    db.from("crm_account_profiles").select("*").order("created_at"),
    db.from("crm_leads").select("*").order("created_at"),
    db.from("crm_deals").select("*").order("created_at", { ascending: false }),
    db
      .from("crm_activities")
      .select("*")
      .eq("visibility_scope", "standard")
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false }),
    db
      .from("tasks")
      .select("*")
      .or("company_id.not.is.null,crm_lead_id.not.is.null")
      .order("due_date", { ascending: true }),
    isAdmin
      ? db
          .from("crm_activity_candidates")
          .select("*")
          .eq("visibility_scope", "standard")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    db.from("crm_settings").select("key, value").order("key"),
    db
      .from("crm_stages")
      .select("*")
      .is("archived_at", null)
      .order("sort_order"),
    db.from("crm_pipelines").select("*").is("archived_at", null).order("name"),
    isAdmin
      ? db.from("crm_match_aliases").select("*").order("created_at")
      : Promise.resolve({ data: [], error: null }),
    db.from("crm_deal_documents").select("*"),
    db.from("crm_conversion_attempts").select("*").order("created_at"),
    db
      .from("crm_deal_stage_events")
      .select("*")
      .order("changed_at", { ascending: false }),
  ]);

  const firstError =
    accountsResult.error ??
    leadsResult.error ??
    dealsResult.error ??
    activitiesResult.error ??
    tasksResult.error ??
    candidatesResult.error ??
    settingsResult.error ??
    stagesResult.error ??
    pipelinesResult.error ??
    aliasesResult.error ??
    documentsResult.error ??
    conversionsResult.error ??
    stageEventsResult.error;
  if (firstError) return apiErrorResponse(firstError);

  const accounts = accountsResult.data ?? [];
  const leads = leadsResult.data ?? [];
  const deals = dealsResult.data ?? [];
  const activities = activitiesResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const candidates = candidatesResult.data ?? [];
  const personIds = Array.from(
    new Set([
      ...accounts.map((row) => row.owner_person_id),
      ...leads.map((row) => row.owner_person_id),
      ...deals.map((row) => row.owner_person_id),
      ...activities
        .map((row) => row.created_by_person_id)
        .filter((value): value is string => Boolean(value)),
      ...tasks
        .map((row) => row.assignee_person_id)
        .filter((value): value is string => Boolean(value)),
      ...(stageEventsResult.data ?? []).map((row) => row.changed_by_person_id),
    ]),
  );
  const companyIds = Array.from(
    new Set([
      ...accounts.map((row) => row.company_id),
      ...deals
        .map((row) => row.company_id)
        .filter((value): value is string => Boolean(value)),
      ...activities
        .map((row) => row.company_id)
        .filter((value): value is string => Boolean(value)),
      ...candidates.map((row) => row.proposed_company_id),
    ]),
  );
  const [peopleResult, companiesResult] = await Promise.all([
    personIds.length
      ? db
          .from("people")
          .select("id, first_name, last_name")
          .in("id", personIds)
      : Promise.resolve({ data: [], error: null }),
    companyIds.length
      ? db.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (peopleResult.error) return apiErrorResponse(peopleResult.error);
  if (companiesResult.error) return apiErrorResponse(companiesResult.error);

  const peopleById = new Map(
    (peopleResult.data ?? []).map((person) => [person.id, person]),
  );
  const companiesById = new Map(
    (companiesResult.data ?? []).map((company) => [company.id, company]),
  );
  const owner = (personId: string) => {
    const name = personName(peopleById.get(personId) ?? null);
    return { id: personId, name, initials: initials(name) };
  };
  const settings = new Map(
    (settingsResult.data ?? []).map((setting) => [setting.key, setting.value]),
  );
  const openDealValueByCompany = new Map<string, number>();
  const openDealValueByLead = new Map<string, number>();
  deals
    .filter((deal) => deal.status === "open" && !deal.archived_at)
    .forEach((deal) => {
      if (deal.company_id) {
        openDealValueByCompany.set(
          deal.company_id,
          (openDealValueByCompany.get(deal.company_id) ?? 0) +
            Number(deal.value_estimate),
        );
      }
      if (deal.lead_id) {
        openDealValueByLead.set(
          deal.lead_id,
          (openDealValueByLead.get(deal.lead_id) ?? 0) +
            Number(deal.value_estimate),
        );
      }
    });
  const nextFollowUpByCompany = new Map<string, string>();
  const nextFollowUpByLead = new Map<string, string>();
  tasks
    .filter(
      (task) =>
        task.company_id &&
        task.due_date &&
        OPEN_TASK_STATUSES.includes(
          task.status as (typeof OPEN_TASK_STATUSES)[number],
        ),
    )
    .forEach((task) => {
      const current = nextFollowUpByCompany.get(task.company_id!);
      if (!current || task.due_date! < current) {
        nextFollowUpByCompany.set(task.company_id!, task.due_date!);
      }
    });
  tasks
    .filter(
      (task) =>
        task.crm_lead_id &&
        task.due_date &&
        OPEN_TASK_STATUSES.includes(
          task.status as (typeof OPEN_TASK_STATUSES)[number],
        ),
    )
    .forEach((task) => {
      const current = nextFollowUpByLead.get(task.crm_lead_id!);
      if (!current || task.due_date! < current) {
        nextFollowUpByLead.set(task.crm_lead_id!, task.due_date!);
      }
    });
  const documentsByDeal = new Map<string, string[]>();
  (documentsResult.data ?? []).forEach((document) => {
    documentsByDeal.set(document.deal_id, [
      ...(documentsByDeal.get(document.deal_id) ?? []),
      document.document_metadata_id,
    ]);
  });
  const stageNameById = new Map(
    (stagesResult.data ?? []).map((stage) => [stage.id, stage.name]),
  );

  return NextResponse.json({
    data: {
      accounts: accounts.map((account) => ({
        companyId: account.company_id,
        name: companiesById.get(account.company_id)?.name ?? "Unknown company",
        lifecycleStage: account.lifecycle_stage,
        owner: owner(account.owner_person_id),
        healthStatus: account.health_status,
        healthReason: account.health_reason,
        healthEvaluatedAt:
          account.health_evaluated_at ??
          account.updated_at ??
          account.created_at,
        lastMeaningfulActivityAt: account.last_meaningful_activity_at,
        nextFollowUpAt: nextFollowUpByCompany.get(account.company_id) ?? null,
        openDealValue: openDealValueByCompany.get(account.company_id) ?? 0,
        rowVersion: account.row_version,
      })),
      leads: leads.map((lead) => ({
        id: lead.id,
        fullName: lead.full_name,
        prospectCompanyName: lead.prospect_company_name,
        jobTitle: lead.job_title,
        email: lead.email,
        phone: lead.phone,
        websiteUrl: lead.website_url,
        linkedinUrl: lead.linkedin_url,
        facebookUrl: lead.facebook_url,
        xUrl: lead.x_url,
        photoStoragePath: lead.photo_storage_path,
        source: lead.source,
        owner: owner(lead.owner_person_id),
        status: lead.status,
        healthStatus: lead.health_status,
        healthReason: lead.health_reason,
        healthEvaluatedAt:
          lead.health_evaluated_at ?? lead.updated_at ?? lead.created_at,
        lastMeaningfulActivityAt: lead.last_meaningful_activity_at,
        nextFollowUpAt: nextFollowUpByLead.get(lead.id) ?? null,
        openDealValue: openDealValueByLead.get(lead.id) ?? 0,
        convertedCompanyId: lead.converted_company_id,
        rowVersion: lead.row_version,
      })),
      deals: deals.map((deal) => ({
        id: deal.id,
        name: deal.name,
        companyId: deal.company_id,
        leadId: deal.lead_id,
        companyName:
          (deal.company_id
            ? companiesById.get(deal.company_id)?.name
            : leads.find((lead) => lead.id === deal.lead_id)
                ?.prospect_company_name) ?? "Unknown relationship",
        owner: owner(deal.owner_person_id),
        stageId: deal.stage_id,
        status: deal.status,
        valueEstimate: Number(deal.value_estimate),
        probability: deal.probability,
        expectedCloseDate: deal.expected_close_date,
        closedAt: deal.closed_at,
        projectId: deal.project_id,
        projectSyncStatus: deal.project_sync_status,
        source: deal.source,
        lostReason: deal.lost_reason,
        forecastCategory: deal.forecast_category,
        pursuitType: deal.pursuit_type,
        bidDueDate: deal.bid_due_date,
        qualificationScore: deal.qualification_score,
        winLossNotes: deal.win_loss_notes,
        updatedAt: deal.updated_at,
        rowVersion: deal.row_version,
      })),
      activities: activities.map((activity) => ({
        id: activity.id,
        companyId: activity.company_id,
        leadId: activity.lead_id,
        companyName:
          (activity.company_id
            ? companiesById.get(activity.company_id)?.name
            : leads.find((lead) => lead.id === activity.lead_id)
                ?.prospect_company_name) ?? "Unknown relationship",
        dealId: activity.deal_id,
        activityType: activity.activity_type,
        subject: activity.subject,
        occurredAt: activity.occurred_at,
        createdBy: activity.created_by_person_id
          ? personName(peopleById.get(activity.created_by_person_id) ?? null)
          : (activity.source_system ?? "Automated source"),
        recordOrigin: activity.record_origin,
        sourceSystem: activity.source_system,
        sourceExternalKey: activity.source_external_key,
        visibilityScope: activity.visibility_scope,
      })),
      followUps: tasks.map((task) => ({
        id: task.id,
        companyId: task.company_id,
        leadId: task.crm_lead_id,
        dealId: task.crm_deal_id,
        title: task.title,
        dueDate: task.due_date,
        assignee: task.assignee_person_id
          ? personName(peopleById.get(task.assignee_person_id) ?? null)
          : "Unassigned",
        status: task.status,
        priority: task.priority,
      })),
      candidates: candidates.map((candidate) => ({
        id: candidate.id,
        sourceSystem: candidate.source_system,
        sourceExternalKey: candidate.source_external_key,
        contentHash: candidate.content_hash,
        proposedCompanyId: candidate.proposed_company_id,
        proposedCompanyName:
          companiesById.get(candidate.proposed_company_id)?.name ??
          "Unknown company",
        subject: `${candidate.source_system} communication`,
        matchConfidence: Number(candidate.match_confidence),
        matchSignals: Object.entries(candidate.match_signals ?? {}).map(
          ([key, value]) => `${key}: ${String(value)}`,
        ),
        visibilityScope: candidate.visibility_scope,
        status: candidate.status,
        occurredAt: candidate.created_at,
      })),
      settings: {
        meaningfulActivityTypes: settings.get("meaningful_activity_types") ?? [
          "call",
          "email",
          "meeting",
        ],
        activeDays:
          (settings.get("health_thresholds") as { active_days?: number } | null)
            ?.active_days ?? 14,
        watchDays:
          (settings.get("health_thresholds") as { watch_days?: number } | null)
            ?.watch_days ?? 30,
        staleDealDays:
          (settings.get("stale_deal_threshold_days") as number | null) ?? 30,
        reportingTimezone:
          (settings.get("default_reporting_timezone") as string | null) ??
          "America/Indianapolis",
        autoAcceptEnabled:
          (settings.get("auto_accept_enabled") as boolean | null) ?? false,
        freeEmailDomains:
          (settings.get("free_email_domain_denylist") as string[] | null) ?? [],
      },
      stages: (stagesResult.data ?? []).map((stage) => ({
        id: stage.id,
        name: stage.name,
        sortOrder: stage.sort_order,
        stageType: stage.stage_type,
        defaultProbability: stage.default_probability,
        pipelineId: stage.pipeline_id,
      })),
      pipelines: (pipelinesResult.data ?? []).map((pipeline) => ({
        id: pipeline.id,
        name: pipeline.name,
        isDefault: pipeline.is_default,
      })),
      archivedAccountIds: accounts
        .filter((account) => Boolean(account.archived_at))
        .map((account) => account.company_id),
      archivedDealIds: deals
        .filter((deal) => Boolean(deal.archived_at))
        .map((deal) => deal.id),
      matchAliases: aliasesResult.data ?? [],
      attachments: Object.fromEntries(documentsByDeal),
      conversionAttempts: (conversionsResult.data ?? []).map((attempt) => ({
        idempotencyKey: attempt.idempotency_key,
        dealId: attempt.deal_id,
        status: attempt.status,
        projectId: attempt.project_id,
        erpExternalId: attempt.erp_external_id,
        attemptCount: attempt.attempt_count,
        errorMessage: attempt.last_error_message,
      })),
      dealStageEvents: (stageEventsResult.data ?? []).map((event) => ({
        id: event.id,
        dealId: event.deal_id,
        fromStageId: event.from_stage_id,
        fromStageName: event.from_stage_id
          ? (stageNameById.get(event.from_stage_id) ?? "Archived stage")
          : null,
        toStageId: event.to_stage_id,
        toStageName: stageNameById.get(event.to_stage_id) ?? "Archived stage",
        changedBy: personName(
          peopleById.get(event.changed_by_person_id) ?? null,
        ),
        changedAt: event.changed_at,
        reason: event.reason,
      })),
    },
  });
});
