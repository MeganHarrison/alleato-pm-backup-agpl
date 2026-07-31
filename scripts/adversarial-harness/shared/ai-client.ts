import { createOpenAI } from "@ai-sdk/openai";
import "dotenv/config";

// Mirror the provider setup in frontend/src/lib/ai/providers.ts — same gateway, same env vars
const useGateway = !!process.env.AI_GATEWAY_API_KEY;

export const openai = createOpenAI(
  useGateway
    ? {
        apiKey: process.env.AI_GATEWAY_API_KEY,
        baseURL: "https://ai-gateway.vercel.sh/v1",
      }
    : {
        apiKey: process.env.OPENAI_API_KEY,
      },
);

export function getModel(modelId: string) {
  return openai.chat(modelId);
}
