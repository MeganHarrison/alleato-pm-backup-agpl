export function buildNextCommitmentChangeOrderNumber(existingCount: number) {
  const nextNumber = Math.max(0, Math.trunc(existingCount)) + 1;
  return `CCO-${String(nextNumber).padStart(3, "0")}`;
}
