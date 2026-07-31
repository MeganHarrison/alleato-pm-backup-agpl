"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  RecruitingDisposition,
  RecruitingStage,
  RecruitingWorkspaceSnapshot,
} from "@/lib/recruiting/contracts";
import {
  LocalRecruitingRepository,
  RECRUITING_LOCAL_STORAGE_KEY,
  RecruitingRepositoryError,
} from "@/lib/recruiting/local-repository";
import { INITIAL_RECRUITING_WORKSPACE } from "@/features/recruiting/workspace-data";
import {
  addSyntheticApplicant,
  markWorkspaceResumeReviewed,
  moveWorkspaceApplication,
  setWorkspaceDisposition,
  type RecruitingMutationContext,
  type RecruitingMutationResult,
} from "@/features/recruiting/workspace-model";

const LOCAL_REVIEWER = {
  actorId: "local-reviewer",
  actorLabel: "Local reviewer",
};

function context(): RecruitingMutationContext {
  return {
    ...LOCAL_REVIEWER,
    occurredAt: new Date().toISOString(),
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof RecruitingRepositoryError) return error.message;
  return "The Applicant Tracker workspace could not be updated. Export the local workspace and reload the page.";
}

export interface RecruitingWorkspaceController {
  snapshot: RecruitingWorkspaceSnapshot;
  ready: boolean;
  error: string | null;
  notice: string;
  clearError: () => void;
  moveApplication: (
    applicationId: string,
    nextStage: RecruitingStage,
  ) => boolean;
  setDisposition: (
    applicationId: string,
    disposition: RecruitingDisposition,
    reason: string | null,
  ) => boolean;
  markResumeReviewed: (applicationId: string) => boolean;
  addSampleApplicant: (requisitionId: string) => string | null;
  resetWorkspace: () => boolean;
  exportWorkspace: () => string | null;
}

export function useRecruitingWorkspace(): RecruitingWorkspaceController {
  const repositoryRef = useRef<LocalRecruitingRepository | null>(null);
  const snapshotRef = useRef(INITIAL_RECRUITING_WORKSPACE);
  const [snapshot, setSnapshot] = useState(INITIAL_RECRUITING_WORKSPACE);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(
    "Local review build. Synthetic data only.",
  );

  const acceptSnapshot = useCallback(
    (nextSnapshot: RecruitingWorkspaceSnapshot) => {
      snapshotRef.current = nextSnapshot;
      setSnapshot(nextSnapshot);
    },
    [],
  );

  useEffect(() => {
    let repository: LocalRecruitingRepository;

    try {
      repository = new LocalRecruitingRepository(
        window.localStorage,
        INITIAL_RECRUITING_WORKSPACE,
      );
      repositoryRef.current = repository;
      acceptSnapshot(repository.load());
    } catch (loadError) {
      setError(errorMessage(loadError));
      setReady(true);
      return;
    }
    setReady(true);

    function syncOtherTab(event: StorageEvent) {
      if (event.key !== RECRUITING_LOCAL_STORAGE_KEY) return;
      try {
        acceptSnapshot(repository.load());
        setError(null);
        setNotice("Local workspace refreshed from another tab.");
      } catch (loadError) {
        setError(errorMessage(loadError));
      }
    }

    window.addEventListener("storage", syncOtherTab);
    return () => {
      window.removeEventListener("storage", syncOtherTab);
      repositoryRef.current = null;
    };
  }, [acceptSnapshot]);

  const commitMutation = useCallback(
    (
      result: RecruitingMutationResult,
      successNotice: string,
    ): RecruitingMutationResult | null => {
      if (!result.ok) {
        setError(result.error);
        return null;
      }
      const repository = repositoryRef.current;
      if (!repository) {
        setError(
          "The local Applicant Tracker workspace is still loading. Wait a moment and try again.",
        );
        return null;
      }

      try {
        const saved = repository.commit(
          result.snapshot,
          snapshotRef.current.revision,
        );
        acceptSnapshot(saved);
        setError(null);
        setNotice(successNotice);
        return result;
      } catch (commitError) {
        setError(errorMessage(commitError));
        return null;
      }
    },
    [acceptSnapshot],
  );

  const moveApplication = useCallback(
    (applicationId: string, nextStage: RecruitingStage) =>
      Boolean(
        commitMutation(
          moveWorkspaceApplication(
            snapshotRef.current,
            { applicationId, nextStage },
            context(),
          ),
          `Application moved to ${nextStage}. The change was saved locally and added to the audit history.`,
        ),
      ),
    [commitMutation],
  );

  const setDisposition = useCallback(
    (
      applicationId: string,
      disposition: RecruitingDisposition,
      reason: string | null,
    ) =>
      Boolean(
        commitMutation(
          setWorkspaceDisposition(
            snapshotRef.current,
            { applicationId, disposition, reason },
            context(),
          ),
          "Disposition saved locally with an audit entry.",
        ),
      ),
    [commitMutation],
  );

  const markResumeReviewed = useCallback(
    (applicationId: string) =>
      Boolean(
        commitMutation(
          markWorkspaceResumeReviewed(
            snapshotRef.current,
            applicationId,
            context(),
          ),
          "Synthetic resume evidence marked reviewed and saved locally.",
        ),
      ),
    [commitMutation],
  );

  const addSampleApplicant = useCallback(
    (requisitionId: string) => {
      const result = addSyntheticApplicant(
        snapshotRef.current,
        { requisitionId },
        context(),
      );
      const committed = commitMutation(
        result,
        "Synthetic applicant, application, and resume metadata saved locally.",
      );
      return committed?.ok ? (committed.applicationId ?? null) : null;
    },
    [commitMutation],
  );

  const resetWorkspace = useCallback(() => {
    const repository = repositoryRef.current;
    if (!repository) {
      setError(
        "The local Applicant Tracker workspace is still loading. Wait a moment and try again.",
      );
      return false;
    }
    try {
      acceptSnapshot(repository.reset());
      setError(null);
      setNotice("Local workspace reset to the original synthetic data.");
      return true;
    } catch (resetError) {
      setError(errorMessage(resetError));
      return false;
    }
  }, [acceptSnapshot]);

  const exportWorkspace = useCallback(() => {
    const repository = repositoryRef.current;
    if (!repository) {
      setError(
        "The local Applicant Tracker workspace is still loading. Wait a moment and try again.",
      );
      return null;
    }
    try {
      const exported = repository.export();
      setError(null);
      setNotice("Local workspace export prepared.");
      return exported;
    } catch (exportError) {
      setError(errorMessage(exportError));
      return null;
    }
  }, []);

  return {
    snapshot,
    ready,
    error,
    notice,
    clearError: () => setError(null),
    moveApplication,
    setDisposition,
    markResumeReviewed,
    addSampleApplicant,
    resetWorkspace,
    exportWorkspace,
  };
}
