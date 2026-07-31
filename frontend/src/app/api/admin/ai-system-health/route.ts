import { withApiGuardrails } from "@/lib/guardrails/api";
import { requireAdmin } from "@/app/api/admin/_shared";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { estimateCostWithFallback, extractModelId } from "@/lib/ai/model-pricing";
import { GuardrailError } from "@/lib/guardrails/errors";

export const dynamic = "force-dynamic";

const WHERE = "api.admin.ai-system-health#GET";
const SAMPLE_LIMIT = 5000;
const DAYS_BACK = 30;
const DEFAULT_SOURCE_COVERAGE_DAYS = 14;
const SOURCE_COVERAGE_LIMIT = 1500;
const ALLOWED_SOURCE_COVERAGE_WINDOWS = new Set([1, 3, 7, 14]);

type MetricsWindow = {
  conversations: number;
  messages: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  feedbackUp: number;
  feedbackDown: number;
};

type SourceCoverageRow = {
  family: string;
  label: string;
  sourceRowsInRange: number;
  docsWithEmbeddedChunks: number;
  terminalUnembeddable: number;
  actionableMissingEmbeddings: number;
  coverageRatio: number | null;
  newestSourceCreatedAt: string | null;
  missingSamples: { id: string; title: string | null; createdAt: string | null }[];
};

function emptyWindow(): MetricsWindow {
  return { conversations: 0, messages: 0, inputTokens: 0, outputTokens: 0, cost: 0, feedbackUp: 0, feedbackDown: 0 };
}

function msAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function parseIsoDateParam(value: string | null, field: "from" | "to"): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new GuardrailError({
      code: "INVALID_INPUT",
      where: WHERE,
      message: `Invalid ${field} date. Use YYYY-MM-DD.`,
    });
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new GuardrailError({
      code: "INVALID_INPUT",
      where: WHERE,
      message: `Invalid ${field} date. Use YYYY-MM-DD.`,
    });
  }

  return parsed;
}

function resolveSourceCoverageRange(searchParams: URLSearchParams): {
  days: number;
  from: string;
  to: string;
  preset: "1d" | "3d" | "7d" | "14d" | "custom";
} {
  const fromParam = parseIsoDateParam(searchParams.get("coverageFrom"), "from");
  const toParam = parseIsoDateParam(searchParams.get("coverageTo"), "to");

  if (fromParam || toParam) {
    if (!fromParam || !toParam) {
      throw new GuardrailError({
        code: "INVALID_INPUT",
        where: WHERE,
        message: "Custom source coverage requires both start and end dates.",
      });
    }

    const from = startOfUtcDay(fromParam);
    const to = endOfUtcDay(toParam);
    if (from.getTime() > to.getTime()) {
      throw new GuardrailError({
        code: "INVALID_INPUT",
        where: WHERE,
        message: "Custom source coverage start date must be on or before the end date.",
      });
    }

    const diffDays = Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    return {
      days: diffDays,
      from: from.toISOString(),
      to: to.toISOString(),
      preset: "custom",
    };
  }

  const windowParam = Number.parseInt(
    searchParams.get("coverageWindowDays") ?? String(DEFAULT_SOURCE_COVERAGE_DAYS),
    10,
  );
  const days = ALLOWED_SOURCE_COVERAGE_WINDOWS.has(windowParam)
    ? windowParam
    : DEFAULT_SOURCE_COVERAGE_DAYS;
  const today = startOfUtcDay(new Date());
  const from = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const to = endOfUtcDay(today);

  return {
    days,
    from: from.toISOString(),
    to: to.toISOString(),
    preset: `${days}d` as "1d" | "3d" | "7d" | "14d",
  };
}

function sourceFamily(row: Record<string, unknown>): SourceCoverageRow["family"] | null {
  const source = String(row.source ?? "");
  const category = String(row.category ?? "");
  const sourceSystem = String(row.source_system ?? "");

  if (source === "fireflies") return "meeting_transcripts";
  if (source !== "microsoft_graph") return null;
  if (category === "email") return "emails";
  if (category === "teams_message") return "teams_messages";
  if (category === "document" && sourceSystem === "sharepoint") return "sharepoint_documents";
  if (category === "document") return "onedrive_documents";
  return null;
}

function familyLabel(family: string): string {
  switch (family) {
    case "meeting_transcripts":
      return "Meeting transcripts";
    case "emails":
      return "Emails";
    case "teams_messages":
      return "Teams messages";
    case "sharepoint_documents":
      return "SharePoint documents";
    case "onedrive_documents":
      return "OneDrive documents";
    default:
      return family.replaceAll("_", " ");
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sanitizePipelineErrorMessage(message: string | null | undefined): string {
  const trimmed = message?.trim();
  if (!trimmed) return "No error message recorded.";

  const lowered = trimmed.toLowerCase();
  if (lowered.includes("error code 522") || lowered.includes("code': 522") || lowered.includes('code": 522')) {
    return "Supabase timed out (Cloudflare 522 Connection timed out).";
  }
  if (lowered.includes("error code 521") || lowered.includes("code': 521") || lowered.includes('code": 521')) {
    return "Supabase is unavailable (Cloudflare 521 Web server is down).";
  }
  if (lowered.includes("<!doctype html") || lowered.includes("<html") || lowered.includes("cloudflare ray id")) {
    return "Upstream service returned an HTML error page instead of a structured failure message.";
  }

  const compact = trimmed.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return compact.slice(0, 300);
}

async function addEmbeddedChunkDocumentIds(
  ragSupabase: ReturnType<typeof createRagServiceClient>,
  documentIds: string[],
  target: Set<string>,
) {
  const pageSize = 1000;
  for (const batch of chunk(documentIds, 100)) {
    let offset = 0;
    while (true) {
      const { data: chunkRows, error: chunkError } = await ragSupabase
        .from("document_chunks")
        .select("document_id")
        .in("document_id", batch)
        .not("embedding", "is", null)
        .range(offset, offset + pageSize - 1);
      if (chunkError) throw new Error(`source coverage document_chunks query failed: ${chunkError.message}`);
      for (const row of chunkRows ?? []) {
        if (row.document_id) target.add(String(row.document_id));
      }
      if (!chunkRows || chunkRows.length < pageSize) break;
      offset += pageSize;
    }
  }
}

export const GET = withApiGuardrails(WHERE, async ({ request }) => {
  await requireAdmin(WHERE);
  const supabase = createServiceClient();
  const ragSupabase = createRagServiceClient();
  const generatedAt = new Date().toISOString();
  const since30d = msAgo(24 * DAYS_BACK);
  const sourceCoverageRange = resolveSourceCoverageRange(request.nextUrl.searchParams);

  // Pull all chat_history rows from last 30 days (capped at SAMPLE_LIMIT)
  const { data: rows, error: chatError } = await serviceDb.from("chat_history")
    .select("id, session_id, role, metadata, created_at")
    .gte("created_at", since30d)
    .order("created_at", { ascending: false })
    .limit(SAMPLE_LIMIT);

  if (chatError) throw new Error(`chat_history query failed: ${chatError.message}`);

  const sampleTruncated = (rows?.length ?? 0) === SAMPLE_LIMIT;
  const sampleSize = rows?.length ?? 0;

  const now = Date.now();
  const cutoff24h = now - 24 * 60 * 60 * 1000;
  const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;

  const windows = {
    last24h: emptyWindow(),
    last7d: emptyWindow(),
    last30d: emptyWindow(),
  };

  // 30-day daily series (date → metrics)
  const seriesMap: Record<string, { date: string; messages: number; tokens: number; cost: number }> = {};
  for (let i = 0; i < DAYS_BACK; i++) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    seriesMap[key] = { date: key, messages: 0, tokens: 0, cost: 0 };
  }

  const modelBreakdownMap: Record<
    string,
    { model: string; provider: string; calls: number; inputTokens: number; outputTokens: number; cost: number; estimated: boolean }
  > = {};

  const sessionsSeen24h = new Set<string>();
  const sessionsSeen7d = new Set<string>();
  const sessionsSeen30d = new Set<string>();

  let totalToolCalls = 0;
  let messagesWithToolTrace = 0;
  let messagesWithUnknownModel = 0;
  let assistantMessages30d = 0;

  for (const row of rows ?? []) {
    const ts = new Date(row.created_at as string).getTime();
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const sid = row.session_id as string;

    // Feedback rows
    if (row.role === "system" && meta.type === "feedback") {
      const fb = meta.feedback as string | undefined;
      if (fb === "up" || fb === "down") {
        const bump = (w: MetricsWindow) => { if (fb === "up") w.feedbackUp++; else w.feedbackDown++; };
        if (ts >= cutoff24h) bump(windows.last24h);
        if (ts >= cutoff7d) bump(windows.last7d);
        bump(windows.last30d);
      }
      continue;
    }

    // Only assistant messages carry usage/model data
    if (row.role !== "assistant") continue;

    assistantMessages30d++;

    const usage = meta.usage as { inputTokens?: number; outputTokens?: number } | null | undefined;
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    const modelId = extractModelId(meta);

    const { cost, pricing, matchedModel } = estimateCostWithFallback(modelId, inputTokens, outputTokens);
    if (!matchedModel) messagesWithUnknownModel++;

    const tokens = inputTokens + outputTokens;
    const dayKey = new Date(ts).toISOString().slice(0, 10);
    if (seriesMap[dayKey]) {
      seriesMap[dayKey].messages++;
      seriesMap[dayKey].tokens += tokens;
      seriesMap[dayKey].cost += cost;
    }

    const bump = (w: MetricsWindow, sessions: Set<string>) => {
      w.messages++;
      w.inputTokens += inputTokens;
      w.outputTokens += outputTokens;
      w.cost += cost;
      if (sid) sessions.add(sid);
    };
    if (ts >= cutoff24h) bump(windows.last24h, sessionsSeen24h);
    if (ts >= cutoff7d) bump(windows.last7d, sessionsSeen7d);
    bump(windows.last30d, sessionsSeen30d);

    // Per-model breakdown
    const mKey = modelId || "unknown";
    if (!modelBreakdownMap[mKey]) {
      modelBreakdownMap[mKey] = {
        model: mKey,
        provider: pricing.provider,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        estimated: pricing.estimated ?? false,
      };
    }
    modelBreakdownMap[mKey].calls++;
    modelBreakdownMap[mKey].inputTokens += inputTokens;
    modelBreakdownMap[mKey].outputTokens += outputTokens;
    modelBreakdownMap[mKey].cost += cost;

    // Tool calls
    const toolTrace = meta.tool_trace as unknown[] | null | undefined;
    if (Array.isArray(toolTrace) && toolTrace.length > 0) {
      totalToolCalls += toolTrace.length;
      messagesWithToolTrace++;
    }
  }

  windows.last24h.conversations = sessionsSeen24h.size;
  windows.last7d.conversations = sessionsSeen7d.size;
  windows.last30d.conversations = sessionsSeen30d.size;

  const series = Object.values(seriesMap).sort((a, b) => a.date.localeCompare(b.date));

  const totalCost30d = windows.last30d.cost;
  const modelBreakdown = Object.values(modelBreakdownMap)
    .map((m) => ({
      ...m,
      share: totalCost30d > 0 ? m.cost / totalCost30d : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  const quality = {
    totalToolCalls,
    messagesWithToolTrace,
    avgToolCallsPerMessage: assistantMessages30d > 0 ? totalToolCalls / assistantMessages30d : 0,
    telemetryCoverage: assistantMessages30d > 0 ? messagesWithToolTrace / assistantMessages30d : 0,
    messagesWithUnknownModel,
  };

  // Self-learning counts
  const [feedbackResult, candidateResult, activeResult] = await Promise.all([
    serviceDb.from("ai_feedback_events").select("id", { count: "exact", head: true }).gte("created_at", msAgo(7 * 24)),
    serviceDb.from("ai_learning_promotions").select("id", { count: "exact", head: true }).eq("status", "candidate"),
    serviceDb.from("ai_learning_promotions").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  if (feedbackResult.error) throw new Error(`ai_feedback_events query failed: ${feedbackResult.error.message}`);
  if (candidateResult.error) throw new Error(`ai_learning_promotions(candidate) query failed: ${candidateResult.error.message}`);
  if (activeResult.error) throw new Error(`ai_learning_promotions(active) query failed: ${activeResult.error.message}`);

  const feedbackEvents7d = feedbackResult.count ?? 0;
  const candidateLearnings = candidateResult.count ?? 0;
  const activeLearnings = activeResult.count ?? 0;

  const { data: sourceDocs, error: sourceDocsError } = await serviceDb.from("document_metadata")
    .select("id,title,source,category,type,source_system,status,created_at")
    .is("deleted_at", null)
    .gte("created_at", sourceCoverageRange.from)
    .lte("created_at", sourceCoverageRange.to)
    .in("source", ["fireflies", "microsoft_graph"])
    .order("created_at", { ascending: false })
    .limit(SOURCE_COVERAGE_LIMIT);

  if (sourceDocsError) throw new Error(`source coverage document_metadata query failed: ${sourceDocsError.message}`);

  const coveredDocs = (sourceDocs ?? [])
    .map((row) => ({ ...row, family: sourceFamily(row as Record<string, unknown>) }))
    .filter((row): row is typeof row & { family: string } => Boolean(row.family));
  const sourceIds = coveredDocs.map((row) => String(row.id));
  const chunkDocumentIds = new Set<string>();
  await addEmbeddedChunkDocumentIds(ragSupabase, sourceIds, chunkDocumentIds);

  const terminalDocumentIds = new Set<string>();
  for (const batch of chunk(sourceIds, 100)) {
    const { data: terminalRows, error: terminalError } = await ragSupabase
      .from("source_processing_jobs")
      .select("source_document_id,error_code,status")
      .in("source_document_id", batch)
      .eq("status", "failed_permanent")
      .in("error_code", [
        "skipped_low_content",
        "interview_title_excluded",
        "graph_content_missing",
        "graph_content_empty",
        "no_chunks",
        "ocr_failed",
      ]);
    if (terminalError) throw new Error(`source coverage source_processing_jobs query failed: ${terminalError.message}`);
    for (const row of terminalRows ?? []) {
      if (row.source_document_id) terminalDocumentIds.add(String(row.source_document_id));
    }
  }

  const ragMetadataRows: {
    id: string | null;
    embedding_status: string | null;
    parsing_status: string | null;
  }[] = [];
  for (const batch of chunk(sourceIds, 100)) {
    const { data: batchRows, error: ragMetadataError } = await ragSupabase
      .from("rag_document_metadata")
      .select("id,embedding_status,parsing_status")
      .in("id", batch);
    if (ragMetadataError) {
      throw new Error(
        `source coverage rag_document_metadata query failed: ${ragMetadataError.message || "unknown Supabase REST error"}`,
      );
    }
    ragMetadataRows.push(...(batchRows ?? []));
  }

  const terminalStatuses = new Set([
    "intentionally_excluded",
    "deleted_no_transcript",
    "metadata_only",
    "not_vectorizable",
    "skipped",
    "skipped_low_content",
    "graph_content_missing",
    "graph_content_empty",
    "no_chunks",
    "ocr_failed",
  ]);
  for (const row of ragMetadataRows ?? []) {
    if (
      row.id &&
      (terminalStatuses.has(String(row.embedding_status ?? "")) ||
        terminalStatuses.has(String(row.parsing_status ?? "")))
    ) {
      terminalDocumentIds.add(String(row.id));
    }
  }
  for (const row of coveredDocs) {
    if (terminalStatuses.has(String(row.status ?? ""))) {
      terminalDocumentIds.add(String(row.id));
    }
  }

  const families = [
    "meeting_transcripts",
    "emails",
    "teams_messages",
    "sharepoint_documents",
    "onedrive_documents",
  ];
  const sourceCoverage: SourceCoverageRow[] = families.map((family) => {
    const rows = coveredDocs.filter((row) => row.family === family);
    const terminalRows = rows.filter((row) => terminalDocumentIds.has(String(row.id)));
    const terminalRowIds = new Set(terminalRows.map((row) => String(row.id)));
    const embeddedRows = rows.filter(
      (row) => chunkDocumentIds.has(String(row.id)) && !terminalRowIds.has(String(row.id)),
    );
    const missingRows = rows.filter(
      (row) => !chunkDocumentIds.has(String(row.id)) && !terminalDocumentIds.has(String(row.id)),
    );
    const denominator = rows.length - terminalRows.length;

    return {
      family,
      label: familyLabel(family),
      sourceRowsInRange: rows.length,
      docsWithEmbeddedChunks: embeddedRows.length,
      terminalUnembeddable: terminalRows.length,
      actionableMissingEmbeddings: missingRows.length,
      coverageRatio: denominator > 0 ? embeddedRows.length / denominator : null,
      newestSourceCreatedAt: rows[0]?.created_at ?? null,
      missingSamples: missingRows.slice(0, 5).map((row) => ({
        id: String(row.id),
        title: row.title ?? null,
        createdAt: row.created_at ?? null,
      })),
    };
  });

  // Pipeline health: last 24h sync runs
  const since24h = msAgo(24);
  const { data: syncRuns, error: syncError } = await ragSupabase
    .from("source_sync_runs")
    .select("source, stage, status, finished_at, error_message")
    .gte("finished_at", since24h)
    .order("finished_at", { ascending: false })
    .limit(200);

  if (syncError) throw new Error(`source_sync_runs query failed: ${syncError.message}`);

  const succeeded = syncRuns?.filter((r) => r.status === "succeeded").length ?? 0;
  const failed = syncRuns?.filter((r) => r.status === "failed").length ?? 0;
  const lastFailures = (syncRuns ?? [])
    .filter((r) => r.status === "failed")
    .slice(0, 5)
    .map((r) => ({
      source: r.source,
      stage: r.stage,
      finishedAt: r.finished_at,
      errorMessage: sanitizePipelineErrorMessage(r.error_message),
    }));

  return Response.json({
    generatedAt,
    windows,
    series,
    modelBreakdown,
    quality,
    learning: {
      feedbackEvents7d,
      candidateLearnings,
      activeLearnings,
    },
    sourceCoverage: {
      days: sourceCoverageRange.days,
      from: sourceCoverageRange.from,
      to: sourceCoverageRange.to,
      preset: sourceCoverageRange.preset,
      rows: sourceCoverage,
    },
    pipeline: {
      succeeded,
      failed,
      total: succeeded + failed,
      lastFailures,
    },
    flags: { sampleTruncated, sampleSize },
  });
});
