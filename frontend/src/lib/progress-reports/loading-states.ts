/**
 * Ordered steps shown in the multi-step loader while a progress report is being
 * generated. These mirror the real work `generateProgressReportSections` does
 * (gather sources → analyze → draft → polish) so the animation reflects the
 * pipeline rather than being decorative filler.
 *
 * Generation is a single server round-trip with no streamed progress, so the
 * loader advances through these on a timer with `loop={false}` and holds on the
 * final step until the request resolves.
 */
export const PROGRESS_REPORT_LOADING_STATES = [
  { text: "Gathering meetings and emails" },
  { text: "Reviewing site photos" },
  { text: "Analyzing change events, RFIs, and submittals" },
  { text: "Drafting this week's highlights" },
  { text: "Polishing the client-ready report" },
] as const;

/**
 * Per-step dwell time (ms). Five steps at ~2.6s reaches the final "polishing"
 * step at ~10s, which is a realistic point for a generation to still be running;
 * with `loop={false}` it then holds there until the response arrives.
 */
export const PROGRESS_REPORT_LOADING_STEP_DURATION = 2600;
