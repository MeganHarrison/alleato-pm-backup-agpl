export const SUBMITTAL_WORKFLOW_ROLES = ["Submitter", "Approver"] as const;

export type SubmittalWorkflowRole = (typeof SUBMITTAL_WORKFLOW_ROLES)[number];

export function normalizeSubmittalWorkflowRole(
  role: string | null | undefined,
): SubmittalWorkflowRole {
  return role === "Submitter" ? "Submitter" : "Approver";
}
