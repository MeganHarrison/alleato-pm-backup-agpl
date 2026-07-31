/**
 * Legacy transcript persistence wrapper.
 *
 * The historical `public.procore_video_transcripts` table no longer exists in the
 * live schema. Keeping the old Supabase calls here would silently rot, so this
 * module now fails loudly until the capture pipeline is rebuilt on a supported
 * storage target.
 */

export interface ProcoreVideoTranscript {
  id?: string;
  url: string;
  title: string | null;
  wmediaid: string | null;
  wchannelid: string | null;
  transcript_text: string | null;
  transcript_hash: string | null;
  transcript_download_url: string | null;
  transcript_filename: string | null;
  video_asset_urls: string[];
  video_player_urls: string[];
  video_host_domains: string[];
  screenshots: string[];
  metadata: unknown;
  created_at?: string;
  updated_at?: string;
}

function legacyTranscriptStoreError(): Error {
  return new Error(
    "Legacy transcript persistence is disabled: public.procore_video_transcripts no longer exists. Rebuild this capture flow on a current storage target before using it.",
  );
}

// This legacy setup hook now fails loudly until a supported storage target is implemented.
export async function createVideoTranscriptsTable() {
  throw legacyTranscriptStoreError();
}

// This legacy upsert path now fails loudly instead of pretending transcript persistence still exists.
export async function upsertVideoTranscript(_data: ProcoreVideoTranscript): Promise<string> {
  throw legacyTranscriptStoreError();
}

// This legacy lookup path now fails loudly instead of querying a removed table.
export async function getVideoTranscriptByMediaId(_wmediaid: string): Promise<ProcoreVideoTranscript | null> {
  throw legacyTranscriptStoreError();
}

// This legacy list path now fails loudly instead of querying a removed table.
export async function getAllVideoTranscripts(): Promise<ProcoreVideoTranscript[]> {
  throw legacyTranscriptStoreError();
}

// This legacy search path now fails loudly instead of querying a removed table.
export async function searchTranscripts(_query: string): Promise<ProcoreVideoTranscript[]> {
  throw legacyTranscriptStoreError();
}

// This legacy delete path now fails loudly instead of mutating a removed table.
export async function deleteVideoTranscript(_id: string): Promise<boolean> {
  throw legacyTranscriptStoreError();
}

// This legacy stats path now fails loudly instead of reading a removed table.
export async function getTranscriptStats(): Promise<{
  total_videos: number;
  videos_with_transcripts: number;
  videos_with_downloads: number;
  unique_hosts: string[];
  total_transcript_chars: number;
}> {
  throw legacyTranscriptStoreError();
}
