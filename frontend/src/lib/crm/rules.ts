import type {
  CrmAccount,
  CrmActivity,
  CrmActivityCandidate,
  CrmConversionAttempt,
  CrmDashboardMetrics,
  CrmDeal,
  CrmFollowUp,
  CrmSettings,
  CrmStage,
} from "@/lib/crm/types";

const OPEN_TASK_STATUSES = new Set(["open", "in_progress", "blocked"]);
const MILLISECONDS_PER_DAY = 86_400_000;
const DEFAULT_REPORTING_TIMEZONE = "America/Indianapolis";

export function crmDateOnly(date: Date, reportingTimezone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: reportingTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", options).formatToParts(date);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    parts = new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: DEFAULT_REPORTING_TIMEZONE,
    }).formatToParts(date);
  }
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export interface CrmDealAttention {
  code: "expected_close_overdue" | "no_next_action" | "stale_deal";
  label: string;
  reason: string;
  severity: "attention" | "watch";
}

export function evaluateCrmDealAttention(input: {
  deal: Pick<CrmDeal, "id" | "status" | "expectedCloseDate" | "updatedAt">;
  followUps: Array<Pick<CrmFollowUp, "dealId" | "dueDate" | "status">>;
  staleDealDays: number;
  reportingTimezone: string;
  now: Date;
}): CrmDealAttention[] {
  if (input.deal.status !== "open") return [];

  const today = crmDateOnly(input.now, input.reportingTimezone);
  const attention: CrmDealAttention[] = [];
  const hasFutureAction = input.followUps.some(
    (followUp) =>
      followUp.dealId === input.deal.id &&
      OPEN_TASK_STATUSES.has(followUp.status) &&
      followUp.dueDate >= today,
  );

  if (input.deal.expectedCloseDate && input.deal.expectedCloseDate < today) {
    attention.push({
      code: "expected_close_overdue",
      label: "Close date overdue",
      reason: `Expected close date was ${input.deal.expectedCloseDate}.`,
      severity: "attention",
    });
  }

  if (!hasFutureAction) {
    attention.push({
      code: "no_next_action",
      label: "No next action",
      reason: "No open CRM task is scheduled for today or later.",
      severity: "attention",
    });
  }

  const staleThreshold = Math.max(1, input.staleDealDays);
  const updatedAt = new Date(input.deal.updatedAt);
  const updatedDate = Number.isNaN(updatedAt.getTime())
    ? null
    : crmDateOnly(updatedAt, input.reportingTimezone);
  const staleAgeDays = updatedDate
    ? (Date.parse(`${today}T00:00:00Z`) -
        Date.parse(`${updatedDate}T00:00:00Z`)) /
      MILLISECONDS_PER_DAY
    : 0;

  if (staleAgeDays >= staleThreshold) {
    attention.push({
      code: "stale_deal",
      label: "Deal is stale",
      reason: `No deal update has been recorded in ${staleThreshold} days.`,
      severity: "watch",
    });
  }

  return attention;
}

export function calculateCrmDashboardMetrics(input: {
  accounts: CrmAccount[];
  deals: CrmDeal[];
  activities: CrmActivity[];
  followUps: CrmFollowUp[];
  now: Date;
}): CrmDashboardMetrics {
  const openDeals = input.deals.filter((deal) => deal.status === "open");
  const closedDeals = input.deals.filter(
    (deal) => deal.status === "won" || deal.status === "lost",
  );
  const wonDeals = closedDeals.filter((deal) => deal.status === "won");
  const weekStart = new Date(input.now);
  const day = weekStart.getUTCDay();
  weekStart.setUTCDate(weekStart.getUTCDate() - ((day + 6) % 7));
  weekStart.setUTCHours(0, 0, 0, 0);

  return {
    openPipeline: openDeals.reduce((sum, deal) => sum + deal.valueEstimate, 0),
    weightedPipeline: openDeals.reduce(
      (sum, deal) => sum + (deal.valueEstimate * deal.probability) / 100,
      0,
    ),
    winRate:
      closedDeals.length === 0
        ? null
        : (wonDeals.length / closedDeals.length) * 100,
    overdueFollowUps: input.followUps.filter(
      (task) =>
        OPEN_TASK_STATUSES.has(task.status) &&
        new Date(`${task.dueDate}T00:00:00Z`) < input.now,
    ).length,
    staleRelationships: input.accounts.filter(
      (account) => account.healthStatus === "stale",
    ).length,
    activityThisWeek: input.activities.filter(
      (activity) => new Date(activity.occurredAt) >= weekStart,
    ).length,
  };
}

export function transitionDeal(input: {
  deal: CrmDeal;
  targetStage: CrmStage;
  expectedRowVersion: number;
  reason?: string;
}): CrmDeal {
  if (input.deal.rowVersion !== input.expectedRowVersion) {
    throw new Error("This deal changed. Refresh before moving it.");
  }
  if (
    input.deal.status !== "open" &&
    input.targetStage.stageType === "open" &&
    !input.reason?.trim()
  ) {
    throw new Error("A reason is required to reopen a closed deal.");
  }
  if (
    input.deal.status === "won" &&
    input.targetStage.stageType === "open" &&
    input.deal.projectId !== null
  ) {
    throw new Error("Sever the project link before reopening this deal.");
  }
  if (input.targetStage.stageType === "lost" && !input.reason?.trim()) {
    throw new Error("A loss reason is required.");
  }

  const status = input.targetStage.stageType;
  return {
    ...input.deal,
    stageId: input.targetStage.id,
    status,
    probability: input.targetStage.defaultProbability,
    closedAt: status === "open" ? null : new Date().toISOString(),
    lostReason: status === "lost" ? (input.reason?.trim() ?? null) : null,
    updatedAt: new Date().toISOString(),
    rowVersion: input.deal.rowVersion + 1,
  };
}

export function upsertCommunicationCandidate(
  candidates: CrmActivityCandidate[],
  incoming: CrmActivityCandidate,
): CrmActivityCandidate[] {
  const exact = candidates.find(
    (candidate) =>
      candidate.sourceSystem === incoming.sourceSystem &&
      candidate.sourceExternalKey === incoming.sourceExternalKey &&
      candidate.contentHash === incoming.contentHash,
  );
  if (exact) return candidates;

  return [
    ...candidates.map((candidate) =>
      candidate.sourceSystem === incoming.sourceSystem &&
      candidate.sourceExternalKey === incoming.sourceExternalKey &&
      candidate.status === "pending"
        ? { ...candidate, status: "superseded" as const }
        : candidate,
    ),
    incoming,
  ];
}

export function canCreateDomainAlias(
  domain: string,
  settings: CrmSettings,
): boolean {
  const normalized = domain.trim().toLowerCase();
  return (
    normalized.length > 0 &&
    !settings.freeEmailDomains
      .map((value) => value.toLowerCase())
      .includes(normalized)
  );
}

export function requestDealConversion(input: {
  deal: CrmDeal;
  idempotencyKey: string;
  existingAttempts: CrmConversionAttempt[];
}): CrmConversionAttempt {
  const existing = input.existingAttempts.find(
    (attempt) => attempt.idempotencyKey === input.idempotencyKey,
  );
  if (existing) return existing;
  if (input.deal.status !== "won") {
    throw new Error("Only a won deal can be converted to a project.");
  }
  if (input.deal.projectId !== null) {
    throw new Error("This deal is already linked to a project.");
  }
  return {
    idempotencyKey: input.idempotencyKey,
    dealId: input.deal.id,
    status: "pending",
    projectId: null,
    erpExternalId: null,
    attemptCount: 0,
    errorMessage: null,
  };
}
