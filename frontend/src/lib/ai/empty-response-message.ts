// User-facing message shown when the AI model produced no text on a turn.
//
// This must NOT blindly blame billing. The old inline version always said
// "out of credits / over quota / blocked by billing" regardless of the real
// cause, which was wrong whenever the failure was a swallowed provider/stream
// error or a tool-schema problem — e.g. session d87edc77, where the same AI
// Gateway had answered the prior turn seconds earlier. Use the captured
// `streamText.onError` message to explain what actually happened; only invoke
// the billing wording when the error text itself looks like a quota/billing
// signal.

const BILLING_SIGNAL =
  /\b(quota|billing|insufficient|credit|credits|payment|rate limit|402|429|exceeded|positive credit balance)\b/i;

const GENERIC_STREAM_ERROR = /^(an error occurred\.?|error)$/i;

/**
 * Convert a provider or AI SDK stream failure into safe, actionable UI copy.
 * The AI SDK may replace the provider error with "An error occurred", so the
 * caller should prefer the error captured by streamText.onError when present.
 */
export function buildAssistantStreamErrorMessage(
  streamErrorMessage: string | null,
): string {
  const detail = streamErrorMessage?.trim();

  if (detail && BILLING_SIGNAL.test(detail)) {
    return "The AI provider is currently unavailable because its quota or billing limit was reached. Your question was saved; retry after provider access is restored.";
  }

  if (detail && !GENERIC_STREAM_ERROR.test(detail)) {
    return `The assistant request failed before a response was returned: ${detail}`;
  }

  return "The assistant request failed before a response was returned. Your question was saved; retry once the AI provider is available.";
}

/**
 * Build the assistant message persisted/shown when the model yields empty text.
 * @param streamErrorMessage the message captured by streamText.onError, or null
 *   when the stream ended with no error event.
 */
export function buildEmptyResponseMessage(
  streamErrorMessage: string | null,
): string {
  if (streamErrorMessage) {
    if (BILLING_SIGNAL.test(streamErrorMessage)) {
      return buildAssistantStreamErrorMessage(streamErrorMessage);
    }
    return `The assistant hit an error before it could answer: ${streamErrorMessage}. I saved your question so it is not lost — retry, or pick a different model if it persists.`;
  }
  return "The AI provider returned an empty response with no error. I saved your question so it is not lost — please retry, or pick a different model. If this keeps happening, the model call is failing silently and needs a look.";
}
