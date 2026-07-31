export const AI_ASSISTANT_SURFACES = {
  full: "full-assistant",
  askAlleato: "ask-alleato",
} as const;

export type AiAssistantSurface =
  (typeof AI_ASSISTANT_SURFACES)[keyof typeof AI_ASSISTANT_SURFACES];

export function parseAiAssistantSurface(value: unknown): AiAssistantSurface {
  if (value === undefined || value === null) {
    return AI_ASSISTANT_SURFACES.full;
  }

  if (
    value === AI_ASSISTANT_SURFACES.full ||
    value === AI_ASSISTANT_SURFACES.askAlleato
  ) {
    return value;
  }

  throw new Error(
    `AI_ASSISTANT_SURFACE_CAPABILITY_DENIED: unsupported assistant surface ${JSON.stringify(value)}.`,
  );
}

export function assistantSurfaceAllowsActionTools(
  surface: AiAssistantSurface,
): boolean {
  return surface === AI_ASSISTANT_SURFACES.full;
}
