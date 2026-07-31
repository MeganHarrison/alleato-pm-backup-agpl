"use client";

import * as React from "react";

import { apiFetch } from "@/lib/api-client";
import type {
  CrmAccount,
  CrmActivity,
  CrmActivityCandidate,
  CrmConversionAttempt,
  CrmDeal,
  CrmDealStageEvent,
  CrmFollowUp,
  CrmLead,
  CrmAiArtifact,
  CrmRelationshipTarget,
  CrmSettings,
  CrmStage,
} from "@/lib/crm/types";

interface CrmPipeline {
  id: string;
  name: string;
  isDefault: boolean;
}

interface CrmWorkspaceData {
  accounts: CrmAccount[];
  leads: CrmLead[];
  deals: CrmDeal[];
  activities: CrmActivity[];
  followUps: CrmFollowUp[];
  candidates: CrmActivityCandidate[];
  settings: CrmSettings;
  stages: Array<CrmStage & { pipelineId: string }>;
  pipelines: CrmPipeline[];
  conversionAttempts: CrmConversionAttempt[];
  dealStageEvents: CrmDealStageEvent[];
  attachments: Record<string, string[]>;
  archivedAccountIds: string[];
  archivedDealIds: string[];
  matchAliases: Array<Record<string, unknown>>;
}

const EMPTY_WORKSPACE: CrmWorkspaceData = {
  accounts: [],
  leads: [],
  deals: [],
  activities: [],
  followUps: [],
  candidates: [],
  stages: [],
  pipelines: [],
  conversionAttempts: [],
  dealStageEvents: [],
  attachments: {},
  archivedAccountIds: [],
  archivedDealIds: [],
  matchAliases: [],
  settings: {
    meaningfulActivityTypes: ["call", "email", "meeting"],
    activeDays: 14,
    watchDays: 30,
    staleDealDays: 30,
    reportingTimezone: "America/Indianapolis",
    autoAcceptEnabled: false,
    freeEmailDomains: [],
  },
};

export function useCrmWorkspace() {
  const [workspace, setWorkspace] =
    React.useState<CrmWorkspaceData>(EMPTY_WORKSPACE);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ data: CrmWorkspaceData }>(
        "/api/crm/workspace",
        { cache: "no-store" },
      );
      setWorkspace(result.data);
      return result.data;
    } catch (caught) {
      const nextError =
        caught instanceof Error
          ? caught
          : new Error("CRM could not be loaded.");
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const mutate = React.useCallback(
    async <T>(url: string, init: RequestInit): Promise<T> => {
      const result = await apiFetch<{ data: T }>(url, init);
      await refresh();
      return result.data;
    },
    [refresh],
  );

  const actions = React.useMemo(
    () => ({
      refresh,
      async addActivity(
        input: Omit<
          CrmActivity,
          | "id"
          | "occurredAt"
          | "createdBy"
          | "recordOrigin"
          | "sourceSystem"
          | "sourceExternalKey"
        >,
      ) {
        return mutate<CrmActivity>("/api/crm/activities", {
          method: "POST",
          body: JSON.stringify({
            company_id: input.companyId,
            lead_id: input.leadId,
            deal_id: input.dealId,
            activity_type: input.activityType,
            subject: input.subject,
            occurred_at: new Date().toISOString(),
            contact_person_ids: [],
          }),
        });
      },
      async addDeal(input: {
        name: string;
        target: CrmRelationshipTarget;
        valueEstimate: number;
        expectedCloseDate: string | null;
      }) {
        const stage = workspace.stages.find(
          (candidate) => candidate.stageType === "open",
        );
        if (!stage) {
          throw new Error("An open CRM pipeline stage is required.");
        }
        return mutate<CrmDeal>("/api/crm/deals", {
          method: "POST",
          body: JSON.stringify({
            name: input.name,
            company_id:
              input.target.type === "account" ? input.target.id : null,
            lead_id: input.target.type === "lead" ? input.target.id : null,
            pipeline_id: stage.pipelineId,
            stage_id: stage.id,
            owner_person_id: input.target.owner.id,
            value_estimate: input.valueEstimate,
            probability: stage.defaultProbability,
            expected_close_date: input.expectedCloseDate,
            source: "manual",
          }),
        });
      },
      async updateDeal(dealId: string, patch: Partial<CrmDeal>) {
        const current = workspace.deals.find((deal) => deal.id === dealId);
        if (!current) throw new Error("Deal was not found.");
        const body: Record<string, unknown> = {
          row_version: current.rowVersion,
        };
        if (patch.name !== undefined) body.name = patch.name;
        if (patch.valueEstimate !== undefined) {
          body.value_estimate = patch.valueEstimate;
        }
        if (patch.probability !== undefined)
          body.probability = patch.probability;
        if (patch.expectedCloseDate !== undefined) {
          body.expected_close_date = patch.expectedCloseDate || null;
        }
        if (patch.source !== undefined) body.source = patch.source;
        return mutate<CrmDeal>(`/api/crm/deals/${dealId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      },
      async moveDeal(dealId: string, stageId: string) {
        const deal = workspace.deals.find(
          (candidate) => candidate.id === dealId,
        );
        const stage = workspace.stages.find(
          (candidate) => candidate.id === stageId,
        );
        if (!deal || !stage) throw new Error("Deal or stage was not found.");
        const reason =
          stage.stageType === "lost"
            ? "Opportunity did not proceed."
            : deal.status !== "open" && stage.stageType === "open"
              ? "Opportunity reopened."
              : undefined;
        return mutate<CrmDeal>(`/api/crm/deals/${dealId}/transition`, {
          method: "POST",
          body: JSON.stringify({
            to_stage_id: stageId,
            row_version: deal.rowVersion,
            reason,
          }),
        });
      },
      async convertDeal(dealId: string) {
        return mutate<CrmConversionAttempt>(
          `/api/crm/deals/${dealId}/conversion`,
          {
            method: "POST",
            body: JSON.stringify({
              idempotency_key: `${dealId}:project-conversion:v1`,
            }),
          },
        );
      },
      async decideCandidate(candidateId: string, accepted: boolean) {
        return mutate<CrmActivityCandidate>(
          `/api/crm/activity-candidates/${candidateId}/decision`,
          {
            method: "POST",
            body: JSON.stringify({
              decision: accepted ? "accept" : "reject",
              feedback: accepted ? undefined : "Rejected during CRM review.",
              activity_type: "email",
            }),
          },
        );
      },
      async saveSettings(settings: CrmSettings) {
        return mutate<unknown>("/api/crm/settings", {
          method: "PATCH",
          body: JSON.stringify({
            health_thresholds: {
              active_days: settings.activeDays,
              watch_days: settings.watchDays,
            },
            stale_deal_threshold_days: settings.staleDealDays,
            default_reporting_timezone: settings.reportingTimezone,
            auto_accept_enabled: settings.autoAcceptEnabled,
            free_email_domain_denylist: settings.freeEmailDomains,
          }),
        });
      },
      async enrollCompany(companyId: string) {
        return mutate<CrmAccount>("/api/crm/accounts", {
          method: "POST",
          body: JSON.stringify({
            company_id: companyId,
            lifecycle_stage: "lead",
          }),
        });
      },
      async createLead(input: {
        fullName: string;
        prospectCompanyName: string;
        jobTitle?: string;
        email: string;
        phone: string;
      }) {
        return mutate<{ id: string }>("/api/crm/leads", {
          method: "POST",
          body: JSON.stringify({
            full_name: input.fullName,
            prospect_company_name: input.prospectCompanyName,
            job_title: input.jobTitle,
            email: input.email,
            phone: input.phone,
            source: "manual",
          }),
        });
      },
      async convertLead(leadId: string, companyId: string) {
        const lead = workspace.leads.find(
          (candidate) => candidate.id === leadId,
        );
        if (!lead) throw new Error("CRM lead was not found.");
        return mutate<CrmLead>(`/api/crm/leads/${leadId}/convert`, {
          method: "POST",
          body: JSON.stringify({
            company_id: companyId,
            row_version: lead.rowVersion,
          }),
        });
      },
      async updateLead(
        leadId: string,
        patch: Partial<
          Pick<
            CrmLead,
            | "fullName"
            | "prospectCompanyName"
            | "jobTitle"
            | "email"
            | "phone"
            | "websiteUrl"
            | "linkedinUrl"
            | "facebookUrl"
            | "xUrl"
          >
        >,
      ) {
        const lead = workspace.leads.find(
          (candidate) => candidate.id === leadId,
        );
        if (!lead) throw new Error("CRM lead was not found.");
        return mutate<{ id: string }>(`/api/crm/leads/${leadId}`, {
          method: "PATCH",
          body: JSON.stringify({
            row_version: lead.rowVersion,
            full_name: patch.fullName,
            prospect_company_name: patch.prospectCompanyName,
            job_title: patch.jobTitle,
            email: patch.email,
            phone: patch.phone,
            website_url: patch.websiteUrl,
            linkedin_url: patch.linkedinUrl,
            facebook_url: patch.facebookUrl,
            x_url: patch.xUrl,
          }),
        });
      },
      async researchLead(leadId: string) {
        return mutate<CrmAiArtifact>(`/api/crm/leads/${leadId}/research`, {
          method: "POST",
        });
      },
      async getLeadResearch(leadId: string) {
        const result = await apiFetch<{ data: CrmAiArtifact[] }>(
          `/api/crm/leads/${leadId}/research`,
          { cache: "no-store" },
        );
        return result.data;
      },
      async decideLeadResearch(
        leadId: string,
        artifactId: string,
        decision: "apply" | "reject",
      ) {
        const lead = workspace.leads.find(
          (candidate) => candidate.id === leadId,
        );
        if (!lead) throw new Error("CRM lead was not found.");
        const result = await apiFetch<{ data: unknown }>(
          `/api/crm/leads/${leadId}/research/${artifactId}/decision`,
          {
            method: "POST",
            body: JSON.stringify({ decision, row_version: lead.rowVersion }),
          },
        );
        const refreshedWorkspace = await refresh();
        return { data: result.data, workspace: refreshedWorkspace };
      },
      async getLeadPhoto(leadId: string) {
        const result = await apiFetch<{ data: { url: string | null } }>(
          `/api/crm/leads/${leadId}/photo`,
          { cache: "no-store" },
        );
        return result.data.url;
      },
      async uploadLeadPhoto(leadId: string, file: File) {
        const form = new FormData();
        form.set("photo", file);
        const result = await apiFetch<{ data: { url: string } }>(
          `/api/crm/leads/${leadId}/photo`,
          { method: "POST", body: form },
        );
        await refresh();
        return result.data.url;
      },
      async updateActivity(
        activityId: string,
        patch: Pick<CrmActivity, "subject" | "activityType">,
      ) {
        return mutate<CrmActivity>(`/api/crm/activities/${activityId}`, {
          method: "PATCH",
          body: JSON.stringify({
            subject: patch.subject,
            activity_type: patch.activityType,
          }),
        });
      },
      async removeActivity(activityId: string) {
        return mutate<CrmActivity>(`/api/crm/activities/${activityId}`, {
          method: "DELETE",
        });
      },
      async addFollowUp(input: Omit<CrmFollowUp, "id" | "status">) {
        const target = input.companyId
          ? workspace.accounts.find(
              (candidate) => candidate.companyId === input.companyId,
            )
          : workspace.leads.find((candidate) => candidate.id === input.leadId);
        if (!target) throw new Error("CRM relationship was not found.");
        return mutate<CrmFollowUp>("/api/crm/follow-ups", {
          method: "POST",
          body: JSON.stringify({
            company_id: input.companyId,
            crm_lead_id: input.leadId,
            crm_deal_id: input.dealId,
            title: input.title,
            description: input.title,
            assignee_person_id: target.owner.id,
            due_date: input.dueDate,
            priority: input.priority,
          }),
        });
      },
      async updateFollowUpStatus(
        followUpId: string,
        status: CrmFollowUp["status"],
      ) {
        const result = await apiFetch<{ task: CrmFollowUp }>(
          `/api/tasks/${followUpId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ status }),
          },
        );
        await refresh();
        return result.task;
      },
      async startPursuitPlaybook(dealId: string) {
        return mutate<{ created: number; complete: boolean }>(
          "/api/crm/playbooks/pursuit",
          {
            method: "POST",
            body: JSON.stringify({ deal_id: dealId }),
          },
        );
      },
      async archiveAccount(companyId: string, reason: string) {
        const account = workspace.accounts.find(
          (candidate) => candidate.companyId === companyId,
        );
        if (!account) throw new Error("CRM account was not found.");
        return mutate<CrmAccount>(`/api/crm/accounts/${companyId}/deactivate`, {
          method: "POST",
          body: JSON.stringify({ reason, row_version: account.rowVersion }),
        });
      },
      async restoreAccount(companyId: string) {
        const account = workspace.accounts.find(
          (candidate) => candidate.companyId === companyId,
        );
        if (!account) throw new Error("CRM account was not found.");
        return mutate<CrmAccount>(`/api/crm/accounts/${companyId}/unarchive`, {
          method: "POST",
          body: JSON.stringify({ row_version: account.rowVersion }),
        });
      },
      async archiveDeal(dealId: string, reason: string) {
        const deal = workspace.deals.find(
          (candidate) => candidate.id === dealId,
        );
        if (!deal) throw new Error("Deal was not found.");
        return mutate<CrmDeal>(`/api/crm/deals/${dealId}/deactivate`, {
          method: "POST",
          body: JSON.stringify({ reason, row_version: deal.rowVersion }),
        });
      },
      async restoreDeal(dealId: string) {
        const deal = workspace.deals.find(
          (candidate) => candidate.id === dealId,
        );
        if (!deal) throw new Error("Deal was not found.");
        return mutate<CrmDeal>(`/api/crm/deals/${dealId}/unarchive`, {
          method: "POST",
          body: JSON.stringify({ row_version: deal.rowVersion }),
        });
      },
      async severProjectLink(dealId: string, reason: string) {
        const deal = workspace.deals.find(
          (candidate) => candidate.id === dealId,
        );
        if (!deal) throw new Error("Deal was not found.");
        return mutate<CrmDeal>(`/api/crm/deals/${dealId}/sever-project-link`, {
          method: "POST",
          body: JSON.stringify({ reason, row_version: deal.rowVersion }),
        });
      },
      async addAttachment(dealId: string, documentId: string) {
        return mutate<unknown>(`/api/crm/deals/${dealId}/documents`, {
          method: "POST",
          body: JSON.stringify({ document_id: documentId }),
        });
      },
      async removeAttachment(dealId: string, documentId: string) {
        return mutate<unknown>(
          `/api/crm/deals/${dealId}/documents/${encodeURIComponent(documentId)}`,
          { method: "DELETE" },
        );
      },
    }),
    [
      mutate,
      refresh,
      workspace.accounts,
      workspace.deals,
      workspace.leads,
      workspace.stages,
    ],
  );

  return { ...workspace, ...actions, isLoading, error };
}
