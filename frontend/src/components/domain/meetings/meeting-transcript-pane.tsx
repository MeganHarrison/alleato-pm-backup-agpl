"use client";

/**
 * Transcript pane for the meeting detail page.
 *
 * Behaviorally ported from Meetily's `TranscriptPanel` /
 * `VirtualizedTranscriptView` (MIT, github.com/Zackriya-Solutions/meetily,
 * cloned read-only at /Users/meganharrison/Documents/reference/meetily) —
 * specifically: a clear empty/loading/error state and a copy affordance for
 * a large transcript. No Meetily markup, styling, or Tauri-only behavior was
 * copied; this file is a from-scratch Alleato implementation of that
 * interaction model on our own primitives (`Skeleton`, `EmptyState`,
 * `ErrorState`, `SectionRuleHeading`, semantic tokens) and our own data
 * source (`document_metadata.content`, parsed by the existing
 * `parseTranscriptSections` + rendered by the existing `FormattedTranscript`
 * component — both already used by the legacy meeting page). Scrolling
 * follows the page (no nested scroll region), matching every other detail
 * page section in this app.
 */

import { useMemo, useState } from "react";
import { Copy, FileText } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/ds";
import { ErrorState } from "@/components/ds/error-state";
import { SectionAction, SectionRuleHeading } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useMeetingTranscriptDocument } from "@/hooks/use-meeting-transcript";
import { parseTranscriptSections } from "@/app/(main)/[projectId]/meetings/[meetingId]/parse-transcript-sections";
import { FormattedTranscript } from "@/app/(main)/[projectId]/meetings/formatted-transcript";

export interface MeetingTranscriptPaneProps {
  /** `meetings.transcript_document_id` — null/undefined means no transcript linked yet. */
  transcriptDocumentId: string | null;
  meetingId: string;
  meetingTitle: string;
  projectId: number;
}

function participantsFromDocument(doc: {
  participants: string | null;
  participants_array: string[] | null;
}): string[] {
  const fromArray = (doc.participants_array ?? []).map((p) => p.trim()).filter(Boolean);
  if (fromArray.length > 0) return [...new Set(fromArray)];

  if (!doc.participants) return [];
  return [
    ...new Set(
      doc.participants
        .replace(/[{}"]/g, "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    ),
  ];
}

export function MeetingTranscriptPane({
  transcriptDocumentId,
  meetingId,
  meetingTitle,
  projectId,
}: MeetingTranscriptPaneProps) {
  const [copied, setCopied] = useState(false);
  const {
    data: document,
    isLoading,
    isError,
    error,
    refetch,
  } = useMeetingTranscriptDocument(transcriptDocumentId);

  const participants = useMemo(
    () => (document ? participantsFromDocument(document) : []),
    [document],
  );

  const parsedSections = useMemo(
    () => (document?.content ? parseTranscriptSections(document.content) : null),
    [document?.content],
  );

  const transcriptText = parsedSections?.transcript ?? document?.content ?? null;

  const handleCopy = async () => {
    if (!transcriptText) return;
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      toast.success("Transcript copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy transcript");
    }
  };

  if (!transcriptDocumentId) {
    return (
      <EmptyState
        icon={<FileText />}
        title="No transcript linked"
        description="This meeting doesn't have a linked transcript yet."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load transcript"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  if (!transcriptText) {
    return (
      <EmptyState
        icon={<FileText />}
        title="Transcript not ready yet"
        description="The transcript is still processing. Check back shortly."
      />
    );
  }

  return (
    <div>
      <SectionRuleHeading
        label="Transcript"
        actions={
          <SectionAction onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </SectionAction>
        }
      />
      <FormattedTranscript
        content={transcriptText}
        participants={participants}
        meetingId={meetingId}
        meetingTitle={meetingTitle}
        projectId={projectId}
      />
    </div>
  );
}
