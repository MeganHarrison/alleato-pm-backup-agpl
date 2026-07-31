import { readFileSync } from "node:fs";
import path from "node:path";

import { CHROMIUM_PACK_VERSION, getChromiumRemotePackUrl } from "@/lib/documents/pdf";

/**
 * Guardrails for the two Chromium-engine production crashes:
 *
 * 1. "input directory .../@sparticuz/chromium/bin does not exist" — the bundled
 *    binary is missing, so renderPdfFromHtml() downloads a remote pack. The pack
 *    is version-pinned; a @sparticuz/chromium upgrade must not silently drift it.
 * 2. "/tmp/chromium: cannot execute binary file" (exit 126) — the pack must match
 *    the function's CPU architecture. Vercel runs x64 AND arm64 functions, and
 *    the npm package's bundled binary is x64-only, so the remote URL must be
 *    selected per-arch.
 */
describe("Chromium remote pack fallback URL", () => {
  it("pins the same version as the installed @sparticuz/chromium package", () => {
    const pkgPath = path.resolve(process.cwd(), "node_modules/@sparticuz/chromium/package.json");
    const installedVersion: string = JSON.parse(readFileSync(pkgPath, "utf8")).version;

    expect(CHROMIUM_PACK_VERSION).toBe(installedVersion);
    expect(getChromiumRemotePackUrl("x64")).toContain(`/v${installedVersion}/`);
    expect(getChromiumRemotePackUrl("arm64")).toContain(`/v${installedVersion}/`);
  });

  it("selects the pack matching the function's CPU architecture", () => {
    expect(getChromiumRemotePackUrl("x64")).toMatch(/pack\.x64\.tar$/);
    expect(getChromiumRemotePackUrl("arm64")).toMatch(/pack\.arm64\.tar$/);
    // Unknown arch falls back to x64 rather than producing a nonexistent URL.
    expect(getChromiumRemotePackUrl("ia32")).toMatch(/pack\.x64\.tar$/);
  });

  it("defaults to the current process architecture", () => {
    const expectedArch = process.arch === "arm64" ? "arm64" : "x64";
    expect(getChromiumRemotePackUrl()).toContain(`pack.${expectedArch}.tar`);
  });

  it("honors the CHROMIUM_REMOTE_PACK_URL env override verbatim", () => {
    const prior = process.env.CHROMIUM_REMOTE_PACK_URL;
    process.env.CHROMIUM_REMOTE_PACK_URL = "https://example.com/custom-pack.tar";
    try {
      expect(getChromiumRemotePackUrl("arm64")).toBe("https://example.com/custom-pack.tar");
    } finally {
      if (prior === undefined) delete process.env.CHROMIUM_REMOTE_PACK_URL;
      else process.env.CHROMIUM_REMOTE_PACK_URL = prior;
    }
  });
});
