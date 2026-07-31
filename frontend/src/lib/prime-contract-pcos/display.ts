export function formatPrimeContractPcoNumber(
  pcoNumber: string | null | undefined,
): string | null {
  const normalized = pcoNumber?.trim();
  if (!normalized) return null;

  if (/^PPCO-/i.test(normalized)) {
    return normalized.replace(/^PPCO-/i, "Prime PCO-");
  }

  return normalized;
}

export function getPrimeContractPcoDisplayName(params: {
  pcoNumber?: string | null;
  title?: string | null;
}): string {
  const formattedNumber = formatPrimeContractPcoNumber(params.pcoNumber);
  if (formattedNumber) return formattedNumber;

  const title = params.title?.trim();
  if (title) return title;

  return "Prime Contract PCO";
}
