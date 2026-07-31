/**
 * @jest-environment jsdom
 */
import { isChunkLoadError, markReload, shouldAutoReload } from "../chunk-error";

describe("isChunkLoadError", () => {
  it("detects the Next.js 'Loading chunk N failed' message", () => {
    expect(
      isChunkLoadError(
        new Error(
          "Loading chunk 76989 failed. (error: https://example.com/_next/static/chunks/76989-abc.js)",
        ),
      ),
    ).toBe(true);
  });

  it("detects dynamic-import and CSS-chunk variants", () => {
    expect(
      isChunkLoadError(new Error("Failed to fetch dynamically imported module")),
    ).toBe(true);
    expect(isChunkLoadError(new Error("Loading CSS chunk 12 failed"))).toBe(true);
    expect(isChunkLoadError(new Error("error loading /_next/static/x.js"))).toBe(
      true,
    );
  });

  it("ignores unrelated errors and non-Error values", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(
      false,
    );
    expect(isChunkLoadError("Loading chunk failed")).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe("shouldAutoReload / markReload cooldown", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("allows a reload when no prior reload is recorded", () => {
    expect(shouldAutoReload()).toBe(true);
  });

  it("blocks a second reload within the cooldown window", () => {
    markReload();
    expect(shouldAutoReload()).toBe(false);
  });

  it("allows a reload again once the cooldown has elapsed", () => {
    sessionStorage.setItem("chunk-error-reload", String(Date.now() - 11_000));
    expect(shouldAutoReload()).toBe(true);
  });
});
