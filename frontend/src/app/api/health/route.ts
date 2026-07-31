import { z } from "zod";
import { NextResponse } from "next/server";
import { GuardrailError } from "@/lib/guardrails/errors";
import { fetchWithPolicy } from "@/lib/guardrails/dependency";
import { validateResponseContract, withApiGuardrails } from "@/lib/guardrails/api";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.PYTHON_BACKEND_URL ||
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");
const HealthResponseSchema = z.object({
  status: z.literal("healthy"),
  backend: z.literal(true),
  openai_configured: z.boolean(),
  timestamp: z.string(),
});

export const GET = withApiGuardrails("/api/health#GET", async ({ requestId }) => {
  try {
    new URL(BACKEND_URL);
  } catch {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: "/api/health#GET",
      message:
        "Missing or invalid backend URL. Set BACKEND_URL or PYTHON_BACKEND_URL.",
      details: { BACKEND_URL, PYTHON_BACKEND_URL: process.env.PYTHON_BACKEND_URL },
    });
  }

  const backendResponse = await fetchWithPolicy(
    requestId,
    "/api/health#GET",
    "backend.health",
    `${BACKEND_URL}/health`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
    {
      timeoutMs: 5_000,
      maxRetries: 1,
      backoffMs: 250,
    },
  );

  const healthData = (await backendResponse.json()) as Record<string, unknown>;
  const responsePayload = validateResponseContract(
    HealthResponseSchema,
    {
      status: "healthy",
      backend: true,
      openai_configured: Boolean(healthData.openai_configured),
      timestamp: new Date().toISOString(),
    },
    "/api/health#GET",
  );

  if (responsePayload.backend !== true) {
    throw new GuardrailError({
      code: "SCHEMA_MISMATCH",
      where: "/api/health#GET",
      message: "Health contract check failed.",
    });
  }

  return NextResponse.json(responsePayload);
});
