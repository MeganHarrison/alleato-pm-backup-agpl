import "server-only";

import { GuardrailError } from "@/lib/guardrails/errors";
import {
  recruitingCommandResponseSchema,
  recruitingApplicationIsVisible,
  recruitingMicrosoftConnectionSchema,
  requisitionAcceptsActiveWorkflow,
  recruitingWorkspaceResponseSchema,
  testApplicationAllowsStage,
  type RecruitingCommand,
  type RecruitingFeatureAvailability,
  type RecruitingWorkspaceResponse,
} from "@/lib/recruiting/production-contracts";
import { requireRecruitingAccess } from "@/lib/recruiting/server";
import { createServiceClient } from "@/lib/supabase/service";

function throwDatabaseError(
  where: string,
  message: string,
  error: { message: string },
): never {
  throw new GuardrailError({
    code: "INTERNAL_ERROR",
    where,
    message,
    cause: error,
  });
}

const safeRecruitingMutationErrors = new Set([
  "A filled, closed, or canceled requisition cannot be changed by this action.",
  "A reason of at least 5 characters is required.",
  "Only an unused draft requisition can be permanently deleted.",
  "Recruiting administrator access is required to delete a draft.",
  "Recruiting write access is required.",
  "The requisition changed after it was loaded. Reload and try again.",
  "The requisition no longer exists. Reload and try again.",
  "This draft has recruiting activity. Close or cancel it instead of deleting it.",
  "This position is no longer active. Its recruiting history is read-only.",
]);

function safeRecruitingMutationMessage(
  error: { message: string },
  fallback: string,
): string {
  return safeRecruitingMutationErrors.has(error.message)
    ? error.message
    : fallback;
}

function settingBoolean(settings: Map<string, unknown>, key: string): boolean {
  return settings.get(key) === true;
}

function settingNumber(
  settings: Map<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = settings.get(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function featureAvailability(
  settings: Map<string, unknown>,
  microsoftConnection: ReturnType<
    typeof recruitingMicrosoftConnectionSchema.parse
  >,
): RecruitingFeatureAvailability {
  const testMode = settingBoolean(settings, "public_intake_uat_enabled");
  const providerDelivery = settingBoolean(
    settings,
    "provider_delivery_enabled",
  );
  const publicIntake = settingBoolean(settings, "public_intake_enabled");
  const resumeUpload =
    publicIntake &&
    settingBoolean(settings, "resume_upload_enabled") &&
    settingBoolean(settings, "resume_scanner_verified") &&
    Boolean(process.env.RECRUITING_RESUME_SCANNER_URL);
  const resumeExtraction =
    resumeUpload &&
    settingBoolean(settings, "resume_extraction_enabled") &&
    settingBoolean(settings, "resume_extractor_verified") &&
    Boolean(
      process.env.RECRUITING_RESUME_EXTRACTOR_URL ?? process.env.OPENAI_API_KEY,
    );
  const outlookMail =
    providerDelivery &&
    settingBoolean(settings, "outlook_mail_verified") &&
    microsoftConnection.mailConnected;
  const outlookCalendar =
    providerDelivery &&
    settingBoolean(settings, "outlook_calendar_verified") &&
    microsoftConnection.calendarConnected;
  const sms =
    providerDelivery &&
    settingBoolean(settings, "sms_enabled") &&
    settingBoolean(settings, "sms_provider_verified") &&
    Boolean(process.env.RECRUITING_SMS_PROVIDER);
  const eSignature =
    providerDelivery &&
    settingBoolean(settings, "esignature_enabled") &&
    settingBoolean(settings, "esignature_provider_verified") &&
    Boolean(process.env.RECRUITING_ESIGNATURE_PROVIDER);
  const aiAssistance =
    settingBoolean(settings, "ai_enabled") &&
    settingBoolean(settings, "ai_evaluation_approved") &&
    Boolean(process.env.OPENAI_API_KEY);
  const automation = settingBoolean(settings, "automation_enabled");
  const retentionExecution = settingBoolean(
    settings,
    "retention_deletion_enabled",
  );

  const unavailableReasons: Record<string, string> = {};
  if (!publicIntake) {
    unavailableReasons.publicIntake =
      "Public intake is disabled until privacy, consent, anti-bot, and retention controls are approved.";
  }
  if (!resumeUpload) {
    unavailableReasons.resumeUpload =
      "Real resume upload requires public-intake approval and a configured malware scanner.";
  }
  if (!outlookMail) {
    unavailableReasons.outlookMail =
      "Connect your Microsoft 365 account below to send recruiting email from Outlook.";
  }
  if (!outlookCalendar) {
    unavailableReasons.outlookCalendar =
      "Connect your Microsoft 365 calendar below to schedule Outlook and Teams interviews.";
  }
  if (!sms) {
    unavailableReasons.sms =
      "SMS requires an approved provider, consent, opt-out, quiet-hour, and sender-number configuration.";
  }
  if (!eSignature) {
    unavailableReasons.eSignature =
      "Offer e-signature requires an approved provider, template, and verified callback secret.";
  }
  if (!aiAssistance) {
    unavailableReasons.aiAssistance =
      "Employment AI assistance is disabled until its evaluation and human-review gate is approved.";
  }
  if (!retentionExecution) {
    unavailableReasons.retentionExecution =
      "Retention is dry-run only until an approved policy and legal-hold process are configured.";
  }

  return {
    sharedData: true,
    testMode,
    publicIntake,
    resumeUpload,
    resumeExtraction,
    outlookMail,
    outlookCalendar,
    sms,
    eSignature,
    automation,
    aiAssistance,
    retentionExecution,
    unavailableReasons,
  };
}

export async function loadRecruitingWorkspace(
  requestedRequisitionId: string | null,
): Promise<RecruitingWorkspaceResponse> {
  const { db, viewer } = await requireRecruitingAccess("read");
  const [
    settingsResult,
    requisitionsResult,
    tasksResult,
    approvalsResult,
    interviewsResult,
    scorecardsResult,
    providersResult,
    offersResult,
    poolsResult,
    automationsResult,
    aiRunsResult,
    microsoftConnectionResult,
  ] = await Promise.all([
    db.from("recruiting_settings").select("key,value"),
    db
      .from("recruiting_requisitions")
      .select(
        "id,requisition_number,title,department,location_name,jobsite_name,status,is_confidential,headcount,row_version",
      )
      .order("created_at", { ascending: false }),
    db
      .from("recruiting_tasks")
      .select("id,status,due_at,requisition_id,assigned_to_person_id"),
    db
      .from("recruiting_requisition_approvals")
      .select("id,status,requisition_id,approver_person_id"),
    db
      .from("recruiting_interviews")
      .select("id,status,starts_at,application_id"),
    db
      .from("recruiting_scorecard_submissions")
      .select("id,status,interview_id,interviewer_person_id"),
    db.from("recruiting_provider_attempts").select("id,status,requisition_id"),
    db.from("recruiting_offers").select("id,status,application_id"),
    db.from("recruiting_talent_pools").select("id,is_active"),
    db.from("recruiting_automation_rules").select("id,is_enabled"),
    db.from("recruiting_ai_runs").select("id,status"),
    db.rpc("recruiting_get_microsoft_connection_status"),
  ]);

  const initialError =
    settingsResult.error ??
    requisitionsResult.error ??
    tasksResult.error ??
    approvalsResult.error ??
    interviewsResult.error ??
    scorecardsResult.error ??
    providersResult.error ??
    offersResult.error ??
    poolsResult.error ??
    automationsResult.error ??
    aiRunsResult.error ??
    microsoftConnectionResult.error;
  if (initialError) {
    throwDatabaseError(
      "recruiting/workspace",
      "Applicant Tracker shared data could not be loaded. Reload the page; if the problem continues, verify the recruiting migrations.",
      initialError,
    );
  }

  const settings = new Map(
    (settingsResult.data ?? []).map((row) => [row.key, row.value]),
  );
  const microsoftConnection = recruitingMicrosoftConnectionSchema.parse(
    microsoftConnectionResult.data,
  );
  const requisitions = (requisitionsResult.data ?? []).map((row) => ({
    id: row.id,
    requisitionNumber: row.requisition_number,
    title: row.title,
    department: row.department,
    location: row.location_name,
    jobsite: row.jobsite_name,
    status: row.status,
    isConfidential: row.is_confidential,
    headcount: row.headcount,
    rowVersion: row.row_version,
  }));
  const activeRequisitions = requisitions.filter((item) =>
    requisitionAcceptsActiveWorkflow(item.status),
  );
  const selectedRequisitionId =
    activeRequisitions.find((item) => item.id === requestedRequisitionId)?.id ??
    activeRequisitions.find((item) => item.status === "open")?.id ??
    activeRequisitions[0]?.id ??
    null;

  const [stagesResult, applicationsResult, uatApplicationsResult, documentsResult] =
    selectedRequisitionId
    ? await Promise.all([
        db
          .from("recruiting_stage_definitions")
          .select(
            "id,requisition_id,stage_key,label,position,is_terminal,requires_disposition",
          )
          .eq("requisition_id", selectedRequisitionId)
          .order("position"),
        db
          .from("recruiting_applications")
          .select(
            "id,requisition_id,candidate_id,current_stage,status,disposition_code,disposition_reason,applied_at,last_activity_at,row_version",
          )
          .eq("requisition_id", selectedRequisitionId)
          .order("last_activity_at", { ascending: false }),
        db.from("recruiting_uat_submissions").select("application_id"),
        db
          .from("recruiting_documents")
          .select("id,application_id,original_file_name")
          .eq("document_type", "resume")
          .not("application_id", "is", null),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  const pipelineError =
    stagesResult.error ??
    applicationsResult.error ??
    uatApplicationsResult.error ??
    documentsResult.error;
  if (pipelineError) {
    throwDatabaseError(
      "recruiting/pipeline",
      "The selected recruiting pipeline could not be loaded.",
      pipelineError,
    );
  }

  const uatApplicationIds = new Set(
    (uatApplicationsResult.data ?? [])
      .map((row) => row.application_id)
      .filter((value): value is string => Boolean(value)),
  );
  const documentRows = (documentsResult.data ?? []) as Array<{
    id: string;
    application_id: string | null;
    original_file_name: string;
  }>;
  const resumeByApplication = new Map(
    documentRows.map((row) => [
      row.application_id,
      { documentId: row.id, originalFileName: row.original_file_name },
    ]),
  );
  const testMode = settingBoolean(settings, "public_intake_uat_enabled");
  const applications = (applicationsResult.data ?? [])
    .filter((row) =>
      recruitingApplicationIsVisible({
        testMode,
        isTestApplication: uatApplicationIds.has(row.id),
      }),
    )
    .map((row) => ({
    id: row.id,
    isTestApplication: uatApplicationIds.has(row.id),
    candidateId: row.candidate_id,
    requisitionId: row.requisition_id,
    stage: row.current_stage,
    status: row.status,
    dispositionCode: row.disposition_code,
    dispositionReason: row.disposition_reason,
    appliedAt: row.applied_at,
    lastActivityAt: row.last_activity_at,
    rowVersion: row.row_version,
    resume: resumeByApplication.get(row.id) ?? null,
    }));
  const candidateIds = [...new Set(applications.map((row) => row.candidateId))];
  const [candidatesResult, contactsResult] = candidateIds.length
    ? await Promise.all([
        db
          .from("recruiting_candidates")
          .select(
            "id,display_name,current_company,current_title,location_text,candidate_status,row_version",
          )
          .in("id", candidateIds),
        db
          .from("recruiting_candidate_contacts")
          .select(
            "candidate_id,contact_type,value_display,is_primary,consent_status",
          )
          .in("candidate_id", candidateIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  const candidateError = candidatesResult.error ?? contactsResult.error;
  if (candidateError) {
    throwDatabaseError(
      "recruiting/candidates",
      "Candidate summaries could not be loaded for this requisition.",
      candidateError,
    );
  }
  const contactsByCandidate = new Map<
    string,
    { email: string | null; phone: string | null }
  >();
  for (const contact of contactsResult.data ?? []) {
    const current = contactsByCandidate.get(contact.candidate_id) ?? {
      email: null,
      phone: null,
    };
    if (
      contact.contact_type === "email" &&
      (contact.is_primary || !current.email)
    ) {
      current.email = contact.value_display;
    }
    if (
      contact.contact_type === "phone" &&
      (contact.is_primary || !current.phone)
    ) {
      current.phone = contact.value_display;
    }
    contactsByCandidate.set(contact.candidate_id, current);
  }
  const candidates = (candidatesResult.data ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    email: contactsByCandidate.get(row.id)?.email ?? null,
    phone: contactsByCandidate.get(row.id)?.phone ?? null,
    currentCompany: row.current_company,
    currentTitle: row.current_title,
    location: row.location_text,
    status: row.candidate_status,
    rowVersion: row.row_version,
  }));

  const unassignedResult = await db
    .from("recruiting_uat_submissions")
    .select("candidate_id,document_id,created_at,expires_at,row_version")
    .is("application_id", null)
    .order("created_at", { ascending: false });
  if (unassignedResult.error) {
    throwDatabaseError(
      "recruiting/unassigned-resumes",
      "The unassigned resume inbox could not be loaded.",
      unassignedResult.error,
    );
  }
  const unassignedRows = unassignedResult.data ?? [];
  const unassignedCandidateIds = unassignedRows.map((row) => row.candidate_id);
  const unassignedDocumentIds = unassignedRows.map((row) => row.document_id);
  const [unassignedCandidatesResult, unassignedDocumentsResult] =
    unassignedRows.length
      ? await Promise.all([
          db
            .from("recruiting_candidates")
            .select("id,display_name")
            .in("id", unassignedCandidateIds),
          db
            .from("recruiting_documents")
            .select("id,original_file_name")
            .in("id", unassignedDocumentIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
  const unassignedDetailError =
    unassignedCandidatesResult.error ?? unassignedDocumentsResult.error;
  if (unassignedDetailError) {
    throwDatabaseError(
      "recruiting/unassigned-resume-details",
      "The unassigned resume details could not be loaded.",
      unassignedDetailError,
    );
  }
  const unassignedCandidateNames = new Map(
    (unassignedCandidatesResult.data ?? []).map((row) => [
      row.id,
      row.display_name,
    ]),
  );
  const unassignedDocumentNames = new Map(
    (unassignedDocumentsResult.data ?? []).map((row) => [
      row.id,
      row.original_file_name,
    ]),
  );
  const unassignedResumes = unassignedRows.map((row) => {
    return {
      candidateId: row.candidate_id,
      candidateName:
        unassignedCandidateNames.get(row.candidate_id) ??
        "Restricted candidate",
      documentId: row.document_id,
      originalFileName:
        unassignedDocumentNames.get(row.document_id) ?? "resume.pdf",
      uploadedAt: row.created_at,
      expiresAt: row.expires_at,
      rowVersion: row.row_version,
    };
  });

  const now = Date.now();
  const staleBefore =
    now - settingNumber(settings, "stale_stage_days", 7) * 24 * 60 * 60 * 1000;
  const openTasks = (tasksResult.data ?? []).filter((row) =>
    ["open", "in_progress"].includes(row.status),
  );
  const failedProviderStatuses = new Set([
    "retryable_failed",
    "permanent_failed",
  ]);

  return recruitingWorkspaceResponseSchema.parse({
    ok: true,
    source: "supabase-live",
    viewer,
    featureAvailability: featureAvailability(settings, microsoftConnection),
    microsoftConnection,
    requisitions,
    selectedRequisitionId,
    stageDefinitions: (stagesResult.data ?? []).map((row) => ({
      id: row.id,
      requisitionId: row.requisition_id,
      key: row.stage_key,
      label: row.label,
      position: row.position,
      isTerminal: row.is_terminal,
      requiresDisposition: row.requires_disposition,
    })),
    candidates,
    applications,
    unassignedResumes,
    inbox: {
      openTasks: openTasks.length,
      overdueTasks: openTasks.filter(
        (row) => row.due_at && new Date(row.due_at).getTime() < now,
      ).length,
      pendingApprovals: (approvalsResult.data ?? []).filter(
        (row) => row.status === "pending",
      ).length,
      unscheduledInterviews: (interviewsResult.data ?? []).filter((row) =>
        ["draft", "scheduling"].includes(row.status),
      ).length,
      missingScorecards: (scorecardsResult.data ?? []).filter(
        (row) => row.status === "draft",
      ).length,
      failedProviderAttempts: (providersResult.data ?? []).filter((row) =>
        failedProviderStatuses.has(row.status),
      ).length,
      staleApplications: applications.filter(
        (row) =>
          row.status === "active" &&
          new Date(row.lastActivityAt).getTime() < staleBefore,
      ).length,
    },
    operations: {
      interviews: (interviewsResult.data ?? []).length,
      offers: (offersResult.data ?? []).length,
      talentPools: (poolsResult.data ?? []).filter((row) => row.is_active)
        .length,
      activeAutomations: (automationsResult.data ?? []).filter(
        (row) => row.is_enabled,
      ).length,
      aiRunsAwaitingReview: (aiRunsResult.data ?? []).filter(
        (row) => row.status === "completed",
      ).length,
    },
    fetchedAt: new Date().toISOString(),
  });
}

export async function executeRecruitingCommand(
  command: RecruitingCommand,
): Promise<ReturnType<typeof recruitingCommandResponseSchema.parse>> {
  const { db, viewer } = await requireRecruitingAccess(
    command.command === "requisition.delete" ? "admin" : "write",
  );

  if (command.command === "application.transition") {
    const { data: uatSubmission, error: uatLookupError } = await db
      .from("recruiting_uat_submissions")
      .select("application_id")
      .eq("application_id", command.applicationId)
      .maybeSingle();
    if (uatLookupError) {
      throwDatabaseError(
        "recruiting/application.transition-uat-check",
        "The application test status could not be verified. No stage change was made.",
        uatLookupError,
      );
    }
    if (
      uatSubmission &&
      !testApplicationAllowsStage(command.nextStage)
    ) {
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where: "recruiting/application.transition",
        message:
          "Test applications can move through review and interview only. Offers, hiring, and closure require a real applicant record.",
      });
    }
    const { data, error } = await db.rpc("recruiting_transition_application", {
      p_application_id: command.applicationId,
      p_to_stage: command.nextStage,
      p_expected_row_version: command.expectedRowVersion,
      p_reason: command.reason,
      p_idempotency_key: command.idempotencyKey,
      p_request_hash: command.requestHash,
    });
    if (error) {
      throwDatabaseError(
        "recruiting/application.transition",
        "The application could not be moved. Reload its current stage and try again.",
        error,
      );
    }
    return recruitingCommandResponseSchema.parse({
      ok: true,
      command: command.command,
      result: data,
    });
  }

  if (command.command === "application.disposition") {
    const { data: uatSubmission, error: uatLookupError } = await db
      .from("recruiting_uat_submissions")
      .select("application_id")
      .eq("application_id", command.applicationId)
      .maybeSingle();
    if (uatLookupError) {
      throwDatabaseError(
        "recruiting/application.disposition-uat-check",
        "The application test status could not be verified. No disposition was saved.",
        uatLookupError,
      );
    }
    if (
      uatSubmission &&
      (command.dispositionCode !== "not_qualified" ||
        (command.reason?.trim().length ?? 0) < 5)
    ) {
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where: "recruiting/application.disposition",
        message:
          "Test applications only allow the human-reviewed Not Qualified outcome with a reason.",
      });
    }
    const dispositionArguments = {
      p_application_id: command.applicationId,
      p_disposition_code: command.dispositionCode,
      p_reason: command.reason,
      p_expected_row_version: command.expectedRowVersion,
      p_idempotency_key: command.idempotencyKey,
      p_request_hash: command.requestHash,
    };
    const { data, error } = uatSubmission
      ? await db.rpc(
          "recruiting_set_uat_application_disposition",
          dispositionArguments,
        )
      : await db.rpc(
          "recruiting_set_application_disposition",
          dispositionArguments,
        );
    if (error) {
      throwDatabaseError(
        "recruiting/application.disposition",
        "The disposition could not be saved. Reload the application and review the required reason.",
        error,
      );
    }
    return recruitingCommandResponseSchema.parse({
      ok: true,
      command: command.command,
      result: data,
    });
  }

  if (command.command === "resume.assign") {
    const service = createServiceClient();
    const { data, error } = await service.rpc(
      "recruiting_assign_uat_submission",
      {
        p_candidate_id: command.candidateId,
        p_requisition_id: command.requisitionId,
        p_actor_person_id: viewer.personId,
        p_expected_row_version: command.expectedRowVersion,
        p_idempotency_key: command.idempotencyKey,
        p_request_hash: command.requestHash,
      },
    );
    if (error) {
      throwDatabaseError(
        "recruiting/resume.assign",
        "The resume could not be assigned. Reload the inbox and try again.",
        error,
      );
    }
    return recruitingCommandResponseSchema.parse({
      ok: true,
      command: command.command,
      result: data,
    });
  }

  if (command.command === "requisition.create") {
    const { data, error } = await db.rpc("recruiting_create_requisition", {
      p_requisition_number: command.requisitionNumber,
      p_title: command.title,
      p_department: command.department,
      p_location: command.location,
      p_jobsite: command.jobsite,
      p_headcount: command.headcount,
      p_is_confidential: command.isConfidential,
      p_idempotency_key: command.idempotencyKey,
      p_request_hash: command.requestHash,
    });
    if (error) {
      throwDatabaseError(
        "recruiting/requisition.create",
        "The requisition could not be created. Confirm its number is unique and try again.",
        error,
      );
    }
    return recruitingCommandResponseSchema.parse({
      ok: true,
      command: command.command,
      result: data,
    });
  }

  if (command.command === "requisition.lifecycle") {
    const { data, error } = await db.rpc(
      "recruiting_set_requisition_lifecycle",
      {
        p_requisition_id: command.requisitionId,
        p_next_status: command.nextStatus,
        p_expected_row_version: command.expectedRowVersion,
        p_reason: command.reason,
        p_idempotency_key: command.idempotencyKey,
        p_request_hash: command.requestHash,
      },
    );
    if (error) {
      throwDatabaseError(
        "recruiting/requisition.lifecycle",
        safeRecruitingMutationMessage(
          error,
          "The position status could not be changed. Reload the position and try again.",
        ),
        error,
      );
    }
    return recruitingCommandResponseSchema.parse({
      ok: true,
      command: command.command,
      result: data,
    });
  }

  if (command.command === "requisition.delete") {
    const { data, error } = await db.rpc(
      "recruiting_delete_unused_draft_requisition",
      {
        p_requisition_id: command.requisitionId,
        p_expected_row_version: command.expectedRowVersion,
        p_idempotency_key: command.idempotencyKey,
        p_request_hash: command.requestHash,
      },
    );
    if (error) {
      throwDatabaseError(
        "recruiting/requisition.delete",
        safeRecruitingMutationMessage(
          error,
          "The draft could not be deleted. Only an unused draft can be removed; close or cancel a used position instead.",
        ),
        error,
      );
    }
    return recruitingCommandResponseSchema.parse({
      ok: true,
      command: command.command,
      result: data,
    });
  }

  if (command.command === "task.create") {
    const { data, error } = await db.rpc("recruiting_create_task", {
      p_requisition_id: command.requisitionId,
      p_candidate_id: command.candidateId,
      p_application_id: command.applicationId,
      p_title: command.title,
      p_task_type: command.taskType,
      p_priority: command.priority,
      p_due_at: command.dueAt,
      p_idempotency_key: command.idempotencyKey,
      p_request_hash: command.requestHash,
    });
    if (error) {
      throwDatabaseError(
        "recruiting/task.create",
        "The recruiting task could not be created.",
        error,
      );
    }
    return recruitingCommandResponseSchema.parse({
      ok: true,
      command: command.command,
      result: data,
    });
  }

  const uatChecks = [];
  if (command.applicationId) {
    uatChecks.push(
      db
        .from("recruiting_uat_submissions")
        .select("id")
        .eq("application_id", command.applicationId)
        .maybeSingle(),
    );
  }
  if (command.candidateId) {
    uatChecks.push(
      db
        .from("recruiting_uat_submissions")
        .select("id")
        .eq("candidate_id", command.candidateId)
        .maybeSingle(),
    );
  }
  const uatResults = await Promise.all(uatChecks);
  const uatLookupError = uatResults.find((result) => result.error)?.error;
  if (uatLookupError) {
    throwDatabaseError(
      "recruiting/ai.request-uat-check",
      "The candidate test status could not be verified. No AI request was made.",
      uatLookupError,
    );
  }
  if (uatResults.some((result) => result.data)) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where: "recruiting/ai.request",
      message:
        "AI assistance is unavailable for synthetic test applications. Review the test résumé manually.",
    });
  }

  const { data: setting, error: settingError } = await db
    .from("recruiting_settings")
    .select("value")
    .eq("key", "ai_enabled")
    .maybeSingle();
  if (settingError) {
    throwDatabaseError(
      "recruiting/ai.request",
      "The employment-AI enablement gate could not be verified.",
      settingError,
    );
  }
  if (setting?.value !== true || !process.env.OPENAI_API_KEY) {
    throw new GuardrailError({
      code: "CONFIGURATION_ERROR",
      where: "recruiting/ai.request",
      message:
        "Employment AI assistance is disabled. The core recruiting workflow remains available without it.",
      status: 503,
      severity: "medium",
    });
  }

  const { data, error } = await db.rpc("recruiting_request_ai_assistance", {
    p_action: command.action,
    p_requisition_id: command.requisitionId,
    p_candidate_id: command.candidateId,
    p_application_id: command.applicationId,
    p_prompt_version: command.promptVersion,
    p_idempotency_key: command.idempotencyKey,
    p_request_hash: command.requestHash,
  });
  if (error) {
    throwDatabaseError(
      "recruiting/ai.request",
      "The AI assistance request could not be recorded. No candidate decision was made.",
      error,
    );
  }
  return recruitingCommandResponseSchema.parse({
    ok: true,
    command: command.command,
    result: data,
  });
}
