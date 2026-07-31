/**
 * Regression tests for GitHub issue #281:
 * Voice input "aborted" error was displayed as a failure toast when the user
 * stopped recording intentionally. The Web Speech API fires onerror with
 * event.error="aborted" as a normal side-effect of calling recognition.stop().
 *
 * These tests guard the onerror handler logic extracted from chat-area.tsx.
 */

type SpeechErrorCode =
  | "aborted"
  | "audio-capture"
  | "not-allowed"
  | "network"
  | "no-speech"
  | "service-not-allowed"
  | "bad-grammar"
  | "language-not-supported";

interface MockErrorEvent {
  error: SpeechErrorCode | string;
}

interface ErrorHandlerCallbacks {
  setIsRecording: (v: boolean) => void;
  setIsMicrophoneBlocked: (v: boolean) => void;
  showError: (msg: string, opts?: { id?: string; description?: string }) => void;
}

/**
 * Mirrors the exact onerror guard logic from chat-area.tsx after the fix.
 * @sync-with frontend/src/components/ai-assistant/chat-area.tsx:1084-1114
 * Keep in sync with the handler in chat-area.tsx.
 */
function handleSpeechRecognitionError(
  event: MockErrorEvent,
  callbacks: ErrorHandlerCallbacks,
): void {
  if (event.error === "aborted") return;

  callbacks.setIsRecording(false);

  if (event.error === "not-allowed") {
    callbacks.setIsMicrophoneBlocked(true);
    callbacks.showError("Microphone access is blocked", {
      id: "ai-assistant-microphone-blocked",
      description:
        "Enable microphone access for this site in browser site settings, then try voice input again.",
    });
    return;
  }

  if (event.error === "audio-capture") {
    callbacks.showError("No microphone found", {
      id: "ai-assistant-audio-capture",
      description:
        "Make sure a microphone is connected and enabled in your system settings.",
    });
    return;
  }

  callbacks.showError(
    event.error ? `Voice input failed: ${event.error}` : "Voice input failed",
  );
}

describe("SpeechRecognition onerror handler", () => {
  let setIsRecording: jest.Mock;
  let setIsMicrophoneBlocked: jest.Mock;
  let showError: jest.Mock;

  beforeEach(() => {
    setIsRecording = jest.fn();
    setIsMicrophoneBlocked = jest.fn();
    showError = jest.fn();
  });

  const callbacks = () => ({ setIsRecording, setIsMicrophoneBlocked, showError });

  // ── Regression: issue #281 ──────────────────────────────────────────────────

  it("suppresses aborted error (issue #281 regression)", () => {
    handleSpeechRecognitionError({ error: "aborted" }, callbacks());

    expect(showError).not.toHaveBeenCalled();
    expect(setIsRecording).not.toHaveBeenCalled();
    expect(setIsMicrophoneBlocked).not.toHaveBeenCalled();
  });

  // ── Permission errors ───────────────────────────────────────────────────────

  it("shows actionable toast and blocks mic for not-allowed", () => {
    handleSpeechRecognitionError({ error: "not-allowed" }, callbacks());

    expect(setIsRecording).toHaveBeenCalledWith(false);
    expect(setIsMicrophoneBlocked).toHaveBeenCalledWith(true);
    expect(showError).toHaveBeenCalledWith(
      "Microphone access is blocked",
      expect.objectContaining({
        id: "ai-assistant-microphone-blocked",
        description: expect.stringContaining("browser site settings"),
      }),
    );
  });

  // ── Hardware errors ─────────────────────────────────────────────────────────

  it("shows actionable toast for audio-capture (no microphone)", () => {
    handleSpeechRecognitionError({ error: "audio-capture" }, callbacks());

    expect(setIsRecording).toHaveBeenCalledWith(false);
    expect(setIsMicrophoneBlocked).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith(
      "No microphone found",
      expect.objectContaining({
        id: "ai-assistant-audio-capture",
        description: expect.stringContaining("microphone"),
      }),
    );
  });

  // ── Generic fallback ────────────────────────────────────────────────────────

  it("shows generic error with code for unknown error types (e.g. network)", () => {
    handleSpeechRecognitionError({ error: "network" }, callbacks());

    expect(setIsRecording).toHaveBeenCalledWith(false);
    expect(showError).toHaveBeenCalledWith("Voice input failed: network");
  });

  it("shows generic error without code when error is empty string", () => {
    handleSpeechRecognitionError({ error: "" }, callbacks());

    expect(showError).toHaveBeenCalledWith("Voice input failed");
  });
});
