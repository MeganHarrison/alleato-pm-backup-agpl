import Link from "next/link";
import { ArrowLeft, ArrowRight, MailOpen } from "lucide-react";

import { Badge, Button, DetailField, DetailFieldGrid, StatusBadge } from "@/components/ds";
import { PageShell, SectionRuleHeading } from "@/components/layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  cleanEmailText,
  parseReadableEmailThread,
  type ReadableEmailMessage,
} from "@/lib/email/readable-email";
import {
  TeamsConversationThread,
  parseTeamsConversation,
} from "@/features/documents/teams-conversation-thread";
import {
  createOutlookIntakeServiceClient,
  createRagServiceClient,
  createServiceClient,
  isRagDatabaseReadsEnabled,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database } from "@/types/database.types";
import type { Database as RagDatabase } from "@/types/rag-database.types";
import type { ReactNode } from "react";

export type SourceDocument = Database["public"]["Tables"]["document_metadata"]["Row"];
type RagSourceDocument = RagDatabase["public"]["Tables"]["rag_document_metadata"]["Row"];
type MeetingSourceSegment = Pick<
  Database["public"]["Tables"]["meeting_segments"]["Row"],
  "id" | "segment_index" | "summary" | "title"
>;

export type SourceDocumentDetailRecord = {
  source: SourceDocument;
  attachmentUrl: string | null;
  attachmentContentType: string | null;
  relatedTaskCount: number;
  meetingSegments: MeetingSourceSegment[];
};

type LoadSourceDocumentDetailOptions = {
  sourceDocumentId: string;
  projectId?: number | null;
  requiredType?: string;
};

type SourceDocumentDetailPageProps = {
  record: SourceDocumentDetailRecord;
  backHref: string;
  backLabel: string;
  description: string;
  projectSourceHref?: string | null;
  reviewActions?: ReactNode;
};

function formatLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function cleanSourceText(value: string | null | undefined): string {
  if (!value) return "";
  return cleanEmailText(value).replace(/\n{3,}/g, "\n\n");
}

function getReadableContent(source: SourceDocument): string {
  if (source.type === "email" || source.category === "email") {
    return cleanSourceText(source.content || source.raw_text);
  }

  return cleanSourceText(
    source.content ||
      source.raw_text ||
      source.summary ||
      source.overview ||
      source.description ||
      source.notes,
  );
}

function mergeSourceDocument(
  source: SourceDocument,
  ragSource?: RagSourceDocument | null,
): SourceDocument {
  if (!ragSource) return source;

  return {
    ...source,
    title: ragSource.title || source.title,
    type: ragSource.type || source.type,
    category: ragSource.category || source.category,
    source: ragSource.source || source.source,
    source_system: ragSource.source_system || source.source_system,
    summary: ragSource.summary || source.summary,
    overview: ragSource.overview || source.overview,
    content: ragSource.content || source.content,
    raw_text: ragSource.raw_text || source.raw_text,
    source_web_url: ragSource.source_web_url || source.source_web_url,
    url: ragSource.url || source.url,
  };
}

function attachmentDownloadUrl(
  projectId: number | null | undefined,
  attachmentId: number | null | undefined,
): string | null {
  if (typeof projectId !== "number" || !Number.isInteger(projectId)) return null;
  if (typeof attachmentId !== "number" || !Number.isInteger(attachmentId)) return null;
  return `/api/projects/${projectId}/email-attachments/${attachmentId}/download?disposition=inline`;
}

function getExternalSourceHref(source: SourceDocument): string | null {
  return (
    source.source_web_url ||
    source.fireflies_link ||
    source.meeting_link ||
    source.url ||
    null
  );
}

function getSourceContextHref(projectId: number, source: SourceDocument): string | null {
  if (source.type === "meeting") {
    return `/${projectId}/meetings/${encodeURIComponent(source.id)}`;
  }
  if (source.category === "knowledge") {
    return `/${projectId}/knowledge`;
  }
  return null;
}

function emailTitle(
  message: ReadableEmailMessage,
  fallback: string | null | undefined,
  index: number,
): string {
  return message.subject || fallback || `Email ${index + 1}`;
}

function emailSubtitle(message: ReadableEmailMessage): string {
  return [message.from, message.date ? formatDateTime(message.date) : null]
    .filter(Boolean)
    .join(" - ");
}

function getParticipants(source: SourceDocument): string[] {
  if (source.participants_array?.length) return source.participants_array;
  if (!source.participants) return [];
  return source.participants
    .replace(/[{}"]/g, "")
    .split(/[,;|\n]+/)
    .map((participant) => participant.trim())
    .filter(Boolean);
}

function meetingSegmentAnchorId(segmentId: string) {
  return `meeting-segment-${segmentId}`;
}

export async function loadSourceDocumentDetail(
  options: LoadSourceDocumentDetailOptions,
): Promise<SourceDocumentDetailRecord | null> {
  const supabase = createServiceClient();
  let query = serviceDb.from("document_metadata")
    .select("*")
    .eq("id", options.sourceDocumentId);

  if (typeof options.projectId === "number") {
    query = query.eq("project_id", options.projectId);
  }

  if (options.requiredType) {
    query = query.eq("type", options.requiredType);
  }

  const { data: source, error } = await query.single();

  if (error || !source) {
    return null;
  }

  const ragSupabase = isRagDatabaseReadsEnabled() ? createRagServiceClient() : null;
  const intakeSupabase = createOutlookIntakeServiceClient();
  const attachmentLinkResult =
    typeof source.project_id === "number"
      ? await intakeSupabase
          .from("outlook_email_intake_attachments")
          .select("*")
          .eq("document_metadata_id", options.sourceDocumentId)
          .maybeSingle()
      : { data: null, error: null };
  const ragSourceResult =
    ragSupabase
      ? await ragSupabase
          .from("rag_document_metadata")
          .select("*")
          .eq("id", options.sourceDocumentId)
          .single()
      : { data: null, error: null };

  const mergedSource = mergeSourceDocument(
    source,
    (ragSourceResult.data as RagSourceDocument | null) ?? null,
  );
  const attachmentUrl = attachmentDownloadUrl(
    source.project_id,
    attachmentLinkResult.data?.email_attachment_id ?? null,
  );
  const { count: relatedTaskCount, error: relatedTaskError } = await serviceDb.from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("metadata_id", options.sourceDocumentId);
  const { data: meetingSegments, error: meetingSegmentsError } = await serviceDb.from("meeting_segments")
    .select("id, segment_index, summary, title")
    .eq("metadata_id", options.sourceDocumentId)
    .order("segment_index", { ascending: true });

  if (relatedTaskError) {
    throw relatedTaskError;
  }

  if (meetingSegmentsError) {
    throw meetingSegmentsError;
  }

  return {
    source: mergedSource,
    attachmentUrl,
    attachmentContentType: attachmentLinkResult.data?.content_type ?? null,
    relatedTaskCount: relatedTaskCount ?? 0,
    meetingSegments: meetingSegments ?? [],
  };
}

export function SourceDocumentDetailPage({
  record,
  backHref,
  backLabel,
  description,
  projectSourceHref,
  reviewActions,
}: SourceDocumentDetailPageProps) {
  const { source, attachmentUrl, attachmentContentType, meetingSegments } = record;
  const readableContent = getReadableContent(source);
  const emailMessages =
    source.type === "email" || source.category === "email"
      ? parseReadableEmailThread(readableContent)
      : [];
  const teamsMessages =
    source.type === "teams_dm_conversation" ||
    source.type === "teams_dm" ||
    source.category === "teams_message"
      ? parseTeamsConversation(source.content ?? readableContent)
      : [];
  const externalHref = getExternalSourceHref(source);
  const sourceContextHref =
    typeof source.project_id === "number"
      ? getSourceContextHref(source.project_id, source)
      : null;
  const participants = getParticipants(source);
  const showAttachmentPdf =
    attachmentUrl &&
    (attachmentContentType === "application/pdf" ||
      source.title?.toLowerCase().endsWith(".pdf"));
  const showAttachmentImage =
    attachmentUrl && attachmentContentType?.startsWith("image/");

  return (
    <PageShell
      variant="content"
      title={source.title ?? "Source context"}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {projectSourceHref ? (
            <Button asChild size="sm" variant="outline">
              <Link href={projectSourceHref}>Project source detail</Link>
            </Button>
          ) : null}
          {sourceContextHref ? (
            <Button asChild size="sm" variant="outline">
              <Link href={sourceContextHref}>Open in project</Link>
            </Button>
          ) : null}
          {externalHref ? (
            <Button asChild size="sm" variant="outline">
              <a href={externalHref} target="_blank" rel="noopener noreferrer">
                Original source
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="ghost">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backLabel}
            </Link>
          </Button>
        </div>
      }
      contentClassName="space-y-8"
    >
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{formatLabel(source.type ?? source.category)}</Badge>
          {source.source ? <Badge variant="outline">{formatLabel(source.source)}</Badge> : null}
          {source.source_system ? (
            <Badge variant="outline">{formatLabel(source.source_system)}</Badge>
          ) : null}
          {source.status ? <StatusBadge status={source.status} /> : null}
        </div>

        <DetailFieldGrid columns={2}>
          <DetailField label="Source date">{formatDateTime(source.date)}</DetailField>
          <DetailField label="Captured">
            {formatDateTime(source.captured_at ?? source.created_at)}
          </DetailField>
          {source.project ? (
            <DetailField label="Project">{source.project}</DetailField>
          ) : null}
          {participants.length > 0 ? (
            <DetailField label="Participants">{participants.slice(0, 8).join(", ")}</DetailField>
          ) : null}
        </DetailFieldGrid>
      </section>

      {source.summary || source.overview ? (
        <section className="space-y-3">
          <SectionRuleHeading label="Summary" />
          <p className="text-sm leading-6 text-foreground">
            {cleanSourceText(source.summary || source.overview)}
          </p>
        </section>
      ) : null}

      {reviewActions ? (
        <section className="space-y-3">
          <SectionRuleHeading label="Review Actions" />
          {reviewActions}
        </section>
      ) : null}

      {meetingSegments.length > 0 ? (
        <section className="space-y-3">
          <SectionRuleHeading label={`Discussion Topics (${meetingSegments.length})`} />
          <ol className="divide-y divide-border">
            {meetingSegments.map((segment, index) => (
              <li
                key={segment.id}
                id={meetingSegmentAnchorId(segment.id)}
                className="scroll-mt-24 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex gap-2.5">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums text-muted-foreground">
                    {segment.segment_index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm font-medium text-foreground">
                      {segment.title || `Topic ${index + 1}`}
                    </p>
                    {segment.summary ? (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {cleanSourceText(segment.summary)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionRuleHeading label="Source Content" />
        {showAttachmentPdf ? (
          <div className="overflow-hidden rounded-md border border-border bg-background">
            <iframe
              src={attachmentUrl}
              title={source.title || "Attachment preview"}
              className="w-full"
              style={{ height: "52rem" }}
            />
          </div>
        ) : null}
        {showAttachmentImage ? (
          <div className="overflow-hidden rounded-md border border-border bg-background">
            <img
              src={attachmentUrl ?? ""}
              alt={source.title || "Attachment preview"}
              className="h-auto w-full"
            />
          </div>
        ) : null}
        {emailMessages.length > 0 ? (
          <div className="rounded-md border border-border bg-background">
            <div className="border-b border-border px-4 py-4">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <MailOpen className="h-3.5 w-3.5" />
                Email thread
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {source.title || emailMessages[0]?.subject || "Untitled email"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {emailMessages.length} message{emailMessages.length === 1 ? "" : "s"} parsed. Open an item to read the clean body text.
              </p>
            </div>
            <Accordion type="multiple" className="px-4">
              {emailMessages.map((message, index) => (
                <AccordionItem key={message.id} value={message.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <span className="min-w-0 text-left">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {emailTitle(message, source.title, index)}
                      </span>
                      {emailSubtitle(message) ? (
                        <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                          {emailSubtitle(message)}
                        </span>
                      ) : null}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <DetailFieldGrid columns={2} className="pb-4">
                      {message.from ? (
                        <DetailField label="From">{message.from}</DetailField>
                      ) : null}
                      {message.to ? (
                        <DetailField label="To">{message.to}</DetailField>
                      ) : null}
                      {message.cc ? (
                        <DetailField label="Cc">{message.cc}</DetailField>
                      ) : null}
                      {message.date ? (
                        <DetailField label="Date">{formatDateTime(message.date)}</DetailField>
                      ) : null}
                    </DetailFieldGrid>
                    {message.body ? (
                      <div className="max-w-none whitespace-pre-wrap text-sm leading-7 text-foreground">
                        {message.body}
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-muted-foreground">
                        No email body text was captured for this message; only the message headers are available.
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ) : teamsMessages.length > 0 ? (
          <TeamsConversationThread messages={teamsMessages} />
        ) : readableContent ? (
          <div className="max-w-none whitespace-pre-wrap text-sm leading-7 text-foreground">
            {readableContent}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No readable body content is stored for this source.
          </p>
        )}
      </section>
    </PageShell>
  );
}
