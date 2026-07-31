import type { TrainingRole } from "./types";

export function normalizeTrainingRoleLabel(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveViewerRole(
  title: string | null | undefined,
  roles: TrainingRole[],
): string | null {
  const normalizedTitle = normalizeTrainingRoleLabel(title ?? "");
  if (!normalizedTitle) return null;

  const matches = roles.filter((role) =>
    [role.slug, role.name, ...role.aliases].some(
      (candidate) =>
        normalizeTrainingRoleLabel(candidate) === normalizedTitle,
    ),
  );

  return matches.length === 1 ? matches[0].slug : null;
}
