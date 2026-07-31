#!/usr/bin/env tsx

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { generateText, Output } from "ai";

import {
  candidateOutputHasStructuredRows,
  fmdsVisionExtractionSchema,
  fmdsVisionVerificationSchema,
  hasStructuredTableRows,
} from "../../src/lib/fmds/fmds-vision-candidate";
import {
  formatAIProviderFailure,
  getAiProviderPath,
  getOpenAIModelId,
} from "../../src/lib/ai/provider-config";
import { getLanguageModel } from "../../src/lib/ai/providers";

const DOCUMENT_CODE = "FMDS0834";
const REVISION_LABEL = "2026-04";
const BUCKET = "fmds-source-evidence";
const PROMPT_VERSION = "fmds-table-vision-2026-07-20.2";
const DEFAULT_MODEL = "openai/gpt-5.4";
const execFileAsync = promisify(execFile);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDirectory, "../..");
const repositoryRoot = resolve(frontendRoot, "..");
const cropHelperPath = resolve(
  repositoryRoot,
  "scripts/asrs/localize_fmds_table_crop.py",
);
loadEnv({ path: resolve(repositoryRoot, ".env"), quiet: true });
loadEnv({
  path: resolve(frontendRoot, ".env.local"),
  quiet: true,
});

interface Arguments {
  apply: boolean;
  concurrency: number;
  force: boolean;
  identifier: string | null;
  limit: number | null;
  model: string;
  output: string | null;
  preflightOnly: boolean;
}

interface RevisionRow {
  id: string;
  document_code: string;
  revision_label: string;
  status: string;
  source_storage_path: string | null;
}

interface TableRow {
  id: string;
  revision_id: string;
  table_identifier: string;
  title: string | null;
  page_start: number;
  evidence_image_path: string | null;
  bounding_box: unknown;
  extracted_structure: unknown;
  review_status: string;
}

interface CandidateRow {
  id: string;
  source_id: string;
  output: unknown;
  created_at: string;
}

interface RunResult {
  table_id: string;
  table_identifier: string;
  page_number: number;
  status: "generated" | "failed";
  candidate_id?: string;
  confidence?: number;
  exact_match?: boolean;
  discrepancy_count?: number;
  completeness?: string;
  error?: string;
  evidence_path?: string;
  locator_method?: string;
  mode?: "candidate" | "crop_preflight";
}

interface CropMetadata {
  page_number: number;
  table_identifier: string;
  crop_bbox_points: number[];
  table_bbox_points: number[];
  caption_bbox_points: number[];
  locator_method: string;
  context_text: string[];
  pixel_width: number;
  pixel_height: number;
}

function parseArguments(values: string[]): Arguments {
  const result: Arguments = {
    apply: false,
    concurrency: 1,
    force: false,
    identifier: null,
    limit: null,
    model: DEFAULT_MODEL,
    output: null,
    preflightOnly: false,
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--apply") result.apply = true;
    else if (value === "--force") result.force = true;
    else if (value === "--preflight-only") result.preflightOnly = true;
    else if (value === "--identifier")
      result.identifier = values[++index] ?? null;
    else if (value === "--limit") result.limit = Number(values[++index]);
    else if (value === "--model")
      result.model = values[++index] ?? DEFAULT_MODEL;
    else if (value === "--output") result.output = values[++index] ?? null;
    else if (value === "--concurrency") {
      result.concurrency = Number(values[++index]);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  if (
    !Number.isInteger(result.concurrency) ||
    result.concurrency < 1 ||
    result.concurrency > 4
  ) {
    throw new Error("--concurrency must be an integer from 1 through 4.");
  }
  if (
    result.limit !== null &&
    (!Number.isInteger(result.limit) || result.limit < 1)
  ) {
    throw new Error("--limit must be a positive integer.");
  }
  if (result.identifier !== null && !result.identifier.trim()) {
    throw new Error("--identifier cannot be blank.");
  }
  if (result.preflightOnly && result.apply) {
    throw new Error("--preflight-only cannot be combined with --apply.");
  }
  return result;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numericRect(value: unknown): number[] | null {
  return Array.isArray(value) &&
    value.length === 4 &&
    value.every((coordinate) => typeof coordinate === "number")
    ? value
    : null;
}

function parseCropMetadata(value: string, table: TableRow): CropMetadata {
  const parsed = JSON.parse(value) as Partial<CropMetadata>;
  if (
    parsed.page_number !== table.page_start ||
    parsed.table_identifier !== table.table_identifier ||
    !numericRect(parsed.crop_bbox_points) ||
    !numericRect(parsed.table_bbox_points) ||
    !numericRect(parsed.caption_bbox_points) ||
    typeof parsed.locator_method !== "string" ||
    !Array.isArray(parsed.context_text) ||
    !parsed.context_text.every((item) => typeof item === "string") ||
    typeof parsed.pixel_width !== "number" ||
    typeof parsed.pixel_height !== "number"
  ) {
    throw new Error(
      `Crop helper returned invalid metadata for Table ${table.table_identifier}.`,
    );
  }
  return parsed as CropMetadata;
}

async function localizeTableEvidence(
  sourcePdfPath: string,
  outputPath: string,
  table: TableRow,
): Promise<{ imageBytes: Uint8Array; metadata: CropMetadata }> {
  const boundingBox = asRecord(table.bounding_box);
  const caption = numericRect(boundingBox?.caption);
  if (!caption) {
    throw new Error(
      `Table ${table.table_identifier} has no valid caption bounding box.`,
    );
  }
  const tableBox = numericRect(boundingBox?.table);
  const helperArgs = [
    cropHelperPath,
    "--pdf",
    sourcePdfPath,
    "--page-number",
    String(table.page_start),
    "--table-identifier",
    table.table_identifier,
    "--caption-bbox-json",
    JSON.stringify(caption),
    "--output",
    outputPath,
  ];
  if (tableBox) {
    helperArgs.push("--table-bbox-json", JSON.stringify(tableBox));
  }
  const { stdout } = await execFileAsync("python3", helperArgs, {
    maxBuffer: 1024 * 1024,
  });
  return {
    imageBytes: new Uint8Array(await readFile(outputPath)),
    metadata: parseCropMetadata(stdout.trim(), table),
  };
}

function localizedEvidencePath(
  sourcePagePath: string,
  table: TableRow,
  inputHash: string,
): string {
  const pageSegment = "/pages/";
  const marker = sourcePagePath.indexOf(pageSegment);
  if (marker < 1) {
    throw new Error(
      `Table ${table.table_identifier} evidence path is outside the revision page namespace.`,
    );
  }
  const prefix = sourcePagePath.slice(0, marker);
  const safeIdentifier = table.table_identifier.replace(/[^A-Za-z0-9.-]/g, "-");
  return `${prefix}/vision-candidates/tables/table-${safeIdentifier}-page-${String(table.page_start).padStart(3, "0")}-${inputHash.slice(0, 16)}.png`;
}

function statusChecksum(rows: TableRow[]): string {
  return createHash("sha256")
    .update(
      rows
        .map((row) => `${row.id}:${row.review_status}`)
        .sort()
        .join("\n"),
    )
    .digest("hex");
}

function describeError(error: unknown): string {
  const seen = new Set<unknown>();
  function visit(value: unknown, depth: number): unknown {
    if (depth > 3 || value === null || value === undefined) return value;
    if (typeof value !== "object") return value;
    if (seen.has(value)) return "[circular]";
    seen.add(value);
    const record = value as Record<string, unknown>;
    const keys = [
      "name",
      "message",
      "status",
      "statusCode",
      "code",
      "type",
      "cause",
      "responseBody",
      "data",
      "issues",
      "text",
    ];
    return Object.fromEntries(
      keys
        .filter((key) => key in record)
        .map((key) => [key, visit(record[key], depth + 1)]),
    );
  }

  try {
    return JSON.stringify(visit(error, 0)).slice(0, 4_000);
  } catch {
    return String(error);
  }
}

function latestCandidates(rows: CandidateRow[]): Map<string, CandidateRow> {
  const latest = new Map<string, CandidateRow>();
  for (const row of rows) {
    if (!latest.has(row.source_id)) latest.set(row.source_id, row);
  }
  return latest;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () =>
      worker(),
    ),
  );
  return results;
}

function extractionInstructions(): string {
  return [
    "You are transcribing an engineering table from an FM Global Data Sheet source image.",
    "The image is authoritative. Transcribe only content that is visibly present.",
    "Preserve exact comparison symbols, punctuation, capitalization, units, metric pairs, blank cells, footnotes, and governing text adjacent to the table.",
    "Represent merged cells with row_span or column_span on the first visible cell; do not repeat text unless it is visibly repeated.",
    "Keep blank cells with is_blank=true and text=''.",
    "Do not infer a missing value, repair a likely typo, normalize a threshold, or borrow content from another table.",
    "If any region is unclear, record it in ambiguities and mark completeness partial or unreadable.",
    "Column and row indexes are zero-based and must match the visual order.",
  ].join(" ");
}

function verificationInstructions(): string {
  return [
    "Act as an independent engineering-table transcription verifier.",
    "Compare the proposed structured transcription against the source image cell by cell.",
    "Check table identity, every heading, row/column alignment, merged-cell scope, values, units, parentheses, comparison symbols, footnotes, and visible governing text.",
    "Do not rewrite the proposal. Report discrepancies and unreadable regions only.",
    "Set exact_match=true only when no visible discrepancy remains.",
  ].join(" ");
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const supabase = createClient(
    requiredEnvironment("SUPABASE_ASRS_URL"),
    requiredEnvironment("SUPABASE_ASRS_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const revisionResult = await supabase
    .from("fmds_corpus_revisions")
    .select("id,document_code,revision_label,status,source_storage_path")
    .eq("document_code", DOCUMENT_CODE)
    .eq("revision_label", REVISION_LABEL)
    .single();
  if (revisionResult.error) throw revisionResult.error;
  const revision = revisionResult.data as RevisionRow;
  if (revision.status !== "staging") {
    throw new Error(
      `Vision extraction requires ${DOCUMENT_CODE} ${REVISION_LABEL} to remain staging; found ${revision.status}.`,
    );
  }

  const tablesResult = await supabase
    .from("fmds_tables")
    .select(
      "id,revision_id,table_identifier,title,page_start,evidence_image_path,bounding_box,extracted_structure,review_status",
    )
    .eq("revision_id", revision.id)
    .order("page_start", { ascending: true })
    .order("table_identifier", { ascending: true });
  if (tablesResult.error) throw tablesResult.error;
  const tables = tablesResult.data as TableRow[];
  if (tables.length !== 58) {
    throw new Error(
      `FMDS0834 table coverage drifted: expected 58, found ${tables.length}.`,
    );
  }

  const cellsResult = await supabase
    .from("fmds_table_cells")
    .select("table_id");
  if (cellsResult.error) throw cellsResult.error;
  const tablesWithCells = new Set(
    (cellsResult.data as Array<{ table_id: string }>).map(
      (row) => row.table_id,
    ),
  );

  const candidatesResult = await supabase
    .from("fmds_visual_review_candidates")
    .select("id,source_id,output,created_at")
    .eq("revision_id", revision.id)
    .eq("source_type", "table")
    .eq("status", "candidate")
    .order("created_at", { ascending: false });
  if (candidatesResult.error) throw candidatesResult.error;
  const candidateByTable = latestCandidates(
    candidatesResult.data as CandidateRow[],
  );

  let targets = tables.filter((table) => {
    if (args.identifier && table.table_identifier !== args.identifier)
      return false;
    if (args.force) return true;
    return !(
      hasStructuredTableRows(table.extracted_structure) ||
      tablesWithCells.has(table.id) ||
      candidateOutputHasStructuredRows(candidateByTable.get(table.id)?.output)
    );
  });
  if (args.limit !== null) targets = targets.slice(0, args.limit);
  if (!targets.length) {
    throw new Error(
      "No FMDS0834 tables match the requested missing-candidate scope.",
    );
  }
  if (targets.some((table) => !table.evidence_image_path)) {
    const missing = targets
      .filter((table) => !table.evidence_image_path)
      .map((table) => table.table_identifier);
    throw new Error(`Rendered evidence is missing for: ${missing.join(", ")}`);
  }
  if (!revision.source_storage_path) {
    throw new Error(
      `${DOCUMENT_CODE} ${REVISION_LABEL} has no revision-locked source PDF path.`,
    );
  }

  const sourceDownload = await supabase.storage
    .from(BUCKET)
    .download(revision.source_storage_path);
  if (sourceDownload.error) throw sourceDownload.error;
  const temporaryDirectory = await mkdtemp(
    resolve(tmpdir(), "fmds-vision-candidates-"),
  );
  const sourcePdfPath = resolve(temporaryDirectory, "source.pdf");
  await writeFile(
    sourcePdfPath,
    new Uint8Array(await sourceDownload.data.arrayBuffer()),
  );

  const reviewEventsBefore = await supabase
    .from("fmds_visual_review_events")
    .select("id", { count: "exact", head: true })
    .eq("revision_id", revision.id);
  if (reviewEventsBefore.error) throw reviewEventsBefore.error;
  const sourceStatusBefore = statusChecksum(tables);
  const model = getLanguageModel(args.model);
  const providerPath = getAiProviderPath();
  const storedModelId = getOpenAIModelId(args.model);

  process.stdout.write(
    `${JSON.stringify({ event: "fmds_vision_start", revision_id: revision.id, targets: targets.length, apply: args.apply, concurrency: args.concurrency, provider_path: providerPath, model: storedModelId })}\n`,
  );

  let results: RunResult[];
  try {
    results = await mapWithConcurrency(
      targets,
      args.concurrency,
      async (table, index): Promise<RunResult> => {
        let stage:
          | "evidence_localization"
          | "extraction"
          | "verification"
          | "candidate_evidence_upload"
          | "candidate_write"
          | "candidate_read_back" = "evidence_localization";
        try {
          process.stdout.write(
            `${JSON.stringify({ event: "fmds_vision_table_start", position: index + 1, total: targets.length, table_identifier: table.table_identifier, page: table.page_start })}\n`,
          );
          const sourcePageImagePath = table.evidence_image_path as string;
          const cropOutputPath = resolve(temporaryDirectory, `${table.id}.png`);
          const { imageBytes, metadata: cropMetadata } =
            await localizeTableEvidence(sourcePdfPath, cropOutputPath, table);
          const inputHash = sha256(imageBytes);
          const evidencePath = localizedEvidencePath(
            sourcePageImagePath,
            table,
            inputHash,
          );

          if (args.preflightOnly) {
            const result: RunResult = {
              table_id: table.id,
              table_identifier: table.table_identifier,
              page_number: table.page_start,
              status: "generated",
              evidence_path: evidencePath,
              locator_method: cropMetadata.locator_method,
              mode: "crop_preflight",
            };
            process.stdout.write(
              `${JSON.stringify({ event: "fmds_vision_crop_preflight_complete", ...result })}\n`,
            );
            return result;
          }

          stage = "extraction";
          const extractionResult = await generateText({
            model,
            instructions: extractionInstructions(),
            output: Output.object({ schema: fmdsVisionExtractionSchema }),
            maxOutputTokens: 30_000,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Transcribe ${DOCUMENT_CODE} ${REVISION_LABEL} Table ${table.table_identifier} on PDF page ${table.page_start}. This localized source crop contains the target table and its visible governing context only. Stored title context: ${table.title ?? "None"}. The image remains authoritative if this context differs.`,
                  },
                  {
                    type: "file",
                    mediaType: "image/png",
                    data: imageBytes,
                    providerOptions: { openai: { imageDetail: "high" } },
                  },
                ],
              },
            ],
          });
          const extraction = fmdsVisionExtractionSchema.parse(
            extractionResult.output,
          );
          if (!hasStructuredTableRows(extraction.extracted_structure)) {
            throw new Error(
              "The vision model returned no structured table rows.",
            );
          }

          stage = "verification";
          const verificationResult = await generateText({
            model,
            instructions: verificationInstructions(),
            output: Output.object({ schema: fmdsVisionVerificationSchema }),
            maxOutputTokens: 8_000,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Verify this candidate for ${DOCUMENT_CODE} ${REVISION_LABEL} Table ${table.table_identifier}:\n${JSON.stringify(extraction.extracted_structure)}`,
                  },
                  {
                    type: "file",
                    mediaType: "image/png",
                    data: imageBytes,
                    providerOptions: { openai: { imageDetail: "high" } },
                  },
                ],
              },
            ],
          });
          const verification = fmdsVisionVerificationSchema.parse(
            verificationResult.output,
          );
          const confidence = Math.min(
            extraction.extracted_structure.confidence,
            verification.confidence,
            verification.exact_match ? 1 : 0.49,
          );
          const candidateOutput = {
            document_code: DOCUMENT_CODE,
            revision_label: REVISION_LABEL,
            table_identifier: table.table_identifier,
            page_number: table.page_start,
            evidence_image_path: evidencePath,
            source_page_image_path: sourcePageImagePath,
            evidence_crop: cropMetadata,
            extracted_structure: extraction.extracted_structure,
            verification,
            candidate_only: true,
            requires_visual_validation: true,
            generator_version: PROMPT_VERSION,
            input_sha256: inputHash,
            generated_at: new Date().toISOString(),
            usage: {
              extraction: extractionResult.usage,
              verification: verificationResult.usage,
            },
          };

          let candidateId: string | undefined;
          if (args.apply) {
            stage = "candidate_evidence_upload";
            const uploadResult = await supabase.storage
              .from(BUCKET)
              .upload(evidencePath, imageBytes, {
                contentType: "image/png",
                upsert: true,
              });
            if (uploadResult.error) throw uploadResult.error;

            stage = "candidate_write";
            const writeResult = await supabase
              .from("fmds_visual_review_candidates")
              .upsert(
                {
                  revision_id: revision.id,
                  source_type: "table",
                  source_id: table.id,
                  candidate_kind: "vision",
                  provider: providerPath,
                  model: storedModelId,
                  prompt_version: PROMPT_VERSION,
                  input_sha256: inputHash,
                  output: candidateOutput,
                  confidence,
                  status: "candidate",
                  extraction_error: null,
                  created_at: new Date().toISOString(),
                },
                {
                  onConflict:
                    "source_type,source_id,candidate_kind,provider,model,prompt_version,input_sha256",
                },
              )
              .select("id,source_id,status,output")
              .single();
            if (writeResult.error) throw writeResult.error;
            candidateId = String(writeResult.data.id);

            const supersedeResult = await supabase
              .from("fmds_visual_review_candidates")
              .update({ status: "superseded" })
              .eq("revision_id", revision.id)
              .eq("source_type", "table")
              .eq("source_id", table.id)
              .eq("status", "candidate")
              .neq("id", candidateId);
            if (supersedeResult.error) throw supersedeResult.error;

            stage = "candidate_read_back";
            const readBack = await supabase
              .from("fmds_visual_review_candidates")
              .select("id,source_id,status,output")
              .eq("id", candidateId)
              .eq("source_id", table.id)
              .eq("status", "candidate")
              .single();
            if (readBack.error) throw readBack.error;
            if (!candidateOutputHasStructuredRows(readBack.data.output)) {
              throw new Error(
                "Candidate read-back did not contain structured rows.",
              );
            }
          }

          const result: RunResult = {
            table_id: table.id,
            table_identifier: table.table_identifier,
            page_number: table.page_start,
            status: "generated",
            mode: "candidate",
            candidate_id: candidateId,
            confidence,
            exact_match: verification.exact_match,
            discrepancy_count: verification.discrepancies.length,
            completeness: verification.completeness,
          };
          process.stdout.write(
            `${JSON.stringify({ event: "fmds_vision_table_complete", ...result })}\n`,
          );
          return result;
        } catch (error) {
          const diagnostic = describeError(error);
          const message =
            stage === "extraction" || stage === "verification"
              ? `${formatAIProviderFailure(
                  error,
                  `FMDS vision ${stage} for Table ${table.table_identifier}`,
                )} Sanitized diagnostic: ${diagnostic}`
              : `FMDS Table ${table.table_identifier} failed during ${stage}. Sanitized diagnostic: ${diagnostic}`;
          const result: RunResult = {
            table_id: table.id,
            table_identifier: table.table_identifier,
            page_number: table.page_start,
            status: "failed",
            error: message,
          };
          process.stdout.write(
            `${JSON.stringify({ event: "fmds_vision_table_failed", ...result })}\n`,
          );
          return result;
        }
      },
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  const finalTablesResult = await supabase
    .from("fmds_tables")
    .select(
      "id,revision_id,table_identifier,title,page_start,evidence_image_path,bounding_box,extracted_structure,review_status",
    )
    .eq("revision_id", revision.id);
  if (finalTablesResult.error) throw finalTablesResult.error;
  const finalTables = finalTablesResult.data as TableRow[];
  const finalRevision = await supabase
    .from("fmds_corpus_revisions")
    .select("status")
    .eq("id", revision.id)
    .single();
  if (finalRevision.error) throw finalRevision.error;
  const reviewEventsAfter = await supabase
    .from("fmds_visual_review_events")
    .select("id", { count: "exact", head: true })
    .eq("revision_id", revision.id);
  if (reviewEventsAfter.error) throw reviewEventsAfter.error;

  if (statusChecksum(finalTables) !== sourceStatusBefore) {
    throw new Error(
      "Source review-status drift detected during candidate generation.",
    );
  }
  if (finalRevision.data.status !== "staging") {
    throw new Error(
      `Revision status drift detected: expected staging, found ${finalRevision.data.status}.`,
    );
  }
  if (reviewEventsAfter.count !== reviewEventsBefore.count) {
    throw new Error(
      `Review-event drift detected: ${reviewEventsBefore.count ?? 0} -> ${reviewEventsAfter.count ?? 0}.`,
    );
  }

  const report = {
    generated_at: new Date().toISOString(),
    document_code: DOCUMENT_CODE,
    revision_label: REVISION_LABEL,
    revision_id: revision.id,
    revision_status: finalRevision.data.status,
    provider_path: providerPath,
    model: storedModelId,
    prompt_version: PROMPT_VERSION,
    apply: args.apply,
    preflight_only: args.preflightOnly,
    requested: targets.length,
    generated: results.filter((result) => result.status === "generated").length,
    failed: results.filter((result) => result.status === "failed").length,
    source_status_unchanged: true,
    review_event_count_unchanged: true,
    results,
  };
  if (args.output) {
    const outputPath = resolve(args.output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  process.stdout.write(
    `${JSON.stringify({ event: "fmds_vision_complete", ...report })}\n`,
  );
  if (report.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ event: "fmds_vision_fatal", error: error instanceof Error ? error.message : String(error) })}\n`,
  );
  process.exitCode = 1;
});
