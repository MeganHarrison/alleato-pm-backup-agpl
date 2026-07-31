// Canonical source enumeration and materialization contract.
const SOURCE_TIMESTAMP_SQL =
  "coalesce(last_content_loaded_at, last_indexed_at, last_synced_at, updated_at, created_at)";

const SOURCE_COLUMNS_SQL = `
  id,
  app_document_id,
  project_id,
  source,
  source_system,
  source_item_id,
  fireflies_id,
  title,
  type,
  category,
  source_web_url,
  url,
  storage_bucket,
  storage_path,
  file_name,
  content,
  raw_text,
  summary,
  overview,
  parsing_status,
  embedding_status,
  last_synced_at,
  last_content_loaded_at,
  last_indexed_at,
  created_at,
  updated_at,
  ${SOURCE_TIMESTAMP_SQL} as source_at
`;

/**
 * Resolve the durable upstream identity and user-facing URL for a source row.
 * Database row ids are ingestion records, not canonical source ids; prefer the
 * provider item id (or Fireflies id) and retain the row id only as a fallback.
 */
export function canonicalSourceProvenance(row = {}) {
  const candidates = [row.source_item_id, row.fireflies_id, row.app_document_id, row.id];
  const sourceId = candidates.find((value) => value !== null && value !== undefined && String(value).trim());
  const urlCandidates = [row.source_web_url, row.url];
  const sourceUrl = urlCandidates.find(
    (value) => typeof value === "string" && value.trim().startsWith("http"),
  );
  return {
    canonicalSourceId: sourceId === undefined ? null : String(sourceId),
    canonicalSourceUrl: sourceUrl ? sourceUrl.trim() : null,
  };
}

/** Build auditable per-lane read receipts from the enumerated/materialized sets. */
export function buildLaneReadReceipts(
  rows,
  sources,
  skipped,
  { classifyLane, lanes = ["meetings", "emails", "teams", "documents"] } = {},
) {
  if (typeof classifyLane !== "function") throw new Error("buildLaneReadReceipts requires classifyLane.");
  const includedById = new Set((sources || []).map((source) => String(source.id)));
  const receipts = {};
  for (const lane of lanes) {
    const laneRows = (rows || []).filter((row) => classifyLane(row) === lane);
    const laneSources = (sources || []).filter((source) => source.lane === lane);
    const laneSkipped = (skipped || []).filter((item) => item.lane === lane);
    const duplicateCount = laneSkipped.filter((item) => String(item.reason || "").startsWith("duplicate content of ")).length;
    const outsideWindowCount = laneSkipped.filter((item) => String(item.reason || "").startsWith("not in ")).length;
    const failures = laneSkipped.filter(
      (item) => !includedById.has(String(item.id)) && !String(item.reason || "").startsWith("not in ") && !String(item.reason || "").startsWith("duplicate content of "),
    );
    const sourceCharacters = laneSources.reduce((total, source) => total + String(source.text ?? "").length, 0);
    const status = failures.length > 0 ? "failed" : laneSources.length === 0 ? "valid-empty" : "complete";
    receipts[lane] = {
      status,
      enumeratedRows: laneRows.length,
      materializedSources: laneSources.length,
      sourceCharacters,
      modelInputCharacters: sourceCharacters,
      excludedOutsideWindow: outsideWindowCount,
      deduplicatedSources: duplicateCount,
      failedSources: failures.length,
      failures: failures.slice(0, 25),
    };
  }
  return receipts;
}

/**
 * Enumerate one stable database snapshot of every source row eligible for the
 * Daily Source Corpus. A count plus deterministic pagination makes a silent
 * row cap or partial page impossible to mislabel as complete.
 */
export async function fetchCompleteSourceRows(
  client,
  { startIso, endIso, pageSize = 500 } = {},
) {
  if (!startIso || !endIso) throw new Error("Daily Source Corpus requires startIso and endIso.");
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(`Daily Source Corpus pageSize must be a positive integer; received ${pageSize}.`);
  }

  await client.query("begin isolation level repeatable read read only");
  try {
    const params = [startIso, endIso];
    const predicate = `
      ${SOURCE_TIMESTAMP_SQL} >= ($1::timestamptz - interval '36 hours')
      and ${SOURCE_TIMESTAMP_SQL} < ($2::timestamptz + interval '12 hours')
      and source is distinct from 'ai_memory'
    `;
    const countResult = await client.query(
      `select count(*)::int as eligible_count from public.rag_document_metadata where ${predicate}`,
      params,
    );
    const eligibleRows = Number(countResult.rows[0]?.eligible_count ?? 0);
    if (!Number.isInteger(eligibleRows) || eligibleRows < 0) {
      throw new Error(`Daily Source Corpus count returned invalid value '${countResult.rows[0]?.eligible_count}'.`);
    }

    const rows = [];
    for (let offset = 0; offset < eligibleRows; offset += pageSize) {
      const page = await client.query(
        `
          select ${SOURCE_COLUMNS_SQL}
          from public.rag_document_metadata
          where ${predicate}
          order by ${SOURCE_TIMESTAMP_SQL} asc, id asc
          limit $3::int offset $4::int
        `,
        [...params, pageSize, offset],
      );
      if (page.rows.length === 0) {
        throw new Error(
          `Daily Source Corpus pagination stopped at ${rows.length}/${eligibleRows} rows (offset ${offset}).`,
        );
      }
      rows.push(...page.rows);
    }

    const uniqueIds = new Set(rows.map((row) => String(row.id)));
    if (rows.length !== eligibleRows || uniqueIds.size !== rows.length) {
      throw new Error(
        `Daily Source Corpus completeness failure: expected=${eligibleRows}, fetched=${rows.length}, unique=${uniqueIds.size}.`,
      );
    }
    await client.query("commit");
    return {
      rows,
      receipt: {
        status: "complete",
        eligibleRows,
        fetchedRows: rows.length,
        uniqueRows: uniqueIds.size,
        pageSize,
        pageCount: eligibleRows === 0 ? 0 : Math.ceil(eligibleRows / pageSize),
      },
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export function chunkSourcesForModel(sources, maxCharsPerChunk = 10_000) {
  if (!Number.isInteger(maxCharsPerChunk) || maxCharsPerChunk < 1) {
    throw new Error(`maxCharsPerChunk must be a positive integer; received ${maxCharsPerChunk}.`);
  }
  const chunks = [];
  let sourceCharacters = 0;
  for (const source of sources) {
    const text = String(source.text ?? "");
    sourceCharacters += text.length;
    const partCount = Math.max(1, Math.ceil(text.length / maxCharsPerChunk));
    for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
      const start = partIndex * maxCharsPerChunk;
      const partText = text.slice(start, start + maxCharsPerChunk);
      chunks.push({
        id: source.alias,
        part: `${partIndex + 1}/${partCount}`,
        lane: source.lane,
        title: source.title,
        project: source.attributionLabel ?? source.projectName ?? "Unassigned",
        attributionStatus: source.attributionStatus ?? "not_evaluated",
        sourceAt: source.sourceAt,
        text: partText,
        characterStart: start,
        characterEnd: start + partText.length,
      });
    }
  }
  const modelInputCharacters = chunks.reduce((total, chunk) => total + chunk.text.length, 0);
  if (modelInputCharacters !== sourceCharacters) {
    throw new Error(
      `Daily Source Corpus model-input coverage failure: sourceCharacters=${sourceCharacters}, modelInputCharacters=${modelInputCharacters}.`,
    );
  }
  return {
    chunks,
    receipt: {
      status: "complete",
      sources: sources.length,
      sourceCharacters,
      modelInputCharacters,
      chunkCount: chunks.length,
      truncatedSources: 0,
    },
  };
}

export function packSourceChunks(chunks, { maxBatchCharacters = 80_000, maxBatchItems = 24 } = {}) {
  const batches = [];
  let current = [];
  let currentCharacters = 0;
  for (const chunk of chunks) {
    const nextCharacters = String(chunk.text ?? "").length;
    if (
      current.length > 0 &&
      (current.length >= maxBatchItems || currentCharacters + nextCharacters > maxBatchCharacters)
    ) {
      batches.push(current);
      current = [];
      currentCharacters = 0;
    }
    current.push(chunk);
    currentCharacters += nextCharacters;
  }
  if (current.length) batches.push(current);
  return batches;
}
