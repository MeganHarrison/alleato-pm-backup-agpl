export function resolveProjectLabel(
  requestedName: string | undefined,
  persistedName: unknown,
  projectId: number,
): string {
  const requested = requestedName?.trim();
  if (requested) return requested;

  const persisted = String(persistedName ?? "").trim();
  return persisted || `Project ${projectId}`;
}
