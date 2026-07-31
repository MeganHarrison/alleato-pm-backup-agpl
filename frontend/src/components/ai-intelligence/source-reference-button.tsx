"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge, Button } from "@/components/ds";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cleanEmailText, parseReadableEmailThread } from "@/lib/email/readable-email";

export type SourceReferenceRecord = {
  id: string;
  title: string | null;
  type: string | null;
  category: string | null;
  source: string | null;
  sourceSystem: string | null;
  date: string | null;
  createdAt: string | null;
  summary: string | null;
  overview: string | null;
  description: string | null;
  notes: string | null;
  content: string | null;
  rawText: string | null;
  sourceWebUrl: string | null;
  firefliesLink: string | null;
  meetingLink: string | null;
  url: string | null;
  participants: string[];
  attachmentDownloadUrl?: string | null;
  attachmentContentType?: string | null;
  attachmentFileName?: string | null;
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

function getReadableContent(source: SourceReferenceRecord): string {
  if (source.type === "email" || source.category === "email") {
    return cleanSourceText(source.content || source.rawText);
  }

  return cleanSourceText(
    source.content ||
      source.rawText ||
      source.summary ||
      source.overview ||
      source.description ||
      source.notes,
  );
}

function externalHref(source: SourceReferenceRecord): string | null {
  return source.sourceWebUrl || source.firefliesLink || source.meetingLink || source.url || null;
}

function isPdfAttachment(source: SourceReferenceRecord): boolean {
  return (
    source.attachmentContentType === "application/pdf" ||
    source.attachmentFileName?.toLowerCase().endsWith(".pdf") === true
  );
}

function isImageAttachment(source: SourceReferenceRecord): boolean {
  return source.attachmentContentType?.startsWith("image/") === true;
}

type SourceReferenceButtonProps = {
  buttonLabel?: string;
  projectId: number;
  source: SourceReferenceRecord;
};

export function SourceReferenceButton({
  buttonLabel = "Source",
  projectId,
  source,
}: SourceReferenceButtonProps) {
  const [open, setOpen] = useState(false);
  const content = useMemo(() => getReadableContent(source), [source]);
  const messages = useMemo(() => parseReadableEmailThread(content), [content]);
  const href = externalHref(source);
  const attachmentUrl = source.attachmentDownloadUrl ?? null;
  const showPdfPreview = attachmentUrl && isPdfAttachment(source);
  const showImagePreview = attachmentUrl && isImageAttachment(source);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="ghost"
        size="sm"
        className="h-auto p-0 text-xs font-medium text-foreground underline-offset-4 hover:underline"
      >
        {buttonLabel}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} modal={false}>
        <SheetContent
          side="right"
          className="gap-0 p-0 sm:max-w-3xl"
          showOverlay={false}
          showCloseButton={true}
        >
          <SheetHeader className="px-5 pt-5 pb-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{formatLabel(source.type || source.category)}</Badge>
                {source.sourceSystem ? (
                  <Badge variant="outline">{formatLabel(source.sourceSystem)}</Badge>
                ) : null}
              </div>
              <SheetTitle className="pr-8 text-sm leading-6">
                {source.title || "Untitled source"}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {formatDateTime(source.date || source.createdAt)}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {source.participants.length > 0 ? (
                  <span>{source.participants.slice(0, 6).join(", ")}</span>
                ) : null}
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                  >
                    Original
                    <ArrowRight className="h-3 w-3" />
                  </a>
                ) : null}
                <Link
                  href={`/${projectId}/intelligence/sources/${encodeURIComponent(source.id)}`}
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  Full page
                </Link>
              </div>
            </div>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {showPdfPreview ? (
              <div className="space-y-2 pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Attachment preview
                </p>
                <div className="overflow-hidden rounded-md border border-border bg-muted/20">
                  <iframe
                    src={attachmentUrl}
                    title={source.attachmentFileName || source.title || "Attachment preview"}
                    className="w-full"
                    style={{ height: "42rem" }}
                  />
                </div>
              </div>
            ) : null}

            {showImagePreview ? (
              <div className="space-y-2 pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Attachment preview
                </p>
                <div className="overflow-hidden rounded-md border border-border bg-muted/20">
                  <img
                    src={attachmentUrl}
                    alt={source.attachmentFileName || source.title || "Attachment preview"}
                    className="h-auto w-full"
                  />
                </div>
              </div>
            ) : null}

            {attachmentUrl && !showPdfPreview && !showImagePreview ? (
              <div className="space-y-2 pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Attachment
                </p>
                <a
                  href={attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-foreground underline-offset-4 hover:underline"
                >
                  Open attachment
                  <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            ) : null}

            {source.summary || source.overview ? (
              <div className="space-y-2 pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Summary
                </p>
                <p className="text-sm leading-7 text-foreground">
                  {cleanSourceText(source.summary || source.overview)}
                </p>
              </div>
            ) : null}

            {messages.length > 0 ? (
              <div className="space-y-5">
                {messages.map((message, index) => (
                  <article key={message.id} className="space-y-2 border-t border-border/70 pt-4 first:border-t-0 first:pt-0">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {message.subject || source.title || `Email ${index + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[message.from, formatDateTime(message.date)].filter(Boolean).join(" - ")}
                      </p>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                      {message.body || "No readable body content."}
                    </pre>
                  </article>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Source content
                </p>
                <pre className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                  {content || "No readable source content available."}
                </pre>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
