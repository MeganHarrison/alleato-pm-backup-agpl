import { collaborationNotificationChannelName } from "../use-collaboration-notifications";

jest.mock("server-only", () => ({}));

describe("collaboration notification realtime channels", () => {
  it("creates a distinct channel name for each mounted hook instance", () => {
    const first = collaborationNotificationChannelName("user-1", ":r1:");
    const second = collaborationNotificationChannelName("user-1", ":r2:");

    expect(first).toBe("notifications:user-1:r1");
    expect(second).toBe("notifications:user-1:r2");
    expect(first).not.toBe(second);
  });
});
