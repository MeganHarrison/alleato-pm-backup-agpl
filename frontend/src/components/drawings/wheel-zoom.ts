// Wheel-to-zoom for the drawings viewer (PdfjsExpressDrawingViewer).
//
// Originally written to replace OpenSeadragon's built-in scrollToZoom when an
// OSD-based viewer existed; the rationale below explains the wheel-handling
// flaws it corrects, which apply to any naive per-tick zoom:
// OSD's wheel handler ignores BOTH the scroll magnitude and the horizontal
// axis. Its MouseTracker collapses every wheel event to a fixed ±1 tick
// (`nDelta = event.deltaY ? (event.deltaY < 0 ? 1 : -1) : 0`) — note the TODO
// in OSD source: pixel-mode deltas *should* be accumulated but aren't. Two
// real-world consequences:
//   1. A horizontally-scrolling mouse (Logitech thumb wheel / tilt wheel /
//      trackball ring) sends deltaX with deltaY === 0 → zero tick → never zooms.
//   2. A precision trackpad fires a burst of small scroll events; OSD turns
//      each into a FULL 8% tick → the zoom leaps in big steps ("jumpy").
// Both are the same flaw: zoom must scale with how much you actually scrolled,
// on whichever axis the device uses.
//
// Kept in its own module (no OpenSeadragon import) so it is unit-testable in a
// Node environment.

/** Zoom applied per normalized pixel of scroll. Tuned so a typical mouse notch
 *  (~a clamped step) lands near OSD's old 1.08 feel, while small trackpad
 *  deltas produce correspondingly small, smooth zoom. */
export const WHEEL_ZOOM_SENSITIVITY = 0.002;

/** Per-event clamp (in normalized px). Caps how much a single wheel event can
 *  zoom, so a momentum/precision-trackpad spike can't jump. This is the core of
 *  the "jumpy" fix. exp(50 * 0.002) ≈ 1.105 max per event. */
export const WHEEL_ZOOM_MAX_STEP_PX = 50;

/** Below this magnitude a delta is treated as jitter (no zoom). */
export const WHEEL_ZOOM_MIN_DELTA_PX = 1;

/** Pixels per line, for line-mode wheels (deltaMode === 1). */
export const WHEEL_LINE_HEIGHT_PX = 16;

/**
 * Normalize a wheel event to a signed pixel delta on the dominant axis.
 * Prefers the vertical axis; falls back to horizontal so thumb/tilt wheels
 * (deltaX with deltaY === 0) still drive zoom. Handles line/page delta modes.
 */
export function normalizeWheelDeltaPx(
  e: Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode">,
  viewport?: { width: number; height: number }
): number {
  let dx = e.deltaX;
  let dy = e.deltaY;
  if (e.deltaMode === 1) {
    // lines → px
    dx *= WHEEL_LINE_HEIGHT_PX;
    dy *= WHEEL_LINE_HEIGHT_PX;
  } else if (e.deltaMode === 2) {
    // pages → px
    dx *= viewport?.width ?? 800;
    dy *= viewport?.height ?? 600;
  }
  return dy !== 0 ? dy : dx;
}

/**
 * Compute the multiplicative zoom factor for a wheel event.
 *
 * Returns 1 (no zoom) for jitter / no-op events. Otherwise returns a smooth,
 * magnitude-proportional factor: negative delta (scroll up/away) zooms in
 * (factor > 1), positive zooms out (factor < 1), mirroring OSD's vertical-wheel
 * convention. The per-event delta is clamped so no single event can jump.
 */
export function wheelZoomFactor(
  e: Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode">,
  viewport?: { width: number; height: number }
): number {
  const delta = normalizeWheelDeltaPx(e, viewport);
  if (Math.abs(delta) < WHEEL_ZOOM_MIN_DELTA_PX) return 1;
  const clamped = Math.max(
    -WHEEL_ZOOM_MAX_STEP_PX,
    Math.min(WHEEL_ZOOM_MAX_STEP_PX, delta)
  );
  return Math.exp(-clamped * WHEEL_ZOOM_SENSITIVITY);
}
