/**
 * Strategist failure response helpers.
 *
 * Extracted from the AI assistant chat route to enable unit testing without
 * importing the full route (which has heavy server-side dependencies).
 *
 * REGRESSION GUARD (CLAUDE.md Rule 15):
 * `createStrategistFailureResponse` must never return a bare generic string —
 * it must always include the `cause`, project hint, and tool trace summary.
 * See: frontend/src/lib/ai/__tests__/strategist-failure-response.test.ts
 */

export function createStrategistFailureResponse(params: {
  cause: string;
  selectedProjectId?: number;
  toolTrace: Array<Record<string, unknown>>;
  userMessage?: string;
}): string {
  const failedTools = params.toolTrace
    .filter((trace) => trace.error)
    .map((trace) => String(trace.tool ?? "unknown tool"));
  const successfulTools = params.toolTrace
    .filter((trace) => trace.output && !trace.error)
    .map((trace) => String(trace.tool ?? "unknown tool"));

  const hasAnyTools = failedTools.length > 0 || successfulTools.length > 0;
  const sourceSummary = hasAnyTools
    ? `I checked ${successfulTools.length} source${successfulTools.length === 1 ? "" : "s"} successfully` +
      (failedTools.length > 0 ? `, but ${failedTools.join(", ")} failed before I could finish the answer.` : ".")
    : "I did not get far enough to retrieve project, meeting, email, Teams, OneDrive, or Acumatica context.";

  const projectHint = params.selectedProjectId
    ? "The pinned project context was included, so the failure is in retrieval or generation rather than project selection."
    : "No project was pinned, so a narrower project or topic would reduce retrieval ambiguity on the retry.";

  const scopedFollowUp = params.userMessage
    ? `I still need a successful retrieval pass before I can give a sourced strategic read on: "${params.userMessage.slice(0, 180)}${params.userMessage.length > 180 ? "..." : ""}".`
    : "I still need a successful retrieval pass before I can give a sourced strategic read.";

  return [
    "I hit a retrieval/generation failure before I could give you a trustworthy strategist answer.",
    "",
    `What happened: ${params.cause}`,
    `What I could confirm: ${sourceSummary}`,
    `What that means: ${projectHint}`,
    scopedFollowUp,
    "",
    "The right next move is to retry the same question with the project or decision you care about most. If this repeats, the persisted tool trace now shows exactly which source failed instead of leaving the chat blank.",
  ].join("\n");
}
