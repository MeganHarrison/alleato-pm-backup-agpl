import {
  getSafePostLoginFallback,
  POST_LOGIN_REDIRECT_TIMEOUT_MS,
  resolvePostLoginRedirect,
} from "../post-login-redirect-client";

const noWait = async () => {};

describe("resolvePostLoginRedirect", () => {
  it("keeps the same-origin redirect request bounded without aborting a cold development compile", () => {
    expect(POST_LOGIN_REDIRECT_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
  });

  it("returns the redirect immediately when it isn't the home fallback", async () => {
    const fetchRedirect = jest.fn().mockResolvedValue({ redirect: "/47/drawings/viewer/abc" });

    const result = await resolvePostLoginRedirect(fetchRedirect, "/47/drawings/viewer/abc", noWait);

    expect(result).toBe("/47/drawings/viewer/abc");
    expect(fetchRedirect).toHaveBeenCalledTimes(1);
  });

  it("retries once when the server falls back to home despite a valid callback, and uses the retry result", async () => {
    const fetchRedirect = jest
      .fn()
      .mockResolvedValueOnce({ redirect: "/" })
      .mockResolvedValueOnce({ redirect: "/47/drawings/viewer/abc" });

    const result = await resolvePostLoginRedirect(fetchRedirect, "/47/drawings/viewer/abc", noWait);

    expect(result).toBe("/47/drawings/viewer/abc");
    expect(fetchRedirect).toHaveBeenCalledTimes(2);
  });

  it("does not retry when there was no callback to protect", async () => {
    const fetchRedirect = jest.fn().mockResolvedValue({ redirect: "/" });

    const result = await resolvePostLoginRedirect(fetchRedirect, null, noWait);

    expect(result).toBe("/");
    expect(fetchRedirect).toHaveBeenCalledTimes(1);
  });

  it("falls back to home if the retry also lands on home", async () => {
    const fetchRedirect = jest.fn().mockResolvedValue({ redirect: "/" });

    const result = await resolvePostLoginRedirect(fetchRedirect, "/47/drawings/viewer/abc", noWait);

    expect(result).toBe("/");
    expect(fetchRedirect).toHaveBeenCalledTimes(2);
  });

  it("falls back to home if the retry request throws", async () => {
    const fetchRedirect = jest
      .fn()
      .mockResolvedValueOnce({ redirect: "/" })
      .mockRejectedValueOnce(new Error("network error"));

    const result = await resolvePostLoginRedirect(fetchRedirect, "/47/drawings/viewer/abc", noWait);

    expect(result).toBe("/");
    expect(fetchRedirect).toHaveBeenCalledTimes(2);
  });

  it("surfaces first-request failure so the UI can use its safe fallback route", async () => {
    const fetchRedirect = jest.fn().mockRejectedValue(new Error("Request timed out after 8s"));

    await expect(resolvePostLoginRedirect(fetchRedirect, "/47/drawings/viewer/abc", noWait)).rejects.toThrow(
      "Request timed out after 8s",
    );
    expect(fetchRedirect).toHaveBeenCalledTimes(1);
  });

  it("uses home as the safe client fallback when server-side redirect resolution fails", () => {
    expect(getSafePostLoginFallback()).toBe("/");
  });
});
