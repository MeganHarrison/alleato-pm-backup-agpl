import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

const LabelSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
});

const ReviewerRuleSchema = z.object({
  paths: z.array(z.string().min(1)).min(1),
  suggest: z.array(z.string().min(1)).min(1),
});

const RiskSchema = z
  .object({
    levels: z.array(z.string().min(1)).default(["low", "medium", "high"]),
    signals: z.record(z.string(), z.array(z.string())).default({}),
  })
  .default({ levels: ["low", "medium", "high"], signals: {} });

const TriageConfigSchema = z.object({
  labels: z.array(LabelSchema).default([]),
  risk: RiskSchema,
  reviewers: z.array(ReviewerRuleSchema).default([]),
});

export type TriageConfig = z.infer<typeof TriageConfigSchema>;

const TRIAGE_YML_PATH = join(process.cwd(), "triage.yml");

let cache: { raw: string; config: TriageConfig } | null = null;

function load(): { raw: string; config: TriageConfig } {
  if (cache) return cache;
  const raw = readFileSync(TRIAGE_YML_PATH, "utf8");
  const config = TriageConfigSchema.parse(parseYaml(raw));
  cache = { raw, config };
  return cache;
}

export function loadTriageConfig(): TriageConfig {
  return load().config;
}

export function triageRulesetYaml(): string {
  return load().raw.trim();
}
