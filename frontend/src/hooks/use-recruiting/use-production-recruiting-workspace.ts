"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { RECRUITING_PRODUCTION_PREVIEW } from "@/features/recruiting/production-preview-data";
import {
  allowedProductionStageTransitions,
  requisitionAcceptsActiveWorkflow,
  recruitingCommandResponseSchema,
  recruitingUatFeatureResponseSchema,
  recruitingWorkspaceResponseSchema,
  testApplicationAllowsStage,
  type ProductionRecruitingStage,
  type RecruitingCommand,
  type RecruitingUatFeatureAction,
  type RecruitingUatFeatureResult,
  type RecruitingWorkspaceResponse,
} from "@/lib/recruiting/production-contracts";
import { buildRecruitingUatFeatureResult } from "@/lib/recruiting/uat-feature-tests";
import { apiFetch } from "@/lib/api-client";

const previewRequested =
  process.env.NEXT_PUBLIC_RECRUITING_DATA_MODE === "preview" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_RECRUITING_DATA_MODE !== "live");

async function postCommand(command: RecruitingCommand) {
  const body = await apiFetch<unknown>("/api/recruiting", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(command),
  });
  return recruitingCommandResponseSchema.parse(body);
}

function previewTransition(
  workspace: RecruitingWorkspaceResponse,
  applicationId: string,
  nextStage: ProductionRecruitingStage,
): RecruitingWorkspaceResponse {
  return {
    ...workspace,
    applications: workspace.applications.map((application) =>
      application.id === applicationId
        ? {
            ...application,
            stage: nextStage,
            status:
              nextStage === "hired"
                ? "hired"
                : nextStage === "closed"
                  ? "closed"
                  : "active",
            rowVersion: application.rowVersion + 1,
            lastActivityAt: new Date().toISOString(),
          }
        : application,
    ),
    fetchedAt: new Date().toISOString(),
  };
}

export async function runIdempotentRecruitingMutation({
  pendingKeys,
  operationKey,
  execute,
  reload,
}: {
  pendingKeys: Map<
    string,
    { idempotencyKey: string; requestHash: string }
  >;
  operationKey: string;
  execute: (idempotencyKey: string, requestHash: string) => Promise<void>;
  reload: () => Promise<boolean>;
}) {
  const pendingCommand = pendingKeys.get(operationKey) ?? {
    idempotencyKey: crypto.randomUUID(),
    requestHash: crypto.randomUUID().replaceAll("-", "").repeat(2),
  };
  pendingKeys.set(operationKey, pendingCommand);
  await execute(pendingCommand.idempotencyKey, pendingCommand.requestHash);
  const reloaded = await reload();
  if (!reloaded) {
    throw new Error(
      "Your change was saved, but current recruiting data could not be reloaded. Retry the same action after connectivity is restored.",
    );
  }
  pendingKeys.delete(operationKey);
}

export type CreateRecruitingRequisitionInput = {
  requisitionNumber: string;
  title: string;
  department: string | null;
  location: string | null;
  jobsite: string | null;
  headcount: number;
  isConfidential: boolean;
};

export function useProductionRecruitingWorkspace() {
  const pendingCommandKeys = useRef(
    new Map<string, { idempotencyKey: string; requestHash: string }>(),
  );
  const [workspace, setWorkspace] = useState<RecruitingWorkspaceResponse | null>(
    previewRequested ? RECRUITING_PRODUCTION_PREVIEW : null,
  );
  const [selectedRequisitionId, setSelectedRequisitionId] = useState<
    string | null
  >(
    previewRequested
      ? RECRUITING_PRODUCTION_PREVIEW.selectedRequisitionId
      : null,
  );
  const [loading, setLoading] = useState(!previewRequested);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(
    previewRequested
      ? "Local production preview. Synthetic identities only; external providers are disabled."
      : "Loading shared Applicant Tracker data.",
  );
  const [uatFeatureBusy, setUatFeatureBusy] =
    useState<RecruitingUatFeatureAction | null>(null);
  const [uatFeatureResult, setUatFeatureResult] =
    useState<RecruitingUatFeatureResult | null>(null);
  const uatFeatureIdempotencyKeysRef = useRef(new Map<string, string>());

  const load = useCallback(async () => {
    if (previewRequested) return true;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ query: "workspace" });
      const linkedRequisitionId =
        typeof window === "undefined"
          ? null
          : new URL(window.location.href).searchParams.get("requisitionId");
      const requestedRequisitionId =
        selectedRequisitionId ?? linkedRequisitionId;
      if (requestedRequisitionId) {
        params.set("requisitionId", requestedRequisitionId);
      }
      const body = await apiFetch<unknown>(
        `/api/recruiting?${params.toString()}`,
        {
        cache: "no-store",
        },
      );
      const nextWorkspace = recruitingWorkspaceResponseSchema.parse(body);
      setWorkspace(nextWorkspace);
      setSelectedRequisitionId(nextWorkspace.selectedRequisitionId);
      setNotice("Shared recruiting data is current.");
      return true;
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Applicant Tracker shared data could not be loaded.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, [selectedRequisitionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const moveApplication = useCallback(
    async (
      applicationId: string,
      nextStage: ProductionRecruitingStage,
    ) => {
      const application = workspace?.applications.find(
        (item) => item.id === applicationId,
      );
      if (!workspace || !application) {
        setError("The application could not be found. Reload and try again.");
        return false;
      }
      if (!workspace.viewer.canWrite) {
        setError("Recruiting write access is required to move an application.");
        return false;
      }
      if (
        !allowedProductionStageTransitions(application.stage).includes(nextStage)
      ) {
        setError(
          "That stage transition is not allowed. Use a disposition action to close an application.",
        );
        return false;
      }
      if (
        application.isTestApplication &&
        !testApplicationAllowsStage(nextStage)
      ) {
        setError(
          "Test applications can move through review and interview only. Offers, hiring, and closure require a real applicant record.",
        );
        return false;
      }
      if (previewRequested) {
        setWorkspace(
          previewTransition(workspace, applicationId, nextStage),
        );
        setNotice(
          `Preview application moved to ${nextStage}. No production record or external action was created.`,
        );
        return true;
      }

      setError(null);
      try {
        const operationKey = `${applicationId}:${application.rowVersion}:${nextStage}`;
        await runIdempotentRecruitingMutation({
          pendingKeys: pendingCommandKeys.current,
          operationKey,
          execute: async (idempotencyKey, requestHash) => {
            await postCommand({
              command: "application.transition",
              idempotencyKey,
              requestHash,
              applicationId,
              nextStage,
              expectedRowVersion: application.rowVersion,
              reason: "Stage changed by recruiter from the pipeline.",
            });
          },
          reload: load,
        });
        setNotice(`Application moved to ${nextStage} and added to the audit history.`);
        return true;
      } catch (commandError) {
        setError(
          commandError instanceof Error
            ? commandError.message
            : "The application could not be moved.",
        );
        return false;
      }
    },
    [load, workspace],
  );

  const markNotQualified = useCallback(
    async (applicationId: string, reason: string) => {
      const application = workspace?.applications.find(
        (item) => item.id === applicationId,
      );
      if (!workspace || !application || reason.trim().length < 5) {
        setError("Enter a reason of at least 5 characters.");
        return false;
      }
      if (!workspace.viewer.canWrite) {
        setError(
          "Recruiting write access is required to record an applicant outcome.",
        );
        return false;
      }
      if (previewRequested) {
        setWorkspace({
          ...workspace,
          applications: workspace.applications.map((item) =>
            item.id === applicationId
              ? {
                  ...item,
                  stage: "closed",
                  status: "rejected",
                  dispositionCode: "not_qualified",
                  dispositionReason: reason.trim(),
                  rowVersion: item.rowVersion + 1,
                  lastActivityAt: new Date().toISOString(),
                }
              : item,
          ),
        });
        setNotice("Preview candidate marked Not Qualified.");
        return true;
      }
      setError(null);
      try {
        await runIdempotentRecruitingMutation({
          pendingKeys: pendingCommandKeys.current,
          operationKey: `application.disposition:${applicationId}:${application.rowVersion}:not_qualified`,
          execute: async (idempotencyKey, requestHash) => {
            await postCommand({
              command: "application.disposition",
              idempotencyKey,
              requestHash,
              applicationId,
              expectedRowVersion: application.rowVersion,
              dispositionCode: "not_qualified",
              reason: reason.trim(),
            });
          },
          reload: load,
        });
        setNotice("Candidate marked Not Qualified and added to the audit history.");
        return true;
      } catch (commandError) {
        setError(
          commandError instanceof Error
            ? commandError.message
            : "The candidate outcome could not be saved.",
        );
        return false;
      }
    },
    [load, workspace],
  );

  const assignResume = useCallback(
    async (candidateId: string, requisitionId: string) => {
      const resume = workspace?.unassignedResumes.find(
        (item) => item.candidateId === candidateId,
      );
      if (!workspace || !resume) {
        setError("The unassigned resume could not be found.");
        return false;
      }
      if (!workspace.viewer.canWrite) {
        setError("Recruiting write access is required to assign a resume.");
        return false;
      }
      if (previewRequested) {
        setWorkspace({
          ...workspace,
          unassignedResumes: workspace.unassignedResumes.filter(
            (item) => item.candidateId !== candidateId,
          ),
        });
        setNotice("Preview resume assigned to the selected position.");
        return true;
      }
      setError(null);
      try {
        await runIdempotentRecruitingMutation({
          pendingKeys: pendingCommandKeys.current,
          operationKey: `resume.assign:${candidateId}:${resume.rowVersion}:${requisitionId}`,
          execute: async (idempotencyKey, requestHash) => {
            await postCommand({
              command: "resume.assign",
              idempotencyKey,
              requestHash,
              candidateId,
              requisitionId,
              expectedRowVersion: resume.rowVersion,
            });
          },
          reload: load,
        });
        setNotice("Resume assigned to the position and added to its New stage.");
        return true;
      } catch (commandError) {
        setError(
          commandError instanceof Error
            ? commandError.message
            : "The resume could not be assigned.",
        );
        return false;
      }
    },
    [load, workspace],
  );

  const selectRequisition = useCallback((requisitionId: string) => {
    setSelectedRequisitionId(requisitionId);
    if (previewRequested) {
      setWorkspace((current) =>
        current
          ? { ...current, selectedRequisitionId: requisitionId }
          : current,
      );
    }
  }, []);

  const createRequisition = useCallback(
    async (input: CreateRecruitingRequisitionInput) => {
      if (!workspace?.viewer.canWrite) {
        setError("Recruiting write access is required to create a position.");
        return false;
      }
      if (previewRequested) {
        const requisitionId = crypto.randomUUID();
        setWorkspace((current) =>
          current
            ? {
                ...current,
                requisitions: [
                  ...current.requisitions,
                  {
                    id: requisitionId,
                    ...input,
                    status: "draft",
                    rowVersion: 1,
                  },
                ],
                fetchedAt: new Date().toISOString(),
              }
            : current,
        );
        setNotice(
          `Preview position ${input.requisitionNumber} created as a draft. No production record was created.`,
        );
        return true;
      }

      setError(null);
      try {
        const operationKey = `requisition.create:${input.requisitionNumber}`;
        await runIdempotentRecruitingMutation({
          pendingKeys: pendingCommandKeys.current,
          operationKey,
          execute: async (idempotencyKey, requestHash) => {
            await postCommand({
              command: "requisition.create",
              idempotencyKey,
              requestHash,
              ...input,
            });
          },
          reload: load,
        });
        setNotice(
          `Position ${input.requisitionNumber} created as a draft with the standard hiring stages.`,
        );
        return true;
      } catch (commandError) {
        setError(
          commandError instanceof Error
            ? commandError.message
            : "The position could not be created.",
        );
        return false;
      }
    },
    [load, workspace?.viewer.canWrite],
  );

  const setRequisitionLifecycle = useCallback(
    async (
      requisitionId: string,
      nextStatus: "closed" | "canceled",
      reason: string,
    ) => {
      const requisition = workspace?.requisitions.find(
        (item) => item.id === requisitionId,
      );
      if (!workspace?.viewer.canWrite || !requisition) {
        setError("The position could not be found. Reload and try again.");
        return false;
      }
      if (previewRequested) {
        const requisitions = workspace.requisitions.map((item) =>
          item.id === requisitionId
            ? {
                ...item,
                status: nextStatus,
                rowVersion: item.rowVersion + 1,
              }
            : item,
        );
        const nextSelectedRequisitionId =
          workspace.selectedRequisitionId === requisitionId
            ? (requisitions.find((item) =>
                requisitionAcceptsActiveWorkflow(item.status),
              )?.id ?? null)
            : workspace.selectedRequisitionId;
        setSelectedRequisitionId(nextSelectedRequisitionId);
        setWorkspace({
          ...workspace,
          requisitions,
          selectedRequisitionId: nextSelectedRequisitionId,
          fetchedAt: new Date().toISOString(),
        });
        setNotice(
          `Preview position ${requisition.requisitionNumber} ${nextStatus}. No production record was changed.`,
        );
        return true;
      }

      setError(null);
      try {
        const operationKey = `requisition.lifecycle:${requisitionId}:${requisition.rowVersion}:${nextStatus}`;
        await runIdempotentRecruitingMutation({
          pendingKeys: pendingCommandKeys.current,
          operationKey,
          execute: async (idempotencyKey, requestHash) => {
            await postCommand({
              command: "requisition.lifecycle",
              idempotencyKey,
              requestHash,
              requisitionId,
              nextStatus,
              expectedRowVersion: requisition.rowVersion,
              reason,
            });
          },
          reload: load,
        });
        setNotice(
          `Position ${requisition.requisitionNumber} ${nextStatus}; its recruiting history was preserved.`,
        );
        return true;
      } catch (commandError) {
        setError(
          commandError instanceof Error
            ? commandError.message
            : "The position status could not be changed.",
        );
        return false;
      }
    },
    [load, workspace],
  );

  const deleteDraftRequisition = useCallback(
    async (requisitionId: string) => {
      const requisition = workspace?.requisitions.find(
        (item) => item.id === requisitionId,
      );
      if (!workspace?.viewer.canAdmin || !requisition) {
        setError(
          "Recruiting administrator access is required to delete a draft.",
        );
        return false;
      }
      if (requisition.status !== "draft") {
        setError(
          "Only an unused draft can be deleted. Close or cancel this position instead.",
        );
        return false;
      }
      if (previewRequested) {
        setWorkspace((current) =>
          current
            ? {
                ...current,
                requisitions: current.requisitions.filter(
                  (item) => item.id !== requisitionId,
                ),
                selectedRequisitionId:
                  current.selectedRequisitionId === requisitionId
                    ? (current.requisitions.find(
                        (item) => item.id !== requisitionId,
                      )?.id ?? null)
                    : current.selectedRequisitionId,
                fetchedAt: new Date().toISOString(),
              }
            : current,
        );
        setNotice(
          `Preview draft ${requisition.requisitionNumber} deleted. No production record was changed.`,
        );
        return true;
      }

      setError(null);
      try {
        const operationKey = `requisition.delete:${requisitionId}:${requisition.rowVersion}`;
        await runIdempotentRecruitingMutation({
          pendingKeys: pendingCommandKeys.current,
          operationKey,
          execute: async (idempotencyKey, requestHash) => {
            await postCommand({
              command: "requisition.delete",
              idempotencyKey,
              requestHash,
              requisitionId,
              expectedRowVersion: requisition.rowVersion,
            });
          },
          reload: load,
        });
        setNotice(`Unused draft ${requisition.requisitionNumber} deleted.`);
        return true;
      } catch (commandError) {
        setError(
          commandError instanceof Error
            ? commandError.message
            : "The draft position could not be deleted.",
        );
        return false;
      }
    },
    [load, workspace],
  );

  const runUatFeatureTest = useCallback(
    async (
      action: RecruitingUatFeatureAction,
      requestedApplicationId?: string,
    ) => {
      if (!workspace?.viewer.canWrite) {
        setError("Recruiting write access is required to run feature tests.");
        return false;
      }
      if (!workspace.featureAvailability.testMode) {
        setError(
          "Recruiter test mode is not enabled. Ask a recruiting administrator to enable synthetic intake UAT.",
        );
        return false;
      }

      setError(null);
      setUatFeatureBusy(action);
      try {
        const application = requestedApplicationId
          ? workspace.applications.find(
              (item) => item.id === requestedApplicationId && item.resume,
            )
          : workspace.applications.find(
              (item) =>
                item.resume && (previewRequested || item.isTestApplication),
            );
        const candidate = application
          ? workspace.candidates.find(
              (item) => item.id === application.candidateId,
            )
          : null;
        const requisition = application
          ? workspace.requisitions.find(
              (item) => item.id === application.requisitionId,
            )
          : null;
        if (!application?.resume || !candidate) {
          setError(
            "Upload and assign the approved synthetic PDF in Candidate intake UAT before running feature tests.",
          );
          return false;
        }

        if (previewRequested) {
          const result = buildRecruitingUatFeatureResult({
            action,
            runId: crypto.randomUUID(),
            subject: {
              candidateName: candidate.displayName,
              resumeFileName: application.resume.originalFileName,
              requisitionTitle: requisition?.title ?? "Unassigned test intake",
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
          });
          setUatFeatureResult(result);
          setNotice(
            "Synthetic feature test completed. No message, offer, workflow transition, or employment decision was sent.",
          );
          return true;
        }

        const retryKey = `${action}:${application.id}`;
        const idempotencyKey =
          uatFeatureIdempotencyKeysRef.current.get(retryKey) ??
          crypto.randomUUID();
        uatFeatureIdempotencyKeysRef.current.set(retryKey, idempotencyKey);
        const response = recruitingUatFeatureResponseSchema.parse(
          await apiFetch<unknown>("/api/recruiting/uat-actions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action,
              idempotencyKey,
              applicationId: application.id,
            }),
          }),
        );
        uatFeatureIdempotencyKeysRef.current.delete(retryKey);
        setUatFeatureResult(response.result);
        setNotice(
          response.replayed
            ? "The existing audited feature-test result was loaded."
            : "Feature test completed and was recorded in the expiring UAT audit log.",
        );
        return true;
      } catch (testError) {
        setError(
          testError instanceof Error
            ? testError.message
            : "The feature test could not be completed. No provider action was sent.",
        );
        return false;
      } finally {
        setUatFeatureBusy(null);
      }
    },
    [workspace],
  );

  return useMemo(
    () => ({
      workspace,
      selectedRequisitionId,
      loading,
      error,
      notice,
      preview: previewRequested,
      selectRequisition,
      moveApplication,
      markNotQualified,
      assignResume,
      createRequisition,
      setRequisitionLifecycle,
      deleteDraftRequisition,
      runUatFeatureTest,
      uatFeatureBusy,
      uatFeatureResult,
      reload: load,
      clearError: () => setError(null),
    }),
    [
      error,
      createRequisition,
      deleteDraftRequisition,
      load,
      loading,
      moveApplication,
      markNotQualified,
      assignResume,
      notice,
      runUatFeatureTest,
      selectRequisition,
      setRequisitionLifecycle,
      selectedRequisitionId,
      uatFeatureBusy,
      uatFeatureResult,
      workspace,
    ],
  );
}
