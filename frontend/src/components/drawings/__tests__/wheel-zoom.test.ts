import {
  WHEEL_ZOOM_MAX_STEP_PX,
  WHEEL_ZOOM_SENSITIVITY,
  WHEEL_LINE_HEIGHT_PX,
  normalizeWheelDeltaPx,
  wheelZoomFactor,
} from "../wheel-zoom";

// Regression guard for the drawings wheel-zoom bug: OpenSeadragon collapses
// every wheel event to a fixed ±1 tick and ignores the horizontal axis, which
// makes precision trackpads jump ("jumpy") and horizontal thumb/tilt wheels do
// nothing. wheelZoomFactor replaces that with a smooth, magnitude-proportional,
// clamped, axis-agnostic factor.

const ev = (deltaX: number, deltaY: number, deltaMode = 0) => ({
  deltaX,
  deltaY,
  deltaMode,
});

describe("normalizeWheelDeltaPx", () => {
  it("prefers the vertical axis", () => {
    expect(normalizeWheelDeltaPx(ev(100, -30))).toBe(-30);
  });

  it("falls back to horizontal when vertical is empty (thumb wheel)", () => {
    expect(normalizeWheelDeltaPx(ev(-42, 0))).toBe(-42);
  });

  it("converts line-mode deltas to pixels", () => {
    expect(normalizeWheelDeltaPx(ev(0, -3, 1))).toBe(-3 * WHEEL_LINE_HEIGHT_PX);
  });

  it("converts page-mode deltas using the viewport height", () => {
    expect(normalizeWheelDeltaPx(ev(0, -2, 2), { width: 640, height: 400 })).toBe(-800);
  });
});

describe("wheelZoomFactor", () => {
  it("zooms in on scroll-up (negative delta) and out on scroll-down", () => {
    expect(wheelZoomFactor(ev(0, -30))).toBeGreaterThan(1);
    expect(wheelZoomFactor(ev(0, 30))).toBeLessThan(1);
  });

  it("zooms on a horizontal-only wheel (thumb/tilt wheel)", () => {
    expect(wheelZoomFactor(ev(-30, 0))).toBeGreaterThan(1);
    expect(wheelZoomFactor(ev(30, 0))).toBeLessThan(1);
  });

  it("scales with magnitude — a bigger scroll zooms more (smooth, not fixed ticks)", () => {
    const small = wheelZoomFactor(ev(0, -5));
    const big = wheelZoomFactor(ev(0, -40));
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThan(1);
  });

  it("clamps each event so a momentum/precision spike can't jump (the jumpy fix)", () => {
    const spike = wheelZoomFactor(ev(0, -100000));
    const maxPerEvent = Math.exp(WHEEL_ZOOM_MAX_STEP_PX * WHEEL_ZOOM_SENSITIVITY);
    expect(spike).toBeCloseTo(maxPerEvent, 6);
    // A single event can never more than ~1.1× — no leaps.
    expect(spike).toBeLessThan(1.11);
  });

  it("treats sub-pixel / zero deltas as no-op (returns exactly 1)", () => {
    expect(wheelZoomFactor(ev(0, 0))).toBe(1);
    expect(wheelZoomFactor(ev(0.4, 0))).toBe(1);
  });

  it("is symmetric — equal-and-opposite scrolls are inverse factors", () => {
    const inFactor = wheelZoomFactor(ev(0, -20));
    const outFactor = wheelZoomFactor(ev(0, 20));
    expect(inFactor * outFactor).toBeCloseTo(1, 6);
  });
});
