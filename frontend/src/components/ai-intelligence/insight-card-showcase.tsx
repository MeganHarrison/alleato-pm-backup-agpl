"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  Clock,
  FileText,
  MailOpen,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/ds";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import type {
  ConfidenceLevel,
  InsightCard,
  InsightCardReviewFeedback,
} from "@/lib/ai/intelligence/types";
import {
  cleanEmailText,
  type ReadableEmailMessage,
} from "@/lib/email/readable-email";
import { cn } from "@/lib/utils";

const confidenceVariant: Record<ConfidenceLevel, "success" | "warning" | "error"> = {
  high: "success",
  medium: "warning",
  low: "error",
};

const confidenceDot: Record<ConfidenceLevel, string> = {
  high: "bg-status-success",
  medium: "bg-status-warning",
  low: "bg-status-error",
};

const genericReviewWhyItMatters =
  "This source contains project-relevant language that should be reviewed before it is trusted in a current intelligence packet.";
const genericReviewNextAction = "Review the source attribution and extracted signal, then promote or reject it.";

function formatLabel(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function cleanInsightText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/(?:^|\s)#{1,6}\s+/gm, " ")
    .replace(/\*{1,3}([^*]*)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]*)_{1,3}/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "")
    .replace(/<\s*>/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function normalizeForCompare(value: string | null | undefined): string {
  return cleanInsightText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSameMeaning(a: string | null | undefined, b: string | null | undefined): boolean {
  const first = normalizeForCompare(a);
  const second = normalizeForCompare(b);
  if (!first || !second) return false;
  return first === second || first.includes(second) || second.includes(first);
}

function getComparableTokens(value: string | null | undefined): string[] {
  const normalized = normalizeForCompare(value);
  if (!normalized) return [];
  return normalized.split(" ").filter((token) => token.length > 2);
}

function hasHighTokenOverlap(candidate: string, reference: string): boolean {
  const candidateTokens = getComparableTokens(candidate);
  const referenceTokens = new Set(getComparableTokens(reference));
  if (candidateTokens.length < 12 || referenceTokens.size < 12) return false;

  const matchingTokens = candidateTokens.filter((token) => referenceTokens.has(token)).length;
  return matchingTokens / candidateTokens.length >= 0.72;
}

function isDuplicateOfCardContent(value: string, card: InsightCard): boolean {
  const cardText = [
    card.title,
    card.summary,
    card.whyItMatters,
    card.nextAction,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    isSameMeaning(value, card.summary) ||
    isSameMeaning(value, card.whyItMatters) ||
    isSameMeaning(value, card.nextAction) ||
    hasHighTokenOverlap(value, cardText)
  );
}

function isGenericReviewText(value: string | null | undefined): boolean {
  return isSameMeaning(value, genericReviewWhyItMatters) || isSameMeaning(value, genericReviewNextAction);
}

function isRawSourceDump(value: string | null | undefined): boolean {
  const text = normalizeForCompare(value);
  return (
    text.startsWith("subject ") ||
    (text.includes(" subject ") && text.includes(" from ")) ||
    (text.includes(" date ") && text.includes(" from ") && text.includes(" to "))
  );
}

function isSourceMetadataDump(value: string | null | undefined): boolean {
  const text = normalizeForCompare(value);
  return (
    text.includes("duration") &&
    text.includes("organizer email") &&
    (text.includes("fireflies link") || text.includes("participants"))
  );
}

function isEmailEvidence(evidence: InsightCard["evidence"][number]): boolean {
  return evidence.sourceType.toLowerCase() === "email" || evidence.sourceCategory?.toLowerCase() === "email";
}

function isNegativeFeedback(feedback: InsightCardReviewFeedback | null): boolean {
  return feedback?.signal === "wrong" || feedback?.signal === "stale";
}

function buildEvidenceSourceHref(
  projectId: number,
  evidence: InsightCard["evidence"][number],
): string | null {
  if (!evidence.sourceDocumentId) return null;
  return `/${projectId}/intelligence/sources/${encodeURIComponent(evidence.sourceDocumentId)}`;
}

function getSourceTypeIcon(
  evidence: InsightCard["evidence"][number],
): typeof CalendarDays {
  const sourceType = evidence.sourceType.toLowerCase();
  const sourceCategory = evidence.sourceCategory?.toLowerCase() ?? "";

  if (sourceType === "meeting" || sourceCategory === "meeting") return CalendarDays;
  if (sourceType === "email" || sourceType === "email_attachment" || sourceCategory === "email") return MailOpen;
  if (sourceType.includes("teams") || sourceCategory.includes("teams") || sourceType.includes("message")) return MessageSquare;
  if (sourceType.includes("task") || sourceCategory.includes("task")) return Check;
  if (sourceType.includes("contact") || sourceCategory.includes("contact")) return Users;
  return FileText;
}

function getLatestSourceDate(card: InsightCard): string | null {
  const dates = card.evidence
    .map((evidence) => evidence.sourceOccurredAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  return dates.at(-1) ?? null;
}

function getPrimarySourceLabel(card: InsightCard): string {
  const sourceTypes = Array.from(new Set(card.evidence.map((evidence) => formatLabel(evidence.sourceType))));
  if (sourceTypes.length === 0) return "No linked source";
  if (sourceTypes.length === 1) return sourceTypes[0];
  return `${sourceTypes.slice(0, 2).join(" + ")}${sourceTypes.length > 2 ? ` +${sourceTypes.length - 2}` : ""}`;
}

function getEvidenceText(evidence: InsightCard["evidence"][number]): string {
  return cleanInsightText(evidence.summary || evidence.excerpt || evidence.relevanceReason);
}

function getUniqueEvidence(card: InsightCard): Array<InsightCard["evidence"][number] & { displayText: string }> {
  const summary = cleanInsightText(card.summary);
  const seen = new Set<string>();

  return card.evidence.flatMap((evidence) => {
    const displayText = getEvidenceText(evidence);
    const normalized = normalizeForCompare(displayText);
    if (
      !displayText ||
      !normalized ||
      isSameMeaning(displayText, summary) ||
      isSameMeaning(displayText, card.title) ||
      isDuplicateOfCardContent(displayText, card)
    ) {
      return [{ ...evidence, displayText: "" }];
    }
    if (seen.has(normalized)) return [{ ...evidence, displayText: "" }];
    seen.add(normalized);
    return [{ ...evidence, displayText }];
  });
}

function sortCards(cards: InsightCard[]): InsightCard[] {
  return [...cards].sort((a, b) => {
    const aNegative = isNegativeFeedback(a.latestFeedback);
    const bNegative = isNegativeFeedback(b.latestFeedback);
    if (aNegative !== bNegative) return aNegative ? 1 : -1;

    const aDate = getLatestSourceDate(a) ?? "";
    const bDate = getLatestSourceDate(b) ?? "";
    if (aDate !== bDate) return bDate.localeCompare(aDate);

    return a.title.localeCompare(b.title);
  });
}

function emailTitle(message: ReadableEmailMessage, fallback: string | null | undefined, index: number): string {
  return message.subject || fallback || `Email ${index + 1}`;
}

function emailSubtitle(message: ReadableEmailMessage): string {
  return [message.from, message.date ? formatDate(message.date) : null]
    .filter(Boolean)
    .join(" - ");
}

const exactEmailHeaderPattern = /^(Subject|Date|Sent|From|To|Cc):\s*(.*)$/i;
const exactEmailMessageStartPattern = /^(From:|On .+wrote:|-{2,}\s*Original Message\s*-{2,})/i;

function normalizeExactEmailText(value: string | null | undefined): string {
  return cleanEmailText(value)
    .replace(/([^\n])\s+(From|Sent|Date|To|Cc|Subject):\s+/g, "$1\n$2: ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{3,}/g, "  ")
    .trim();
}

function emptyEmailMessage(index: number): ReadableEmailMessage {
  return {
    id: `email-message-${index}`,
    subject: "",
    date: "",
    from: "",
    to: "",
    cc: "",
    body: "",
  };
}

function normalizeExactHeaderKey(value: string): keyof Omit<ReadableEmailMessage, "id" | "body"> {
  const key = value.toLowerCase();
  return key === "sent" ? "date" : (key as keyof Omit<ReadableEmailMessage, "id" | "body">);
}

function parseExactEmailHeaderBlock(
  lines: string[],
  startIndex: number,
  message: ReadableEmailMessage,
): number {
  let index = startIndex;
  let lastHeader: keyof Omit<ReadableEmailMessage, "id" | "body"> | null = null;

  for (; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trim();
    if (!line) {
      index += 1;
      break;
    }

    const match = line.match(exactEmailHeaderPattern);
    if (match) {
      const key = normalizeExactHeaderKey(match[1]);
      message[key] = match[2].trim();
      lastHeader = key;
      continue;
    }

    if (lastHeader && /^\s/.test(rawLine)) {
      message[lastHeader] = `${message[lastHeader]} ${line}`.trim();
      continue;
    }

    break;
  }

  return index;
}

function parseExactEmailThread(value: string | null | undefined): ReadableEmailMessage[] {
  const text = normalizeExactEmailText(value);
  if (!text) return [];

  const lines = text.split("\n");
  const messages: ReadableEmailMessage[] = [];
  let index = 0;

  while (index < lines.length) {
    while (index < lines.length && !lines[index]?.trim()) index += 1;
    if (index >= lines.length) break;

    const message = emptyEmailMessage(messages.length);
    const firstLine = lines[index]?.trim() ?? "";

    if (/^On .+wrote:$/i.test(firstLine)) {
      message.from = firstLine.replace(/^On\s+/i, "").replace(/\s+wrote:$/i, "");
      index += 1;
    } else if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(firstLine)) {
      index += 1;
      index = parseExactEmailHeaderBlock(lines, index, message);
    } else if (exactEmailHeaderPattern.test(firstLine)) {
      index = parseExactEmailHeaderBlock(lines, index, message);
    }

    const bodyStart = index;
    while (index < lines.length) {
      const line = lines[index]?.trim() ?? "";
      if (index > bodyStart && exactEmailMessageStartPattern.test(line)) break;
      index += 1;
    }

    message.body = lines.slice(bodyStart, index).join("\n").trim();
    if (message.subject || message.date || message.from || message.to || message.cc || message.body) {
      messages.push(message);
    }
  }

  return messages;
}

function buildEmailMessages(evidence: InsightCard["evidence"][number]): ReadableEmailMessage[] {
  if (!isEmailEvidence(evidence)) return [];

  const messages = parseExactEmailThread(evidence.sourceContentPreview);
  const seen = new Set<string>();
  return messages.filter((message) => {
    const key = `${message.from}|${message.date}|${message.subject}|${message.body}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function EmailThread({
  evidence,
}: {
  evidence: InsightCard["evidence"][number];
}) {
  const emailMessages = buildEmailMessages(evidence);
  if (emailMessages.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <MailOpen className="h-3.5 w-3.5" />
        Email thread
      </p>
      <Accordion type="multiple" className="rounded-md border border-border bg-background px-3">
        {emailMessages.map((message, index) => (
          <AccordionItem key={`${message.id}-${index}`} value={`${message.id}-${index}`}>
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-medium text-foreground">
                  {emailTitle(message, evidence.sourceTitle, index)}
                </span>
                {emailSubtitle(message) ? (
                  <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                    {emailSubtitle(message)}
                  </span>
                ) : null}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <dl className="grid gap-3 pb-4 text-xs sm:grid-cols-2 xl:grid-cols-4">
                {message.from ? (
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.08em] text-muted-foreground">From</dt>
                    <dd className="mt-1 break-words text-foreground">{message.from}</dd>
                  </div>
                ) : null}
                {message.to ? (
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.08em] text-muted-foreground">To</dt>
                    <dd className="mt-1 break-words text-foreground">{message.to}</dd>
                  </div>
                ) : null}
                {message.cc ? (
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.08em] text-muted-foreground">Cc</dt>
                    <dd className="mt-1 break-words text-foreground">{message.cc}</dd>
                  </div>
                ) : null}
                {message.date ? (
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.08em] text-muted-foreground">Date</dt>
                    <dd className="mt-1 text-foreground">{formatDate(message.date) || message.date}</dd>
                  </div>
                ) : null}
              </dl>
              {message.body ? (
                <div className="max-w-3xl whitespace-pre-wrap text-sm leading-7 text-foreground">
                  {message.body}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  No email body text was captured for this message.
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function EvidenceList({
  card,
  projectId,
}: {
  card: InsightCard;
  projectId: number;
}) {
  const evidence = getUniqueEvidence(card).slice(0, 6);
  if (evidence.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Sources
      </p>
      <div className="space-y-2">
        {evidence.map((item) => {
          const sourceHref = buildEvidenceSourceHref(projectId, item);
          const SourceIcon = getSourceTypeIcon(item);

          return (
            <div key={item.id} className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <SourceIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {sourceHref ? (
                  <Link
                    href={sourceHref}
                    className="min-w-0 font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    <span className="truncate">{item.sourceTitle ?? "Untitled source"}</span>
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{item.sourceTitle ?? "Untitled source"}</span>
                )}
                {item.sourceOccurredAt ? (
                  <span>{formatDate(item.sourceOccurredAt)}</span>
                ) : null}
              </div>
              <EmailThread evidence={item} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardFeedback({
  card,
  projectId,
  onFeedbackRecorded,
}: {
  card: InsightCard;
  projectId: number;
  onFeedbackRecorded: (cardId: string, feedback: InsightCardReviewFeedback) => void;
}) {
  const [feedbackSignal, setFeedbackSignal] = useState<"wrong" | "stale" | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  async function submitFeedback(signal: "useful" | "wrong" | "stale") {
    setFeedbackBusy(true);
    try {
      const response = await apiFetch<{
        reviewId: string;
        status: string;
      }>("/api/ai-assistant/packet-card-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          insightCardId: card.id,
          signal,
          reason:
            signal === "useful"
              ? "Card was marked useful from Project Intelligence."
              : feedbackText || null,
          correction: signal === "useful" ? null : feedbackText || null,
          cardSnapshot: {
            id: card.id,
            title: card.title,
            cardType: card.cardType,
            currentStatus: card.currentStatus,
            confidence: card.confidence,
            summary: card.summary,
            nextAction: card.nextAction,
            evidenceCount: card.evidence.length,
          },
          metadata: { projectId, surface: "project_intelligence_card" },
        }),
      });
      onFeedbackRecorded(card.id, {
        id: response.reviewId,
        status: response.status,
        signal,
        reason: signal === "useful" ? "Card was marked useful from Project Intelligence." : feedbackText || null,
        correction: signal === "useful" ? null : feedbackText || null,
        createdAt: new Date().toISOString(),
      });
      toast.success(signal === "useful" ? "Card feedback saved" : "Card review queued");
      setFeedbackSignal(null);
      setFeedbackText("");
    } catch (error) {
      toast.error("Could not save card feedback", {
        description: error instanceof Error ? error.message : "Unexpected error",
      });
    } finally {
      setFeedbackBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={feedbackBusy}
          onClick={() => void submitFeedback("useful")}
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ThumbsUp className="h-3 w-3" />
          Useful
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={feedbackBusy}
          onClick={() => setFeedbackSignal("wrong")}
          className={cn(
            "h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground",
            feedbackSignal === "wrong" && "text-foreground",
          )}
        >
          <ThumbsDown className="h-3 w-3" />
          Wrong
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={feedbackBusy}
          onClick={() => setFeedbackSignal("stale")}
          className={cn(
            "h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground",
            feedbackSignal === "stale" && "text-foreground",
          )}
        >
          <Clock className="h-3 w-3" />
          Stale
        </Button>
      </div>
      {feedbackSignal ? (
        <div className="space-y-2">
          <Textarea
            value={feedbackText}
            onChange={(event) => setFeedbackText(event.target.value)}
            placeholder={
              feedbackSignal === "wrong"
                ? "What should this card say instead?"
                : "What is stale or missing?"
            }
            className="min-h-20 text-sm"
          />
          <Button
            type="button"
            size="sm"
            disabled={feedbackBusy}
            onClick={() => void submitFeedback(feedbackSignal)}
          >
            Queue review
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function InsightAccordionItem({
  card,
  projectId,
  onFeedbackRecorded,
}: {
  card: InsightCard;
  projectId: number;
  onFeedbackRecorded: (cardId: string, feedback: InsightCardReviewFeedback) => void;
}) {
  const summary = cleanInsightText(card.summary);
  const whyItMatters = cleanInsightText(card.whyItMatters);
  const nextAction = cleanInsightText(card.nextAction);
  const usefulWhyItMatters = whyItMatters && !isGenericReviewText(whyItMatters) ? whyItMatters : "";
  const usefulNextAction = nextAction && !isGenericReviewText(nextAction) ? nextAction : "";
  const negativeFeedback = isNegativeFeedback(card.latestFeedback) ? card.latestFeedback : null;
  const displaySummary = isRawSourceDump(summary) || isSourceMetadataDump(summary)
    ? ""
    : summary;

  return (
    <AccordionItem id={`insight-card-${card.id}`} value={card.id} className="scroll-mt-20 border-border">
      <AccordionTrigger className="gap-4 py-4 hover:no-underline">
        <span className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", confidenceDot[card.confidence])} aria-hidden="true" />
          <span className="min-w-0 space-y-1">
            <span className="block truncate text-sm font-medium text-foreground">{card.title}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {formatLabel(card.cardType)} · {getPrimarySourceLabel(card)}
              {getLatestSourceDate(card) ? ` · ${formatDate(getLatestSourceDate(card))}` : ""}
            </span>
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-2 sm:flex">
          {negativeFeedback ? (
            <StatusBadge status="Review queued" variant="warning" className="text-xs" />
          ) : null}
          <StatusBadge status={formatLabel(card.confidence)} variant={confidenceVariant[card.confidence]} className="text-xs" />
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-5 pb-5 pl-5 pr-2">
          {negativeFeedback ? (
            <div className="rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-status-warning">
                Review queued
              </p>
              <p className="mt-1 text-sm leading-6 text-foreground">
                This card was marked {negativeFeedback.signal}.
              </p>
              {negativeFeedback.correction || negativeFeedback.reason ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {negativeFeedback.correction || negativeFeedback.reason}
                </p>
              ) : null}
            </div>
          ) : null}
          {displaySummary ? (
            <section className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Read
              </p>
              <p className="max-w-4xl text-sm leading-7 text-foreground">{displaySummary}</p>
            </section>
          ) : null}
          {(usefulWhyItMatters || usefulNextAction) ? (
            <section className="space-y-3">
              {usefulWhyItMatters ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Why it matters
                  </p>
                  <p className="text-sm leading-6 text-foreground">{usefulWhyItMatters}</p>
                </div>
              ) : null}
              {usefulNextAction ? (
                <div className="space-y-1">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <Check className="h-3.5 w-3.5" />
                    Next action
                  </p>
                  <p className="text-sm leading-6 text-foreground">{usefulNextAction}</p>
                </div>
              ) : null}
            </section>
          ) : null}
          <EvidenceList card={card} projectId={projectId} />
          <CardFeedback
            card={card}
            projectId={projectId}
            onFeedbackRecorded={onFeedbackRecorded}
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function InsightCardShowcase({
  cards,
  projectId,
}: {
  cards: InsightCard[];
  projectId: number;
}) {
  const [feedbackByCardId, setFeedbackByCardId] = useState<Record<string, InsightCardReviewFeedback>>({});
  const [openCardIds, setOpenCardIds] = useState<string[]>([]);
  const cardsWithFeedback = useMemo(
    () =>
      cards.map((card) => ({
        ...card,
        latestFeedback: feedbackByCardId[card.id] ?? card.latestFeedback,
      })),
    [cards, feedbackByCardId],
  );
  const sortedCards = useMemo(() => sortCards(cardsWithFeedback), [cardsWithFeedback]);

  useEffect(() => {
    const cardId = window.location.hash.replace(/^#insight-card-/, "");
    if (!cardId || cardId === window.location.hash) return;
    if (!cards.some((card) => card.id === cardId)) return;

    setOpenCardIds((current) => (current.includes(cardId) ? current : [...current, cardId]));
  }, [cards]);

  if (cards.length === 0) return null;

  return (
    <section id="insight-cards" className="scroll-mt-16 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Current read
      </p>
      <Accordion
        type="multiple"
        value={openCardIds}
        onValueChange={setOpenCardIds}
        className="divide-y divide-border"
      >
        {sortedCards.map((card) => (
          <InsightAccordionItem
            key={card.id}
            card={card}
            projectId={projectId}
            onFeedbackRecorded={(cardId, feedback) => {
              setFeedbackByCardId((current) => ({
                ...current,
                [cardId]: feedback,
              }));
            }}
          />
        ))}
      </Accordion>
    </section>
  );
}
