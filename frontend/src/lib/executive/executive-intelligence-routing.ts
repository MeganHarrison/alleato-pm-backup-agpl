export type AgentRoute =
  | "strategic_advisor"
  | "cfo"
  | "project_intelligence"
  | "risk_accountability"
  | "operations_improvement"
  | "meeting_intelligence";

export function classifyExecutiveQuery(query: string): AgentRoute {
  const q = query.toLowerCase();

  if (
    q.includes("financial") ||
    q.includes("wip") ||
    q.includes("budget") ||
    q.includes("margin") ||
    q.includes("invoice")
  ) {
    return "cfo";
  }

  if (
    q.includes("project") ||
    q.includes("status") ||
    q.includes("blocker") ||
    q.includes("schedule")
  ) {
    return "project_intelligence";
  }

  if (
    q.includes("risk") ||
    q.includes("overdue") ||
    q.includes("accountability") ||
    q.includes("commitment")
  ) {
    return "risk_accountability";
  }

  if (
    q.includes("sop") ||
    q.includes("process") ||
    q.includes("handoff") ||
    q.includes("bottleneck")
  ) {
    return "operations_improvement";
  }

  if (
    q.includes("meeting") ||
    q.includes("transcript") ||
    q.includes("decided") ||
    q.includes("fireflies")
  ) {
    return "meeting_intelligence";
  }

  return "strategic_advisor";
}
