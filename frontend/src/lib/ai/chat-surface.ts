export const ASSISTANT_SURFACES = ["alleato_ai", "ask_alleato", "asrs"] as const;

export type AssistantSurface = (typeof ASSISTANT_SURFACES)[number];

export const DEFAULT_ASSISTANT_SURFACE: AssistantSurface = "alleato_ai";

export function parseAssistantSurface(
  value: string | null | undefined,
): AssistantSurface {
  if (value === "asrs" || value === "ask_alleato") return value;
  return DEFAULT_ASSISTANT_SURFACE;
}

export function conversationMatchesSurface(
  metadata: unknown,
  surface: AssistantSurface,
): boolean {
  const storedSurface =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).surface
      : null;

  if (surface === "asrs") return storedSurface === "asrs";
  if (surface === "ask_alleato") return storedSurface === "ask_alleato";

  // Conversations created before surface namespacing belong to the general
  // assistant. Explicit ASRS and Ask Alleato markers remove them from `/ai`.
  return storedSurface !== "asrs" && storedSurface !== "ask_alleato";
}

export function assistantSurfaceQuery(surface: AssistantSurface): string {
  return `surface=${encodeURIComponent(surface)}`;
}
