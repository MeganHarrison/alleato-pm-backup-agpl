import { notFound } from "next/navigation";

import { ContentSectionStack, PageShell } from "@/components/layout";
import {
  Button,
  DetailField,
  DetailFieldGrid,
  InfoAlert,
  StatusBadge,
} from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { getFmdsTableDetailData } from "@/lib/fmds/fmds-tables.server";
import {
  candidateOutputHasStructuredRows,
  getVisionCandidateDisplayGrid,
  rowsForCandidateDisplay,
} from "@/lib/fmds/fmds-vision-candidate";

import { FmdsTableReviewForm } from "./review-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CandidateRow = Array<{
  key: string;
  text: string;
  rowSpan?: number;
  columnSpan?: number;
}>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function candidateCellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  const record = asRecord(value);
  if (!record) return "";
  for (const key of [
    "text",
    "value",
    "label",
    "normalized_value",
    "raw_value",
  ]) {
    const candidate = record[key];
    if (typeof candidate === "string" || typeof candidate === "number") {
      return String(candidate).trim();
    }
  }
  return "";
}

function candidateColumnLabel(value: string): string {
  const trimmed = value.trim();
  const containsLetters = /[A-Za-z]/.test(trimmed);
  const isAllCaps = containsLetters && trimmed === trimmed.toUpperCase();

  if (!isAllCaps) return trimmed;

  const sentenceCase = trimmed.toLowerCase().replace(/l\/min/g, "L/min");
  return sentenceCase.charAt(0).toUpperCase() + sentenceCase.slice(1);
}

function columnsFromStructure(structure: unknown): CandidateRow {
  const record = asRecord(structure);
  if (!record || !Array.isArray(record.columns)) return [];
  return record.columns
    .map((column, index) => ({
      key: `column-${index}`,
      text: candidateCellText(column),
    }))
    .filter((column) => column.text.length > 0);
}

function rowsFromStructure(structure: unknown): CandidateRow[] {
  const record = asRecord(structure);
  if (!record || !Array.isArray(record.rows)) return [];

  return rowsForCandidateDisplay(structure)
    .map((row, rowIndex) => {
      const rowRecord = asRecord(row);
      const values = Array.isArray(row)
        ? row
        : rowRecord && Array.isArray(rowRecord.cells)
          ? rowRecord.cells
          : rowRecord
            ? Object.values(rowRecord)
            : [];

      return values.map((value, columnIndex) => ({
        key: `${rowIndex}-${columnIndex}`,
        text: candidateCellText(value),
      }));
    })
    .filter((row) => row.some((cell) => cell.text.length > 0));
}

function reviewStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export async function FmdsTableDetailView({
  tableId,
  workspaceBasePath = "/fm-global",
}: {
  tableId: string;
  workspaceBasePath?: "/fm-global" | "/asrs";
}) {
  const data = await getFmdsTableDetailData(tableId);
  if (!data) notFound();

  const { table, revision, cells, latestReview, latestCandidate } = data;
  const cellRows: CandidateRow[] = Array.from(
    new Set(cells.map((cell) => cell.row_index)),
  ).map((rowIndex) =>
    cells
      .filter((cell) => cell.row_index === rowIndex)
      .sort((left, right) => left.column_index - right.column_index)
      .map((cell) => ({
        key: cell.id,
        text: [cell.normalized_value || cell.raw_value || "", cell.unit]
          .filter(Boolean)
          .join(" ")
          .trim(),
      }))
      .filter((cell) => cell.text.length > 0),
  );
  const candidateOutput = latestCandidate?.output ?? null;
  const outputRecord = asRecord(candidateOutput);
  const outputStructure = outputRecord?.extracted_structure;
  const tableVisionGrid = getVisionCandidateDisplayGrid(
    table.extracted_structure,
  );
  const outputVisionGrid = getVisionCandidateDisplayGrid(outputStructure);
  const tableStructureRows = rowsFromStructure(table.extracted_structure);
  const cellColumns = Array.from(
    new Map(
      cells
        .filter((cell) => cell.column_header)
        .map((cell) => [cell.column_index, cell.column_header as string]),
    ).entries(),
  )
    .sort(([left], [right]) => left - right)
    .map(([index, label]) => ({ key: `cell-column-${index}`, text: label }));
  const candidateColumns = cellColumns.length
    ? cellColumns
    : tableVisionGrid?.columns.length
      ? tableVisionGrid.columns
      : tableStructureRows.length
        ? columnsFromStructure(table.extracted_structure)
        : outputVisionGrid?.columns.length
          ? outputVisionGrid.columns
          : columnsFromStructure(outputStructure);
  const candidateRows = cellRows.some((row) =>
    row.some((cell) => cell.text.length > 0),
  )
    ? cellRows.filter((row) => row.some((cell) => cell.text.length > 0))
    : tableVisionGrid?.rows.length
      ? tableVisionGrid.rows
      : tableStructureRows.length
        ? tableStructureRows
        : outputVisionGrid?.rows.length
          ? outputVisionGrid.rows
          : rowsFromStructure(outputStructure);
  const candidateReady = candidateRows.some((row) =>
    row.some((cell) => cell.text.length > 0),
  );
  const latestCandidateReady =
    candidateOutputHasStructuredRows(candidateOutput);
  const verification = asRecord(outputRecord?.verification);
  const verificationDiscrepancies = Array.isArray(verification?.discrepancies)
    ? verification.discrepancies.length
    : null;
  const automatedCheckBlocksApproval = Boolean(
    latestCandidateReady &&
    verification &&
    (verification.exact_match !== true ||
      verification.completeness !== "complete" ||
      (verificationDiscrepancies ?? 0) > 0),
  );
  const approvalBlockedReason = !candidateReady
    ? "Approved is unavailable because this record has no structured table candidate to compare with the source."
    : automatedCheckBlocksApproval
      ? "Approved is unavailable because the automated cross-check found discrepancies or marked this extraction partial. Choose Needs changes and describe the exact issue."
      : undefined;
  const candidateSourceText =
    typeof outputRecord?.region_native_text === "string"
      ? outputRecord.region_native_text.trim()
      : "";
  const sourcePdfHref = table.source_pdf_url
    ? `${table.source_pdf_url}#page=${table.page_start}`
    : null;
  const initialReviewDecision =
    latestReview?.decision === "approved" ||
    latestReview?.decision === "changes_requested" ||
    latestReview?.decision === "rejected"
      ? latestReview.decision
      : null;

  return (
    <PageShell
      variant="detail"
      title={`${table.table_identifier}${table.title ? `: ${table.title}` : ""}`}
      description={`${revision.document_code} · ${revision.revision_label} · p. ${table.page_start}`}
      statusBadge={
        <StatusBadge status={reviewStatusLabel(table.review_status)} />
      }
      breadcrumbs={[
        {
          label:
            workspaceBasePath === "/asrs" ? "ASRS Intelligence" : "FM Global",
          href: workspaceBasePath,
        },
        {
          label: "Tables",
          href:
            workspaceBasePath === "/asrs"
              ? "/asrs/tables"
              : "/fm-global/fm_global_tables",
        },
        { label: table.table_identifier },
      ]}
    >
      <ContentSectionStack className="space-y-8">
        <section>
          <div className="space-y-8">
            <section aria-label="Original source">
              <SectionRuleHeading
                label="Original source excerpt (authoritative)"
                actions={
                  sourcePdfHref ? (
                    <Button
                      variant="link"
                      size="sm"
                      asChild
                      className="h-auto px-0 py-0 text-xs font-semibold"
                    >
                      <a href={sourcePdfHref} target="_blank" rel="noreferrer">
                        View PDF
                      </a>
                    </Button>
                  ) : undefined
                }
              />
              {table.signed_evidence_url ? (
                <a
                  href={table.signed_evidence_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border border-border bg-card p-3"
                >
                  {/* TODO: Render the authoritative source as structured HTML when source cells are available so reviewers can compare row by row. */}
                  <img
                    src={table.signed_evidence_url}
                    alt={`Original FMDS source excerpt for ${table.table_identifier}`}
                    className="h-auto w-full object-contain"
                  />
                </a>
              ) : (
                <div className="rounded-md bg-destructive/10 p-6 text-sm text-destructive">
                  Review is blocked because the original source image is
                  unavailable.
                </div>
              )}
            </section>

            <section aria-label="Candidate extraction">
              <SectionRuleHeading label="Candidate extraction (review this)" />
              {candidateReady ? (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full border-collapse text-sm">
                    {candidateColumns.length ? (
                      <thead className="bg-muted/60">
                        <tr className="border-b border-border">
                          {candidateColumns.map((column) => (
                            <th
                              key={column.key}
                              scope="col"
                              className="border-r border-border px-3 py-2 text-left text-xs normal-case tracking-normal align-bottom font-medium last:border-r-0"
                            >
                              {candidateColumnLabel(column.text)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                    ) : null}
                    <tbody>
                      {candidateRows.map((row, rowIndex) => (
                        <tr
                          key={rowIndex}
                          className="border-b border-border last:border-0"
                        >
                          {row.map((cell) => (
                            <td
                              key={cell.key}
                              rowSpan={cell.rowSpan}
                              colSpan={cell.columnSpan}
                              className="border-r border-border px-3 py-2 align-top last:border-r-0"
                            >
                              {cell.text}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-md bg-muted/50 p-6">
                  <p className="font-medium text-foreground">
                    Not ready for review
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    The extraction pipeline did not produce a structured table
                    for this record. There is currently nothing to approve.
                    Choose Needs changes below so this table returns to
                    extraction.
                  </p>
                  {latestCandidate?.extraction_error ? (
                    <p className="mt-3 text-sm text-destructive">
                      {latestCandidate.extraction_error}
                    </p>
                  ) : null}
                </div>
              )}

              {candidateReady && verification && automatedCheckBlocksApproval ? (
                <InfoAlert variant="warning" role="alert" className="mt-3">
                  <p className="font-medium">Automated check found an issue</p>
                  <p className="mt-0.5 opacity-90">
                    Resolve the differences before approving.
                  </p>
                </InfoAlert>
              ) : null}

              {candidateReady && verification && !automatedCheckBlocksApproval ? (
                <p className="mt-3 text-sm text-success" role="status">
                  Automated check: no discrepancies.
                </p>
              ) : null}

              {candidateSourceText ? (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer font-medium text-foreground">
                    Show unstructured candidate text
                  </summary>
                  <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    {candidateSourceText}
                  </pre>
                </details>
              ) : null}
            </section>
          </div>
        </section>

        <section>
          <SectionRuleHeading label="Record the review" />
          <FmdsTableReviewForm
            tableId={table.id}
            evidencePath={table.review_evidence_path}
            candidateIds={
              latestCandidate && latestCandidateReady
                ? [latestCandidate.id]
                : []
            }
            canApprove={candidateReady && !automatedCheckBlocksApproval}
            approvalBlockedReason={approvalBlockedReason}
            initialDecision={initialReviewDecision}
            initialNotes={latestReview?.notes ?? ""}
          />
        </section>

        {latestReview ? (
          <section className="text-sm">
            <SectionRuleHeading label="Latest review" />
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={reviewStatusLabel(latestReview.decision)}
                />
                <span className="font-medium text-foreground">
                  by {latestReview.reviewer_id}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                {latestReview.notes}
              </p>
            </div>
          </section>
        ) : null}

        <details className="text-sm">
          <summary className="inline-flex cursor-pointer list-none items-center rounded-lg border border-border bg-muted/50 px-3.5 py-2 font-medium text-muted-foreground hover:bg-muted [&::-webkit-details-marker]:hidden">
            Extraction diagnostics
          </summary>
          <div className="pt-4">
            <DetailFieldGrid columns={2}>
              <DetailField label="Method">
                {table.extraction_method}
              </DetailField>
              <DetailField label="Confidence">
                {table.extraction_confidence ?? "Not available"}
              </DetailField>
              <DetailField label="Review reason">
                {table.review_reason}
              </DetailField>
              {latestCandidate ? (
                <DetailField label="Candidate source">
                  {latestCandidate.provider}, {latestCandidate.model}
                </DetailField>
              ) : null}
            </DetailFieldGrid>
          </div>
        </details>
      </ContentSectionStack>
    </PageShell>
  );
}

export default async function FmdsTableDetailPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  return <FmdsTableDetailView tableId={tableId} />;
}
