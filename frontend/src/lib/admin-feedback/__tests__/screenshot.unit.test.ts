/** @jest-environment jsdom */

import {
  shouldProtectCaptureRoot,
  isEmptyCapture,
  renderWithRetry,
  withTimeout,
  MAX_SCREENSHOT_CAPTURE_ATTEMPTS,
} from "@/lib/admin-feedback/screenshot";

/**
 * Guardrail for the feedback auto-capture bug: html-to-image intermittently
 * returns an empty data URL ("data:,") on its first call when the cloned node's
 * images/fonts aren't decoded yet. The widget fired capture the instant the
 * dialog mounted, so users saw "Auto-capture failed". The capture path must
 * retry the empty result instead of surfacing it as a failure.
 */

describe("isEmptyCapture", () => {
  it("flags empty and degenerate data URLs", () => {
    expect(isEmptyCapture(null)).toBe(true);
    expect(isEmptyCapture(undefined)).toBe(true);
    expect(isEmptyCapture("")).toBe(true);
    expect(isEmptyCapture("data:,")).toBe(true);
    expect(isEmptyCapture("data:image/png;base64,AAA")).toBe(true); // too short
  });

  it("accepts a real-looking PNG data URL", () => {
    const realish = `data:image/png;base64,${"A".repeat(200)}`;
    expect(isEmptyCapture(realish)).toBe(false);
  });
});

describe("renderWithRetry", () => {
  const valid = `data:image/png;base64,${"A".repeat(200)}`;

  it("returns the first non-empty capture without extra attempts", async () => {
    const render = jest.fn().mockResolvedValue(valid);

    const out = await renderWithRetry(render);

    expect(out).toBe(valid);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("retries past an empty first result and yields a paint between attempts", async () => {
    const render = jest
      .fn()
      .mockResolvedValueOnce("data:,")
      .mockResolvedValueOnce(valid);
    const betweenAttempts = jest.fn().mockResolvedValue(undefined);

    const out = await renderWithRetry(render, { betweenAttempts });

    expect(out).toBe(valid);
    expect(render).toHaveBeenCalledTimes(2);
    expect(betweenAttempts).toHaveBeenCalledTimes(1);
  });

  it("throws an explicit error when every attempt is empty", async () => {
    const render = jest.fn().mockResolvedValue("data:,");

    await expect(renderWithRetry(render, { attempts: 3 })).rejects.toThrow(
      "Capture produced an empty image after 3 attempts",
    );
    expect(render).toHaveBeenCalledTimes(3);
  });

  it("treats a thrown/hung attempt as a failed attempt and retries", async () => {
    const render = jest
      .fn()
      .mockRejectedValueOnce(new Error("Screenshot render timed out after 8000ms"))
      .mockResolvedValueOnce(valid);

    const out = await renderWithRetry(render, { attempts: 3 });

    expect(out).toBe(valid);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("surfaces the last failure reason when all attempts throw", async () => {
    const render = jest.fn().mockRejectedValue(new Error("boom"));

    await expect(renderWithRetry(render, { attempts: 2 })).rejects.toThrow(
      "Capture produced an empty image after 2 attempts (boom)",
    );
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("defaults to the shared attempt budget", async () => {
    const render = jest.fn().mockResolvedValue("data:,");

    await expect(renderWithRetry(render)).rejects.toThrow();
    expect(render).toHaveBeenCalledTimes(MAX_SCREENSHOT_CAPTURE_ATTEMPTS);
  });
});

describe("withTimeout", () => {
  it("resolves with the value when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000, "render")).resolves.toBe(
      "ok",
    );
  });

  it("rejects with a labelled timeout when the promise hangs", async () => {
    const neverSettles = new Promise<string>(() => {});

    await expect(withTimeout(neverSettles, 20, "Screenshot render")).rejects.toThrow(
      "Screenshot render timed out after 20ms",
    );
  });
});

describe("shouldProtectCaptureRoot", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  it("protects the selected capture root and its containing dialog subtree", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const content = document.createElement("section");
    dialog.appendChild(content);
    document.body.appendChild(dialog);

    expect(shouldProtectCaptureRoot(content, content)).toBe(true);
    expect(shouldProtectCaptureRoot(content, dialog)).toBe(true);
    expect(shouldProtectCaptureRoot(content, document.body)).toBe(true);
  });

  it("does not protect unrelated floating UI", () => {
    const root = document.createElement("section");
    const otherDialog = document.createElement("div");
    otherDialog.setAttribute("role", "dialog");
    document.body.append(root, otherDialog);

    expect(shouldProtectCaptureRoot(root, otherDialog)).toBe(false);
  });
});
