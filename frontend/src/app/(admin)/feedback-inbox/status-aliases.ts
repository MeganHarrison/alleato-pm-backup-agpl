export function normalizeFeedbackStoredStatus(status: string): string {
  if (status === "verified") return "closed";
  return status;
}

export function expandFeedbackStatusAliases(status: string): string[] {
  if (status === "verified") return ["closed", "verified"];
  if (status === "in_review") return ["resolved", "in_review"];
  return [normalizeFeedbackStoredStatus(status)];
}
