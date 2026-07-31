export const CRM_PURSUIT_PLAYBOOK = [
  { title: "Confirm stakeholders and decision process", offsetDays: 0 },
  { title: "Complete pursuit qualification review", offsetDays: 3 },
  { title: "Prepare proposal or bid checkpoint", offsetDays: 7 },
] as const;

function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function planMissingPursuitSteps(
  today: string,
  existingTitles: Iterable<string>,
) {
  const existing = new Set(existingTitles);
  return CRM_PURSUIT_PLAYBOOK.filter(
    (step) => !existing.has(step.title),
  ).map((step) => ({
    title: step.title,
    dueDate: addDays(today, step.offsetDays),
  }));
}
