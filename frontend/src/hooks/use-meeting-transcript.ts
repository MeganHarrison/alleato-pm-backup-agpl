"use client";

import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";

/**
 * Reads transcript content directly from `document_metadata` (RLS-protected,
 * client-side read) for the meeting detail Transcript tab.
 *
 * `meetings.transcript_document_id` points at `document_metadata.id` (TEXT).
 * This hook is intentionally NOT part of `use-meetings.ts` — it reads a
 * different table for a narrow, read-only purpose scoped to the transcript
 * pane, so it lives alongside its one consumer
 * (`meeting-transcript-pane.tsx`) instead of growing the shared meetings
 * hook file's surface area.
 */

export interface MeetingTranscriptDocument {
  id: string;
  title: string | null;
  content: string | null;
  participants: string | null;
  participants_array: string[] | null;
  date: string | null;
  project_id: number | null;
}

export const meetingTranscriptKeys = {
  all: ["meeting-transcript-document"] as const,
  detail: (documentMetadataId: string) =>
    [...meetingTranscriptKeys.all, documentMetadataId] as const,
};

export function useMeetingTranscriptDocument(documentMetadataId: string | null | undefined) {
  return useQuery<MeetingTranscriptDocument | null>({
    queryKey: meetingTranscriptKeys.detail(documentMetadataId ?? ""),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("document_metadata")
        .select("id, title, content, participants, participants_array, date, project_id")
        .eq("id", documentMetadataId as string)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load transcript: ${error.message}`);
      }

      return data as MeetingTranscriptDocument | null;
    },
    enabled: Boolean(documentMetadataId),
    staleTime: 60_000,
  });
}
