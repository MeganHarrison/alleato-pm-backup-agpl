export interface CycleTaskProjectAssociation {
  project_id: number | null;
  project_ids: number[] | null;
  document_metadata:
    | { project_id: number | null }
    | Array<{ project_id: number | null }>
    | null;
}

export type CycleTaskProjectResolution =
  | { status: "resolved"; projectId: number }
  | { status: "invalid"; reason: string };

function validProjectId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

export function resolveCycleTaskProject(
  task: CycleTaskProjectAssociation,
): CycleTaskProjectResolution {
  if (task.project_id !== null) {
    return validProjectId(task.project_id)
      ? { status: "resolved", projectId: task.project_id }
      : { status: "invalid", reason: "Task has an invalid project." };
  }

  const legacy = task.project_ids ?? [];
  if (legacy.length > 1 || legacy.some((id) => !validProjectId(id))) {
    return {
      status: "invalid",
      reason: "Task has ambiguous legacy project ownership.",
    };
  }

  const metadataRows = Array.isArray(task.document_metadata)
    ? task.document_metadata
    : task.document_metadata
      ? [task.document_metadata]
      : [];
  const metadataIds = [
    ...new Set(
      metadataRows
        .map((row) => row.project_id)
        .filter((id): id is number => validProjectId(id)),
    ),
  ];

  if (legacy.length === 1) {
    if (metadataIds.some((id) => id !== legacy[0])) {
      return {
        status: "invalid",
        reason: "Task and source document identify different projects.",
      };
    }
    return { status: "resolved", projectId: legacy[0] };
  }

  return metadataIds.length === 1
    ? { status: "resolved", projectId: metadataIds[0] }
    : { status: "invalid", reason: "Task is not scoped to one project." };
}
