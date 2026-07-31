import "server-only";

import { z } from "zod";

import { GuardrailError } from "@/lib/guardrails/errors";

const finderOutcomeSchema = z.object({
  title: z.string(),
  url: z.string().nullable().optional(),
  decision: z.enum([
    "inserted",
    "would_insert",
    "duplicate",
    "rejected",
    "failed",
  ]),
  reasonCode: z.string(),
  detail: z.string(),
  resourceId: z.string().nullable().optional(),
});

const finderResponseSchema = z.object({
  status: z.enum(["completed", "partial", "failed"]),
  query: z.string(),
  roleSlug: z.string(),
  topicSlug: z.string(),
  dryRun: z.boolean(),
  searchedCount: z.number().int().nonnegative(),
  acceptedCount: z.number().int().nonnegative(),
  insertedCount: z.number().int().nonnegative(),
  duplicateCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  outcomes: z.array(finderOutcomeSchema),
});

export type TrainingFinderAdminResult = z.infer<typeof finderResponseSchema>;

export type TrainingFinderAdminInput = {
  roleSlug: string;
  topicSlug: string;
};

type TrainingFinderAdminOptions = {
  backendUrl?: string;
  adminApiKey?: string;
  requestId?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

function configuredBackendUrl(override?: string) {
  const value = (
    override ??
    process.env.BACKEND_URL ??
    process.env.PYTHON_BACKEND_URL ??
    ""
  )
    .trim()
    .replace(/\/+$/, "");

  try {
    return new URL(value).toString().replace(/\/+$/, "");
  } catch {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: "training.adminFinder.backendUrl",
      message:
        "Training resource discovery is unavailable because BACKEND_URL or PYTHON_BACKEND_URL is missing or invalid.",
      status: 503,
    });
  }
}

function configuredAdminApiKey(override?: string) {
  const value = (override ?? process.env.ADMIN_API_KEY ?? "").trim();
  if (!value) {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: "training.adminFinder.adminApiKey",
      message:
        "Training resource discovery is unavailable because ADMIN_API_KEY is not configured.",
      status: 503,
    });
  }
  return value;
}

function backendFailureMessage(
  status: number,
  payload: unknown,
  requestId: string,
) {
  const parsed = z.object({ detail: z.string().min(1) }).safeParse(payload);
  const detail = parsed.success
    ? parsed.data.detail
    : `backend returned HTTP ${status}`;
  return `Training resource discovery failed: ${detail} (request ${requestId}).`;
}

export async function runTrainingResourceFinderAdmin(
  input: TrainingFinderAdminInput,
  options: TrainingFinderAdminOptions = {},
): Promise<TrainingFinderAdminResult> {
  const requestId = options.requestId ?? crypto.randomUUID();
  const fetcher = options.fetcher ?? fetch;
  const backendUrl = configuredBackendUrl(options.backendUrl);
  const adminApiKey = configuredAdminApiKey(options.adminApiKey);
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 120_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetcher(
      `${backendUrl}/api/admin/training/resources/find`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Admin-Api-Key": adminApiKey,
          "X-Request-Id": requestId,
        },
        body: JSON.stringify({
          roleSlug: input.roleSlug,
          topicSlug: input.topicSlug,
          maxSearchResults: 8,
          maxInserts: 3,
          dryRun: false,
        }),
        cache: "no-store",
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GuardrailError({
        code: "UPSTREAM_TIMEOUT",
        where: "training.adminFinder.fetch",
        message: `Training resource discovery exceeded ${timeoutMs}ms (request ${requestId}). Check the backend provider status before retrying.`,
        status: 504,
        details: { requestId, timeoutMs },
      });
    }
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "training.adminFinder.fetch",
      message: `Training resource discovery could not reach the backend (request ${requestId}): ${
        error instanceof Error ? error.message : String(error)
      }`,
      status: 502,
      details: { requestId },
    });
  } finally {
    clearTimeout(timeout);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "training.adminFinder.response",
      message: backendFailureMessage(response.status, payload, requestId),
      status: 502,
      details: { requestId, backendStatus: response.status },
    });
  }

  const parsed = finderResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "training.adminFinder.response",
      message: `Training resource discovery returned an invalid response contract (request ${requestId}).`,
      status: 502,
      details: {
        requestId,
        validation: parsed.error.flatten(),
      },
    });
  }
  if (parsed.data.dryRun) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "training.adminFinder.response",
      message: `Training resource discovery unexpectedly ran in read-only mode (request ${requestId}); no review candidates were created.`,
      status: 502,
      details: { requestId },
    });
  }

  return parsed.data;
}
