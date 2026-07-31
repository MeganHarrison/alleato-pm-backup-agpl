/**
 * Shared helpers for connecting to the Python backend's
 * Microsoft Executive Assistant endpoint.
 *
 * Extracted from handler-v2.ts and orchestrator.ts to eliminate
 * duplication and ensure both callers use the same logic.
 */

export function microsoftAssistantBackendUrl(): string {
  const value = (
    process.env.NODE_ENV === "development"
      ? process.env.PYTHON_BACKEND_URL || "http://127.0.0.1:8000"
      : process.env.BACKEND_URL || process.env.PYTHON_BACKEND_URL || ""
  )
    .replace(/\/+$/, "")
    .trim();

  try {
    new URL(value);
  } catch {
    throw new Error(
      "Missing or invalid backend URL. Set BACKEND_URL or PYTHON_BACKEND_URL before using the Microsoft Executive Assistant.",
    );
  }

  return value;
}

export function microsoftAssistantAdminApiKey(): string {
  const value = process.env.ADMIN_API_KEY?.trim();
  if (!value) {
    throw new Error(
      "ADMIN_API_KEY is required to call the backend Microsoft Executive Assistant.",
    );
  }
  return value;
}

export function defaultMicrosoftMailbox(): string | undefined {
  return (
    process.env.AI_ASSISTANT_DEFAULT_OUTLOOK_MAILBOX?.trim() ||
    process.env.OUTLOOK_OPERATOR_MAILBOX?.trim() ||
    process.env.MICROSOFT_SYNC_USERS?.split(",")[0]?.trim() ||
    undefined
  );
}

export function microsoftAssistantTimeoutMs(): number {
  const raw = process.env.AI_ASSISTANT_MICROSOFT_BRIDGE_TIMEOUT_MS;
  if (raw !== undefined) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    console.warn(
      `[microsoft-backend-config] Invalid timeout value "${raw}", using default 120000ms`,
    );
  }
  return 120_000;
}
