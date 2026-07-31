import {
  AI_ASSISTANT_SURFACES,
  assistantSurfaceAllowsActionTools,
  parseAiAssistantSurface,
} from "@/lib/ai/assistant-surface";

describe("AI assistant surface capabilities", () => {
  it("keeps the canonical full assistant action-capable by default", () => {
    const surface = parseAiAssistantSurface(undefined);
    expect(surface).toBe(AI_ASSISTANT_SURFACES.full);
    expect(assistantSurfaceAllowsActionTools(surface)).toBe(true);
  });

  it("makes the compact Ask Alleato surface read-only", () => {
    const surface = parseAiAssistantSurface(AI_ASSISTANT_SURFACES.askAlleato);
    expect(assistantSurfaceAllowsActionTools(surface)).toBe(false);
  });

  it("fails loudly on an unknown surface instead of widening capability", () => {
    expect(() => parseAiAssistantSurface("admin-override")).toThrow(
      "AI_ASSISTANT_SURFACE_CAPABILITY_DENIED",
    );
  });
});
