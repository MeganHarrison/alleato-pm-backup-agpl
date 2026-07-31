/** @jest-environment jsdom */

import { observeMalformedVeltAnnotations } from "../annotation-sanitizer";

describe("observeMalformedVeltAnnotations", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("never removes product-owned annotation DOM", () => {
    document.body.innerHTML = `
      <svg aria-label="Drawing markup overlay">
        <g data-annotation-layer="true">
          <rect data-drawing-annotation-id="drawing-1"></rect>
          <rect data-annotation-id="legacy-product-annotation"></rect>
        </g>
      </svg>
    `;

    observeMalformedVeltAnnotations(document);

    expect(document.querySelector('[data-drawing-annotation-id="drawing-1"]')).not.toBeNull();
    expect(document.querySelector('[data-annotation-id="legacy-product-annotation"]')).not.toBeNull();
  });

  it("removes malformed Velt-owned annotations and preserves valid ones", () => {
    document.body.innerHTML = `
      <div data-velt-annotation="malformed"></div>
      <div data-velt-annotation="valid" data-velt-target="target-1">Comment</div>
    `;

    observeMalformedVeltAnnotations(document);

    expect(document.querySelector('[data-velt-annotation="malformed"]')).toBeNull();
    expect(document.querySelector('[data-velt-annotation="valid"]')).not.toBeNull();
  });

  it("does not remove product annotations added after observation starts", async () => {
    const stop = observeMalformedVeltAnnotations(document);
    const annotation = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    annotation.setAttribute("data-drawing-annotation-id", "drawing-2");
    document.body.append(annotation);

    await Promise.resolve();

    expect(document.querySelector('[data-drawing-annotation-id="drawing-2"]')).toBe(annotation);
    stop();
  });

  it("disconnects its document observer when the Velt layer unmounts", () => {
    const disconnect = jest.spyOn(MutationObserver.prototype, "disconnect");

    const stop = observeMalformedVeltAnnotations(document);
    stop();

    expect(disconnect).toHaveBeenCalledTimes(1);
    disconnect.mockRestore();
  });
});
