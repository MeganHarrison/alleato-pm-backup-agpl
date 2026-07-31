import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  clampConfidence,
  SITE_SCRIBE_NOTE_TAGS,
  type SiteScribeSubmitPayload,
} from "@/lib/site-scribe/types";
import type { Database } from "@/types/database.types";

type DailyLogInsert = Database["public"]["Tables"]["daily_logs"]["Insert"];
type DailyLogManpowerInsert =
  Database["public"]["Tables"]["daily_log_manpower"]["Insert"];
type DailyLogNoteInsert = Database["public"]["Tables"]["daily_log_notes"]["Insert"];
type DailyLogPhotoInsert =
  Database["public"]["Tables"]["daily_log_photos"]["Insert"];

function dataUrlToFileParts(dataUrl: string) {
  const [metadata, encoded] = dataUrl.split(",");
  if (!metadata || !encoded) throw new Error("Invalid data URL payload.");
  const contentType = metadata.match(/^data:(.*?);base64$/)?.[1] ?? "application/octet-stream";
  return {
    contentType,
    buffer: Buffer.from(encoded, "base64"),
  };
}

function cleanString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toJson<T extends keyof DailyLogInsert>(
  value: unknown,
): NonNullable<DailyLogInsert[T]> {
  return JSON.parse(JSON.stringify(value)) as NonNullable<DailyLogInsert[T]>;
}

function validTag(value: string | null | undefined) {
  return SITE_SCRIBE_NOTE_TAGS.includes(value as (typeof SITE_SCRIBE_NOTE_TAGS)[number])
    ? value
    : "Other";
}

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/daily-log/site-scribe#POST",
  async ({ request, params }) => {
  const { projectId } = params;
  const parsedProjectId = Number(projectId);

  if (!Number.isInteger(parsedProjectId)) {
    return NextResponse.json(
      { code: "INVALID_PROJECT_ID", message: "Project ID must be numeric." },
      { status: 400 },
    );
  }

  const user = await getApiRouteUser();
  if (!user) {
    return NextResponse.json(
      { code: "AUTH_EXPIRED", message: "Authentication required to submit a Site Scribe log." },
      { status: 401 },
    );
  }

  const payload = (await request.json()) as SiteScribeSubmitPayload;
  if (payload.projectId !== parsedProjectId) {
    return NextResponse.json(
      { code: "PROJECT_MISMATCH", message: "Payload project does not match the route project." },
      { status: 400 },
    );
  }

  if (!payload.logDate || !payload.sessionId) {
    return NextResponse.json(
      { code: "MISSING_REQUIRED_FIELD", message: "Log date and session ID are required." },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const storageBasePath = `projects/${parsedProjectId}/daily-logs/site-scribe/${payload.sessionId}`;

  let audioStoragePath: string | null = null;
  if (payload.rawAudio?.dataUrl) {
    const audio = dataUrlToFileParts(payload.rawAudio.dataUrl);
    audioStoragePath = `${storageBasePath}/audio/${payload.rawAudio.fileName || "session.webm"}`;
    const { error: audioError } = await service.storage
      .from("project-files")
      .upload(audioStoragePath, audio.buffer, {
        contentType: payload.rawAudio.contentType || audio.contentType,
        upsert: true,
      });

    if (audioError) {
      return NextResponse.json(
        {
          code: "AUDIO_UPLOAD_FAILED",
          message: `Raw audio upload failed: ${audioError.message}`,
        },
        { status: 500 },
      );
    }
  }

  const transcriptStoragePath = `${storageBasePath}/transcript.json`;
  const { error: transcriptError } = await service.storage
    .from("project-files")
    .upload(
      transcriptStoragePath,
      Buffer.from(JSON.stringify(payload.transcript, null, 2)),
      { contentType: "application/json", upsert: true },
    );

  if (transcriptError) {
    return NextResponse.json(
      {
        code: "TRANSCRIPT_UPLOAD_FAILED",
        message: `Transcript upload failed: ${transcriptError.message}`,
      },
      { status: 500 },
    );
  }

  const dailyLogRow: DailyLogInsert = {
    project_id: parsedProjectId,
    log_date: payload.logDate,
    status: "complete",
    completed_at: new Date().toISOString(),
    completed_by: user.id,
    created_by: user.id,
    general_notes: cleanString(payload.structuredLog.summary),
    weather_conditions: null,
    site_scribe_session_id: payload.sessionId,
    ai_audio_storage_path: audioStoragePath,
    ai_transcript_storage_path: transcriptStoragePath,
    ai_extraction: toJson<"ai_extraction">(payload.structuredLog),
    ai_field_confidence: toJson<"ai_field_confidence">(payload.structuredLog.fieldConfidence),
    updated_at: new Date().toISOString(),
  };

  const { data: dailyLog, error: dailyLogError } = await serviceDb.from("daily_logs")
    .upsert(dailyLogRow, { onConflict: "project_id,log_date" })
    .select("id")
    .single();

  if (dailyLogError || !dailyLog) {
    return NextResponse.json(
      {
        code: "DAILY_LOG_SAVE_FAILED",
        message: dailyLogError?.message ?? "Daily log was not saved.",
      },
      { status: 500 },
    );
  }

  const [manpowerDelete, notesDelete, photosDelete] = await Promise.all([
    serviceDb.from("daily_log_manpower").delete().eq("daily_log_id", dailyLog.id),
    serviceDb.from("daily_log_notes").delete().eq("daily_log_id", dailyLog.id),
    serviceDb.from("daily_log_photos").delete().eq("daily_log_id", dailyLog.id),
  ]);

  const deleteError = manpowerDelete.error ?? notesDelete.error ?? photosDelete.error;
  if (deleteError) {
    return NextResponse.json(
      {
        code: "SECTION_REPLACE_FAILED",
        message: `Daily log saved, but existing AI sections were not replaced: ${deleteError.message}`,
      },
      { status: 500 },
    );
  }

  const manpowerRows: DailyLogManpowerInsert[] = payload.structuredLog.manpower.map((row) => ({
    daily_log_id: dailyLog.id,
    trade: cleanString(row.subcontractorName),
    workers_count: row.workerCount ?? 0,
    hours_worked: row.hoursWorked,
    comments: cleanString(`Captured by Site Scribe for ${row.subcontractorName}`),
    source_audio_start_ms: row.sourceAudioStartMs ?? null,
    source_audio_end_ms: row.sourceAudioEndMs ?? null,
    ai_confidence: {
      subcontractorName: clampConfidence(row.confidence.subcontractorName),
      workerCount: clampConfidence(row.confidence.workerCount),
      hoursWorked: clampConfidence(row.confidence.hoursWorked),
    },
  }));

  const noteRows: Array<DailyLogNoteInsert & { clientId: string }> =
    payload.structuredLog.notes.map((note) => ({
      clientId: note.id,
      daily_log_id: dailyLog.id,
      category: validTag(note.tag),
      topic_tag: validTag(note.tag),
      description: note.text.trim(),
      issue_flag: note.tag === "Issue" || note.tag === "Safety",
      source_audio_start_ms: note.sourceAudioStartMs ?? null,
      source_audio_end_ms: note.sourceAudioEndMs ?? null,
      ai_confidence: {
        tag: clampConfidence(note.confidence.tag),
        text: clampConfidence(note.confidence.text),
      },
    }));

  const { error: manpowerError } =
    manpowerRows.length > 0
      ? await serviceDb.from("daily_log_manpower").insert(manpowerRows)
      : { error: null };
  if (manpowerError) {
    return NextResponse.json(
      { code: "MANPOWER_SAVE_FAILED", message: manpowerError.message },
      { status: 500 },
    );
  }

  const noteIdByClientId = new Map<string, string>();
  if (noteRows.length > 0) {
    const { data: savedNotes, error: notesError } = await serviceDb.from("daily_log_notes")
      .insert(noteRows.map(({ clientId: _clientId, ...row }) => row))
      .select("id, description");

    if (notesError || !savedNotes) {
      return NextResponse.json(
        { code: "NOTES_SAVE_FAILED", message: notesError?.message ?? "Notes were not saved." },
        { status: 500 },
      );
    }

    savedNotes.forEach((note, index) => {
      const clientId = noteRows[index]?.clientId;
      if (clientId) noteIdByClientId.set(clientId, note.id);
    });
  }

  const photoRows: DailyLogPhotoInsert[] = [];
  for (const photo of payload.structuredLog.photos) {
    const image = dataUrlToFileParts(photo.dataUrl);
    const extension = photo.fileName.split(".").pop() ?? "jpg";
    const photoPath = `${storageBasePath}/photos/${photo.id}.${extension}`;
    const { error: photoUploadError } = await service.storage
      .from("project-files")
      .upload(photoPath, image.buffer, {
        contentType: photo.contentType || image.contentType,
        upsert: true,
      });

    if (photoUploadError) {
      return NextResponse.json(
        {
          code: "PHOTO_UPLOAD_FAILED",
          message: `${photo.fileName} upload failed: ${photoUploadError.message}`,
        },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = service.storage.from("project-files").getPublicUrl(photoPath);

    photoRows.push({
      daily_log_id: dailyLog.id,
      project_id: parsedProjectId,
      storage_bucket: "project-files",
      storage_path: photoPath,
      public_url: publicUrl,
      file_name: photo.fileName,
      content_type: photo.contentType || image.contentType,
      file_size: image.buffer.byteLength,
      captured_at: photo.capturedAt,
      audio_timestamp_ms: photo.audioTimestampMs,
      paired_note_id: photo.pairedNoteId ? noteIdByClientId.get(photo.pairedNoteId) ?? null : null,
      pairing_confidence: clampConfidence(photo.pairingConfidence, 0.5),
      caption: cleanString(photo.caption),
      metadata: {
        clientPhotoId: photo.id,
        clientPairedNoteId: photo.pairedNoteId ?? null,
      },
      created_by: user.id,
    });
  }

  if (photoRows.length > 0) {
    const { error: photoInsertError } = await serviceDb.from("daily_log_photos")
      .insert(photoRows);

    if (photoInsertError) {
      return NextResponse.json(
        { code: "PHOTO_METADATA_SAVE_FAILED", message: photoInsertError.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    success: true,
    dailyLogId: dailyLog.id,
    saved: {
      manpower: manpowerRows.length,
      notes: noteRows.length,
      photos: photoRows.length,
      transcriptStoragePath,
      audioStoragePath,
    },
  });
});
