import { compressImageDataUrl } from "@/lib/admin-feedback/compress-image";

/**
 * Guardrail for the bug where a full-page Budget screenshot (multi-MB PNG)
 * overflowed Vercel's 4.5MB request-body limit and silently failed feedback
 * submission. compressImageDataUrl must always return a data URL within the
 * configured byte budget.
 */

// Fake <img>: resolves load synchronously-ish on src assignment.
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 4000;
  naturalHeight = 3000;
  width = 4000;
  height = 3000;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

// Fake canvas where the encoded length scales with pixels * quality, so the
// downscale/quality loop measurably shrinks the output.
function installCanvasMock() {
  const ctx = {
    fillStyle: "",
    fillRect: () => {},
    drawImage: () => {},
  };
  const createElement = (tag: string) => {
    if (tag !== "canvas") throw new Error(`unexpected createElement(${tag})`);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toDataURL: (_type: string, quality: number) => {
        const bytes = Math.round(canvas.width * canvas.height * quality * 2);
        return `data:image/jpeg;base64,${"A".repeat(Math.max(1, bytes))}`;
      },
    };
    return canvas;
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement },
  });
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: FakeImage,
  });
}

describe("compressImageDataUrl", () => {
  beforeAll(installCanvasMock);

  it("reduces an oversized image below the byte budget", async () => {
    const huge = `data:image/png;base64,${"A".repeat(8_000_000)}`;
    const maxBytes = 3_000_000;

    const out = await compressImageDataUrl(huge, { maxBytes });

    expect(out.startsWith("data:image/jpeg")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(maxBytes);
  });

  it("passes through a JPEG already within budget unchanged", async () => {
    const small = `data:image/jpeg;base64,${"A".repeat(1000)}`;

    const out = await compressImageDataUrl(small, { maxBytes: 3_000_000 });

    expect(out).toBe(small);
  });
});
