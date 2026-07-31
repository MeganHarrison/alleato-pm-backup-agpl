import { ASSISTANT_SHORTCUT_GROUPS } from "../assistant-shortcuts";

describe("assistant shortcuts", () => {
  it("keeps shortcut labels and prompts unique", () => {
    const shortcuts = ASSISTANT_SHORTCUT_GROUPS.flatMap((group) => group.shortcuts);
    const labels = shortcuts.map((shortcut) => shortcut.label);
    const prompts = shortcuts.map((shortcut) => shortcut.prompt);

    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it("keeps the owner snapshot shortcut on the widget-emitting prompt path", () => {
    const ownerSnapshot = ASSISTANT_SHORTCUT_GROUPS
      .flatMap((group) => group.shortcuts)
      .find((shortcut) => shortcut.id === "owner-snapshot");

    expect(ownerSnapshot?.prompt.toLowerCase()).toContain("owner snapshot");
  });

  it("keeps the owner action queue shortcut on the widget-emitting prompt path", () => {
    const ownerActionQueue = ASSISTANT_SHORTCUT_GROUPS
      .flatMap((group) => group.shortcuts)
      .find((shortcut) => shortcut.id === "owner-action-queue");

    expect(ownerActionQueue?.prompt.toLowerCase()).toContain("what needs my attention");
  });

  it("keeps the meeting insights shortcut on the source-specific meeting path", () => {
    const meetingInsights = ASSISTANT_SHORTCUT_GROUPS
      .flatMap((group) => group.shortcuts)
      .find((shortcut) => shortcut.id === "recent-meeting-intelligence");

    expect(meetingInsights?.prompt.toLowerCase()).toContain("review recent meetings");
  });
});
