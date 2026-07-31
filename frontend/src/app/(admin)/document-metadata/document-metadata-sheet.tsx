"use client";

import * as React from "react";

import {
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  FolderOpen,
  MessageSquare,
  Users,
  X,
} from "lucide-react";

import { StatusBadge, InfoAlert } from "@/components/ds";
import {
  getFirstTeamsMessageTimestamp,
  TeamsConversation,
} from "@/components/document-metadata/teams-conversation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Markdown } from "@/components/misc/markdown";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocumentMetadataItem {
  id: string;
  title: string | null;
  type: string | null;
  source: string | null;
  source_system: string | null;
  content: string | null;
  summary: string | null;
  date: string | null;
  created_at: string | null;
  status: string | null;
  participants: string | null;
  project_id: number | null;
  project: string | null;
  phase: string;
  category: string | null;
  division: string | null;
  duration_minutes: number | null;
  meeting_type: string | null;
  host_email: string | null;
  organizer_email: string | null;
  url: string | null;
  fireflies_link: string | null;
  tags: string | null;
  file_name: string | null;
  file_path: string | null;
  source_web_url: string | null;
  keywords: string[] | null;
  source_metadata?: unknown;
  contentSource?: string | null;
  contentCheckedSources?: string[];
  contentUnavailableReason?: string | null;
}

interface DocumentMetadataSheetProps {
  item: DocumentMetadataItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: (direction: "prev" | "next") => void;
  canNavigatePrev?: boolean;
  canNavigateNext?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSheetTimestamp(value: string | null) {
  if (!value) return null;
  return new Date(value.replace(" ", "T")).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function isBinaryContent(content: string): boolean {
  // Detect raw PDF binary data — common patterns: %PDF header, /i255 tokens, or dense /N /N sequences
  if (content.startsWith("%PDF")) return true;
  const sample = content.slice(0, 200);
  const binaryTokens = (sample.match(/\/i?\d+/g) ?? []).length;
  // If more than 15 binary-style tokens in first 200 chars, treat as binary
  return binaryTokens > 15;
}

function typeLabel(type: string | null) {
  if (!type) return "Document";
  const map: Record<string, string> = {
    meeting: "Meeting",
    teams_dm: "Teams DM",
    teams_dm_conversation: "Teams Conversation",
    teams_message: "Teams Message",
    email: "Email",
    document: "Document",
  };
  return map[type] ?? type;
}

/** Label for the full-text content section, matched to the record type. */
function contentLabel(type: string | null) {
  if (!type) return "Preview";
  if (type.startsWith("teams")) return "Conversation";
  if (type === "meeting") return "Transcript";
  if (type === "email") return "Message";
  return "Preview";
}

function isAttachmentDocument(item: DocumentMetadataItem) {
  return (
    item.type === "email_attachment" ||
    item.category === "email_attachment" ||
    item.source_system === "outlook_attachment"
  );
}

function attachmentFileUrl(item: DocumentMetadataItem) {
  if (!isAttachmentDocument(item)) return null;
  if (item.url?.startsWith("http")) return item.url;

  const metadata = item.source_metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const attachmentId = (metadata as { attachment_id?: unknown }).attachment_id;
    if (typeof attachmentId === "number" && Number.isInteger(attachmentId)) {
      return `/api/email-attachments/${attachmentId}/download?disposition=inline`;
    }
  }

  return null;
}

function isImageFile(url: string, fileName: string | null) {
  return /\.(?:png|jpe?g|gif|webp|svg)(?:$|[?#])/i.test(`${fileName ?? ""} ${url}`);
}

function isPdfFile(url: string, fileName: string | null) {
  return /\.pdf(?:$|[?#])/i.test(`${fileName ?? ""} ${url}`);
}

function AttachmentPreview({ item, src }: { item: DocumentMetadataItem; src: string }) {
  if (isImageFile(src, item.file_name ?? item.title)) {
    return (
      <div className="flex min-h-72 items-center justify-center overflow-auto rounded-lg border border-border bg-muted/20 p-4">
        <img
          src={src}
          alt={item.file_name ?? item.title ?? "Attachment preview"}
          className="max-h-96 max-w-full object-contain"
        />
      </div>
    );
  }

  if (isPdfFile(src, item.file_name ?? item.title)) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
        <iframe
          src={src}
          className="h-96 w-full"
          title={item.file_name ?? item.title ?? "Attachment preview"}
        />
      </div>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
    >
      <ArrowRight className="h-3.5 w-3.5" />
      Open attachment
    </a>
  );
}

// ── Section component ─────────────────────────────────────────────────────────

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-0.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="break-words text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

function formatMetadataValue(value: string) {
  return value.replace(/_/g, " ");
}

// ── Sheet component ───────────────────────────────────────────────────────────

export function DocumentMetadataSheet({
  item,
  open,
  onOpenChange,
  onNavigate,
  canNavigatePrev = false,
  canNavigateNext = false,
}: DocumentMetadataSheetProps) {
  // Keyboard nav
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" && onNavigate && canNavigatePrev) {
        e.preventDefault();
        onNavigate("prev");
      } else if (e.key === "ArrowDown" && onNavigate && canNavigateNext) {
        e.preventDefault();
        onNavigate("next");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onNavigate, canNavigatePrev, canNavigateNext]);

  if (!item) return null;

  const link = item.fireflies_link ?? item.url;
  const host = item.host_email ?? item.organizer_email;
  const participantList = item.participants
    ? item.participants.split(/[,;|\n]+/).map((p) => p.trim()).filter(Boolean)
    : [];
  const primaryTimestamp =
    item.type?.startsWith("teams")
      ? getFirstTeamsMessageTimestamp(item.content) ?? item.date
      : item.date;
  const attachmentSrc = attachmentFileUrl(item);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="p-0 flex flex-col bg-card"
        showCloseButton={false}
        showOverlay={false}
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="secondary" className="text-xs shrink-0">
                  {typeLabel(item.type)}
                </Badge>
                {item.status && <StatusBadge status={item.status} />}
              </div>
              <SheetTitle className="text-base font-semibold leading-snug">
                {item.title ?? "Untitled"}
              </SheetTitle>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {onNavigate && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!canNavigatePrev}
                    onClick={() => onNavigate("prev")}
                    title="Previous (↑)"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={!canNavigateNext}
                    onClick={() => onNavigate("next")}
                    title="Next (↓)"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Meta strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
            {primaryTimestamp && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatSheetTimestamp(primaryTimestamp)}
              </span>
            )}
            {item.duration_minutes != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(item.duration_minutes)}
              </span>
            )}
            {item.project && (
              <span className="flex items-center gap-1">
                <FolderOpen className="h-3 w-3" />
                {item.project}
              </span>
            )}
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <ArrowRight className="h-3 w-3" />
                Open source
              </a>
            )}
          </div>
        </SheetHeader>

        <Separator />

        {/* Body */}
        <ScrollArea className="flex-1">
          <div className="space-y-6 px-5 py-5">

            {/* Document / file preview */}
            {(attachmentSrc ?? item.source_web_url ?? item.url ?? item.fireflies_link) && (
              <>
                <Section label="Preview">
                  {(() => {
                    if (attachmentSrc) {
                      return <AttachmentPreview item={item} src={attachmentSrc} />;
                    }

                    const src = item.source_web_url ?? item.url ?? item.fireflies_link ?? "";
                    const isSharePoint =
                      src.includes("sharepoint.com") || src.includes("onedrive.live.com");
                    const isGoogleDocs = src.includes("docs.google.com");
                    const isPublicPdf =
                      src.toLowerCase().endsWith(".pdf") && !isSharePoint;

                    if (isSharePoint) {
                      return (
                        <InfoAlert variant="info">
                          <span>Stored in SharePoint — open in Microsoft 365 to view.</span>
                          <a
                            href={src}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            Open in SharePoint
                          </a>
                        </InfoAlert>
                      );
                    }
                    if (isGoogleDocs) {
                      const embedSrc = src.replace(/\/edit.*$/, "/preview");
                      return (
                        <div className="overflow-hidden rounded-lg border border-border">
                          <iframe
                            src={embedSrc}
                            className="h-96 w-full"
                            title={item.title ?? "Document preview"}
                            allow="autoplay"
                          />
                        </div>
                      );
                    }
                    if (isPublicPdf) {
                      return (
                        <div className="overflow-hidden rounded-lg border border-border">
                          <iframe
                            src={src}
                            className="h-96 w-full"
                            title={item.title ?? "Document preview"}
                          />
                        </div>
                      );
                    }
                    return (
                      <a
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                        Open file
                      </a>
                    );
                  })()}
                </Section>
              </>
            )}

            {/* Summary */}
            {item.summary && (
              <>
                <Section label="Summary">
                  <Markdown className="text-sm [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 [&_p]:leading-relaxed [&_p]:mb-2 last:[&_p]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5 [&_strong]:font-semibold">
                    {item.summary}
                  </Markdown>
                </Section>
              </>
            )}

            {/* Content — full text, skip binary/unreadable data */}
            {item.content && !isBinaryContent(item.content) && (!attachmentSrc || !isPdfFile(attachmentSrc, item.file_name ?? item.title)) && (
              <>
                <Section label={contentLabel(item.type)}>
                  {item.type?.startsWith("teams") ? (
                    <TeamsConversation content={item.content} />
                  ) : (
                    <Markdown className="text-sm text-foreground [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-0.5 [&_p]:leading-relaxed [&_p]:mb-2 last:[&_p]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:font-semibold">
                      {item.content}
                    </Markdown>
                  )}
                </Section>
              </>
            )}

            {!item.content && item.contentUnavailableReason && (
              <>
                <Section label={contentLabel(item.type)}>
                  <InfoAlert variant="info">
                    <span>{item.contentUnavailableReason}</span>
                    {item.contentCheckedSources && item.contentCheckedSources.length > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        Sources checked: {item.contentCheckedSources.join(", ")}
                      </span>
                    )}
                  </InfoAlert>
                </Section>
              </>
            )}

            {/* Tags & keywords */}
            {(item.tags ?? (item.keywords?.length ?? 0) > 0) && (
              <>
                <Section label="Tags">
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags?.split(/[,;]+/).map((t) => t.trim()).filter(Boolean).map((t) => (
                      <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{t}</span>
                    ))}
                    {item.keywords?.map((k) => (
                      <span key={k} className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs">{k}</span>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {/* Participants */}
            {participantList.length > 0 && (
              <>
                <Section label="Participants">
                  <div className="flex flex-wrap gap-1.5">
                    {participantList.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs"
                      >
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {p}
                      </span>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {/* File info */}
            {(item.file_name ?? item.file_path ?? item.source_web_url ?? item.url) && (
              <>
                <Section label="File">
                  <div className="space-y-1">
                    {item.file_name && <p className="text-sm">{item.file_name}</p>}
                    {item.file_path && <p className="text-xs text-muted-foreground break-all">{item.file_path}</p>}
                    {(attachmentSrc ?? item.source_web_url ?? item.url) && (
                      <a href={(attachmentSrc ?? item.source_web_url ?? item.url)!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline break-all">
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        {attachmentSrc ?? item.source_web_url ?? item.url}
                      </a>
                    )}
                  </div>
                </Section>
              </>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border/60 pt-5">
              {host && (
                <DetailItem icon={Users} label="Host">
                  <span className="text-sm">{host}</span>
                </DetailItem>
              )}
              {item.meeting_type && (
                <DetailItem icon={Clock} label="Meeting Type">
                  <span className="text-sm">{formatMetadataValue(item.meeting_type)}</span>
                </DetailItem>
              )}
              {item.category && (
                <DetailItem icon={MessageSquare} label="Category">
                  <span className="text-sm">{formatMetadataValue(item.category)}</span>
                </DetailItem>
              )}
              {item.division && (
                <DetailItem icon={FolderOpen} label="Division">
                  <span className="text-sm">{item.division}</span>
                </DetailItem>
              )}
              {item.phase && (
                <DetailItem icon={FolderOpen} label="Phase">
                  <span className="text-sm">{formatMetadataValue(item.phase)}</span>
                </DetailItem>
              )}
              {item.source && (
                <DetailItem icon={ArrowRight} label="Source">
                  <span className="text-sm">{formatMetadataValue(item.source)}</span>
                </DetailItem>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
