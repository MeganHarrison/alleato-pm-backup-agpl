import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type ExecutiveIntelligenceRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "partial_success"
  | "failed_retryable"
  | "failed_permanent"
  | "cancelled";

export type ExecutiveIntelligenceRunState = {
  runId: string;
  businessDate: string;
  status: ExecutiveIntelligenceRunStatus;
  attemptCount: number;
  blocker: string | null;
  nextAttemptAt: string | null;
};

const RETRYABLE: ExecutiveIntelligenceRunStatus[] = ["failed_retryable"];
const TERMINAL: ExecutiveIntelligenceRunStatus[] = [
  "succeeded",
  "partial_success",
  "failed_permanent",
  "cancelled",
];

export function transitionExecutiveIntelligenceRun(
  current: ExecutiveIntelligenceRunState,
  next: ExecutiveIntelligenceRunStatus,
  options: { blocker?: string | null; nextAttemptAt?: string | null; complete?: boolean } = {},
): ExecutiveIntelligenceRunState {
  if (TERMINAL.includes(current.status)) {
    throw new Error(`Cannot transition terminal run ${current.runId} from ${current.status}`);
  }
  if (next === "succeeded" && options.complete !== true) {
    throw new Error("Cannot promote an incomplete Executive Intelligence run");
  }
  if (next === "failed_retryable" && !options.blocker?.trim()) {
    throw new Error("Retryable Executive Intelligence failure requires an actionable blocker");
  }
  if (next === "failed_retryable" && !options.nextAttemptAt) {
    throw new Error("Retryable Executive Intelligence failure requires nextAttemptAt");
  }
  if ((next === "succeeded" || next === "partial_success") && (options.blocker || options.nextAttemptAt)) {
    throw new Error("Incomplete Executive Intelligence runs cannot be promoted");
  }
  return {
    ...current,
    status: next,
    blocker: options.blocker ?? null,
    nextAttemptAt: options.nextAttemptAt ?? null,
  };
}

function rowToState(row: Pick<Database["public"]["Tables"]["ai_work_runs"]["Row"], "id" | "business_date" | "status" | "attempt_count" | "blocker" | "next_attempt_at">): ExecutiveIntelligenceRunState {
  if (!row.business_date) throw new Error(`Run ${row.id} has no business date`);
  return {
    runId: row.id,
    businessDate: row.business_date,
    status: row.status as ExecutiveIntelligenceRunStatus,
    attemptCount: row.attempt_count,
    blocker: row.blocker,
    nextAttemptAt: row.next_attempt_at,
  };
}

export function createExecutiveIntelligenceRunStateStore(
  supabase: SupabaseClient<Database>,
) {
  return {
    async get(runId: string): Promise<ExecutiveIntelligenceRunState> {
      const { data, error } = await supabase
        .from("ai_work_runs")
        .select("id,business_date,status,attempt_count,blocker,next_attempt_at")
        .eq("id", runId)
        .single();
      if (error || !data) throw new Error(`Executive Intelligence run lookup failed: ${error?.message ?? "not found"}`);
      return rowToState(data);
    },

    async start(runId: string, businessDate: string) {
      const { error } = await supabase
        .from("ai_work_runs")
        .update({ status: "running", business_date: businessDate, attempt_count: 1, blocker: null, next_attempt_at: null })
        .eq("id", runId);
      if (error) throw new Error(`Executive Intelligence run start failed: ${error.message}`);
    },

    async retry(runId: string, blocker: string, nextAttemptAt: string) {
      const current = await this.get(runId);
      if (current.status !== "running") throw new Error(`Run ${runId} is not running`);
      if (new Date(nextAttemptAt).getTime() <= Date.now()) throw new Error("nextAttemptAt must be in the future");
      const { error } = await supabase
        .from("ai_work_runs")
        .update({ status: "failed_retryable", blocker: blocker.trim(), next_attempt_at: nextAttemptAt })
        .eq("id", runId);
      if (error) throw new Error(`Executive Intelligence retry scheduling failed: ${error.message}`);
    },

    async resume(runId: string) {
      const current = await this.get(runId);
      if (!RETRYABLE.includes(current.status)) throw new Error(`Run ${runId} is not retryable`);
      if (current.nextAttemptAt && new Date(current.nextAttemptAt).getTime() > Date.now()) {
        throw new Error(`Run ${runId} is not due for retry`);
      }
      const { error } = await supabase
        .from("ai_work_runs")
        .update({ status: "running", attempt_count: current.attemptCount + 1, blocker: null, next_attempt_at: null })
        .eq("id", runId);
      if (error) throw new Error(`Executive Intelligence resume failed: ${error.message}`);
    },

    async promote(runId: string, complete: boolean) {
      const current = await this.get(runId);
      const next = transitionExecutiveIntelligenceRun(current, "succeeded", { complete });
      const { error } = await supabase
        .from("ai_work_runs")
        .update({ status: next.status, blocker: null, next_attempt_at: null, completed_at: new Date().toISOString() })
        .eq("id", runId);
      if (error) throw new Error(`Executive Intelligence completion failed: ${error.message}`);
    },
  };
}
