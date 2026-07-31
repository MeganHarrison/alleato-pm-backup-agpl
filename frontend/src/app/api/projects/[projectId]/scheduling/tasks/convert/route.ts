import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type BackendConvertResponse = {
  tasks: unknown[];
  source_format: string;
  task_count: number;
};

function normalizeBackendUrl(): string {
  const backendUrl = (process.env.BACKEND_URL || process.env.PYTHON_BACKEND_URL || "").trim();
  if (!backendUrl) {
    throw new GuardrailError({
      code: "CONFIGURATION_ERROR",
      where: "projects/[projectId]/scheduling/tasks/convert#POST",
      message: "Missing backend URL. Set BACKEND_URL or PYTHON_BACKEND_URL.",
      status: 503,
      severity: "high",
    });
  }
  return backendUrl.replace(/\/+$/, "");
}

function parseBackendError(status: number, body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return `Microsoft Project conversion failed (HTTP ${status}).`;
}

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/scheduling/tasks/convert#POST",
  async ({ request, params }) => {
    const { projectId } = params;
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/scheduling/tasks/convert#POST",
        message: "Authentication required.",
      });
    }

    const adminKey = process.env.ADMIN_API_KEY?.trim();
    if (!adminKey) {
      throw new GuardrailError({
        code: "CONFIGURATION_ERROR",
        where: "projects/[projectId]/scheduling/tasks/convert#POST",
        message: "ADMIN_API_KEY is not configured.",
        status: 503,
        severity: "high",
      });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A Microsoft Project file is required." }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".mpp") && !fileName.endsWith(".mpt") && !fileName.endsWith(".xml")) {
      return NextResponse.json(
        { error: "Upload a Microsoft Project .mpp, .mpt, or XML file." },
        { status: 400 },
      );
    }

    const backendFormData = new FormData();
    backendFormData.append("file", file, file.name);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    let response: Response;
    try {
      const convertUrl = new URL("/api/scheduling/microsoft-project/convert", normalizeBackendUrl());
      convertUrl.searchParams.set("project_id", projectId);
      response = await fetch(convertUrl, {
        method: "POST",
        headers: {
          "x-admin-api-key": adminKey,
        },
        body: backendFormData,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new GuardrailError({
          code: "UPSTREAM_TIMEOUT",
          where: "projects/[projectId]/scheduling/tasks/convert#POST",
          message: "Microsoft Project conversion timed out.",
          status: 504,
          severity: "high",
        });
      }
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "projects/[projectId]/scheduling/tasks/convert#POST",
        message: error instanceof Error ? error.message : "Microsoft Project conversion failed.",
        status: 502,
        severity: "high",
      });
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: parseBackendError(response.status, payload) }, { status: response.status });
    }

    return NextResponse.json(payload as BackendConvertResponse);
  },
);
