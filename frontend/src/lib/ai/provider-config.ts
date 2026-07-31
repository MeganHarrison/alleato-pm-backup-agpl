export type AiProviderPath = "openai" | "vercel_gateway";

export const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";

function normalizeProviderPath(rawValue: string | undefined): AiProviderPath {
  const value = rawValue?.trim().toLowerCase();
  if (value === "openai" || value === "direct_openai" || value === "direct") {
    return "openai";
  }

  if (
    !value ||
    value === "vercel_gateway" ||
    value === "ai_gateway" ||
    value === "gateway" ||
    value === "vercel"
  ) {
    return "vercel_gateway";
  }

  throw new Error(
    `Unsupported AI_PROVIDER_PATH "${rawValue}". Use "openai" or "vercel_gateway".`,
  );
}

export function getAiProviderPath(): AiProviderPath {
  const explicitProviderPath = process.env.AI_PROVIDER_PATH?.trim();
  if (explicitProviderPath) {
    return normalizeProviderPath(explicitProviderPath);
  }

  return process.env.AI_GATEWAY_API_KEY?.trim() ? "vercel_gateway" : "openai";
}

export function usesAiGateway(): boolean {
  return getAiProviderPath() === "vercel_gateway";
}

export function getOpenAICompatibleClientConfig(purpose = "AI request"): {
  apiKey: string;
  baseURL?: string;
  providerPath: AiProviderPath;
} {
  const providerPath = getAiProviderPath();

  if (providerPath === "vercel_gateway") {
    const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        `${purpose} is configured for AI_PROVIDER_PATH=vercel_gateway, but AI_GATEWAY_API_KEY is not set.`,
      );
    }

    return {
      apiKey,
      baseURL: AI_GATEWAY_BASE_URL,
      providerPath,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      `${purpose} requires OPENAI_API_KEY. Direct OpenAI is used only when AI_PROVIDER_PATH=openai is explicitly set or AI_GATEWAY_API_KEY is unavailable.`,
    );
  }

  return {
    apiKey,
    providerPath,
  };
}

export function getOpenAIModelId(modelId: string): string {
  if (!usesAiGateway()) return modelId.replace(/^openai\//, "");
  return modelId.includes("/") ? modelId : `openai/${modelId}`;
}

function getProviderErrorStatus(error: unknown): number | string | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as {
    status?: unknown;
    code?: unknown;
    error?: { code?: unknown; status?: unknown };
  };

  if (typeof candidate.status === "number" || typeof candidate.status === "string") {
    return candidate.status;
  }
  if (
    typeof candidate.error?.status === "number" ||
    typeof candidate.error?.status === "string"
  ) {
    return candidate.error.status;
  }
  if (typeof candidate.code === "number" || typeof candidate.code === "string") {
    return candidate.code;
  }
  if (
    typeof candidate.error?.code === "number" ||
    typeof candidate.error?.code === "string"
  ) {
    return candidate.error.code;
  }
  return null;
}

export function formatAIProviderFailure(
  error: unknown,
  purpose: string,
): string {
  const providerPath = getAiProviderPath();
  const message = error instanceof Error ? error.message : String(error);
  const status = getProviderErrorStatus(error);
  const quotaHint =
    status === 402 ||
    status === 429 ||
    /\b(402|429|quota|insufficient funds|insufficient_quota|credits?)\b/i.test(
      message,
    )
      ? " Provider quota/billing appears to be blocking this request."
      : "";

  return [
    `${purpose} failed on AI provider path "${providerPath}".${quotaHint}`,
    `Original provider error: ${message}`,
    "Detection gap: the app previously selected providers implicitly from whichever key existed.",
    "Prevention: Vercel AI Gateway is now preferred when AI_GATEWAY_API_KEY is configured; direct OpenAI requires AI_PROVIDER_PATH=openai or no gateway key.",
  ].join(" ");
}
