// Bluebeam-style grab-to-pan for the drawings viewer.
//
// The vendor viewer scrolls through a plain scrollable element, so panning is
// just moving that element's scrollLeft/scrollTop opposite to the pointer —
// the sheet follows the cursor like grabbing paper. Kept free of React and
// vendor imports so it is unit-testable alongside wheel-zoom.ts.

export interface DragPanScrollTarget {
  scrollLeft: number;
  scrollTop: number;
}

export interface DragPanOptions {
  /**
   * The element whose scroll position pans the sheet. Resolved per event so a
   * vendor viewer re-mount never leaves the pan gesture holding a stale node.
   */
  getScrollTarget: () => DragPanScrollTarget | null;
  /** Gate for starting a pan — checks tool state and mouse button. */
  shouldStartPan: (event: PointerEvent) => boolean;
  /** Cursor/UI hook: true when a grab starts, false when it releases. */
  onPanningChange?: (panning: boolean) => void;
}

interface ActivePan {
  pointerId: number;
  lastX: number;
  lastY: number;
}

/**
 * Attach grab-to-pan behavior to `element`. Returns a cleanup function that
 * detaches all listeners and ends any in-flight pan.
 */
export function attachDragPan(element: HTMLElement, options: DragPanOptions): () => void {
  let active: ActivePan | null = null;

  const endPan = (event?: PointerEvent) => {
    if (!active) return;
    if (event && event.pointerId !== active.pointerId) return;
    const { pointerId } = active;
    active = null;
    // jsdom and older engines may lack pointer-capture APIs; the pan still
    // works without them, capture just makes drags outside the element stick.
    if (element.hasPointerCapture?.(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
    options.onPanningChange?.(false);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (active) return;
    if (!options.shouldStartPan(event)) return;
    if (!options.getScrollTarget()) return;
    active = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    element.setPointerCapture?.(event.pointerId);
    // Suppress native drag/text-selection so the gesture stays a pan.
    event.preventDefault();
    options.onPanningChange?.(true);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!active || event.pointerId !== active.pointerId) return;
    const target = options.getScrollTarget();
    if (!target) {
      endPan();
      return;
    }
    // Dragging right reveals content to the left → scroll decreases.
    target.scrollLeft -= event.clientX - active.lastX;
    target.scrollTop -= event.clientY - active.lastY;
    active.lastX = event.clientX;
    active.lastY = event.clientY;
  };

  const onPointerEnd = (event: PointerEvent) => endPan(event);

  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", onPointerEnd);
  element.addEventListener("pointercancel", onPointerEnd);

  return () => {
    endPan();
    element.removeEventListener("pointerdown", onPointerDown);
    element.removeEventListener("pointermove", onPointerMove);
    element.removeEventListener("pointerup", onPointerEnd);
    element.removeEventListener("pointercancel", onPointerEnd);
  };
}
