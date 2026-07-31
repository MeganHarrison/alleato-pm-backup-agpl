import {
  recruitingWorkspaceSnapshotSchema,
  type RecruitingWorkspaceSnapshot,
} from "./contracts";

export const RECRUITING_LOCAL_STORAGE_KEY = "alleato.recruiting.local.v1";

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type RecruitingRepositoryErrorCode =
  | "INVALID_SNAPSHOT"
  | "REVISION_CONFLICT"
  | "WRITE_FAILED";

export class RecruitingRepositoryError extends Error {
  constructor(
    readonly code: RecruitingRepositoryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RecruitingRepositoryError";
  }
}

function cloneSnapshot(
  snapshot: RecruitingWorkspaceSnapshot,
): RecruitingWorkspaceSnapshot {
  return recruitingWorkspaceSnapshotSchema.parse(
    JSON.parse(JSON.stringify(snapshot)),
  );
}

function parseSnapshot(raw: string): RecruitingWorkspaceSnapshot {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new RecruitingRepositoryError(
      "INVALID_SNAPSHOT",
      "The saved Applicant Tracker workspace is not valid JSON. Reset the local workspace before continuing.",
      { cause: error },
    );
  }

  const parsed = recruitingWorkspaceSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    throw new RecruitingRepositoryError(
      "INVALID_SNAPSHOT",
      "The saved Applicant Tracker workspace failed validation. Reset the local workspace before continuing.",
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

function mergeStarterHistory(
  snapshot: RecruitingWorkspaceSnapshot,
  starterSnapshot: RecruitingWorkspaceSnapshot,
): RecruitingWorkspaceSnapshot {
  const existingEventIds = new Set(
    snapshot.auditEvents.map((event) => event.id),
  );
  const missingStarterHistory = starterSnapshot.auditEvents.filter(
    (event) =>
      event.action === "application.source_history_imported" &&
      !existingEventIds.has(event.id),
  );

  return missingStarterHistory.length
    ? {
        ...snapshot,
        auditEvents: [...snapshot.auditEvents, ...missingStarterHistory],
      }
    : snapshot;
}

export class LocalRecruitingRepository {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly starterSnapshot: RecruitingWorkspaceSnapshot,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    recruitingWorkspaceSnapshotSchema.parse(starterSnapshot);
  }

  load(): RecruitingWorkspaceSnapshot {
    const raw = this.storage.getItem(RECRUITING_LOCAL_STORAGE_KEY);
    return raw
      ? mergeStarterHistory(parseSnapshot(raw), this.starterSnapshot)
      : cloneSnapshot(this.starterSnapshot);
  }

  commit(
    nextSnapshot: RecruitingWorkspaceSnapshot,
    expectedRevision: number,
  ): RecruitingWorkspaceSnapshot {
    const current = this.load();
    if (current.revision !== expectedRevision) {
      throw new RecruitingRepositoryError(
        "REVISION_CONFLICT",
        "This Applicant Tracker workspace changed in another tab. Reload the latest version before saving again.",
      );
    }

    const saved = recruitingWorkspaceSnapshotSchema.parse({
      ...nextSnapshot,
      revision: expectedRevision + 1,
      updatedAt: this.now(),
    });

    try {
      this.storage.setItem(RECRUITING_LOCAL_STORAGE_KEY, JSON.stringify(saved));
    } catch (error) {
      throw new RecruitingRepositoryError(
        "WRITE_FAILED",
        "The browser could not save the Applicant Tracker workspace. Export the workspace and check available browser storage.",
        { cause: error },
      );
    }

    return saved;
  }

  reset(): RecruitingWorkspaceSnapshot {
    try {
      this.storage.removeItem(RECRUITING_LOCAL_STORAGE_KEY);
    } catch (error) {
      throw new RecruitingRepositoryError(
        "WRITE_FAILED",
        "The browser could not clear the Applicant Tracker workspace. Check browser storage permissions and try again.",
        { cause: error },
      );
    }
    return cloneSnapshot(this.starterSnapshot);
  }

  export(): string {
    return JSON.stringify(this.load(), null, 2);
  }
}
