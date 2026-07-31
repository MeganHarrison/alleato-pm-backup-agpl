/** @jest-environment jsdom */
import { attachDragPan, type DragPanScrollTarget } from "../drag-pan";

// jsdom lacks PointerEvent, so tests dispatch a MouseEvent carrying the
// pointerId the pan handlers read. dispatchEvent accepts any Event, so no
// cast to PointerEvent is needed.
function pointerEvent(type: string, init: { pointerId?: number; button?: number; clientX?: number; clientY?: number }): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: init.button ?? 0,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
  });
  Object.defineProperty(event, "pointerId", { value: init.pointerId ?? 1 });
  return event;
}

describe("attachDragPan", () => {
  let element: HTMLDivElement;
  let scrollTarget: DragPanScrollTarget;

  beforeEach(() => {
    element = document.createElement("div");
    document.body.appendChild(element);
    scrollTarget = { scrollLeft: 500, scrollTop: 400 };
  });

  afterEach(() => {
    element.remove();
  });

  it("pans the scroll target opposite to the drag so the sheet follows the cursor", () => {
    const detach = attachDragPan(element, {
      getScrollTarget: () => scrollTarget,
      shouldStartPan: () => true,
    });

    element.dispatchEvent(pointerEvent("pointerdown", { clientX: 100, clientY: 100 }));
    element.dispatchEvent(pointerEvent("pointermove", { clientX: 130, clientY: 90 }));

    expect(scrollTarget.scrollLeft).toBe(470);
    expect(scrollTarget.scrollTop).toBe(410);

    element.dispatchEvent(pointerEvent("pointermove", { clientX: 140, clientY: 95 }));
    expect(scrollTarget.scrollLeft).toBe(460);
    expect(scrollTarget.scrollTop).toBe(405);

    detach();
  });

  it("does not pan when shouldStartPan rejects the gesture", () => {
    const detach = attachDragPan(element, {
      getScrollTarget: () => scrollTarget,
      shouldStartPan: (event) => event.button === 1,
    });

    element.dispatchEvent(pointerEvent("pointerdown", { button: 0, clientX: 100, clientY: 100 }));
    element.dispatchEvent(pointerEvent("pointermove", { clientX: 200, clientY: 200 }));

    expect(scrollTarget.scrollLeft).toBe(500);
    expect(scrollTarget.scrollTop).toBe(400);

    detach();
  });

  it("stops panning after pointerup and reports panning state changes", () => {
    const onPanningChange = jest.fn();
    const detach = attachDragPan(element, {
      getScrollTarget: () => scrollTarget,
      shouldStartPan: () => true,
      onPanningChange,
    });

    element.dispatchEvent(pointerEvent("pointerdown", { clientX: 100, clientY: 100 }));
    expect(onPanningChange).toHaveBeenLastCalledWith(true);

    element.dispatchEvent(pointerEvent("pointerup", { clientX: 100, clientY: 100 }));
    expect(onPanningChange).toHaveBeenLastCalledWith(false);

    element.dispatchEvent(pointerEvent("pointermove", { clientX: 300, clientY: 300 }));
    expect(scrollTarget.scrollLeft).toBe(500);
    expect(scrollTarget.scrollTop).toBe(400);

    detach();
  });

  it("ignores moves from other pointers during a pan", () => {
    const detach = attachDragPan(element, {
      getScrollTarget: () => scrollTarget,
      shouldStartPan: () => true,
    });

    element.dispatchEvent(pointerEvent("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 }));
    element.dispatchEvent(pointerEvent("pointermove", { pointerId: 2, clientX: 250, clientY: 250 }));

    expect(scrollTarget.scrollLeft).toBe(500);
    expect(scrollTarget.scrollTop).toBe(400);

    detach();
  });

  it("does not start a pan when there is no scroll target", () => {
    const onPanningChange = jest.fn();
    const detach = attachDragPan(element, {
      getScrollTarget: () => null,
      shouldStartPan: () => true,
      onPanningChange,
    });

    element.dispatchEvent(pointerEvent("pointerdown", { clientX: 100, clientY: 100 }));
    expect(onPanningChange).not.toHaveBeenCalled();

    detach();
  });

  it("detaches all listeners on cleanup", () => {
    const detach = attachDragPan(element, {
      getScrollTarget: () => scrollTarget,
      shouldStartPan: () => true,
    });
    detach();

    element.dispatchEvent(pointerEvent("pointerdown", { clientX: 100, clientY: 100 }));
    element.dispatchEvent(pointerEvent("pointermove", { clientX: 200, clientY: 200 }));

    expect(scrollTarget.scrollLeft).toBe(500);
    expect(scrollTarget.scrollTop).toBe(400);
  });
});
