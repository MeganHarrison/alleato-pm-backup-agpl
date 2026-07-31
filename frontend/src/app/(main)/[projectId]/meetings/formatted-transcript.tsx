/* eslint-disable design-system/no-raw-heading */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ds/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";

interface FormattedTranscriptProps {
  content: string;
  /** Ordered list of participant emails — index 0 = speaker "0", index 1 = speaker "1", etc. */
  participants?: string[];
  meetingId?: string;
  meetingTitle?: string | null;
  projectId?: number | null;
  showHeading?: boolean;
}

const SPEAKER_WORD_TO_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function formatParticipantName(email: string): string {
  const localPart = email.split("@")[0];
  if (!localPart) return email;
  const parts = localPart.split(/[._-]/);
  if (parts.length >= 2) {
    const firstName =
      parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    const lastName =
      parts[parts.length - 1].charAt(0).toUpperCase() +
      parts[parts.length - 1].slice(1).toLowerCase();
    return `${firstName} ${lastName}`;
  }
  return localPart.charAt(0).toUpperCase() + localPart.slice(1).toLowerCase();
}

function getParticipantBySpeakerLabel(
  speakerLabel: string,
  participants: string[]
): string | null {
  const normalized = speakerLabel.trim().toLowerCase();
  const numericMatch = normalized.match(/^\d+$/);
  if (numericMatch) {
    const numericIndex = Number.parseInt(normalized, 10);
    return participants[numericIndex] ? formatParticipantName(participants[numericIndex]) : null;
  }

  const speakerNumericMatch = normalized.match(/^speaker\s+(\d+)$/);
  if (speakerNumericMatch) {
    const speakerNumber = Number.parseInt(speakerNumericMatch[1], 10);
    const idx = speakerNumber > 0 ? speakerNumber - 1 : speakerNumber;
    return participants[idx] ? formatParticipantName(participants[idx]) : null;
  }

  const speakerWordMatch = normalized.match(/^speaker\s+([a-z]+)$/);
  if (speakerWordMatch) {
    const speakerWord = speakerWordMatch[1];
    const speakerNumber = SPEAKER_WORD_TO_NUMBER[speakerWord];
    if (!speakerNumber) return null;
    const idx = speakerNumber - 1;
    return participants[idx] ? formatParticipantName(participants[idx]) : null;
  }

  return null;
}

/**
 * Renders markdown-formatted transcript content with proper styling.
 * Maps numbered speaker labels (e.g. **0:**) to actual participant names
 * when a participants array is provided.
 */
export function FormattedTranscript({
  content,
  participants = [],
  meetingId,
  meetingTitle,
  projectId,
  showHeading = true,
}: FormattedTranscriptProps) {
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [selectionPosition, setSelectionPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const formattedContent = useMemo(
    () =>
      content
    // Replace **0:**, **1:**, **Speaker 1:**, **Speaker One:** with participant names.
      .replace(/\*\*(\d+):\*\*/g, (_, n) => {
        const idx = parseInt(n, 10);
        if (participants[idx]) {
          return `**${formatParticipantName(participants[idx])}:**`;
        }
        return `**Speaker ${idx + 1}:**`;
      })
      .replace(/\*\*(speaker\s+(?:\d+|[a-z]+)):\*\*/gi, (fullMatch, speakerLabel) => {
        const participantName = getParticipantBySpeakerLabel(speakerLabel, participants);
        if (!participantName) return fullMatch;
        return `**${participantName}:**`;
      })
      .replace(/(^|\n)(speaker\s+(?:\d+|[a-z]+):)/gi, (fullMatch, prefix, speakerLabel) => {
        const normalizedLabel = speakerLabel.slice(0, -1);
        const participantName = getParticipantBySpeakerLabel(normalizedLabel, participants);
        if (!participantName) return fullMatch;
        return `${prefix}${participantName}:`;
      })
      // Replace "Speaker 1\n" (no colon, no bold) with participant name
      .replace(/(^|\n)(speaker\s+(\d+))\s*\n/gi, (fullMatch, prefix, _label, num) => {
        const speakerNumber = Number.parseInt(num, 10);
        const idx = speakerNumber > 0 ? speakerNumber - 1 : speakerNumber;
        if (participants[idx]) {
          return `${prefix}**${formatParticipantName(participants[idx])}:**\n`;
        }
        return fullMatch;
      })
      // Add double line breaks before speaker timestamps (e.g., **0:15:30**)
      .replace(/(\*\*\d+:\d+:\d+\*\*)/g, "\n\n$1\n")
      // Add double line breaks before Fireflies-format utterances: [MM:SS] **Name**:
      .replace(/(\[\d{1,2}:\d{2}\]\s+\*\*[^*\n]+\*\*:)/g, "\n\n$1")
      // Add double line breaks before speaker name labels (**Name:** colon-inside format)
      .replace(/(\*\*[^*]+:\*\*)/g, "\n\n$1 ")
      // Normalise excessive blank lines
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    [content, participants]
  );

  const resetSelectionUi = useCallback(() => {
    setSelectionPosition(null);
    setSelectedText("");
  }, []);

  const inferDefaultTitle = useCallback((value: string) => {
    const compact = value.replace(/\s+/g, " ").trim();
    if (!compact) return "";
    return compact.length <= 72 ? compact : `${compact.slice(0, 71)}…`;
  }, []);

  useEffect(() => {
    const handleSelection = () => {
      const container = transcriptContainerRef.current;
      if (!container) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        resetSelectionUi();
        return;
      }

      const anchorNode = selection.anchorNode;
      const focusNode = selection.focusNode;
      if (!anchorNode || !focusNode) {
        resetSelectionUi();
        return;
      }

      if (!container.contains(anchorNode) || !container.contains(focusNode)) {
        resetSelectionUi();
        return;
      }

      const selectedValue = selection.toString().trim();
      if (!selectedValue) {
        resetSelectionUi();
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(selectedValue);
      setSelectionPosition({
        top: Math.max(8, rect.top - 40),
        left: Math.min(window.innerWidth - 180, Math.max(8, rect.left)),
      });
    };

    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("keyup", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("keyup", handleSelection);
    };
  }, [resetSelectionUi]);

  const handleOpenNoteDialog = useCallback(() => {
    if (!selectedText) return;
    setNoteTitle(inferDefaultTitle(selectedText));
    setNoteBody("");
    setIsDialogOpen(true);
  }, [inferDefaultTitle, selectedText]);

  const handleSaveNote = useCallback(async () => {
    if (!meetingId) {
      toast.error("Unable to save highlight note", {
        description: "Missing meeting context.",
      });
      return;
    }

    if (!projectId) {
      toast.error("Unable to save highlight note", {
        description: "This meeting is not associated with a project.",
      });
      return;
    }

    if (!selectedText.trim()) {
      toast.error("No highlighted text selected.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = await apiFetch<{ title?: string }>("/api/notes/highlight", {
        method: "POST",
        body: JSON.stringify({
          meetingId,
          selectedText,
          title: noteTitle.trim() || undefined,
          noteBody: noteBody.trim() || undefined,
        }),
      });

      toast.success("Highlight saved as note", {
        description: payload.title || meetingTitle || "Meeting note created",
      });
      setIsDialogOpen(false);
      setNoteBody("");
      setNoteTitle("");
      resetSelectionUi();
      window.getSelection()?.removeAllRanges();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error saving note";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [
    meetingId,
    meetingTitle,
    noteBody,
    noteTitle,
    projectId,
    resetSelectionUi,
    selectedText,
  ]);

  return (
    <div ref={transcriptContainerRef} className="space-y-2">
      {showHeading ? (
        <SectionHeader title="Full Transcript" className="mb-1" />
      ) : null}

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-sans font-light tracking-tight text-neutral-900 mb-4 mt-8 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-sans font-light tracking-tight text-neutral-900 mb-4 mt-6 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium text-neutral-900 mb-4 mt-6 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-medium text-neutral-900 mb-2 mt-4">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-sm text-neutral-700 leading-relaxed mb-2">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="text-sm text-neutral-700 leading-relaxed mb-2 space-y-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-sm text-neutral-700 leading-relaxed mb-4 space-y-2">
              {children}
            </ol>
          ),
          li: ({ children }) => {
            const childArray = Array.isArray(children) ? children : [children];
            const hasContent = childArray.some((child) => {
              if (typeof child === "string") return child.trim().length > 0;
              return child != null;
            });
            if (!hasContent) return null;
            return (
              <li className="flex items-start gap-2.5 ml-1">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0 flex-none" />
                <span>{children}</span>
              </li>
            );
          },
          strong: ({ children }) => (
            <strong className="font-semibold text-neutral-900">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 bg-neutral-100 text-neutral-800 rounded text-xs font-mono">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-neutral-50 border border-neutral-200 rounded p-4 overflow-x-auto mb-4">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/30 pl-4 py-2 mb-4 text-neutral-600 italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-neutral-200 my-6" />,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              {/* @table-exception: Markdown transcript tables render arbitrary user-authored content, not app data tables. */}
              <table className="min-w-full border border-border">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-neutral-50">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-neutral-200">{children}</tbody>
          ),
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider border-b border-neutral-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sm text-neutral-700">{children}</td>
          ),
        }}
      >
        {formattedContent}
      </ReactMarkdown>

      {selectionPosition && selectedText ? (
        <div
          className="fixed z-40"
          style={{ top: selectionPosition.top, left: selectionPosition.left }}
        >
          <Button
            size="sm"
            className="h-8 px-2.5 text-xs"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleOpenNoteDialog}
          >
            Save as note
          </Button>
        </div>
      ) : null}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Note from Highlight</DialogTitle>
            <DialogDescription>
              Save this transcript selection as a project note with source context.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Selected transcript text
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{selectedText}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="highlight-note-title">
                Note title
              </label>
              <Input
                id="highlight-note-title"
                value={noteTitle}
                onChange={(event) => setNoteTitle(event.target.value)}
                placeholder="Optional title"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="highlight-note-body">
                Your note
              </label>
              <Textarea
                id="highlight-note-body"
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                placeholder="Add your context, follow-up, or decision"
                rows={5}
                maxLength={8000}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveNote} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
