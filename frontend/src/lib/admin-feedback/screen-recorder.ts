/**
 * Browser screen recorder for admin feedback.
 *
 * Uses navigator.mediaDevices.getDisplayMedia() + MediaRecorder to capture a
 * short Loom-style screen recording (with optional microphone audio). The
 * resulting Blob is uploaded directly to Supabase Storage via a signed URL,
 * so videos can be larger than Vercel's 4.5 MB serverless body limit.
 */

const PREFERRED_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

export const MAX_RECORDING_DURATION_MS = 2 * 60 * 1000; // 2 minutes.

export type ScreenRecorderState =
  | "idle"
  | "starting"
  | "recording"
  | "stopping"
  | "ready";

export type ScreenRecorderHandle = {
  /** The currently-active MediaRecorder, if any. */
  recorder: MediaRecorder;
  /** Stop recording and resolve to the captured Blob. */
  stop: () => Promise<{ blob: Blob; mimeType: string; durationMs: number }>;
  /** Abort the recording without resolving the captured Blob. */
  cancel: () => void;
};

export function isScreenRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined"
  );
}

function pickMimeType(): string {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
    return "video/webm";
  }
  for (const candidate of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "video/webm";
}

export async function startScreenRecording(options?: {
  withMicrophone?: boolean;
}): Promise<ScreenRecorderHandle> {
  if (!isScreenRecordingSupported()) {
    throw new Error("Screen recording is not supported in this browser.");
  }

  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 24 },
    audio: true,
  });

  let micStream: MediaStream | null = null;
  if (options?.withMicrophone) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch {
      micStream = null;
    }
  }

  const tracks: MediaStreamTrack[] = [...displayStream.getVideoTracks()];

  if (micStream) {
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    if (displayStream.getAudioTracks().length > 0) {
      audioContext.createMediaStreamSource(displayStream).connect(destination);
    }
    audioContext.createMediaStreamSource(micStream).connect(destination);
    tracks.push(...destination.stream.getAudioTracks());
  } else {
    tracks.push(...displayStream.getAudioTracks());
  }

  const combined = new MediaStream(tracks);
  const mimeType = pickMimeType();
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(combined, { mimeType });
  const startedAt = performance.now();
  let stopped = false;

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.start(1_000);

  const stopAllTracks = () => {
    displayStream.getTracks().forEach((track) => track.stop());
    micStream?.getTracks().forEach((track) => track.stop());
  };

  // If the user clicks "Stop sharing" in the browser UI, end the recorder.
  const onDisplayEnded = () => {
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch (stopError) {
        console.warn("[screen-recorder] recorder.stop() on display-end failed", stopError);
      }
    }
  };
  displayStream.getVideoTracks().forEach((track) => {
    track.addEventListener("ended", onDisplayEnded);
  });

  // Hard cap on duration.
  const durationTimer = window.setTimeout(() => {
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch (stopError) {
        console.warn("[screen-recorder] recorder.stop() at duration cap failed", stopError);
      }
    }
  }, MAX_RECORDING_DURATION_MS);

  const stop = () =>
    new Promise<{ blob: Blob; mimeType: string; durationMs: number }>((resolve, reject) => {
      if (stopped) {
        reject(new Error("Recording already stopped."));
        return;
      }
      stopped = true;
      window.clearTimeout(durationTimer);

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        stopAllTracks();
        resolve({ blob, mimeType, durationMs: performance.now() - startedAt });
      };
      recorder.onerror = (event: Event) => {
        stopAllTracks();
        const maybeError =
          "error" in event &&
          (event as Event & { error?: unknown }).error instanceof Error
            ? ((event as Event & { error: Error }).error)
            : null;
        reject(maybeError ?? new Error("MediaRecorder error"));
      };

      if (recorder.state !== "inactive") {
        recorder.stop();
      } else {
        const blob = new Blob(chunks, { type: mimeType });
        stopAllTracks();
        resolve({ blob, mimeType, durationMs: performance.now() - startedAt });
      }
    });

  const cancel = () => {
    stopped = true;
    window.clearTimeout(durationTimer);
    try {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    } finally {
      stopAllTracks();
    }
  };

  return { recorder, stop, cancel };
}

export type UploadedRecording = {
  publicUrl: string;
  path: string;
  contentType: string;
};

/**
 * Best-effort deletion of an orphaned recording. Used when the user discards
 * a recording or closes the feedback composer without submitting. Never
 * throws — orphan cleanup must not block the user flow.
 */
export async function deleteOrphanedRecording(path: string): Promise<void> {
  if (!path) return;
  try {
    await fetch("/api/admin/feedback/recording", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    });
  } catch (deleteError) {
    console.warn("[screen-recorder] orphan delete failed", deleteError);
  }
}

export async function uploadRecording(blob: Blob): Promise<UploadedRecording> {
  const initResponse = await fetch("/api/admin/feedback/recording", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contentType: blob.type || "video/webm",
      fileSize: blob.size,
    }),
  });

  if (!initResponse.ok) {
    let detail = "";
    try {
      const body = await initResponse.json();
      detail = body?.error ?? body?.details ?? "";
    } catch (parseError) {
      console.warn("[screen-recorder] could not parse upload-init error body", parseError);
    }
    throw new Error(
      detail || `Recording upload init failed (HTTP ${initResponse.status})`,
    );
  }

  const { uploadUrl, path, publicUrl, contentType } =
    (await initResponse.json()) as {
      uploadUrl: string;
      path: string;
      publicUrl: string;
      contentType: string;
    };

  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: blob,
  });

  if (!putResponse.ok) {
    throw new Error(
      `Recording upload failed (HTTP ${putResponse.status}). The video was captured but could not be saved.`,
    );
  }

  return { publicUrl, path, contentType };
}
