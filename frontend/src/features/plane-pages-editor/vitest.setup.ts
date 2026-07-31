import * as matchers from "@testing-library/jest-dom/matchers";
import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";

expect.extend(matchers);

if (typeof document !== "undefined") {
  afterEach(() => cleanup());
}

if (typeof HTMLElement !== "undefined") {
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: {
      value: () => false,
    },
    setPointerCapture: {
      value: () => undefined,
    },
    releasePointerCapture: {
      value: () => undefined,
    },
    scrollIntoView: {
      value: () => undefined,
    },
  });
}

if (typeof window !== "undefined") {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
