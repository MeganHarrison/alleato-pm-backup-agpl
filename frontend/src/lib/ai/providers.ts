import { createOpenAI } from "@ai-sdk/openai";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
  type LanguageModelMiddleware,
} from "ai";
import { isTestEnvironment } from "../constants";
import {
  getOpenAICompatibleClientConfig,
  getOpenAIModelId,
} from "./provider-config";

const THINKING_SUFFIX_REGEX = /-thinking$/;

// ---------------------------------------------------------------------------
// AI Gateway is preferred when AI_GATEWAY_API_KEY is configured.
// Direct OpenAI requires AI_PROVIDER_PATH=openai or no gateway key.
// ---------------------------------------------------------------------------

type OpenAIProvider = ReturnType<typeof createOpenAI>;
type OpenAIChatModel = ReturnType<OpenAIProvider["chat"]>;

let openaiProvider: OpenAIProvider | null = null;

function getOpenAIProvider(): OpenAIProvider {
  if (!openaiProvider) {
    const openaiClientConfig = isTestEnvironment
      ? { apiKey: "test-key" }
      : (() => {
          const config = getOpenAICompatibleClientConfig("AI SDK provider");
          return { apiKey: config.apiKey, baseURL: config.baseURL };
        })();
    openaiProvider = createOpenAI(openaiClientConfig);
  }

  return openaiProvider;
}

// ---------------------------------------------------------------------------
// DevTools middleware (local dev only — shows every step, tool call, prompt)
// Run `npx @ai-sdk/devtools` then open http://localhost:4983
// ---------------------------------------------------------------------------

let devToolsMiddlewareFn: (() => LanguageModelMiddleware) | null = null;
if (process.env.NODE_ENV === "development") {
  try {
    // Dynamic import so it's never bundled for production
    devToolsMiddlewareFn = require("@ai-sdk/devtools").devToolsMiddleware;
  } catch (error) {
    console.warn(JSON.stringify({
      event: "ai_devtools_middleware_unavailable",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

/**
 * Wraps a model with DevTools middleware in development.
 * In production, returns the model as-is (zero overhead).
 */
function withDevTools(model: OpenAIChatModel) {
  if (devToolsMiddlewareFn) {
    return wrapLanguageModel({ model, middleware: devToolsMiddlewareFn() });
  }
  return model;
}

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : null;

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  const isReasoningModel =
    modelId.includes("reasoning") || modelId.endsWith("-thinking");

  if (isReasoningModel) {
      const baseModelId = modelId.replace(THINKING_SUFFIX_REGEX, "");
    const openai = getOpenAIProvider();

    return wrapLanguageModel({
      model: openai.chat(getOpenAIModelId(baseModelId)),
      middleware: extractReasoningMiddleware({ tagName: "thinking" }),
    });
  }

  // Use openai.chat() to route through /v1/chat/completions.
  // The default openai() uses /v1/responses; this route still uses chat
  // completions until the app-specific tool loop is validated on Responses.
  const openai = getOpenAIProvider();
  return withDevTools(openai.chat(getOpenAIModelId(modelId)));
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  const openai = getOpenAIProvider();
  return withDevTools(openai.chat(getOpenAIModelId("gpt-4.1-nano")));
}

export function getArtifactModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("artifact-model");
  }
  const openai = getOpenAIProvider();
  return withDevTools(openai.chat(getOpenAIModelId("gpt-4.1-nano")));
}

/**
 * Shared AI SDK OpenAI-compatible provider.
 */
export { getOpenAIProvider as getGatewayProvider };
