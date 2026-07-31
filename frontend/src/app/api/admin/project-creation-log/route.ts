import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { requireAppAdmin } from "@/lib/auth/require-app-admin";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const WHERE = "api.admin.project-creation-log#GET";
const MAX_PER_PAGE = 200;
const CREATION_SOURCES = new Set([
  "web_app",
  "api",
  "test_bootstrap",
  "acumatica_sync",
  "import",
  "automation",
  "direct_database",
  "legacy_unknown",
]);
const ATTRIBUTION_STATUSES = new Set(["complete", "legacy_gap"]);

function positiveInteger(
  raw: string | null,
  fallback: number,
  maximum?: number,
) {
  const parsed = Number.parseInt(raw ?? "", 10);
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return maximum ? Math.min(value, maximum) : value;
}

function safeSearchTerm(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s._-]/gu, " ")
    .replace(/[%_]/g, (match) => `\\${match}`)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function displayProjectNumber(value: string | null) {
  const normalized = value?.trim();
  if (
    !normalized ||
    !/^[\p{L}\p{N}][\p{L}\p{N}\s._/#-]{0,79}$/u.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export const GET = withApiGuardrails(WHERE, async ({ request }) => {
  await requireAppAdmin(WHERE);
  const serviceDb = createServiceClient();

  const url = new URL(request.url);
  const page = positiveInteger(url.searchParams.get("page"), 1);
  const perPage = positiveInteger(
    url.searchParams.get("perPage"),
    50,
    MAX_PER_PAGE,
  );
  const search = safeSearchTerm(url.searchParams.get("search") ?? "");
  const createdVia = url.searchParams.get("created_via") ?? "";
  const attributionStatus = url.searchParams.get("attribution_status") ?? "";

  if (createdVia && !CREATION_SOURCES.has(createdVia)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Unknown project creation source filter.",
      status: 400,
      details: { createdVia },
    });
  }
  if (attributionStatus && !ATTRIBUTION_STATUSES.has(attributionStatus)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: WHERE,
      message: "Unknown project attribution status filter.",
      status: 400,
      details: { attributionStatus },
    });
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = serviceDb
    .from("project_creation_audit_log")
    .select(
      "id,project_id,project_name,project_number,created_by,created_via,creation_request_id,creation_run_id,created_at,attribution_status,project_exists",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    const filters = [
      `project_name.ilike.%${search}%`,
      `project_number.ilike.%${search}%`,
    ];
    if (/^\d+$/.test(search)) {
      filters.push(`project_id.eq.${search}`);
    }
    query = query.or(filters.join(","));
  }
  if (createdVia) {
    query = query.eq("created_via", createdVia);
  }
  if (attributionStatus) {
    query = query.eq("attribution_status", attributionStatus);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: WHERE,
      message: "Failed to load the project creation log.",
      details: { reason: error.message },
      cause: error,
    });
  }

  const rows = data ?? [];
  const userIds = [
    ...new Set(
      rows
        .map((row) => row.created_by)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];
  const actorNames = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await serviceDb
      .from("user_profiles")
      .select("id,full_name,email")
      .in("id", userIds);

    if (profileError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: WHERE,
        message: "Failed to resolve project creator names.",
        details: { reason: profileError.message },
        cause: profileError,
      });
    }

    for (const profile of profiles ?? []) {
      actorNames.set(
        profile.id,
        profile.full_name?.trim() || profile.email?.trim() || profile.id,
      );
    }
  }

  const items = rows.map((row) => {
    if (!row.id || !row.created_at) {
      throw new GuardrailError({
        code: "SCHEMA_MISMATCH",
        where: WHERE,
        message:
          "Project creation evidence is missing its event identity or timestamp.",
        details: { projectId: row.project_id },
      });
    }

    return {
      id: row.id,
      project_id: row.project_id,
      project_name: row.project_name,
      project_number: displayProjectNumber(row.project_number),
      created_by: row.created_by,
      created_by_name: row.created_by
        ? (actorNames.get(row.created_by) ?? null)
        : null,
      created_via: row.created_via ?? "legacy_unknown",
      creation_request_id: row.creation_request_id,
      creation_run_id: row.creation_run_id,
      created_at: row.created_at,
      attribution_status:
        row.attribution_status === "complete" ? "complete" : "legacy_gap",
      project_exists: row.project_exists === true,
    };
  });

  return Response.json({ items, total: count ?? 0, page, perPage });
});
