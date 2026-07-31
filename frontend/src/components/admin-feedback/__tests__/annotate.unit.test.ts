import {
  composeAnnotatedScreenshot,
  type Shape,
} from "@/components/admin-feedback/annotate";

/**
 * Guardrail for "the screenshot disappears when you annotate it".
 *
 * Root cause was twofold:
 *  1. The annotator's flattened output was written back into the same state slot
 *     that fed its <img src>, so every stroke reloaded the base image.
 *  2. A stroke committed while the <img> was mid-reload flattened against a 0x0
 *     image, and `canvas.toDataURL()` on a 0x0 canvas returns the empty
 *     "data:," string. Feeding that into the <img> blanked the screenshot.
 *
 * composeAnnotatedScreenshot must NEVER emit a data URL when the base image has
 * no usable dimensions — it returns null so callers keep the existing image.
 */

const BASE_SHAPE: Shape = {
  kind: "arrow",
  from: { x: 1, y: 1 },
  to: { x: 10, y: 10 },
  color: "#ef4444",
};

function fakeImage(dims: {
  naturalWidth: number;
  naturalHeight: number;
  offsetWidth: number;
  offsetHeight: number;
}): HTMLImageElement {
  return dims as unknown as HTMLImageElement;
}

function makeCanvas(toDataUrl: string): HTMLCanvasElement {
  const ctx = {
    canvas: { width: 0, height: 0 },
    clearRect: () => {},
    drawImage: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    closePath: () => {},
    strokeRect: () => {},
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 0,
    lineCap: "",
    lineJoin: "",
  };
  return {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toDataURL: () => toDataUrl,
  } as unknown as HTMLCanvasElement;
}

describe("composeAnnotatedScreenshot", () => {
  it("returns null when the base image has not loaded (0x0 natural size)", () => {
    const result = composeAnnotatedScreenshot({
      image: fakeImage({
        naturalWidth: 0,
        naturalHeight: 0,
        offsetWidth: 0,
        offsetHeight: 0,
      }),
      shapes: [BASE_SHAPE],
      color: "#ef4444",
      createCanvas: () => makeCanvas("data:,"),
    });
    expect(result).toBeNull();
  });

  it("returns null when the displayed image has collapsed to zero width", () => {
    const result = composeAnnotatedScreenshot({
      image: fakeImage({
        naturalWidth: 800,
        naturalHeight: 600,
        offsetWidth: 0,
        offsetHeight: 0,
      }),
      shapes: [BASE_SHAPE],
      color: "#ef4444",
      createCanvas: () => makeCanvas("data:,"),
    });
    expect(result).toBeNull();
  });

  it("emits a flattened PNG when the base image is ready", () => {
    const png = "data:image/png;base64,ANNOTATED";
    const result = composeAnnotatedScreenshot({
      image: fakeImage({
        naturalWidth: 800,
        naturalHeight: 600,
        offsetWidth: 400,
        offsetHeight: 300,
      }),
      shapes: [BASE_SHAPE],
      color: "#ef4444",
      createCanvas: () => makeCanvas(png),
    });
    expect(result).toBe(png);
  });

  it("never emits the empty 'data:,' sentinel that blanks the screenshot", () => {
    const result = composeAnnotatedScreenshot({
      image: fakeImage({
        naturalWidth: 0,
        naturalHeight: 0,
        offsetWidth: 400,
        offsetHeight: 300,
      }),
      shapes: [],
      color: "#3b82f6",
      createCanvas: () => makeCanvas("data:,"),
    });
    expect(result).not.toBe("data:,");
    expect(result).toBeNull();
  });
});
