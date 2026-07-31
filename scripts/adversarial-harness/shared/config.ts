import type { HarnessConfig } from "./types.ts";

export const DEFAULT_CONFIG: Omit<HarnessConfig, "userPrompt" | "workDir"> = {
  maxSprints: 10,
  maxRetriesPerSprint: 3,
  passThreshold: 7,
};

export const CODEX_MODEL = "gpt-5.4";
export const CODEX_NETWORK_ACCESS = true;
