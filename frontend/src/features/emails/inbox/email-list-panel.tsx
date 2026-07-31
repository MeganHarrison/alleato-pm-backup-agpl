"use client";

import * as React from "react";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";
import {
  Inbox,
  Mail,
  Paperclip,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExpandingSearch } from "@/components/ds";
import type { InboxEmail, InboxTab, ReviewedEmail } from "./email-inbox-client";

interface EmailListPanelProps {
  emails: InboxEmail[];
  reviewedEmails: ReviewedEmail[];
  isLoading: boolean;
  activeTab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  search: string;
  onSearchChange: (v: string) => void;
  needsAssignmentCount: number;
  brandonQueueCount: number;
  reviewedCount: number;
}

const TABS: { id: InboxTab; label: string }[] = [
  { id: "brandon-queue", label: "Brandon Queue" },
  { id: "needs-assignment", label: "Needs Assignment" },
  { id: "all", label: "All" },
  { id: "has-attachments", label: "Attachments" },
  { id: "reviewed", label: "Reviewed" },
];

function formatEmailDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return format(d, "EEE");
  return format(d, "MMM d");
}

function senderLabel(email: InboxEmail): string {
  return email.fromName ?? email.fromEmail ?? "Unknown";
}

function groupLabel(receivedAt: string | null): string {
  if (!receivedAt) return "Unknown";
  const d = new Date(receivedAt);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return format(d, "EEEE");
  return format(d, "MMMM yyyy");
}

interface GroupedEmails {
  label: string;
  emails: InboxEmail[];
}

function groupEmails(emails: InboxEmail[]): GroupedEmails[] {
  const groups: Map<string, InboxEmail[]> = new Map();
  for (const email of emails) {
    const label = groupLabel(email.receivedAt);
    const existing = groups.get(label) ?? [];
    existing.push(email);
    groups.set(label, existing);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    emails: items,
  }));
}

const ACTION_LABEL: Record<InboxEmail["assistantAction"], string> = {
  reply: "Reply",
  delegate: "Delegate",
  watch: "Watch",
  ignore: "No action",
};

const ACTION_CLASS: Record<InboxEmail["assistantAction"], string> = {
  reply: "bg-primary/10 text-primary",
  delegate: "bg-warning-subtle text-warning",
  watch: "bg-info-subtle text-info",
  ignore: "bg-muted text-muted-foreground",
};

function EmailRow({
  email,
  isSelected,
  onSelect,
}: {
  email: InboxEmail;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const sender = senderLabel(email);
  const date = formatEmailDate(email.receivedAt);
  const isUnread = email.matchStatus === "unassigned" && !email.projectId;

  return (
    <Button
      variant="ghost"
      onClick={onSelect}
      className={cn(
        "w-full h-auto text-left px-3 py-2.5 rounded-none justify-start",
        "hover:bg-accent/60 focus-visible:ring-1 focus-visible:ring-primary/30",
        isSelected && "bg-accent hover:bg-accent",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex-1 min-w-0">
          {/* Top row: sender + date */}
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <span
              className={cn(
                "text-sm truncate",
                isUnread ? "font-semibold text-foreground" : "font-medium text-foreground",
              )}
            >
              {sender}
            </span>
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {date}
            </span>
          </div>

          {/* Subject */}
          <p
            className={cn(
              "text-xs truncate mb-1",
              isUnread ? "text-foreground font-medium" : "text-muted-foreground",
            )}
          >
            {email.subject}
          </p>

          {/* Bottom row: project chip + icons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {email.assistantAction !== "ignore" && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium leading-none",
                  ACTION_CLASS[email.assistantAction],
                )}
              >
                {ACTION_LABEL[email.assistantAction]}
                {email.assistantPriority === "urgent" && " now"}
              </span>
            )}

            {email.project ? (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium leading-none">
                {email.project.projectNumber
                  ? `${email.project.projectNumber} · ${email.project.name ?? ""}`
                  : (email.project.name ?? `Project ${email.project.id}`)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-warning-subtle text-warning font-medium leading-none">
                Unassigned
              </span>
            )}

            {email.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-info-subtle text-info font-medium leading-none"
              >
                {tag}
              </span>
            ))}

            <div className="ml-auto flex items-center gap-1">
              {email.starred && (
                <Star className="size-3 fill-warning text-warning" />
              )}
              {email.hasAttachments && (
                <Paperclip className="size-3 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      </div>
    </Button>
  );
}

const REVIEWED_OUTCOME_LABEL: Record<string, string> = {
  draft_copied: "Draft copied",
  draft_edited: "Draft edited",
  delegated: "Delegated",
  watched: "Watching",
  skipped: "Skipped",
  marked_no_action: "No action",
};

const REVIEWED_OUTCOME_CLASS: Record<string, string> = {
  draft_copied: "bg-primary/10 text-primary",
  draft_edited: "bg-primary/10 text-primary",
  delegated: "bg-warning-subtle text-warning",
  watched: "bg-info-subtle text-info",
  skipped: "bg-muted text-muted-foreground",
  marked_no_action: "bg-muted text-muted-foreground",
};

function ReviewedRow({
  reviewed,
  isSelected,
  onSelect,
}: {
  reviewed: ReviewedEmail;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const sender = reviewed.fromName ?? reviewed.fromEmail ?? "Unknown";
  const date = formatEmailDate(reviewed.reviewedAt);
  const outcomeLabel = REVIEWED_OUTCOME_LABEL[reviewed.reviewOutcome] ?? reviewed.reviewOutcome;
  const outcomeClass = REVIEWED_OUTCOME_CLASS[reviewed.reviewOutcome] ?? "bg-muted text-muted-foreground";

  return (
    <Button
      variant="ghost"
      onClick={onSelect}
      className={cn(
        "w-full h-auto text-left px-3 py-2.5 rounded-none justify-start",
        "hover:bg-accent/60 focus-visible:ring-1 focus-visible:ring-primary/30",
        isSelected && "bg-accent hover:bg-accent",
      )}
    >
      <div className="flex items-start gap-2.5 w-full">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <span className="text-sm font-medium text-muted-foreground truncate">{sender}</span>
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{date}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate mb-1">{reviewed.subject}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center text-[10px] px-1.5 py-0.5 rounded font-medium leading-none",
                outcomeClass,
              )}
            >
              {outcomeLabel}
            </span>
            {reviewed.reviewerNote && (
              <span className="text-[10px] text-muted-foreground truncate max-w-36">
                {reviewed.reviewerNote}
              </span>
            )}
            {reviewed.feedbackProvidedAt && (
              <span className="text-[10px] text-muted-foreground">
                Feedback saved
              </span>
            )}
          </div>
        </div>
      </div>
    </Button>
  );
}

export function EmailListPanel({
  emails,
  reviewedEmails,
  isLoading,
  activeTab,
  onTabChange,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  needsAssignmentCount,
  brandonQueueCount,
  reviewedCount,
}: EmailListPanelProps) {
  const groups = groupEmails(emails);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border/50 px-1 pt-1 gap-0.5 shrink-0">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            size="sm"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t transition-colors h-auto",
              activeTab === tab.id
                ? "text-foreground border-b-2 border-primary -mb-px rounded-none"
                : "text-muted-foreground",
            )}
          >
            {tab.label}
            {tab.id === "brandon-queue" && brandonQueueCount > 0 && (
              <Badge
                variant="secondary"
                className="h-4 px-1.5 text-[10px] bg-primary/10 text-primary border-0 font-semibold"
              >
                {brandonQueueCount}
              </Badge>
            )}
            {tab.id === "needs-assignment" && needsAssignmentCount > 0 && (
              <Badge
                variant="secondary"
                className="h-4 px-1.5 text-[10px] bg-warning-subtle text-warning border-0 font-semibold"
              >
                {needsAssignmentCount}
              </Badge>
            )}
            {tab.id === "reviewed" && reviewedCount > 0 && (
              <Badge
                variant="secondary"
                className="h-4 px-1.5 text-[10px] bg-muted text-muted-foreground border-0 font-semibold"
              >
                {reviewedCount}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-2 shrink-0">
        <ExpandingSearch
          value={search}
          onChange={onSearchChange}
          placeholder="Search emails…"
        />
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-3 py-2.5 flex items-start gap-2.5">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-2.5 bg-muted animate-pulse rounded w-full" />
                  <div className="h-2 bg-muted animate-pulse rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === "reviewed" ? (
          reviewedEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-12">
              <Inbox className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No reviewed emails yet.</p>
            </div>
          ) : (
            <div className="pb-4 divide-y divide-border/30">
              {reviewedEmails.map((r) => (
                <ReviewedRow
                  key={r.reviewId}
                  reviewed={r}
                  isSelected={r.id === selectedId}
                  onSelect={() => onSelect(r.id)}
                />
              ))}
            </div>
          )
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6 py-12">
            {activeTab === "brandon-queue" ? (
              <>
                <div className="size-10 rounded-full bg-success-subtle flex items-center justify-center">
                  <Inbox className="size-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Brandon queue is clear
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No reply, delegate, or watch items detected.
                  </p>
                </div>
              </>
            ) : activeTab === "needs-assignment" ? (
              <>
                <div className="size-10 rounded-full bg-success-subtle flex items-center justify-center">
                  <Inbox className="size-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    All caught up
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No emails waiting for project assignment.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Mail className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {search ? "No emails match your search." : "No emails found."}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="pb-4">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1.5 sticky top-0 bg-background/90 backdrop-blur-sm">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
                <div className="divide-y divide-border/30">
                  {group.emails.map((email) => (
                    <EmailRow
                      key={email.id}
                      email={email}
                      isSelected={email.id === selectedId}
                      onSelect={() => onSelect(email.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer: keyboard hint */}
      {emails.length > 1 && (
        <div className="px-3 py-2 border-t border-border/40 shrink-0">
          <p className="text-[10px] text-muted-foreground">
            <kbd className="font-mono">j/k</kbd> navigate
            {" · "}
            <kbd className="font-mono">r</kbd> reply
          </p>
        </div>
      )}
    </div>
  );
}
