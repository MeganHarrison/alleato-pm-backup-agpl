export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";

const WHERE = "/api/ai-assistant/skills#GET";
const SERVICE_MODULE_PATH = "@/lib/ai/services/skill-library-service";

interface SkillLibraryService {
  listVisibleAiSkills: (args: {
    userId: string;
    category?: string;
    scope?: string;
    projectId?: number;
  }) => Promise<unknown>;
}

async function loadSkillLibraryService(): Promise<SkillLibraryService> {
  try {
    const serviceModule = await import(SERVICE_MODULE_PATH);
    if (typeof serviceModule.listVisibleAiSkills !== "function") {
      throw new Error("Missing export listVisibleAiSkills.");
    }
    return serviceModule as SkillLibraryService;
  } catch (error) {
    throw new GuardrailError({
      code: "NOT_IMPLEMENTED",
      where: WHERE,
      message: "Skill Library service is not available.",
      status: 501,
      details: {
        expectedModule: SERVICE_MODULE_PATH,
        expectedExport:
          "listVisibleAiSkills({ userId, category?, scope?, projectId? }) => Promise<{ skills, filters }>",
        cause: error instanceof Error ? error.message : String(error),
        prevention:
          "S54 should land the schema-backed service before this route is treated as production-ready.",
      },
    });
  }
}

function readProjectId(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "projectId must be a positive integer.",
      status: 400,
    });
  }
  return parsed;
}

export const GET = withApiGuardrails(WHERE, async ({ request }) => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE,
      message: "Authentication required.",
      status: 401,
    });
  }

  const projectId = readProjectId(request.nextUrl.searchParams.get("projectId"));
  const service = await loadSkillLibraryService();
  const result = await service.listVisibleAiSkills({
    userId: user.id,
    category: request.nextUrl.searchParams.get("category") ?? undefined,
    scope: request.nextUrl.searchParams.get("scope") ?? undefined,
    projectId,
  });

  return NextResponse.json(result);
});
