/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

import { TrackedVideoPlayer } from "../tracked-video-player";

describe("TrackedVideoPlayer provider contracts", () => {
  const postMessage = jest.fn();
  const fetchMock = jest.fn(() => Promise.resolve({ ok: true }));

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
      configurable: true,
      get: () => ({ postMessage }),
    });
    Object.defineProperty(global, "fetch", { configurable: true, value: fetchMock });
  });

  it("subscribes to Loom Player.js events and records received progress", () => {
    render(<TrackedVideoPlayer contentItemId="550e8400-e29b-41d4-a716-446655440000" title="Loom lesson" provider="loom" url="https://www.loom.com/embed/example" />);

    expect(postMessage).toHaveBeenCalledWith(
      { method: "addEventListener", value: "timeupdate", context: "player.js" },
      "https://www.loom.com",
    );

    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://www.loom.com",
      data: { event: "timeupdate", value: { seconds: 30, duration: 100 } },
    }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/engagement/learning-progress",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"checkpoint":25');
  });

  it("subscribes to Vimeo player progress events", () => {
    render(<TrackedVideoPlayer contentItemId="550e8400-e29b-41d4-a716-446655440000" title="Vimeo lesson" provider="vimeo" url="https://player.vimeo.com/video/123" />);

    expect(postMessage).toHaveBeenCalledWith(
      { method: "addEventListener", value: "timeupdate" },
      "https://player.vimeo.com",
    );
  });
});
