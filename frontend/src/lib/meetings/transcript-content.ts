export type MeetingTranscriptLocator = {
  id: string;
  url?: string | null;
  source?: string | null;
  sourceWebUrl?: string | null;
  content?: string | null;
};

export type MeetingTranscriptLoadResult = {
  content: string | null;
  source: "storage" | "metadata_content" | "missing";
  sourceUrl: string | null;
  completeTranscript: boolean;
  error: string | null;
};

export function buildOptionalMeetingTranscriptDetails(
  includeTranscript: boolean,
  transcript: MeetingTranscriptLoadResult | null,
): {
  meetingFields: Record<string, unknown>;
  warning: string | null;
} {
  if (!includeTranscript) {
    return { meetingFields: {}, warning: null };
  }

  const complete = transcript?.completeTranscript ?? false;
  const warning = complete
    ? null
    : transcript?.error ??
      "A complete transcript was not available; meeting details are returned without transcript text.";

  return {
    meetingFields: {
      transcript: complete ? transcript?.content ?? null : null,
      transcriptCoverage: {
        complete,
        source: transcript?.source ?? "missing",
        characters: complete ? transcript?.content?.length ?? 0 : 0,
        error: warning,
      },
    },
    warning,
  };
}

type FetchLike = typeof fetch;

function transcriptStorageUrl(meeting: MeetingTranscriptLocator): string | null {
  for (const candidate of [meeting.url, meeting.sourceWebUrl, meeting.source]) {
    if (
      typeof candidate === "string" &&
      candidate.includes("supabase.co/storage")
    ) {
      return candidate;
    }
  }
  return null;
}

export function containsTranscriptSection(content: string): boolean {
  return /^##\s+Transcript\s*$/im.test(content);
}

export async function loadMeetingTranscriptContent(
  meeting: MeetingTranscriptLocator,
  fetchImpl: FetchLike = fetch,
): Promise<MeetingTranscriptLoadResult> {
  const storageUrl = transcriptStorageUrl(meeting);
  let storageError: string | null = null;

  if (storageUrl) {
    try {
      const response = await fetchImpl(storageUrl);
      if (response.ok) {
        const content = (await response.text()).trim();
        if (content) {
          return {
            content,
            source: "storage",
            sourceUrl: storageUrl,
            completeTranscript: containsTranscriptSection(content),
            error: null,
          };
        }
        storageError = `Transcript storage returned an empty body for meeting ${meeting.id}.`;
      } else {
        storageError =
          `Transcript storage returned HTTP ${response.status} for meeting ${meeting.id}.`;
      }
    } catch (error) {
      storageError =
        `Transcript storage fetch failed for meeting ${meeting.id}: ` +
        (error instanceof Error ? error.message : String(error));
    }
  }

  const metadataContent = meeting.content?.trim() ?? "";
  if (metadataContent) {
    return {
      content: metadataContent,
      source: "metadata_content",
      sourceUrl: storageUrl,
      completeTranscript: containsTranscriptSection(metadataContent),
      error: storageError,
    };
  }

  return {
    content: null,
    source: "missing",
    sourceUrl: storageUrl,
    completeTranscript: false,
    error:
      storageError ??
      `Meeting ${meeting.id} has neither transcript storage nor metadata content.`,
  };
}
