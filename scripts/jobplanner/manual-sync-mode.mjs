export const JOBPLANNER_MANUAL_FLAG = "--manual";
export const JOBPLANNER_CONFIRMATION_ENV = "JOBPLANNER_MANUAL_SYNC_CONFIRMED";

export function assertManualJobPlannerSync({
  argv = process.argv.slice(2),
  env = process.env,
  dryRun = false,
} = {}) {
  if (dryRun) return;

  const confirmed =
    String(env[JOBPLANNER_CONFIRMATION_ENV] ?? "").trim().toLowerCase() ===
    "true";
  if (!argv.includes(JOBPLANNER_MANUAL_FLAG) || !confirmed) {
    throw new Error(
      "JobPlanner automatic sync is disabled. A deliberate manual import " +
        `requires ${JOBPLANNER_MANUAL_FLAG} and ${JOBPLANNER_CONFIRMATION_ENV}=true.`,
    );
  }
}
