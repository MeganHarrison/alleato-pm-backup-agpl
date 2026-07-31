import Link from "next/link";

import {
  LabelValueRow,
  PageShell,
  SectionRuleHeading,
} from "@/components/layout";
import {
  InlineTable,
  InlineTableHeader,
  InlineTableHeaderRow,
  InlineTableHeaderCell,
  InlineTableBody,
  InlineTableRow,
  InlineTableCell,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { loadMeetingLineage } from "@/lib/meetings/lineage";
import { parseTranscriptSections } from "../parse-transcript-sections";

interface PageProps {
  params: Promise<{ projectId: string; meetingId: string }>;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <SectionRuleHeading label={title} />
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function KeyValueList({
  rows,
}: {
  rows: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <div className="divide-y divide-border rounded-md border border-border">
      {rows.map((row) => (
        <div key={row.label} className="px-4 py-3">
          <LabelValueRow label={row.label}>{row.value}</LabelValueRow>
        </div>
      ))}
    </div>
  );
}

function JsonDetails({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <details className="rounded-md border border-border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
        {label}
      </summary>
      <pre className="overflow-x-auto border-t border-border px-4 py-3 text-xs leading-6 text-muted-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function EmptyRows({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function RowTable({
  columns,
  rows,
}: {
  columns: Array<{ key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }>;
  rows: Array<Record<string, unknown>>;
}) {
  return (
    <InlineTable variant="read">
      <InlineTableHeader>
        <InlineTableHeaderRow>
          {columns.map((column) => (
            <InlineTableHeaderCell key={column.key}>
              {column.label}
            </InlineTableHeaderCell>
          ))}
        </InlineTableHeaderRow>
      </InlineTableHeader>
      <InlineTableBody>
        {rows.map((row, index) => (
          <InlineTableRow key={String(row.id ?? index)}>
            {columns.map((column) => {
              const raw = row[column.key];
              return (
                <InlineTableCell
                  key={column.key}
                  className="align-top"
                >
                  {column.render
                    ? column.render(row)
                    : typeof raw === "object" && raw !== null
                      ? JSON.stringify(raw)
                      : String(raw ?? "")}
                </InlineTableCell>
              );
            })}
          </InlineTableRow>
        ))}
      </InlineTableBody>
    </InlineTable>
  );
}

function excerpt(value: string | null | undefined, max = 220) {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

export default async function MeetingLineagePage({ params }: PageProps) {
  const { projectId, meetingId } = await params;
  const data = await loadMeetingLineage(projectId, meetingId);

  const parsedSections = data.document?.content
    ? parseTranscriptSections(data.document.content)
    : null;

  const documentTitle =
    data.document?.title ?? data.structuredMeeting?.name ?? "Meeting lineage";

  return (
    <PageShell
      variant="content"
      title="Meeting Lineage"
      description={`Temporary inspection surface for ${documentTitle}`}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${projectId}/meetings/${meetingId}`}>
              Back to meeting
            </Link>
          </Button>
          {data.document?.fireflies_link ? (
            <Button asChild size="sm">
              <Link href={data.document.fireflies_link} target="_blank">
                Open Fireflies
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-10 pb-12">
        <Section
          title="Resolution"
          description="This shows how the route parameter resolved into the meeting’s actual stored ids."
        >
          <KeyValueList
            rows={[
              { label: "Project", value: `${data.projectName} (${data.projectId})` },
              { label: "Route param", value: data.routeMeetingId },
              { label: "Route kind", value: data.routeKind },
              { label: "Resolved document id", value: data.documentId ?? "None" },
              {
                label: "Structured meeting id",
                value: data.structuredMeeting?.id ?? "None",
              },
              {
                label: "Transcript storage url",
                value: data.document?.url ?? "None",
              },
            ]}
          />
        </Section>

        <Section
          title="Observed Writes"
          description="Every queried table is listed here, including zero-row sections and query errors."
        >
          <RowTable
            columns={[
              { key: "label", label: "Table" },
              { key: "count", label: "Rows" },
              { key: "status", label: "Status" },
              { key: "error", label: "Error" },
            ]}
            rows={data.inventory}
          />
        </Section>

        <Section
          title="Schema Notes"
          description="These notes explain absences or current schema realities that affect how meeting output is stored."
        >
          <div className="space-y-2">
            {data.schemaNotes.map((note) => (
              <p key={note} className="text-sm leading-6 text-muted-foreground">
                {note}
              </p>
            ))}
          </div>
        </Section>

        <Section
          title="Document Metadata"
          description="Core transcript/document row plus the summary-style fields already written onto it."
        >
          {data.document ? (
            <div className="space-y-4">
              <KeyValueList
                rows={[
                  { label: "Title", value: data.document.title ?? "Untitled" },
                  { label: "Type", value: data.document.type ?? "None" },
                  { label: "Source", value: data.document.source ?? "None" },
                  {
                    label: "Summary embedding",
                    value:
                      data.document.summary_embedding == null ? "null" : "present",
                  },
                  {
                    label: "Short summary",
                    value: excerpt(parsedSections?.shortSummary ?? data.document.summary),
                  },
                  {
                    label: "Overview",
                    value: excerpt(parsedSections?.shortOverview ?? data.document.overview),
                  },
                  { label: "Notes", value: excerpt(data.document.notes) },
                  { label: "Action items", value: excerpt(data.document.action_items) },
                ]}
              />
              <JsonDetails label="Raw document_metadata row" value={data.document} />
            </div>
          ) : (
            <EmptyRows label="No document_metadata row resolved for this route." />
          )}
        </Section>

        <Section
          title="Structured Meeting Row"
          description="The meeting-tool row linked to this transcript, if one exists."
        >
          {data.structuredMeeting ? (
            <div className="space-y-4">
              <KeyValueList
                rows={[
                  { label: "Meeting id", value: data.structuredMeeting.id },
                  { label: "Name", value: data.structuredMeeting.name },
                  {
                    label: "Transcript document id",
                    value: data.structuredMeeting.transcript_document_id ?? "None",
                  },
                  { label: "Mode", value: data.structuredMeeting.mode },
                  {
                    label: "Draft",
                    value: data.structuredMeeting.is_draft ? "Yes" : "No",
                  },
                ]}
              />
              <JsonDetails label="Raw meetings row" value={data.structuredMeeting} />
            </div>
          ) : (
            <EmptyRows label="No linked structured `meetings` row was found." />
          )}
        </Section>

        <Section
          title="Structured Agenda Tables"
          description="Rows attached to the linked `meetings.id` owner instead of the transcript document id."
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <SectionRuleHeading label={`meeting_categories (${data.meetingCategories.length})`} />
              {data.meetingCategories.length > 0 ? (
                <RowTable
                  columns={[
                    { key: "position", label: "Position" },
                    { key: "name", label: "Name" },
                    { key: "id", label: "Id" },
                  ]}
                  rows={data.meetingCategories as unknown as Array<Record<string, unknown>>}
                />
              ) : (
                <EmptyRows label="No meeting_categories rows." />
              )}
            </div>
            <div className="space-y-3">
              <SectionRuleHeading label={`meeting_items (${data.meetingItems.length})`} />
              {data.meetingItems.length > 0 ? (
                <RowTable
                  columns={[
                    { key: "position", label: "Position" },
                    { key: "status", label: "Status" },
                    { key: "title", label: "Title" },
                    { key: "category_id", label: "Category id" },
                  ]}
                  rows={data.meetingItems as unknown as Array<Record<string, unknown>>}
                />
              ) : (
                <EmptyRows label="No meeting_items rows." />
              )}
            </div>
            <div className="space-y-3">
              <SectionRuleHeading label={`meeting_attendees (${data.meetingAttendees.length})`} />
              {data.meetingAttendees.length > 0 ? (
                <RowTable
                  columns={[
                    { key: "person_id", label: "Person id" },
                    { key: "is_required", label: "Required" },
                    { key: "attended", label: "Attended" },
                  ]}
                  rows={data.meetingAttendees as unknown as Array<Record<string, unknown>>}
                />
              ) : (
                <EmptyRows label="No meeting_attendees rows." />
              )}
            </div>
          </div>
        </Section>

        <Section
          title="Meeting Segments and Tasks"
          description="Direct transcript-linked extraction rows tied to `document_metadata.id`."
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <SectionRuleHeading label={`meeting_segments (${data.meetingSegments.length})`} />
              {data.meetingSegments.length > 0 ? (
                <RowTable
                  columns={[
                    { key: "segment_index", label: "Index" },
                    { key: "title", label: "Title" },
                    { key: "summary", label: "Summary" },
                    {
                      key: "tasks",
                      label: "Tasks",
                      render: (row) => excerpt(JSON.stringify(row.tasks), 180),
                    },
                    {
                      key: "risks",
                      label: "Risks",
                      render: (row) => excerpt(JSON.stringify(row.risks), 180),
                    },
                    {
                      key: "decisions",
                      label: "Decisions",
                      render: (row) => excerpt(JSON.stringify(row.decisions), 180),
                    },
                  ]}
                  rows={data.meetingSegments as unknown as Array<Record<string, unknown>>}
                />
              ) : (
                <EmptyRows label="No meeting_segments rows." />
              )}
            </div>
            <div className="space-y-3">
              <SectionRuleHeading label={`tasks (${data.tasks.length})`} />
              {data.tasks.length > 0 ? (
                <RowTable
                  columns={[
                    { key: "status", label: "Status" },
                    { key: "title", label: "Title" },
                    { key: "assignee_name", label: "Assignee" },
                    { key: "source_system", label: "Source" },
                    { key: "meeting_item_id", label: "Meeting item id" },
                    { key: "segment_id", label: "Segment id" },
                  ]}
                  rows={data.tasks as unknown as Array<Record<string, unknown>>}
                />
              ) : (
                <EmptyRows label="No tasks rows linked by metadata_id." />
              )}
            </div>
          </div>
        </Section>

        <Section
          title="Prep and Summary Artifacts"
          description="This is where generated meeting prep/digest content lands today."
        >
          {data.meetingPreps.length > 0 ? (
            <RowTable
              columns={[
                { key: "generated_by", label: "Generated by" },
                { key: "model_used", label: "Model" },
                { key: "version", label: "Version" },
                { key: "updated_at", label: "Updated" },
                {
                  key: "content",
                  label: "Content",
                  render: (row) => excerpt(String(row.content ?? ""), 260),
                },
              ]}
              rows={data.meetingPreps as unknown as Array<Record<string, unknown>>}
            />
          ) : (
            <EmptyRows label="No meeting_preps rows. The current digest route is backed by meeting_preps, so this means no generated prep/digest row exists for this meeting." />
          )}
        </Section>

        <Section
          title="Curated Intelligence"
          description="This view stays focused on the synthesized insight cards written from this meeting."
        >
          <div className="space-y-3">
            <SectionRuleHeading label={`Risk insight cards (${data.insightCards.length})`} />
            {data.insightCards.length > 0 ? (
              <RowTable
                columns={[
                  { key: "card_type", label: "Type" },
                  { key: "severity", label: "Severity" },
                  { key: "title", label: "Title" },
                  {
                    key: "summary",
                    label: "Summary",
                    render: (row) => excerpt(String(row.summary ?? ""), 180),
                  },
                  {
                    key: "why_it_matters",
                    label: "Why it matters",
                    render: (row) => excerpt(String(row.why_it_matters ?? ""), 180),
                  },
                  { key: "current_status", label: "Status" },
                  { key: "source_count", label: "Sources" },
                ]}
                rows={data.insightCards as unknown as Array<Record<string, unknown>>}
              />
            ) : (
              <EmptyRows label="No insight_cards rows linked to this meeting." />
            )}
          </div>
        </Section>

        <Section
          title="Pipeline and RAG"
          description="Operational rows and chunk-level transcript persistence."
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <SectionRuleHeading label={`fireflies_ingestion_jobs (${data.firefliesIngestionJobs.length})`} />
              {data.firefliesIngestionJobs.length > 0 ? (
                <RowTable
                  columns={[
                    { key: "stage", label: "Stage" },
                    { key: "attempt_count", label: "Attempts" },
                    { key: "last_attempt_at", label: "Last attempt" },
                    { key: "error_message", label: "Error" },
                    { key: "updated_at", label: "Updated" },
                  ]}
                  rows={data.firefliesIngestionJobs as unknown as Array<Record<string, unknown>>}
                />
              ) : (
                <EmptyRows label="No fireflies_ingestion_jobs rows." />
              )}
            </div>
            <div className="space-y-3">
              <SectionRuleHeading label={`document_attribution_candidates (${data.documentAttributionCandidates.length})`} />
              {data.documentAttributionCandidates.length > 0 ? (
                <RowTable
                  columns={[
                    { key: "status", label: "Status" },
                    { key: "confidence_label", label: "Confidence" },
                    { key: "candidate_project_name", label: "Candidate project" },
                    { key: "reasoning", label: "Reasoning" },
                  ]}
                  rows={data.documentAttributionCandidates as unknown as Array<Record<string, unknown>>}
                />
              ) : (
                <EmptyRows label="No document_attribution_candidates rows." />
              )}
            </div>
            <div className="space-y-3">
              <SectionRuleHeading label={`document_chunks (${data.documentChunks.length})`} />
              {data.ragChunksError ? (
                <EmptyRows label={`RAG chunk query error: ${data.ragChunksError}`} />
              ) : data.documentChunks.length > 0 ? (
                <RowTable
                  columns={[
                    { key: "chunk_index", label: "Chunk" },
                    { key: "source_type", label: "Source type" },
                    {
                      key: "metadata",
                      label: "Metadata",
                      render: (row) => excerpt(JSON.stringify(row.metadata), 180),
                    },
                    {
                      key: "text",
                      label: "Text",
                      render: (row) => excerpt(String(row.text ?? ""), 220),
                    },
                  ]}
                  rows={data.documentChunks as unknown as Array<Record<string, unknown>>}
                />
              ) : (
                <EmptyRows label="No document_chunks rows." />
              )}
            </div>
          </div>
        </Section>
      </div>
    </PageShell>
  );
}
