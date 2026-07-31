const COMMITMENT_PREFIXES = ["SC-", "PO-"] as const;

export type CommitmentNumberPrefix = "SC-" | "PO-";

export function normalizeCommitmentContractNumber(
  value: string | null | undefined,
  prefix: CommitmentNumberPrefix,
): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";

  const withoutKnownPrefix = COMMITMENT_PREFIXES.reduce((current, knownPrefix) => {
    if (current.toUpperCase().startsWith(knownPrefix)) {
      return current.slice(knownPrefix.length).trim();
    }
    return current;
  }, trimmed);

  return `${prefix}${withoutKnownPrefix}`;
}

export function hasCommitmentContractNumberPrefix(
  value: string | null | undefined,
  prefix: CommitmentNumberPrefix,
): boolean {
  return String(value ?? "").trim().toUpperCase().startsWith(prefix);
}
