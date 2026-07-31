export const EXECUTIVE_SCHEDULE_WORKFLOW_ID = "executive-intelligence-daily-schedule";
export const DEFAULT_RECOVERY_WINDOW_MINUTES = 180;
// Canonical retry and recovery policy for the Project Intelligence runner.
export const DEFAULT_MAX_ATTEMPTS = 4;
export const DEFAULT_RETRY_BASE_MINUTES = 15;
export const DEFAULT_STALE_RUN_MINUTES = 45;

function asDate(value, label) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid timestamp.`);
  return date;
}

export function retryDelayMinutes(
  attemptCount,
  { baseMinutes = DEFAULT_RETRY_BASE_MINUTES, maxMinutes = DEFAULT_RECOVERY_WINDOW_MINUTES } = {},
) {
  if (!Number.isInteger(attemptCount) || attemptCount < 1) {
    throw new Error("attemptCount must be a positive integer.");
  }
  if (!Number.isFinite(baseMinutes) || baseMinutes <= 0) {
    throw new Error("baseMinutes must be positive.");
  }
  return Math.min(maxMinutes, baseMinutes * 2 ** (attemptCount - 1));
}

export function nextRetryAt(now, attemptCount, options = {}) {
  const current = asDate(now, "now");
  return new Date(current.getTime() + retryDelayMinutes(attemptCount, options) * 60_000).toISOString();
}

export function isWithinRecoveryWindow(
  now,
  { targetLocalTime = "06:00", recoveryWindowMinutes = DEFAULT_RECOVERY_WINDOW_MINUTES, localSchedule } = {},
) {
  if (!localSchedule?.currentLocalTime) return false;
  const [hour, minute] = targetLocalTime.split(":").map(Number);
  const [currentHour, currentMinute] = localSchedule.currentLocalTime.split(":").map(Number);
  const target = hour * 60 + minute;
  const current = currentHour * 60 + currentMinute;
  const delta = current - target;
  return delta >= 0 && delta <= recoveryWindowMinutes;
}

export function recoveryDecision(
  now,
  run,
  { maxAttempts = DEFAULT_MAX_ATTEMPTS, staleRunMinutes = DEFAULT_STALE_RUN_MINUTES } = {},
) {
  const current = asDate(now, "now");
  if (!run) return { action: "start", reason: "no_durable_scheduler_run" };
  if (run.status === "succeeded") return { action: "skip", reason: "scheduler_run_already_succeeded" };
  if (run.status === "failed_permanent") return { action: "fail", reason: "scheduler_run_failed_permanently" };
  if (run.status === "failed_retryable") {
    if (run.attempt_count >= maxAttempts) return { action: "fail", reason: "retry_budget_exhausted" };
    if (run.next_attempt_at && asDate(run.next_attempt_at, "next_attempt_at") > current) {
      return { action: "skip", reason: "retry_not_due" };
    }
    return { action: "resume", reason: "retry_due" };
  }
  if (run.status === "running") {
    if (run.started_at) {
      const ageMinutes = (current.getTime() - asDate(run.started_at, "started_at").getTime()) / 60_000;
      if (ageMinutes >= staleRunMinutes && run.attempt_count < maxAttempts) {
        return { action: "resume", reason: "stale_scheduler_run" };
      }
    }
    return { action: "skip", reason: "scheduler_run_in_progress" };
  }
  return { action: "start", reason: `scheduler_run_${run.status}` };
}
