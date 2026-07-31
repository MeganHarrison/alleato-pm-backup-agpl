import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type FmdsCorpusRevision,
  type FmdsTable,
  fmdsTableSelect,
} from "./fmds-tables";

interface FmdsDatabase {
  public: {
    Tables: {
      fmds_corpus_revisions: {
        Row: FmdsCorpusRevision;
        Insert: FmdsCorpusRevision;
        Update: Partial<FmdsCorpusRevision>;
        Relationships: [];
      };
      fmds_tables: {
        Row: FmdsTable;
        Insert: FmdsTable;
        Update: Partial<FmdsTable>;
        Relationships: [];
      };
      fmds_table_cells: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      fmds_visual_review_events: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export interface FmdsTablesPageData {
  revision: FmdsCorpusRevision;
  tables: FmdsTable[];
}

export interface FmdsTableDetailData {
  revision: FmdsCorpusRevision;
  table: FmdsTable & {
    signed_evidence_url: string | null;
    review_evidence_path: string | null;
  };
  cells: Array<{
    id: string;
    row_index: number;
    column_index: number;
    row_header: string | null;
    column_header: string | null;
    raw_value: string | null;
    normalized_value: string | null;
    unit: string | null;
    notes: string | null;
  }>;
  latestReview: {
    decision: string;
    reviewer_id: string;
    reviewer_role: string;
    notes: string;
    created_at: string;
  } | null;
  latestCandidate: {
    id: string;
    candidate_kind: string;
    provider: string;
    model: string;
    output: Record<string, unknown>;
    confidence: number | null;
    status: string;
    extraction_error: string | null;
    created_at: string;
  } | null;
}

export const FMDS_TABLES_DOCUMENT_CODE = "FMDS0834";

function getRequiredAsrsEnvironment(): { url: string; secretKey: string } {
  const url = process.env.SUPABASE_ASRS_URL;
  const secretKey =
    process.env.SUPABASE_ASRS_SECRET_KEY ??
    process.env.SUPABASE_ASRS_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "FMDS tables are unavailable: SUPABASE_ASRS_URL is not configured for the dedicated ASRS project.",
    );
  }

  if (!secretKey) {
    throw new Error(
      "FMDS tables are unavailable: SUPABASE_ASRS_SECRET_KEY is not configured for server-side access.",
    );
  }

  return { url, secretKey };
}

function createAsrsFmdsClient(): SupabaseClient<FmdsDatabase> {
  const { url, secretKey } = getRequiredAsrsEnvironment();
  return createClient<FmdsDatabase>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Returns the newest FMDS 8-34 revision from the dedicated ASRS project.
 * This route must never select another FMDS document merely because that
 * document was imported more recently.
 */
export async function getFmdsTablesPageData(
  options: { revisionId?: string } = {},
): Promise<FmdsTablesPageData> {
  const supabase = createAsrsFmdsClient();
  let revisionQuery = supabase
    .from("fmds_corpus_revisions")
    .select(
      "id,document_code,revision_label,publication_date,status,source_file_name,source_storage_path,source_page_count",
    )
    .eq("document_code", FMDS_TABLES_DOCUMENT_CODE)
    .in("status", ["staging", "active"]);
  if (options.revisionId) revisionQuery = revisionQuery.eq("id", options.revisionId);
  const { data: revisionData, error: revisionError } = await revisionQuery
    .order("publication_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // The ASRS project has its own generated schema boundary. Until its type
  // artifact is checked into this frontend, narrow this explicit select list at
  // the adapter seam rather than allowing untyped rows to escape to the page.
  const revision = revisionData as unknown as FmdsCorpusRevision | null;

  if (revisionError) {
    throw new Error(
      `FMDS tables are unavailable: unable to load the ASRS corpus revision (${revisionError.message}).`,
    );
  }

  if (!revision) {
    throw new Error(
      `FMDS tables are unavailable: the dedicated ASRS project has no imported ${FMDS_TABLES_DOCUMENT_CODE} corpus revision.`,
    );
  }

  const { data: tableData, error: tablesError } = await supabase
    .from("fmds_tables")
    .select(fmdsTableSelect)
    .eq("revision_id", revision.id)
    .order("page_start", { ascending: true })
    .order("table_identifier", { ascending: true });
  const tables = tableData as unknown as FmdsTable[] | null;

  if (tablesError) {
    throw new Error(
      `FMDS tables are unavailable: unable to load tables for ${revision.document_code} ${revision.revision_label} (${tablesError.message}).`,
    );
  }

  if (!tables?.length) {
    throw new Error(
      `FMDS tables are unavailable: ${revision.document_code} ${revision.revision_label} has no extracted table rows in the dedicated ASRS project.`,
    );
  }

  let sourcePdfUrl: string | null = null;
  if (revision.source_storage_path) {
    const signed = await supabase.storage
      .from("fmds-source-evidence")
      .createSignedUrl(revision.source_storage_path, 60 * 60);
    if (!signed.error) sourcePdfUrl = signed.data.signedUrl;
  }

  return {
    revision,
    tables: sourcePdfUrl
      ? tables.map((table) => ({ ...table, source_pdf_url: sourcePdfUrl }))
      : tables,
  };
}

export async function getFmdsTableDetailData(
  tableId: string,
): Promise<FmdsTableDetailData | null> {
  const supabase = createAsrsFmdsClient();
  const { data: tableData, error: tableError } = await supabase
    .from("fmds_tables")
    .select(`${fmdsTableSelect},fmds_corpus_revisions(*)`)
    .eq("id", tableId)
    .maybeSingle();

  if (tableError)
    throw new Error(`Unable to load FMDS table: ${tableError.message}`);
  if (!tableData) return null;

  const row = tableData as unknown as FmdsTable & {
    fmds_corpus_revisions: FmdsCorpusRevision;
  };
  if (row.fmds_corpus_revisions.document_code !== FMDS_TABLES_DOCUMENT_CODE) {
    return null;
  }
  const { data: cells, error: cellsError } = await supabase
    .from("fmds_table_cells")
    .select(
      "id,row_index,column_index,row_header,column_header,raw_value,normalized_value,unit,notes",
    )
    .eq("table_id", tableId)
    .order("row_index", { ascending: true })
    .order("column_index", { ascending: true });
  if (cellsError)
    throw new Error(`Unable to load FMDS table cells: ${cellsError.message}`);

  const { data: reviews, error: reviewError } = await supabase
    .from("fmds_visual_review_events")
    .select("decision,reviewer_id,reviewer_role,notes,created_at")
    .eq("source_type", "table")
    .eq("source_id", tableId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (reviewError)
    throw new Error(
      `Unable to load FMDS review history: ${reviewError.message}`,
    );

  const { data: candidates, error: candidateError } = await supabase
    .from("fmds_visual_review_candidates")
    .select(
      "id,candidate_kind,provider,model,output,confidence,status,extraction_error,created_at",
    )
    .eq("source_type", "table")
    .eq("source_id", tableId)
    .eq("status", "candidate")
    .order("created_at", { ascending: false })
    .limit(1);
  if (candidateError)
    throw new Error(
      `Unable to load FMDS extraction candidate: ${candidateError.message}`,
    );

  const latestCandidate =
    (candidates?.[0] as FmdsTableDetailData["latestCandidate"]) ?? null;
  const candidateOutput = latestCandidate?.output;
  const candidateEvidencePath =
    candidateOutput && typeof candidateOutput.evidence_image_path === "string"
      ? candidateOutput.evidence_image_path
      : null;
  const expectedEvidencePrefix = `${row.fmds_corpus_revisions.document_code}/${row.fmds_corpus_revisions.revision_label}/`;
  if (
    candidateEvidencePath &&
    !candidateEvidencePath.startsWith(expectedEvidencePrefix)
  ) {
    throw new Error(
      `FMDS candidate evidence is outside ${expectedEvidencePrefix}.`,
    );
  }
  const reviewEvidencePath = candidateEvidencePath ?? row.evidence_image_path;
  let signedEvidenceUrl: string | null = null;
  if (reviewEvidencePath) {
    const signed = await supabase.storage
      .from("fmds-source-evidence")
      .createSignedUrl(reviewEvidencePath, 60 * 60);
    if (!signed.error) signedEvidenceUrl = signed.data.signedUrl;
  }

  let sourcePdfUrl: string | null = null;
  if (row.fmds_corpus_revisions.source_storage_path) {
    const signed = await supabase.storage
      .from("fmds-source-evidence")
      .createSignedUrl(row.fmds_corpus_revisions.source_storage_path, 60 * 60);
    if (!signed.error) sourcePdfUrl = signed.data.signedUrl;
  }

  return {
    revision: row.fmds_corpus_revisions,
    table: {
      ...row,
      signed_evidence_url: signedEvidenceUrl,
      review_evidence_path: reviewEvidencePath,
      source_pdf_url: sourcePdfUrl,
    },
    cells: (cells ?? []) as FmdsTableDetailData["cells"],
    latestReview: (reviews?.[0] as FmdsTableDetailData["latestReview"]) ?? null,
    latestCandidate,
  };
}
