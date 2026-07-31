"use client";

import * as React from "react";

import {
  CRM_REVIEW_ACCOUNTS,
  CRM_REVIEW_ACTIVITIES,
  CRM_REVIEW_CANDIDATES,
  CRM_REVIEW_DEALS,
  CRM_REVIEW_FOLLOW_UPS,
  CRM_REVIEW_OWNERS,
  CRM_REVIEW_SETTINGS,
  CRM_REVIEW_STAGES,
} from "@/lib/crm/local-review-data";
import { requestDealConversion, transitionDeal } from "@/lib/crm/rules";
import type {
  CrmAccount,
  CrmActivity,
  CrmActivityCandidate,
  CrmConversionAttempt,
  CrmDeal,
  CrmFollowUp,
  CrmSettings,
} from "@/lib/crm/types";

const STORAGE_KEY = "alleato.crm.local.v1";

export interface LocalCrmState {
  accounts: CrmAccount[];
  deals: CrmDeal[];
  activities: CrmActivity[];
  followUps: CrmFollowUp[];
  candidates: CrmActivityCandidate[];
  settings: CrmSettings;
  conversionAttempts: CrmConversionAttempt[];
  attachments: Record<string, string[]>;
  archivedAccountIds: string[];
  archivedDealIds: string[];
  matchAliases: Array<{
    id: string;
    sourceSystem: CrmActivityCandidate["sourceSystem"];
    companyId: string;
    companyName: string;
    outcome: "accepted" | "rejected";
  }>;
  auditNotes: Array<{
    id: string;
    entityType: "account" | "deal";
    entityId: string;
    action: "archive" | "sever_project_link";
    reason: string;
    occurredAt: string;
  }>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function createInitialLocalCrmState(): LocalCrmState {
  return {
    accounts: clone(CRM_REVIEW_ACCOUNTS),
    deals: clone(CRM_REVIEW_DEALS),
    activities: clone(CRM_REVIEW_ACTIVITIES),
    followUps: clone(CRM_REVIEW_FOLLOW_UPS),
    candidates: clone(CRM_REVIEW_CANDIDATES),
    settings: clone(CRM_REVIEW_SETTINGS),
    conversionAttempts: [],
    archivedAccountIds: [],
    archivedDealIds: [],
    matchAliases: [],
    auditNotes: [],
    attachments: Object.fromEntries(
      CRM_REVIEW_DEALS.map((deal) => [
        deal.id,
        ["Concept proposal.pdf", "Scope assumptions.docx"],
      ]),
    ),
  };
}

let snapshot = createInitialLocalCrmState();
let loaded = false;
const listeners = new Set<() => void>();

function readStoredState(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<LocalCrmState>;
    snapshot = {
      ...createInitialLocalCrmState(),
      ...parsed,
      settings: { ...CRM_REVIEW_SETTINGS, ...parsed.settings },
      attachments: parsed.attachments ?? {},
      archivedAccountIds: parsed.archivedAccountIds ?? [],
      archivedDealIds: parsed.archivedDealIds ?? [],
      matchAliases: parsed.matchAliases ?? [],
      auditNotes: parsed.auditNotes ?? [],
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function getSnapshot(): LocalCrmState {
  readStoredState();
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: LocalCrmState): void {
  snapshot = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((listener) => listener());
}

function recalculateNextFollowUp(
  accounts: CrmAccount[],
  followUps: CrmFollowUp[],
  companyId: string | null,
): CrmAccount[] {
  if (!companyId) return accounts;
  const nextFollowUpAt =
    followUps
      .filter(
        (followUp) =>
          followUp.companyId === companyId &&
          !["done", "cancelled"].includes(followUp.status),
      )
      .sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0]
      ?.dueDate ?? null;

  return accounts.map((account) =>
    account.companyId === companyId
      ? {
          ...account,
          nextFollowUpAt,
          rowVersion: account.rowVersion + 1,
        }
      : account,
  );
}

function updateFollowUpRecord(
  followUpId: string,
  patch: Partial<
    Pick<CrmFollowUp, "title" | "dueDate" | "assignee" | "status" | "priority">
  >,
): void {
  const target = snapshot.followUps.find(
    (followUp) => followUp.id === followUpId,
  );
  if (!target) throw new Error("Follow-up was not found.");
  if (patch.title !== undefined && !patch.title.trim()) {
    throw new Error("Follow-up title is required.");
  }
  if (patch.dueDate !== undefined && !isValidDateOnly(patch.dueDate)) {
    throw new Error("Follow-up due date must use YYYY-MM-DD.");
  }

  const nextFollowUps = snapshot.followUps.map((followUp) =>
    followUp.id === followUpId
      ? {
          ...followUp,
          ...patch,
          title: patch.title?.trim() ?? followUp.title,
        }
      : followUp,
  );
  commit({
    ...snapshot,
    followUps: nextFollowUps,
    accounts: recalculateNextFollowUp(
      snapshot.accounts,
      nextFollowUps,
      target.companyId,
    ),
  });
}

function updateAccountForActivity(
  accounts: CrmAccount[],
  activity: Pick<CrmActivity, "companyId" | "activityType" | "occurredAt">,
): CrmAccount[] {
  if (
    !snapshot.settings.meaningfulActivityTypes.includes(activity.activityType)
  ) {
    return accounts;
  }
  return accounts.map((account) =>
    account.companyId === activity.companyId
      ? {
          ...account,
          lastMeaningfulActivityAt: activity.occurredAt,
          healthStatus: "active",
          healthReason: "Meaningful activity was recorded locally.",
          healthEvaluatedAt: activity.occurredAt,
          rowVersion: account.rowVersion + 1,
        }
      : account,
  );
}

function recalculateDealAccount(
  accounts: CrmAccount[],
  deals: CrmDeal[],
  companyId: string | null,
  won: boolean,
  archivedDealIds: string[] = snapshot.archivedDealIds,
): CrmAccount[] {
  if (!companyId) return accounts;
  const openDealValue = deals
    .filter(
      (deal) =>
        deal.companyId === companyId &&
        deal.status === "open" &&
        !archivedDealIds.includes(deal.id),
    )
    .reduce((sum, deal) => sum + deal.valueEstimate, 0);
  return accounts.map((account) =>
    account.companyId === companyId
      ? {
          ...account,
          openDealValue,
          lifecycleStage: won ? "active_client" : account.lifecycleStage,
          rowVersion: account.rowVersion + 1,
        }
      : account,
  );
}

function recalculateActivityHealth(
  accounts: CrmAccount[],
  activities: CrmActivity[],
  companyId: string | null,
): CrmAccount[] {
  if (!companyId) return accounts;
  const now = new Date();
  return accounts.map((account) => {
    if (account.companyId !== companyId) return account;
    const latest = activities
      .filter(
        (activity) =>
          activity.companyId === account.companyId &&
          snapshot.settings.meaningfulActivityTypes.includes(
            activity.activityType,
          ),
      )
      .sort((left, right) =>
        right.occurredAt.localeCompare(left.occurredAt),
      )[0];
    if (!latest) {
      return {
        ...account,
        lastMeaningfulActivityAt: null,
        healthStatus: "unknown",
        healthReason: "No meaningful activity has been recorded.",
        healthEvaluatedAt: now.toISOString(),
        rowVersion: account.rowVersion + 1,
      };
    }
    const ageDays = Math.floor(
      (now.getTime() - new Date(latest.occurredAt).getTime()) / 86_400_000,
    );
    const healthStatus =
      ageDays <= snapshot.settings.activeDays
        ? "active"
        : ageDays <= snapshot.settings.watchDays
          ? "watch"
          : "stale";
    return {
      ...account,
      lastMeaningfulActivityAt: latest.occurredAt,
      healthStatus,
      healthReason:
        healthStatus === "active"
          ? "Meaningful activity was recorded locally."
          : `No meaningful activity in ${ageDays} days.`,
      healthEvaluatedAt: now.toISOString(),
      rowVersion: account.rowVersion + 1,
    };
  });
}

export const localCrmActions = {
  reset() {
    commit(createInitialLocalCrmState());
  },
  addActivity(
    input: Omit<
      CrmActivity,
      "id" | "occurredAt" | "createdBy" | "recordOrigin"
    >,
  ) {
    const now = new Date().toISOString();
    const activity: CrmActivity = {
      ...input,
      id: `local-activity-${Date.now()}`,
      occurredAt: now,
      createdBy: "Brandon Clymer",
      recordOrigin: "manual",
    };
    commit({
      ...snapshot,
      activities: [activity, ...snapshot.activities],
      accounts: updateAccountForActivity(snapshot.accounts, activity),
    });
    return activity;
  },
  addDeal(input: {
    name: string;
    companyId: string;
    valueEstimate: number;
    expectedCloseDate: string | null;
  }) {
    if (!input.name.trim()) throw new Error("Deal name is required.");
    if (!Number.isFinite(input.valueEstimate) || input.valueEstimate <= 0) {
      throw new Error("Deal value must be a finite, positive number.");
    }
    if (input.expectedCloseDate && !isValidDateOnly(input.expectedCloseDate)) {
      throw new Error("Expected close must be a valid YYYY-MM-DD date.");
    }
    const account = snapshot.accounts.find(
      (candidate) => candidate.companyId === input.companyId,
    );
    if (!account) throw new Error("Choose a CRM account.");
    const deal: CrmDeal = {
      id: `local-deal-${Date.now()}`,
      name: input.name,
      companyId: account.companyId,
      companyName: account.name,
      owner: account.owner,
      stageId: CRM_REVIEW_STAGES[0].id,
      status: "open",
      valueEstimate: input.valueEstimate,
      probability: CRM_REVIEW_STAGES[0].defaultProbability,
      expectedCloseDate: input.expectedCloseDate,
      closedAt: null,
      projectId: null,
      projectSyncStatus: "not_started",
      source: "Local entry",
      lostReason: null,
      updatedAt: new Date().toISOString(),
      rowVersion: 1,
    };
    commit({
      ...snapshot,
      deals: [deal, ...snapshot.deals],
      accounts: snapshot.accounts.map((candidate) =>
        candidate.companyId === account.companyId
          ? {
              ...candidate,
              openDealValue: candidate.openDealValue + deal.valueEstimate,
              rowVersion: candidate.rowVersion + 1,
            }
          : candidate,
      ),
      attachments: { ...snapshot.attachments, [deal.id]: [] },
    });
    return deal;
  },
  updateDeal(dealId: string, patch: Partial<CrmDeal>) {
    if (snapshot.archivedDealIds.includes(dealId)) {
      throw new Error("Restore the deal before editing it.");
    }
    if (patch.name !== undefined && !patch.name.trim()) {
      throw new Error("Deal name is required.");
    }
    if (
      patch.valueEstimate !== undefined &&
      (!Number.isFinite(patch.valueEstimate) || patch.valueEstimate < 0)
    ) {
      throw new Error("Deal value must be a finite, non-negative number.");
    }
    if (
      patch.probability !== undefined &&
      (!Number.isFinite(patch.probability) ||
        !Number.isInteger(patch.probability) ||
        patch.probability < 0 ||
        patch.probability > 100)
    ) {
      throw new Error("Probability must be between 0 and 100.");
    }
    if (patch.expectedCloseDate && !isValidDateOnly(patch.expectedCloseDate)) {
      throw new Error("Expected close must use YYYY-MM-DD.");
    }
    const currentDeal = snapshot.deals.find((deal) => deal.id === dealId);
    const nextDeals = snapshot.deals.map((deal) =>
      deal.id === dealId
        ? {
            ...deal,
            ...patch,
            updatedAt: new Date().toISOString(),
            rowVersion: deal.rowVersion + 1,
          }
        : deal,
    );
    commit({
      ...snapshot,
      deals: nextDeals,
      accounts: currentDeal
        ? recalculateDealAccount(
            snapshot.accounts,
            nextDeals,
            currentDeal.companyId,
            false,
          )
        : snapshot.accounts,
    });
  },
  moveDeal(dealId: string, stageId: string) {
    if (snapshot.archivedDealIds.includes(dealId)) {
      throw new Error("Restore the deal before moving it.");
    }
    const deal = snapshot.deals.find((candidate) => candidate.id === dealId);
    const targetStage = CRM_REVIEW_STAGES.find((stage) => stage.id === stageId);
    if (!deal || !targetStage) throw new Error("Deal or stage was not found.");
    const next = transitionDeal({
      deal,
      targetStage,
      expectedRowVersion: deal.rowVersion,
      reason:
        targetStage.stageType === "lost"
          ? "Local opportunity did not proceed."
          : deal.status !== "open" && targetStage.stageType === "open"
            ? "Local opportunity reopened."
            : undefined,
    });
    const nextDeals = snapshot.deals.map((candidate) =>
      candidate.id === dealId ? next : candidate,
    );
    commit({
      ...snapshot,
      deals: nextDeals,
      accounts: recalculateDealAccount(
        snapshot.accounts,
        nextDeals,
        deal.companyId,
        next.status === "won",
      ),
    });
    return next;
  },
  convertDeal(dealId: string) {
    const deal = snapshot.deals.find((candidate) => candidate.id === dealId);
    if (!deal) throw new Error("Deal was not found.");
    const attempt = requestDealConversion({
      deal,
      idempotencyKey: `${deal.id}:local-conversion`,
      existingAttempts: snapshot.conversionAttempts,
    });
    const completed: CrmConversionAttempt = {
      ...attempt,
      status: "completed",
      projectId: 4127,
      erpExternalId: "LOCAL-ONLY-4127",
      attemptCount: attempt.attemptCount + 1,
    };
    commit({
      ...snapshot,
      conversionAttempts: snapshot.conversionAttempts.some(
        (candidate) => candidate.idempotencyKey === completed.idempotencyKey,
      )
        ? snapshot.conversionAttempts
        : [...snapshot.conversionAttempts, completed],
      deals: snapshot.deals.map((candidate) =>
        candidate.id === dealId
          ? {
              ...candidate,
              projectId: completed.projectId,
              projectSyncStatus: "linked",
              rowVersion: candidate.rowVersion + 1,
            }
          : candidate,
      ),
    });
    return completed;
  },
  decideCandidate(candidateId: string, accepted: boolean) {
    const candidate = snapshot.candidates.find(
      (item) => item.id === candidateId,
    );
    if (!candidate || candidate.status !== "pending") return;
    const activities = accepted
      ? [
          {
            id: `accepted-${candidate.id}`,
            companyId: candidate.proposedCompanyId,
            companyName: candidate.proposedCompanyName,
            dealId: null,
            activityType: "email" as const,
            subject: candidate.subject,
            occurredAt: candidate.occurredAt,
            createdBy: "Local matching review",
            recordOrigin: "auto" as const,
            visibilityScope: candidate.visibilityScope,
          },
          ...snapshot.activities,
        ]
      : snapshot.activities;
    commit({
      ...snapshot,
      candidates: snapshot.candidates.map((item) =>
        item.id === candidateId
          ? { ...item, status: accepted ? "accepted" : "rejected" }
          : item,
      ),
      activities,
      accounts: accepted
        ? recalculateActivityHealth(
            snapshot.accounts,
            activities,
            candidate.proposedCompanyId,
          )
        : snapshot.accounts,
      matchAliases: [
        ...snapshot.matchAliases,
        {
          id: `alias-${candidate.id}`,
          sourceSystem: candidate.sourceSystem,
          companyId: candidate.proposedCompanyId,
          companyName: candidate.proposedCompanyName,
          outcome: accepted ? "accepted" : "rejected",
        },
      ],
    });
  },
  saveSettings(settings: CrmSettings) {
    if (
      ![settings.activeDays, settings.watchDays, settings.staleDealDays].every(
        (value) => Number.isInteger(value) && value > 0,
      ) ||
      settings.watchDays <= settings.activeDays
    ) {
      throw new Error("Health thresholds must be positive whole numbers.");
    }
    commit({ ...snapshot, settings });
  },
  enrollCompany(companyId: string, name: string) {
    if (snapshot.accounts.some((account) => account.companyId === companyId))
      return;
    const now = new Date().toISOString();
    commit({
      ...snapshot,
      accounts: [
        ...snapshot.accounts,
        {
          companyId,
          name,
          lifecycleStage: "lead",
          owner: CRM_REVIEW_OWNERS.brandon,
          healthStatus: "unknown",
          healthReason: "No meaningful local activity has been recorded.",
          healthEvaluatedAt: now,
          lastMeaningfulActivityAt: null,
          nextFollowUpAt: null,
          openDealValue: 0,
          rowVersion: 1,
        },
      ],
    });
  },
  addAttachment(dealId: string, name: string) {
    if (snapshot.archivedDealIds.includes(dealId)) return;
    const current = snapshot.attachments[dealId] ?? [];
    if (current.includes(name)) return;
    commit({
      ...snapshot,
      attachments: {
        ...snapshot.attachments,
        [dealId]: [...current, name],
      },
    });
  },
  removeAttachment(dealId: string, name: string) {
    commit({
      ...snapshot,
      attachments: {
        ...snapshot.attachments,
        [dealId]: (snapshot.attachments[dealId] ?? []).filter(
          (candidate) => candidate !== name,
        ),
      },
    });
  },
  updateActivity(
    activityId: string,
    patch: Pick<CrmActivity, "subject" | "activityType">,
  ) {
    if (!patch.subject.trim()) throw new Error("Activity subject is required.");
    const nextActivities = snapshot.activities.map((activity) =>
      activity.id === activityId
        ? { ...activity, ...patch, subject: patch.subject.trim() }
        : activity,
    );
    const target = snapshot.activities.find(
      (activity) => activity.id === activityId,
    );
    commit({
      ...snapshot,
      activities: nextActivities,
      accounts: target
        ? recalculateActivityHealth(
            snapshot.accounts,
            nextActivities,
            target.companyId,
          )
        : snapshot.accounts,
    });
  },
  removeActivity(activityId: string) {
    const target = snapshot.activities.find(
      (activity) => activity.id === activityId,
    );
    const nextActivities = snapshot.activities.filter(
      (activity) => activity.id !== activityId,
    );
    commit({
      ...snapshot,
      activities: nextActivities,
      accounts: target
        ? recalculateActivityHealth(
            snapshot.accounts,
            nextActivities,
            target.companyId,
          )
        : snapshot.accounts,
    });
  },
  addFollowUp(input: Omit<CrmFollowUp, "id" | "status">) {
    if (input.dealId && snapshot.archivedDealIds.includes(input.dealId)) {
      throw new Error("Restore the deal before adding a follow-up.");
    }
    if (!input.title.trim() || !isValidDateOnly(input.dueDate)) {
      throw new Error(
        "Follow-up title and a YYYY-MM-DD due date are required.",
      );
    }
    const followUp: CrmFollowUp = {
      ...input,
      id: `local-follow-up-${Date.now()}`,
      title: input.title.trim(),
      status: "open",
    };
    const nextFollowUps = [followUp, ...snapshot.followUps];
    commit({
      ...snapshot,
      followUps: nextFollowUps,
      accounts: recalculateNextFollowUp(
        snapshot.accounts,
        nextFollowUps,
        input.companyId,
      ),
    });
    return followUp;
  },
  updateFollowUp(
    followUpId: string,
    patch: Partial<
      Pick<
        CrmFollowUp,
        "title" | "dueDate" | "assignee" | "status" | "priority"
      >
    >,
  ) {
    updateFollowUpRecord(followUpId, patch);
  },
  updateFollowUpStatus(followUpId: string, status: CrmFollowUp["status"]) {
    updateFollowUpRecord(followUpId, { status });
  },
  removeFollowUp(followUpId: string) {
    const target = snapshot.followUps.find(
      (followUp) => followUp.id === followUpId,
    );
    if (!target) return;
    const nextFollowUps = snapshot.followUps.filter(
      (followUp) => followUp.id !== followUpId,
    );
    commit({
      ...snapshot,
      followUps: nextFollowUps,
      accounts: recalculateNextFollowUp(
        snapshot.accounts,
        nextFollowUps,
        target.companyId,
      ),
    });
  },
  archiveAccount(companyId: string, reason: string) {
    if (!reason.trim()) throw new Error("Archive reason is required.");
    const hasOpenDeal = snapshot.deals.some(
      (deal) =>
        deal.companyId === companyId &&
        deal.status === "open" &&
        !snapshot.archivedDealIds.includes(deal.id),
    );
    if (hasOpenDeal) throw new Error("Close or archive open deals first.");
    commit({
      ...snapshot,
      archivedAccountIds: [
        ...new Set([...snapshot.archivedAccountIds, companyId]),
      ],
      auditNotes: [
        ...snapshot.auditNotes,
        {
          id: `account-archive-${Date.now()}`,
          entityType: "account",
          entityId: companyId,
          action: "archive",
          reason: reason.trim(),
          occurredAt: new Date().toISOString(),
        },
      ],
    });
  },
  restoreAccount(companyId: string) {
    commit({
      ...snapshot,
      archivedAccountIds: snapshot.archivedAccountIds.filter(
        (id) => id !== companyId,
      ),
    });
  },
  archiveDeal(dealId: string, reason: string) {
    if (!reason.trim()) throw new Error("Archive reason is required.");
    const deal = snapshot.deals.find((candidate) => candidate.id === dealId);
    if (!deal) throw new Error("Deal was not found.");
    if (deal.projectId)
      throw new Error("Remove the local project link before archiving.");
    const archivedDealIds = [...new Set([...snapshot.archivedDealIds, dealId])];
    commit({
      ...snapshot,
      archivedDealIds,
      accounts: recalculateDealAccount(
        snapshot.accounts,
        snapshot.deals,
        deal.companyId,
        false,
        archivedDealIds,
      ),
      auditNotes: [
        ...snapshot.auditNotes,
        {
          id: `deal-archive-${Date.now()}`,
          entityType: "deal",
          entityId: dealId,
          action: "archive",
          reason: reason.trim(),
          occurredAt: new Date().toISOString(),
        },
      ],
    });
  },
  restoreDeal(dealId: string) {
    const deal = snapshot.deals.find((candidate) => candidate.id === dealId);
    const archivedDealIds = snapshot.archivedDealIds.filter(
      (id) => id !== dealId,
    );
    commit({
      ...snapshot,
      archivedDealIds,
      accounts: deal
        ? recalculateDealAccount(
            snapshot.accounts,
            snapshot.deals,
            deal.companyId,
            false,
            archivedDealIds,
          )
        : snapshot.accounts,
    });
  },
  severProjectLink(dealId: string, reason: string) {
    if (!reason.trim())
      throw new Error("Project-link removal reason is required.");
    const current = snapshot.deals.find((deal) => deal.id === dealId);
    if (current?.projectSyncStatus === "erp_synchronized") {
      throw new Error(
        "ERP-synchronized project links cannot be removed locally.",
      );
    }
    commit({
      ...snapshot,
      deals: snapshot.deals.map((deal) =>
        deal.id === dealId
          ? {
              ...deal,
              projectId: null,
              projectSyncStatus: "not_started",
              rowVersion: deal.rowVersion + 1,
            }
          : deal,
      ),
      auditNotes: [
        ...snapshot.auditNotes,
        {
          id: `deal-sever-${Date.now()}`,
          entityType: "deal",
          entityId: dealId,
          action: "sever_project_link",
          reason: reason.trim(),
          occurredAt: new Date().toISOString(),
        },
      ],
    });
  },
};

export function useLocalCrmStore(): LocalCrmState & typeof localCrmActions {
  const [state, setState] = React.useState<LocalCrmState>(() => snapshot);
  React.useEffect(() => {
    readStoredState();
    setState(snapshot);
    return subscribe(() => setState(snapshot));
  }, []);
  return React.useMemo(() => ({ ...state, ...localCrmActions }), [state]);
}

export function getLocalCrmSnapshot(): LocalCrmState {
  return getSnapshot();
}

export { CRM_REVIEW_STAGES as LOCAL_CRM_STAGES };
