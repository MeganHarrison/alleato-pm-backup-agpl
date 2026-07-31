export interface ProjectDisplayNameInput {
  name?: string | null;
  description?: string | null;
  internalIdentifiers?: Array<string | number | null | undefined>;
  isUnassigned?: boolean;
}

function normalizeLabel(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function identifierVariants(identifier: string): string[] {
  const digits = identifier.replace(/\D/g, "");
  const variants = new Set([identifier]);

  if (digits.length >= 5) {
    variants.add(digits);
    variants.add(`${digits.slice(0, 2)}-${digits.slice(2)}`);
    variants.add(`${digits.slice(0, 2)} ${digits.slice(2)}`);
  }

  return [...variants].sort((left, right) => right.length - left.length);
}

function stripLeadingIdentifiers(
  label: string,
  identifiers: string[],
): string | null {
  let result = label;

  for (const identifier of identifiers) {
    for (const variant of identifierVariants(identifier)) {
      const exactIdentifier = new RegExp(`^${escapeRegExp(variant)}$`, "i");
      if (exactIdentifier.test(result)) return null;

      const leadingIdentifier = new RegExp(
        `^${escapeRegExp(variant)}(?:\\s*[-–—:|,]\\s*|\\s+)`,
        "i",
      );
      result = result.replace(leadingIdentifier, "").trim();
    }
  }

  return normalizeLabel(result);
}

/**
 * Returns a human-facing project name without ever falling back to a raw ID or
 * project code. Callers may provide identifiers so accidental code-as-name
 * source values are rejected as well.
 */
export function getProjectDisplayName({
  name,
  description,
  internalIdentifiers = [],
  isUnassigned = false,
}: ProjectDisplayNameInput): string {
  const identifiers = internalIdentifiers
    .map((identifier) => normalizeLabel(String(identifier ?? "")))
    .filter((identifier): identifier is string => identifier !== null);
  const identifierSet = new Set(identifiers);
  const candidate = [name, description]
    .map(normalizeLabel)
    .filter((label): label is string => label !== null)
    .map((label) => stripLeadingIdentifiers(label, identifiers))
    .find(
      (label): label is string => label !== null && !identifierSet.has(label),
    );

  if (candidate) return candidate;
  return isUnassigned ? "Unassigned" : "Unnamed project";
}

export function compactProjectDisplayName(
  displayName: string,
  maxLength = 18,
): string {
  if (displayName.length <= maxLength) return displayName;
  return `${displayName.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}
