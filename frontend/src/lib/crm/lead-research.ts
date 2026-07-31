import "server-only";

import OpenAI from "openai";
import { z } from "zod";

import {
  getAiProviderPath,
  getOpenAICompatibleClientConfig,
  getOpenAIModelId,
} from "@/lib/ai/provider-config";

const HttpsUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine(
    (value) => URL.canParse(value) && new URL(value).protocol === "https:",
    "Only https:// source URLs are allowed.",
  );

const ResearchPayloadSchema = z
  .object({
    summary: z.string().trim().min(1).max(6000),
    suggestions: z
      .object({
        prospect_company_name: z.string().trim().max(300).optional(),
        job_title: z.string().trim().max(200).optional(),
        website_url: HttpsUrlSchema.optional(),
      })
      .strict()
      .refine(
        (value) => Object.keys(value).length > 0,
        "Research must include at least one supported suggestion.",
      ),
    citations: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(300),
          url: HttpsUrlSchema,
        }),
      )
      .min(1)
      .max(20),
  })
  .strict();

export type LeadResearchPayload = z.infer<typeof ResearchPayloadSchema>;

export async function researchLead(input: {
  fullName: string;
  prospectCompanyName: string;
  jobTitle: string | null;
  websiteUrl: string | null;
}): Promise<LeadResearchPayload> {
  if (getAiProviderPath() !== "openai") {
    throw new Error(
      "Lead web research requires the direct OpenAI provider path so public-web citations can be verified.",
    );
  }
  const config = getOpenAICompatibleClientConfig(
    "CRM lead public-web research",
  );
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  const response = await client.responses.create({
    model: getOpenAIModelId(
      process.env.CRM_LEAD_RESEARCH_MODEL?.trim() || "gpt-5-mini",
    ),
    tools: [{ type: "web_search" }],
    instructions: [
      "Research a business contact using only public professional and company web sources.",
      "Do not infer sensitive personal data. Do not scrape or reproduce private social-profile content.",
      "Return JSON only with summary, suggestions, and citations.",
      "Suggestions may include only prospect_company_name, job_title, and website_url. Social-profile URLs are manual-only and must never be proposed.",
      "Every suggested fact must be supported by at least one URL in citations. If uncertain, omit the suggestion.",
    ].join(" "),
    input: JSON.stringify(input),
  });
  const raw = response.output_text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/, "");
  return ResearchPayloadSchema.parse(JSON.parse(raw));
}
