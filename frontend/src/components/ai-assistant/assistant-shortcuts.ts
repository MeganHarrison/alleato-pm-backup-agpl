export type AssistantShortcutGroup = {
  id: string;
  label: string;
  shortcuts: Array<{
    id: string;
    label: string;
    prompt: string;
    icon: "snapshot" | "tasks" | "meetings" | "money" | "action";
  }>;
};

export const ASSISTANT_SHORTCUT_GROUPS: AssistantShortcutGroup[] = [
  {
    id: "project",
    label: "Project Snapshot",
    shortcuts: [
      {
        id: "owner-snapshot",
        label: "Owner snapshot",
        prompt: "Give me the owner snapshot for this project.",
        icon: "snapshot",
      },
      {
        id: "risks-money-meetings",
        label: "Risks, money, meetings",
        prompt: "Show risks, money, meetings, and owner actions for this project.",
        icon: "money",
      },
    ],
  },
  {
    id: "work",
    label: "Tasks And Meetings",
    shortcuts: [
      {
        id: "generated-tasks-today",
        label: "Tasks generated today",
        prompt: "What tasks were generated today?",
        icon: "tasks",
      },
      {
        id: "recent-meeting-intelligence",
        label: "Recent meeting insights",
        prompt: "Review recent meetings and show meeting insights for this project.",
        icon: "meetings",
      },
    ],
  },
  {
    id: "actions",
    label: "Take Action",
    shortcuts: [
      {
        id: "owner-action-queue",
        label: "Owner action queue",
        prompt: "What needs my attention on this project?",
        icon: "action",
      },
      {
        id: "draft-owner-update",
        label: "Draft owner update",
        prompt: "Draft an owner update for this project using source-backed facts.",
        icon: "action",
      },
    ],
  },
];
