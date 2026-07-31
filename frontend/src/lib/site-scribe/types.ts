export const SITE_SCRIBE_NOTE_TAGS = [
  "Delivery",
  "Inspection",
  "Safety",
  "Visitor",
  "Issue",
  "Progress",
  "Equipment",
  "Other",
] as const;

export type SiteScribeNoteTag = (typeof SITE_SCRIBE_NOTE_TAGS)[number];

export type FieldConfidence<T extends string = string> = Partial<Record<T, number>>;

export interface SiteScribeManpowerRow {
  id: string;
  subcontractorName: string;
  workerCount: number | null;
  hoursWorked: number | null;
  sourceAudioStartMs?: number | null;
  sourceAudioEndMs?: number | null;
  confidence: FieldConfidence<"subcontractorName" | "workerCount" | "hoursWorked">;
}

export interface SiteScribeNote {
  id: string;
  tag: SiteScribeNoteTag;
  text: string;
  sourceAudioStartMs?: number | null;
  sourceAudioEndMs?: number | null;
  confidence: FieldConfidence<"tag" | "text">;
}

export interface SiteScribePhoto {
  id: string;
  fileName: string;
  contentType: string;
  dataUrl: string;
  capturedAt: string;
  audioTimestampMs: number;
  pairedNoteId?: string | null;
  pairingConfidence?: number;
  caption?: string;
}

export interface SiteScribeTranscriptSegment {
  id: string;
  speaker: "crew" | "assistant";
  text: string;
  startMs: number;
  endMs?: number;
  final: boolean;
}

export interface SiteScribeStructuredLog {
  summary: string;
  manpower: SiteScribeManpowerRow[];
  notes: SiteScribeNote[];
  photos: SiteScribePhoto[];
  fieldConfidence: Record<string, number>;
}

export interface SiteScribeSubmitPayload {
  projectId: number;
  logDate: string;
  sessionId: string;
  durationMs: number;
  transcript: SiteScribeTranscriptSegment[];
  structuredLog: SiteScribeStructuredLog;
  rawAudio?: {
    fileName: string;
    contentType: string;
    dataUrl: string;
  } | null;
}

export function clampConfidence(value: unknown, fallback = 0.55) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, numeric));
}
