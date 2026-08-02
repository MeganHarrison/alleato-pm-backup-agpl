import { defineAgent } from "eve";
import { createOpenAI } from "@ai-sdk/openai";

const configuredModel =
  process.env.EVE_ALLEATO_ASSISTANT_MODEL ?? "openai/gpt-5.6-luna";
const model =
  process.env.OPENAI_API_KEY && configuredModel.startsWith("openai/")
    ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(
        configuredModel.slice("openai/".length),
      )
    : configuredModel;

export default defineAgent({
  model,
  reasoning: "low",
});
