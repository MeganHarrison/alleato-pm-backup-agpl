import { defineAgent } from "eve";

export default defineAgent({
  model: process.env.EVE_DOCS_MAINTAINER_MODEL ?? "openai/gpt-5.4-mini",
  reasoning: "low",
});
