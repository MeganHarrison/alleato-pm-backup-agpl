/**
 * Regression tests: the AI-assistant chat dropped the user's first message.
 *
 * Symptom: after sending the FIRST message in a new conversation, the user's
 * message vanished from the live view and only the assistant reply remained
 * (both rows were correctly persisted — verified in `chat_history`). Root cause:
 * during the new-conversation handoff the parent briefly resets session messages
 * to `[]`, and `ChatWithSession`'s sync effect applied that empty array on top
 * of the live `useChat` list, erasing the just-sent user message mid-stream.
 *
 * `shouldSyncInitialMessages` is the extracted decision the sync effect now uses.
 */
import { shouldSyncInitialMessages } from "../chat-message-sync";

describe("shouldSyncInitialMessages", () => {
  it("does NOT overwrite a live conversation with an empty DB copy (the bug)", () => {
    // New-conversation handoff: live list has the just-sent user message,
    // parent transiently provides initialMessages = [].
    expect(
      shouldSyncInitialMessages({
        skipPostFinishReload: false,
        initialCount: 0,
        liveCount: 1,
      }),
    ).toBe(false);
  });

  it("does NOT overwrite during the deliberate post-finish reload", () => {
    expect(
      shouldSyncInitialMessages({
        skipPostFinishReload: true,
        initialCount: 2,
        liveCount: 2,
      }),
    ).toBe(false);
  });

  it("hydrates an empty live list from the DB (conversation open/switch)", () => {
    expect(
      shouldSyncInitialMessages({
        skipPostFinishReload: false,
        initialCount: 4,
        liveCount: 0,
      }),
    ).toBe(true);
  });

  it("applies an empty DB copy only when there is nothing live to lose", () => {
    expect(
      shouldSyncInitialMessages({
        skipPostFinishReload: false,
        initialCount: 0,
        liveCount: 0,
      }),
    ).toBe(true);
  });

  it("replaces the live list with a non-empty DB copy (switching conversations)", () => {
    expect(
      shouldSyncInitialMessages({
        skipPostFinishReload: false,
        initialCount: 6,
        liveCount: 2,
      }),
    ).toBe(true);
  });
});
