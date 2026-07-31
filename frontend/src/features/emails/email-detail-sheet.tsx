"use client";

import * as React from "react";
import { Paperclip, X } from "lucide-react";

import { StatusBadge } from "@/components/ds";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import type { ProjectEmail } from "@/hooks/use-emails";
import { buildEmailContentBlocks, type EmailContentBlock } from "./email-thread";

export interface EmailDetailRecord {
  id: string;
  subject: string;
  body: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  fromName: string | null;
  fromEmail: string | null;
  toList: string[] | null;
  ccList?: string[] | null;
  bccList?: string[] | null;
  status: string;
  sentAt?: string | null;
  receivedAt?: string | null;
  createdAt?: string | null;
  hasAttachments?: boolean | null;
  projectLabel?: string | null;
  sourceLabel?: string | null;
  webLink?: string | null;
  relatedLabel?: string | null;
}

interface EmailDetailSheetProps {
  email: EmailDetailRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions?: React.ReactNode;
}

interface EmailDetailPanelProps {
  email: EmailDetailRecord | null;
  onClose?: () => void;
  actions?: React.ReactNode;
}

function emailContentBlocks(email: EmailDetailRecord): EmailContentBlock[] {
  const rawBody =
    email.bodyText?.trim() ||
    email.body?.trim() ||
    email.bodyHtml?.trim() ||
    "";
  return buildEmailContentBlocks(rawBody);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatList(value: string[] | null | undefined): string {
  const list = value?.map((item) => item.trim()).filter(Boolean) ?? [];
  return list.length > 0 ? list.join(", ") : "Not provided";
}

function projectEmailLabel(email: ProjectEmail): string | null {
  const projectNumber = email.project?.project_number?.trim();
  const projectName = email.project?.name?.trim();

  if (projectNumber && projectName) return `${projectNumber} - ${projectName}`;
  return projectName || projectNumber || null;
}

function OutlookLogoIcon(props: React.SVGProps<SVGSVGElement>): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        d="M13.5 4.75h6.25c.83 0 1.5.67 1.5 1.5v11.5c0 .83-.67 1.5-1.5 1.5H13.5v-2h5.75V8.5L13.5 12.3v-2.4l5.12-3.15H13.5v-2Z"
      />
      <path
        fill="currentColor"
        d="M2.75 7.25 13.5 5.4v13.2L2.75 16.75V7.25Zm5.32 7.65c1.66 0 2.83-1.27 2.83-3.06 0-1.8-1.17-3.04-2.83-3.04-1.67 0-2.85 1.25-2.85 3.04 0 1.8 1.18 3.06 2.85 3.06Zm0-1.28c-.78 0-1.32-.73-1.32-1.78 0-1.04.54-1.76 1.32-1.76.77 0 1.3.72 1.3 1.76 0 1.05-.53 1.78-1.3 1.78Z"
      />
    </svg>
  );
}

export function projectEmailToDetailRecord(email: ProjectEmail): EmailDetailRecord {
  return {
    id: String(email.id),
    subject: email.subject,
    body: email.body,
    bodyHtml: email.body_html,
    bodyText: email.body_text,
    fromName: email.from_name,
    fromEmail: email.from_email,
    toList: email.to_list,
    ccList: email.cc_list,
    bccList: email.bcc_list,
    status: email.status,
    sentAt: email.sent_at,
    receivedAt: email.received_at,
    createdAt: email.created_at,
    hasAttachments: email.has_attachments,
    projectLabel: projectEmailLabel(email),
    sourceLabel: "Project email",
    relatedLabel: email.related_tool || email.distribution_group,
  };
}

export function EmailDetailSheet({
  email,
  open,
  onOpenChange,
  actions,
}: EmailDetailSheetProps): React.ReactElement {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 p-0 sm:max-w-none lg:w-full lg:max-w-3xl"
        aria-describedby="email-detail-description"
      >
        <EmailDetailPanel
          email={email}
          actions={actions}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

export function EmailDetailPanel({
  email,
  onClose,
  actions,
}: EmailDetailPanelProps): React.ReactElement {
  const contentBlocks = React.useMemo(
    () => (email ? emailContentBlocks(email) : []),
    [email],
  );
  const sender = email?.fromName || email?.fromEmail || "Unknown sender";
  const sentOrReceivedAt = email?.receivedAt || email?.sentAt || email?.createdAt;

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-card"
      aria-describedby="email-detail-description"
    >
      {email ? (
        <>
          <div className="border-b border-border/70 px-4 pb-5 pt-5 text-left sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-3">
                <div className="break-words text-xl font-semibold leading-7 text-foreground">
                  {email.subject || "Untitled email"}
                </div>
                <div
                  id="email-detail-description"
                  className="space-y-2 text-sm"
                >
                  <DetailItem label="From" value={sender} />
                  <DetailItem label="To" value={formatList(email.toList)} />
                  {email.ccList && email.ccList.length > 0 ? (
                    <DetailItem label="Cc" value={formatList(email.ccList)} />
                  ) : null}
                  <DetailItem label="Date" value={formatDateTime(sentOrReceivedAt)} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {actions}
                {onClose ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onClose}
                    aria-label="Close email details"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-6 px-4 py-6 sm:px-6">
              <section className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <StatusBadge status={email.status} />
                {email.sourceLabel ? (
                  <Badge variant="secondary">{email.sourceLabel}</Badge>
                ) : null}
                {email.hasAttachments ? (
                  <Badge variant="outline">
                    <Paperclip className="h-3 w-3" />
                    Attachments
                  </Badge>
                ) : null}
                {email.projectLabel ? (
                  <span className="text-muted-foreground">
                    <span className="text-xs font-medium uppercase tracking-wide">
                      Project:
                    </span>{" "}
                    <span className="text-foreground">{email.projectLabel}</span>
                  </span>
                ) : null}
                {email.relatedLabel ? (
                  <span className="text-muted-foreground">
                    <span className="text-xs font-medium uppercase tracking-wide">
                      Related:
                    </span>{" "}
                    <span className="text-foreground">{email.relatedLabel}</span>
                  </span>
                ) : null}
              </section>

              <section className="space-y-3">
                <EmailContent blocks={contentBlocks} />
                {email.webLink ? (
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a
                        href={email.webLink}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open in Outlook"
                        title="Open in Outlook"
                      >
                        <OutlookLogoIcon className="h-4 w-4 text-primary" />
                      </a>
                    </Button>
                  </div>
                ) : null}
              </section>
            </div>
          </ScrollArea>
        </>
      ) : (
        <div className="p-6 text-sm text-muted-foreground">No email selected.</div>
      )}
    </div>
  );
}

function EmailContent({ blocks }: { blocks: EmailContentBlock[] }): React.ReactElement {
  return (
    <div className="space-y-4 rounded-md bg-muted/30 px-4 py-4 text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
      {blocks.map((block) => {
        if (block.kind === "metadata" || block.kind === "quote-header") {
          return null;
        }

        if (block.kind === "warning") {
          return (
            <div
              key={block.id}
              className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium uppercase tracking-wide text-warning-foreground"
            >
              {block.lines.join(" ")}
            </div>
          );
        }

        return (
          <div key={block.id} className="space-y-2">
            {block.lines.map((line) => (
              <p key={line} className="whitespace-pre-wrap break-words">
                {line}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <div className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3">
      <div className="pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="break-words text-foreground [overflow-wrap:anywhere]">
        {value}
      </div>
    </div>
  );
}
