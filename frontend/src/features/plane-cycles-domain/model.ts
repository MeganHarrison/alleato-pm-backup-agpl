import type {
  PlaneCycle,
  PlaneCycleStatus,
} from "./types";

export function getPlaneCycleStatus(
  cycle: Pick<
    PlaneCycle,
    "start_date" | "end_date" | "archived_at"
  >,
  today = new Date(),
): PlaneCycleStatus {
  if (cycle.archived_at) return "archived";
  if (!cycle.start_date && !cycle.end_date) return "draft";

  const day = today.toISOString().slice(0, 10);
  if (cycle.start_date && cycle.start_date > day) return "upcoming";
  if (cycle.end_date && cycle.end_date < day) return "completed";
  return "current";
}

export function withPlaneCycleStatus<T extends Omit<PlaneCycle, "status">>(
  cycle: T,
): T & { status: PlaneCycleStatus } {
  return { ...cycle, status: getPlaneCycleStatus(cycle) };
}
