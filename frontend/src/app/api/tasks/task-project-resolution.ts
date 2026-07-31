const POSTGRES_INT4_MAX = 2_147_483_647;

type DocumentProjectAssociation =
  | { project_id: number | null }
  | Array<{ project_id: number | null }>
  | null;

export type TaskProjectAssociationRow = {
  project_id: number | null;
  project_ids: number[] | null;
  document_metadata: DocumentProjectAssociation;
};

export type TaskProjectResolution =
  | {
      status: "resolved";
      projectId: number;
      source: "project_id" | "project_ids" | "document_metadata";
    }
  | {
      status: "ambiguous";
      reason: string;
    }
  | {
      status: "unscoped";
      reason: string;
    };

function isProjectId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= POSTGRES_INT4_MAX
  );
}

function documentProjectIds(
  documentMetadata: DocumentProjectAssociation,
): number[] {
  const rows = Array.isArray(documentMetadata)
    ? documentMetadata
    : documentMetadata
      ? [documentMetadata]
      : [];
  return [
    ...new Set(
      rows
        .map((row) => row.project_id)
        .filter((projectId): projectId is number => isProjectId(projectId)),
    ),
  ];
}

/**
 * Resolves the same project ownership order used by the Tasks collection:
 * direct scalar ownership first, then the legacy project array, and finally
 * document metadata for rows with no task-level association.
 */
export function resolveTaskProjectAssociation(
  row: TaskProjectAssociationRow,
): TaskProjectResolution {
  if (row.project_id !== null) {
    if (!isProjectId(row.project_id)) {
      return {
        status: "ambiguous",
        reason: "The task has an invalid direct project association.",
      };
    }
    return {
      status: "resolved",
      projectId: row.project_id,
      source: "project_id",
    };
  }

  const taskProjectIds = [
    ...new Set((row.project_ids ?? []).filter(isProjectId)),
  ];
  if (taskProjectIds.length !== (row.project_ids ?? []).length) {
    return {
      status: "ambiguous",
      reason: "The task has invalid legacy project associations.",
    };
  }
  if (taskProjectIds.length > 1) {
    return {
      status: "ambiguous",
      reason: "The task is associated with more than one legacy project.",
    };
  }

  const metadataProjectIds = documentProjectIds(row.document_metadata);
  if (taskProjectIds.length === 1) {
    if (
      metadataProjectIds.length > 0 &&
      metadataProjectIds.some((projectId) => projectId !== taskProjectIds[0])
    ) {
      return {
        status: "ambiguous",
        reason:
          "The task and its source document identify different projects.",
      };
    }
    return {
      status: "resolved",
      projectId: taskProjectIds[0],
      source: "project_ids",
    };
  }

  if (metadataProjectIds.length > 1) {
    return {
      status: "ambiguous",
      reason: "The task source identifies more than one project.",
    };
  }
  if (metadataProjectIds.length === 1) {
    return {
      status: "resolved",
      projectId: metadataProjectIds[0],
      source: "document_metadata",
    };
  }

  return {
    status: "unscoped",
    reason: "The task is not associated with a project.",
  };
}
