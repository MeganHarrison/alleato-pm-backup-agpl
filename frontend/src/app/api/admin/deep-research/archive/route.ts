import { NextResponse } from "next/server";

import { requireAdmin } from "@/app/api/admin/_shared";
import { fetchWithPolicy } from "@/lib/guardrails/dependency";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const dynamic = "force-dynamic";

const WHERE = "api.admin.deep-research.archive#GET";
const ARCHIVE_DEPENDENCY = "backend.deep-agent-llm-wiki.archive";

function isMissingArchiveEndpoint(error: unknown): error is GuardrailError {
  if (!(error instanceof GuardrailError)) {
    return false;
  }

  if (error.code !== "UPSTREAM_FAILURE") {
    return false;
  }

  const details =
    error.details && typeof error.details === "object"
      ? (error.details as Record<string, unknown>)
      : null;

  return details?.dependency === ARCHIVE_DEPENDENCY && details?.status === 404;
}

function getBackendUrl(): string {
  const rawUrl = (
    process.env.BACKEND_URL ||
    process.env.PYTHON_BACKEND_URL ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "")
  )
    .replace(/\/+$/, "")
    .trim();

  try {
    new URL(rawUrl);
  } catch {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: WHERE,
      message:
        "Missing or invalid backend URL. Set BACKEND_URL or PYTHON_BACKEND_URL before browsing Deep Agents research archives.",
      status: 503,
      details: {
        BACKEND_URL: process.env.BACKEND_URL,
        PYTHON_BACKEND_URL: process.env.PYTHON_BACKEND_URL,
      },
    });
  }

  return rawUrl;
}

function getBackendAdminApiKey(): string {
  const apiKey = process.env.ADMIN_API_KEY?.trim();
  if (!apiKey) {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: WHERE,
      message:
        "ADMIN_API_KEY is required to browse backend Deep Agents research archives.",
      status: 503,
    });
  }
  return apiKey;
}

export const GET = withApiGuardrails(WHERE, async ({ request, requestId }) => {
  await requireAdmin(WHERE);

  const backendUrl = new URL(
    `${getBackendUrl()}/api/intelligence/deep-agent/llm-wiki/archive`,
  );
  for (const key of ["userId", "topicSlug", "sessionId", "limit"] as const) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) backendUrl.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetchWithPolicy(
      requestId,
      WHERE,
      ARCHIVE_DEPENDENCY,
      backendUrl.toString(),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Admin-Api-Key": getBackendAdminApiKey(),
        },
        cache: "no-store",
      },
      {
        timeoutMs: 25_000,
        maxRetries: 1,
        backoffMs: 250,
      },
    );
  } catch (error) {
    if (isMissingArchiveEndpoint(error)) {
      return NextResponse.json({
        projects: [],
        selectedProject: null,
        artifacts: [],
      });
    }
    throw error;
  }

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
});
