/** @jest-environment jsdom */

import { triggerBrowserDownload } from "@/lib/browser-download";
import { createClient } from "@/lib/supabase/client";

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

describe("triggerBrowserDownload", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => "blob:test");
    URL.revokeObjectURL = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? "application/pdf" : null),
      },
      blob: async () => new Blob(["pdf"], { type: "application/pdf" }),
    } as Response);
  });

  afterAll(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    global.fetch = originalFetch;
  });

  it("sends the current access token as a bearer header", async () => {
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    createClientMock.mockReturnValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              access_token: "token-123",
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        }),
        refreshSession: jest.fn(),
      },
    } as never);

    await triggerBrowserDownload("/api/example.pdf", "example.pdf", "application/pdf");

    expect(global.fetch).toHaveBeenCalledWith("/api/example.pdf", {
      credentials: "same-origin",
      headers: {
        Authorization: "Bearer token-123",
      },
    });
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("refreshes the session before downloading when the token is about to expire", async () => {
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const refreshSession = jest.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "fresh-token",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
      error: null,
    });

    createClientMock.mockReturnValue({
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              access_token: "stale-token",
              expires_at: Math.floor(Date.now() / 1000) + 5,
            },
          },
          error: null,
        }),
        refreshSession,
      },
    } as never);

    await triggerBrowserDownload("/api/example.pdf", "example.pdf", "application/pdf");

    expect(refreshSession).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith("/api/example.pdf", {
      credentials: "same-origin",
      headers: {
        Authorization: "Bearer fresh-token",
      },
    });
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
