export function isChatTransportLoadFailure(error: Error): boolean {
  return /^(load failed|failed to fetch|networkerror|network error)$/i.test(
    error.message?.trim() ?? "",
  );
}

export function formatChatError(error: Error): string {
  const message = error.message?.trim();
  if (isChatTransportLoadFailure(error)) {
    return "The assistant connection dropped before the request reached the server. Your message was not saved; retry when the connection is stable.";
  }
  if (!message) {
    return "The assistant request failed before a response was returned.";
  }
  return `The assistant request failed before a response was returned: ${message}`;
}
