"use client";

/**
 * AI summary / prep pane for the meeting detail page.
 *
 * Behaviorally ported from Meetily's `SummaryPanel` / `BlockNoteSummaryView`
 * (MIT, github.com/Zackriya-Solutions/meetily, cloned read-only at
 * /Users/meganharrison/Documents/reference/meetily) — specifically: a
 * generate/regenerate action pair driven by an explicit status machine
 * (idle/generating/error), an editable body that never silently discards
 * content, and explicit dirty-state tracking so a save is always a
 * deliberate action. No Meetily markup, BlockNote editor, or Tauri-only
 * behavior was copied — this is a from-scratch Alleato implementation of
 * that interaction model on our own primitives (`Textarea`, `SectionAction`,
 * `EmptyState`) and our own data source (`meeting_preps.content` via the
 * existing `useMeetingPrep` / `useSaveMeetingPrep` / `useGenerateMeetingPrep`
 * hooks — already used by the legacy meeting prep flow). The content is
 * plain markdown text (format-tolerant: works whether the source is
 * hand-written notes or AI-generated markdown), previewed with the existing
 * `MarkdownSummary` renderer.
 */

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/ds";
import { SectionAction, SectionRuleHeading } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useGenerateMeetingPrep,
  useMeetingPrep,
  useSaveMeetingPrep,
} from "@/hooks/use-meeting-prep";
import { MarkdownSummary } from "@/app/(main)/[projectId]/meetings/[meetingId]/markdown-summary";

export interface MeetingSummaryPaneProps {
  projectId: string;
  meetingId: string;
  /** Whether a transcript is linked — prep generation requires one. */
  hasTranscript: boolean;
}

export function MeetingSummaryPane({ projectId, meetingId, hasTranscript }: MeetingSummaryPaneProps) {
  const { data, isLoading } = useMeetingPrep(projectId, meetingId);
  const savePrep = useSaveMeetingPrep(projectId, meetingId);
  const generatePrep = useGenerateMeetingPrep(projectId, meetingId);

  const prep = data?.data ?? null;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const isDirty = isEditing && draft !== (prep?.content ?? "");

  // Never silently discard: only sync the draft from the server when the
  // user isn't actively editing (or hasn't touched it yet).
  useEffect(() => {
    if (!isEditing) {
      setDraft(prep?.content ?? "");
    }
  }, [prep?.content, isEditing]);

  const isGenerating = generatePrep.isPending;

  const handleGenerate = () => {
    generatePrep.mutate(undefined, {
      onSuccess: () => setIsEditing(false),
    });
  };

  const handleStartEdit = () => {
    setDraft(prep?.content ?? "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraft(prep?.content ?? "");
    setIsEditing(false);
  };

  const handleSave = () => {
    savePrep.mutate(draft, {
      onSuccess: () => setIsEditing(false),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  const regenerateAction = prep ? (
    <SectionAction onClick={handleGenerate} disabled={isGenerating || !hasTranscript}>
      {isGenerating ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      Regenerate
    </SectionAction>
  ) : undefined;

  return (
    <div>
      <SectionRuleHeading label="AI Summary" actions={!isEditing ? regenerateAction : undefined} />

      {!prep && !isGenerating ? (
        <EmptyState
          icon={<Sparkles />}
          title="No summary yet"
          description={
            hasTranscript
              ? "Generate an AI summary from the linked transcript."
              : "Link a transcript to this meeting to generate a summary."
          }
          action={
            hasTranscript ? (
              <Button size="sm" onClick={handleGenerate} disabled={isGenerating}>
                <Sparkles className="h-4 w-4" />
                Generate Summary
              </Button>
            ) : undefined
          }
        />
      ) : isGenerating ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating summary…
        </div>
      ) : isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={12}
            className="font-mono text-sm"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={!isDirty || savePrep.isPending}>
              {savePrep.isPending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancelEdit} disabled={savePrep.isPending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          onClick={handleStartEdit}
          className="h-auto w-full justify-start whitespace-normal p-0 text-left font-normal hover:bg-transparent"
        >
          <MarkdownSummary content={prep?.content ?? ""} />
        </Button>
      )}
    </div>
  );
}
