// OpenAI providerOptions for the AI-assistant streamText call.
//
// gpt-5.4 REJECTS `reasoning_effort` when function tools are also attached on
// /v1/chat/completions:
//   "Function tools with reasoning_effort are not supported for gpt-5.4. To use
//    function tools, use /v1/responses or set reasoning_effort to 'none'."
// That rejection returns an EMPTY model response, which surfaced to users as a
// fake error — the intermittent follow-up crash traced on 2026-07-09 (only
// tool-using turns hit it; tool-less turns kept reasoning_effort and worked,
// which is why it looked flaky).
//
// So: only send `reasoningEffort` when NO function tools are attached. Keep
// `textVerbosity: "low"` always. Without tools, "low" still drops reasoning
// tokens ~95->8 and roughly halves latency on gpt-5.4.

// Record<string, string> so the result is assignable to the AI SDK's
// providerOptions JSONObject.
export function buildAssistantOpenAiProviderOptions(
  hasFunctionTools: boolean,
): Record<string, string> {
  if (hasFunctionTools) {
    return { textVerbosity: "low" };
  }
  return { textVerbosity: "low", reasoningEffort: "low" };
}

/** True when a non-empty tool set will be sent to the model. */
export function hasFunctionTools(tools: unknown): boolean {
  return (
    typeof tools === "object" &&
    tools !== null &&
    Object.keys(tools as Record<string, unknown>).length > 0
  );
}
