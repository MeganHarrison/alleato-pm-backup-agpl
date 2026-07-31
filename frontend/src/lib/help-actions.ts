export const HELP_ACTION_STATUSES = [
  "guide_only",
  "planned",
  "preview_ready",
  "executable",
] as const;

export const HELP_ACTION_SAFETY_LEVELS = [
  "read_only",
  "preview_confirm",
  "admin_confirm",
] as const;

export type HelpActionStatus = (typeof HELP_ACTION_STATUSES)[number];
export type HelpActionSafetyLevel = (typeof HELP_ACTION_SAFETY_LEVELS)[number];

export type HelpActionDefinition = {
  id: string;
  label: string;
  description: string;
  status: HelpActionStatus;
  safetyLevel: HelpActionSafetyLevel;
  relatedRoutes: string[];
  toolName?: string;
  unavailableReason?: string;
};

export const HELP_ACTIONS = [
  {
    id: "invite_user",
    label: "Invite user",
    description:
      "Prepare and send an invitation for a new Alleato OS user from User Management.",
    status: "planned",
    safetyLevel: "admin_confirm",
    relatedRoutes: ["/user-management"],
    unavailableReason:
      "The assistant can explain the invitation flow, but the invite-user write tool is not implemented yet.",
  },
  {
    id: "update_profile",
    label: "Update profile",
    description:
      "Update profile details or profile image for the signed-in user or an admin-managed user record.",
    status: "planned",
    safetyLevel: "preview_confirm",
    relatedRoutes: ["/settings/profile", "/user-management"],
    unavailableReason:
      "The assistant can guide profile updates, but profile writes are not exposed as an assistant action yet.",
  },
  {
    id: "assign_permissions",
    label: "Assign access",
    description:
      "Assign company or project roles to a user after reviewing access needs.",
    status: "planned",
    safetyLevel: "admin_confirm",
    relatedRoutes: ["/user-management", "/[projectId]/user-management"],
    unavailableReason:
      "The assistant can explain access decisions, but access updates require a future preview-and-confirm tool.",
  },
  {
    id: "update_permission_template",
    label: "Update role",
    description:
      "Change a reusable company or project role.",
    status: "planned",
    safetyLevel: "admin_confirm",
    relatedRoutes: ["/user-management", "/[projectId]/user-management"],
    unavailableReason:
      "Template changes can affect many users, so this remains guidance-only until a dedicated review workflow exists.",
  },
] as const satisfies readonly HelpActionDefinition[];

export type HelpActionId = (typeof HELP_ACTIONS)[number]["id"];

export function getHelpActionById(id: string): HelpActionDefinition | undefined {
  return HELP_ACTIONS.find((action) => action.id === id);
}

export function getHelpActionsForIds(ids: string[]): HelpActionDefinition[] {
  return ids
    .map((id) => getHelpActionById(id))
    .filter((action): action is HelpActionDefinition => Boolean(action));
}

export function getUnknownHelpActionIds(ids: string[]): string[] {
  return ids.filter((id) => !getHelpActionById(id));
}
