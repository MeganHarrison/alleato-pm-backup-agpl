import {
  listActiveVisibleSkills,
  recordSkillUsage,
  SkillLibraryServiceError,
  type AiSkill,
} from "@/lib/ai/services/skill-library-service";
import type { Json } from "@/types/database.types";

export interface SkillInjectionUsageSummary {
  totalSelected: number;
  selectionReason: string;
  selectionSurface: string | null;
  skills: Array<{
    id: string;
    title: string;
    slug: string;
    category: string;
    scope: string;
    projectId: number | null;
    version: number;
    riskLevel: string;
    score: number;
    reasons: string[];
  }>;
}

export interface BuildSkillInjectionContextParams {
  userId: string;
  messageText: string;
  selectedProjectId?: number;
  surface?: string | null;
  allowedCategories?: string[];
  limit?: number;
}

export interface RecordSelectedSkillUsageParams {
  usage: SkillInjectionUsageSummary | null | undefined;
  userId: string;
  projectId?: number | null;
  sessionId?: string | null;
  surface: string;
  metadata?: Record<string, unknown>;
}

const CATEGORY_HINTS: Record<string, string[]> = {
  app_help: ["app", "page", "route", "where do i", "navigation", "feature", "permission"],
  drawing: ["drawing", "drawings", "plans", "cad", "sheet", "callout", "detail"],
  estimate: ["estimate", "estimating", "rsmeans", "cost", "budget", "forecast"],
  email: ["email", "outlook", "inbox", "draft", "reply"],
  pay_app_review: ["pay app", "payment application", "invoice", "stored materials", "retainage"],
  rfi: ["rfi", "request for information", "architect response"],
  schedule: ["schedule", "lead time", "delay", "critical path", "milestone"],
  submittal: ["submittal", "procurement", "shop drawing", "product data"],
  task: ["task", "follow up", "action item", "todo", "to-do"],
  teams: ["teams", "microsoft teams", "chat thread", "channel"],
  workflow: ["workflow", "process", "sop", "how should", "standard"],
};

const SURFACE_CATEGORY_HINTS: Record<string, string[]> = {
  ai_app_expert: ["app_help"],
  ai_assistant_app_help: ["app_help"],
  app_expert: ["app_help"],
  executive_email: ["email"],
  microsoft_executive_assistant: ["email", "teams"],
  microsoft_teams: ["teams"],
  outlook_assistant: ["email"],
  teams: ["teams"],
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "alleato",
  "also",
  "before",
  "being",
  "could",
  "from",
  "have",
  "into",
  "just",
  "like",
  "more",
  "need",
  "should",
  "that",
  "their",
  "there",
  "these",
  "this",
  "what",
  "when",
  "where",
  "with",
  "would",
]);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !STOP_WORDS.has(word)),
  );
}

function includesPhrase(haystack: string, phrase: string): boolean {
  return haystack.includes(normalizeText(phrase));
}

function isExplicitSkillRequest(message: string): boolean {
  return /\b(skill|skills|playbook|standard|procedure|how should alleato|teach alleato)\b/i.test(
    message,
  );
}

function normalizeSurface(value: string | null | undefined): string | null {
  const normalized = normalizeText(value ?? "").replaceAll(" ", "_");
  return normalized || null;
}

function scoreSkill(params: {
  skill: AiSkill;
  normalizedMessage: string;
  messageTokens: Set<string>;
  selectedProjectId?: number;
  explicitSkillRequest: boolean;
  selectionSurface: string | null;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const categoryHints = CATEGORY_HINTS[params.skill.category] ?? [];
  const matchedCategoryHints = categoryHints.filter((hint) =>
    includesPhrase(params.normalizedMessage, hint),
  );
  if (matchedCategoryHints.length > 0) {
    score += 80 + Math.min(matchedCategoryHints.length * 5, 20);
    reasons.push(`category:${params.skill.category}`);
  }

  if (
    params.selectionSurface &&
    (SURFACE_CATEGORY_HINTS[params.selectionSurface] ?? []).includes(
      params.skill.category,
    )
  ) {
    score += 55;
    reasons.push(`surface:${params.selectionSurface}`);
  }

  if (
    params.selectedProjectId &&
    params.skill.scopeType === "project" &&
    params.skill.projectId === params.selectedProjectId
  ) {
    score += 45;
    reasons.push("selected-project");
  }

  const skillTokens = tokenize(
    [
      params.skill.title,
      params.skill.summary,
      params.skill.category,
      params.skill.instructions.slice(0, 1200),
    ].join(" "),
  );
  const overlap = [...params.messageTokens].filter((token) => skillTokens.has(token));
  if (overlap.length > 0) {
    score += Math.min(overlap.length * 8, 48);
    reasons.push(`keyword-overlap:${overlap.slice(0, 4).join(",")}`);
  }

  if (params.explicitSkillRequest) {
    score += 20;
    reasons.push("explicit-skill-request");
  }

  score += Math.min(params.skill.usageCount, 10);

  return { score, reasons };
}

function renderSkillBlock(skills: AiSkill[], usage: SkillInjectionUsageSummary): string {
  const renderedSkills = skills
    .map((skill) => {
      const examples = skill.examples
        .slice(0, 2)
        .map((example) => {
          const input = example.input ? `Input: ${example.input}` : null;
          const output = example.output ? `Output: ${example.output}` : null;
          const notes = example.notes ? `Notes: ${example.notes}` : null;
          return [input, output, notes].filter(Boolean).join(" | ");
        })
        .filter(Boolean);

      return [
        `### ${skill.title} (v${skill.version}, ${skill.category}, ${skill.riskLevel} risk)`,
        `Summary: ${skill.summary}`,
        `Instructions: ${skill.instructions}`,
        examples.length > 0 ? `Examples:\n${examples.map((item) => `- ${item}`).join("\n")}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return [
    "## Approved Skill Library Context",
    "Use these approved skills only when they directly apply to the user's request.",
    "Priority order: system/developer instructions > current source evidence and structured project data > user instructions > durable memory > approved skills.",
    "If a skill conflicts with current source evidence, follow the source evidence and mention the conflict briefly. High-risk skills may guide drafting or review, but they do not authorize irreversible writes without normal confirmation.",
    `Selected ${usage.totalSelected} skill${usage.totalSelected === 1 ? "" : "s"} because: ${usage.selectionReason}.`,
    renderedSkills,
  ].join("\n\n");
}

export async function buildSkillInjectionContext(
  params: BuildSkillInjectionContextParams,
): Promise<{ block: string; usage: SkillInjectionUsageSummary | null }> {
  const normalizedMessage = normalizeText(params.messageText);
  const messageTokens = tokenize(params.messageText);
  const explicitSkillRequest = isExplicitSkillRequest(params.messageText);
  const selectionSurface = normalizeSurface(params.surface);
  const candidates = await listActiveVisibleSkills({
    viewerUserId: params.userId,
    viewerProjectIds: params.selectedProjectId ? [params.selectedProjectId] : [],
    limit: 25,
  });
  const allowedCategories = new Set(params.allowedCategories ?? []);
  const categoryBoundCandidates =
    allowedCategories.size > 0
      ? candidates.filter((skill) => allowedCategories.has(skill.category))
      : candidates;

  const scored = categoryBoundCandidates
    .map((skill) => {
      const scoredSkill = scoreSkill({
        skill,
        normalizedMessage,
        messageTokens,
        selectedProjectId: params.selectedProjectId,
        explicitSkillRequest,
        selectionSurface,
      });
      return { skill, ...scoredSkill };
    })
    .filter((item) => item.score > 0 && item.reasons.length > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, params.limit ?? 4);

  if (scored.length === 0) {
    return { block: "", usage: null };
  }

  const usage: SkillInjectionUsageSummary = {
    totalSelected: scored.length,
    selectionReason: [
      explicitSkillRequest
        ? "explicit skill/playbook language or matching approved skill content"
        : null,
      selectionSurface ? `surface ${selectionSurface}` : null,
      "category, project, and keyword relevance",
    ]
      .filter(Boolean)
      .join("; "),
    selectionSurface,
    skills: scored.map(({ skill, score, reasons }) => ({
      id: skill.id,
      title: skill.title,
      slug: skill.slug,
      category: skill.category,
      scope: skill.scopeType,
      projectId: skill.projectId,
      version: skill.version,
      riskLevel: skill.riskLevel,
      score,
      reasons,
    })),
  };

  return {
    block: renderSkillBlock(scored.map((item) => item.skill), usage),
    usage,
  };
}

export async function recordSelectedSkillUsage(
  params: RecordSelectedSkillUsageParams,
): Promise<void> {
  if (!params.usage || params.usage.skills.length === 0) return;

  await Promise.all(
    params.usage.skills.map((skill) =>
      recordSkillUsage({
        skillId: skill.id,
        userId: params.userId,
        projectId: params.projectId ?? null,
        sessionId: params.sessionId ?? null,
        surface: params.surface,
        outcome: "used",
        metadata: {
          ...(params.metadata ?? {}),
          category: skill.category,
          version: skill.version,
          score: skill.score,
          reasons: skill.reasons,
        } as Json,
      }).catch((error) => {
        if (error instanceof SkillLibraryServiceError) {
          console.error("[skill-injection] failed to record skill usage", {
            skillId: skill.id,
            action: error.action,
            message: error.message,
          });
          return;
        }
        throw error;
      }),
    ),
  );
}
