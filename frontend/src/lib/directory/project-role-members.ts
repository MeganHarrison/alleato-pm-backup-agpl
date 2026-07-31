export interface RoleMemberUpdatePlan {
  requestedIds: string[];
  existingIds: string[];
  idsToAdd: string[];
  idsToRemove: string[];
}

export function normalizeRoleMemberIds(memberPersonIds: unknown): string[] {
  if (!Array.isArray(memberPersonIds)) {
    throw new Error("member_person_ids must be an array");
  }

  return [
    ...new Set(
      memberPersonIds.map((id) => (typeof id === "string" ? id.trim() : "")),
    ),
  ].filter(Boolean);
}

export function planRoleMemberUpdate(
  requestedIds: string[],
  existingIds: string[],
): RoleMemberUpdatePlan {
  const requestedSet = new Set(requestedIds);
  const existingSet = new Set(existingIds);

  return {
    requestedIds,
    existingIds,
    idsToAdd: requestedIds.filter((id) => !existingSet.has(id)),
    idsToRemove: existingIds.filter((id) => !requestedSet.has(id)),
  };
}

export function roleMemberSetsMatch(
  requestedIds: string[],
  persistedIds: string[],
): boolean {
  if (requestedIds.length !== persistedIds.length) return false;
  const persistedSet = new Set(persistedIds);
  return requestedIds.every((id) => persistedSet.has(id));
}
