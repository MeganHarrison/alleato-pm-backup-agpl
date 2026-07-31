export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/app/api/admin/_shared";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

const GET_WHERE = "/api/admin/ai-skills#GET";
const PATCH_WHERE = "/api/admin/ai-skills#PATCH";
const SERVICE_MODULE_PATH = "@/lib/ai/services/skill-library-service";

const updateSkillSchema = z.object({
  skillId: z.string().min(1),
  status: z.string().trim().min(1).max(80).optional(),
  isActive: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  reviewerNotes: z.string().trim().max(2000).optional(),
});

interface SkillLibraryAdminService {
  listAdminAiSkills: (args: {
    category?: string;
    scope?: string;
    projectId?: number;
    status?: string;
  }) => Promise<unknown>;
  updateAiSkillAdminState?: (args: z.infer<typeof updateSkillSchema>) => Promise<unknown>;
}

async function loadSkillLibraryAdminService(where: string): Promise<SkillLibraryAdminService> {
  try {
    const serviceModule = await import(SERVICE_MODULE_PATH);
    if (typeof serviceModule.listAdminAiSkills !== "function") {
      throw new Error("Missing export listAdminAiSkills.");
    }
    return serviceModule as SkillLibraryAdminService;
  } catch (error) {
    throw new GuardrailError({
      code: "NOT_IMPLEMENTED",
      where,
      message: "Skill Library admin service is not available.",
      status: 501,
      details: {
        expectedModule: SERVICE_MODULE_PATH,
        expectedExports: [
          "listAdminAiSkills({ category?, scope?, projectId?, status? }) => Promise<{ skills, filters }>",
          "updateAiSkillAdminState({ skillId, status?, isActive?, isVisible?, reviewerNotes? }) => Promise<{ skill }>",
        ],
        cause: error instanceof Error ? error.message : String(error),
        prevention:
          "S54 should land the schema-backed service before this route is treated as production-ready.",
      },
    });
  }
}

function readProjectId(value: string | null, where: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: "projectId must be a positive integer.",
      status: 400,
    });
  }
  return parsed;
}

export const GET = withApiGuardrails(GET_WHERE, async ({ request }) => {
  await requireAdmin(GET_WHERE);
  const projectId = readProjectId(request.nextUrl.searchParams.get("projectId"), GET_WHERE);
  const service = await loadSkillLibraryAdminService(GET_WHERE);
  const result = await service.listAdminAiSkills({
    category: request.nextUrl.searchParams.get("category") ?? undefined,
    scope: request.nextUrl.searchParams.get("scope") ?? undefined,
    projectId,
    status: request.nextUrl.searchParams.get("status") ?? undefined,
  });

  return NextResponse.json(result);
});

export const PATCH = withApiGuardrails(PATCH_WHERE, async ({ request }) => {
  await requireAdmin(PATCH_WHERE);
  const service = await loadSkillLibraryAdminService(PATCH_WHERE);
  if (typeof service.updateAiSkillAdminState !== "function") {
    throw new GuardrailError({
      code: "NOT_IMPLEMENTED",
      where: PATCH_WHERE,
      message: "Skill Library admin update service is not available.",
      status: 501,
      details: {
        expectedExport:
          "updateAiSkillAdminState({ skillId, status?, isActive?, isVisible?, reviewerNotes? }) => Promise<{ skill }>",
      },
    });
  }

  const body = await parseJsonBody(request, updateSkillSchema, PATCH_WHERE);
  const result = await service.updateAiSkillAdminState(body);
  return NextResponse.json(result);
});
