type HomeQueueTask = {
  project_id: number | null;
};

export type HomePrimaryQueueAction = {
  href: string;
  label: string;
};

export function getHomeAiApprovalMeta({
  isLoading,
  aiApprovalCount,
  interruptCount,
}: {
  isLoading: boolean;
  aiApprovalCount: number;
  interruptCount: number;
}): string {
  if (isLoading) return "Checking AI decisions.";

  if (aiApprovalCount === 0) {
    return "No AI decisions are waiting for review.";
  }

  const decisionLabel = `AI decision${aiApprovalCount === 1 ? "" : "s"}`;

  if (interruptCount > 0) {
    return `${aiApprovalCount} ${decisionLabel} waiting. ${interruptCount} also alert${interruptCount === 1 ? "s" : ""} the AI widget.`;
  }

  return `${aiApprovalCount} ${decisionLabel} waiting quietly in the review queue.`;
}

export function getHomePrimaryQueueAction({
  todayTasks,
  openTasks,
  aiApprovalCount,
}: {
  todayTasks: HomeQueueTask[];
  openTasks: HomeQueueTask[];
  aiApprovalCount: number;
}): HomePrimaryQueueAction {
  if (todayTasks[0]?.project_id) {
    return {
      href: `/${todayTasks[0].project_id}/tasks`,
      label: "Open tasks",
    };
  }

  if (openTasks[0]?.project_id) {
    return {
      href: `/${openTasks[0].project_id}/tasks`,
      label: "Open tasks",
    };
  }

  if (aiApprovalCount > 0) {
    return {
      href: "/ai/approvals",
      label: "Review AI",
    };
  }

  return {
    href: "/tasks",
    label: "Open tasks",
  };
}
