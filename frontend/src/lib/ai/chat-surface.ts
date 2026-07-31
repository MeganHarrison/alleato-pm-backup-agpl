export const ASSISTANT_SURFACES = [
  "alleato_ai",
  "ask_alleato",
  "training_library",
] as const;

export type AssistantSurface = (typeof ASSISTANT_SURFACES)[number];

export const DEFAULT_ASSISTANT_SURFACE: AssistantSurface = "alleato_ai";

export function parseAssistantSurface(
  value: string | null | undefined,
): AssistantSurface {
  if (value === "ask_alleato" || value === "training_library") return value;
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

  if (surface === "ask_alleato" || surface === "training_library") {
    return storedSurface === surface;
  }

  // Conversations created before surface namespacing belong to the general
  // assistant. Explicit Ask Alleato markers remove them from `/ai`.
  return (
    storedSurface !== "ask_alleato" && storedSurface !== "training_library"
  );
}

export function assistantSurfaceQuery(surface: AssistantSurface): string {
  return `surface=${encodeURIComponent(surface)}`;
}
