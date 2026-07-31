const DEFAULT_AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
const DEFAULT_MODEL_TIMEOUT_MS = 180_000;

export function getProviderConfigs({
  model = "openai/gpt-5.6-terra",
  env = process.env,
  gatewayBaseUrl = DEFAULT_AI_GATEWAY_BASE_URL,
} = {}) {
  const providers = [];
  if (env.AI_GATEWAY_API_KEY?.trim()) {
    providers.push({
      name: "ai_gateway",
      apiKey: env.AI_GATEWAY_API_KEY.trim(),
      baseUrl: gatewayBaseUrl,
      model: model.startsWith("openai/") ? model : `openai/${model}`,
    });
  }
  if (env.OPENAI_API_KEY?.trim()) {
    providers.push({
      name: "openai_direct",
      apiKey: env.OPENAI_API_KEY.trim(),
      baseUrl: "https://api.openai.com/v1",
      model: model.replace(/^openai[/:]/, ""),
    });
  }
  if (!providers.length) {
    throw new Error("AI_GATEWAY_API_KEY or OPENAI_API_KEY is required to draft the brief.");
  }
  return providers;
}

export function isProviderAvailabilityError(status, message) {
  return (
    status === 401 ||
    status === 402 ||
    status === 403 ||
    status === 429 ||
    status >= 500 ||
    /credit|quota|billing|rate.?limit|temporar|unavailable|timeout/i.test(String(message ?? ""))
  );
}

export async function callModel(messages, {
  model = "openai/gpt-5.6-terra",
  maxCompletionTokens = 2200,
  responseFormat = null,
  returnMetadata = false,
  timeoutMs = DEFAULT_MODEL_TIMEOUT_MS,
  env = process.env,
  fetchImpl = globalThis.fetch,
  gatewayBaseUrl = DEFAULT_AI_GATEWAY_BASE_URL,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required for Project Intelligence model transport.");
  }
  const providers = getProviderConfigs({ model, env, gatewayBaseUrl });
  const failures = [];
  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${provider.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          max_completion_tokens: maxCompletionTokens,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const message = error?.name === "AbortError"
        ? `timed out after ${timeoutMs}ms`
        : error?.message ?? "network request failed";
      failures.push(`${provider.name}: ${message}`);
      if (index < providers.length - 1) continue;
      throw new Error(`Daily executive brief model providers failed: ${failures.join("; ")}`);
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
    if (!response.ok) {
      const message = payload?.error?.message || payload.raw || `Model HTTP ${response.status}`;
      failures.push(`${provider.name}: HTTP ${response.status} ${message}`);
      if (index < providers.length - 1 && isProviderAvailabilityError(response.status, message)) continue;
      throw new Error(`Daily executive brief model providers failed: ${failures.join("; ")}`);
    }
    const choice = payload.choices?.[0];
    const content = choice?.message?.content?.trim() ?? "";
    if (!content) {
      failures.push(
        `${provider.name}: empty content; finish_reason=${choice?.finish_reason ?? "unknown"}`,
      );
      if (index < providers.length - 1) continue;
      throw new Error(`Daily executive brief model providers failed: ${failures.join("; ")}`);
    }
    if (returnMetadata) {
      return {
        content,
        provider: provider.name,
        finishReason: choice?.finish_reason ?? null,
        usage: payload.usage ?? null,
      };
    }
    return content;
  }
  throw new Error(`Daily executive brief model providers failed: ${failures.join("; ")}`);
}

export {
  DEFAULT_AI_GATEWAY_BASE_URL,
  DEFAULT_MODEL_TIMEOUT_MS,
};
