"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ErrorState } from "@/components/ds";
import { cn } from "@/lib/utils";
import {
  PdfjsExpressMarkupOverlay,
  type PdfjsExpressMarkupOverlayHandle,
  type PdfjsExpressMarkupTool,
  type PdfjsExpressPageViewport,
} from "@/components/drawings/PdfjsExpressMarkupOverlay";
import { drawingMarkupCursor } from "@/components/drawings/drawing-markup-cursor";
import { wheelZoomFactor } from "@/components/drawings/wheel-zoom";
import { attachDragPan } from "@/components/drawings/drag-pan";
import type { DrawingMarkupPin } from "@/hooks/use-drawing-pins";

interface PdfjsExpressDrawingViewerProps {
  fileUrl: string;
  licenseKey: string | undefined;
  projectId: string;
  drawingId: string;
  page: number;
  markupTool: PdfjsExpressMarkupTool;
  markupColor: string;
  pins?: DrawingMarkupPin[];
  hiddenMarkupTypes?: Exclude<PdfjsExpressMarkupTool, "idle" | "select" | "link" | "eraser">[];
  hiddenPinTypes?: DrawingMarkupPin["pin_type"][];
  showPins?: boolean;
  onPinClick?: (pin: DrawingMarkupPin) => void;
  onLinkPosition?: (position: { x: number; y: number; page: number }) => void;
  onNoteOpen?: () => void;
  onUndoAvailabilityChange?: (canUndo: boolean) => void;
  className?: string;
  onPageNumberChange?: (page: number, total: number) => void;
}

export interface PdfjsExpressDrawingViewerHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  rotateClockwise: () => void;
  rotateCounterClockwise: () => void;
  undo: () => void;
}

interface DocumentViewerControls {
  getZoom?: () => number;
  getZoomLevel?: () => number;
  zoomIn?: () => void;
  zoomOut?: () => void;
  /**
   * Optional (x, y) are ABSOLUTE scroll offsets applied after zooming — not an
   * anchor point. Verified against the live vendor build: zoomTo(z, x, y)
   * scrolls the scroll view to exactly (x, y). Cursor-anchored zoom is
   * therefore computed by the caller from the current scroll position.
   */
  zoomTo?: (zoom: number, x?: number, y?: number) => void;
  rotateClockwise?: (pageNumber?: number) => void;
  rotateCounterClockwise?: (pageNumber?: number) => void;
  getRotation?: (pageNumber?: number) => number;
  setRotation?: (rotation: number, pageNumber?: number) => void;
}

const ZOOM_STEP = 1.2;

function getCurrentZoom(documentViewer: DocumentViewerControls) {
  const zoom = documentViewer.getZoomLevel?.() ?? documentViewer.getZoom?.();
  return typeof zoom === "number" && Number.isFinite(zoom) ? zoom : null;
}

function getCurrentRotation(documentViewer: DocumentViewerControls) {
  const rotation = documentViewer.getRotation?.();
  return typeof rotation === "number" && Number.isFinite(rotation) ? rotation : null;
}

function describeViewerInitializationError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch (serializationError) {
    console.error("PDF.js Express initialization error was not serializable.", serializationError);
  }
  return "PDF.js Express returned a non-serializable initialization failure.";
}

export const PdfjsExpressDrawingViewer = forwardRef<PdfjsExpressDrawingViewerHandle, PdfjsExpressDrawingViewerProps>(function PdfjsExpressDrawingViewer({
  fileUrl,
  licenseKey,
  projectId,
  drawingId,
  page,
  markupTool,
  markupColor,
  pins,
  hiddenMarkupTypes,
  hiddenPinTypes,
  showPins,
  onPinClick,
  onLinkPosition,
  onNoteOpen,
  onUndoAvailabilityChange,
  className,
  onPageNumberChange,
}, ref) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const markupOverlayRef = useRef<PdfjsExpressMarkupOverlayHandle | null>(null);
  const documentViewerRef = useRef<DocumentViewerControls | null>(null);
  const scrollViewRef = useRef<HTMLElement | null>(null);
  const markupToolRef = useRef(markupTool);
  const onPageNumberChangeRef = useRef(onPageNumberChange);
  const scheduleViewportRefreshRef = useRef<() => void>(() => undefined);
  const [error, setError] = useState<string | null>(null);
  const [pageViewport, setPageViewport] = useState<PdfjsExpressPageViewport | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  // The vendor viewer is rendered in an iframe, which otherwise wins hit
  // testing over the sibling SVG markup layer even when that layer has z-index.
  const markupInteractionActive = markupTool !== "idle";
  const activeCursor = drawingMarkupCursor(markupTool, markupColor);

  const zoomFromWheel = useCallback(
    (
      event: WheelEvent,
      viewport: { width: number; height: number },
      anchor?: { x: number; y: number },
    ) => {
      const documentViewer = documentViewerRef.current;
      const currentZoom = documentViewer ? getCurrentZoom(documentViewer) : null;
      if (!documentViewer?.zoomTo || currentZoom === null) return;

      const factor = wheelZoomFactor(event, viewport);
      if (factor === 1) return;

      // Both the annotation overlay (while a markup tool is active) and the
      // vendor iframe (while it is idle) can receive wheel input. Own zoom at
      // this shared boundary so neither path silently degrades to scrolling.
      event.preventDefault();
      const scrollView = scrollViewRef.current;
      if (anchor && scrollView) {
        // Keep the sheet point under the cursor fixed (Bluebeam-style "zoom
        // straight in"): the content point at viewport offset `anchor` sits at
        // (scroll + anchor) in content space, scales by `factor`, and the
        // scroll is set so it lands back on the same viewport offset.
        documentViewer.zoomTo(
          currentZoom * factor,
          Math.max(0, (scrollView.scrollLeft + anchor.x) * factor - anchor.x),
          Math.max(0, (scrollView.scrollTop + anchor.y) * factor - anchor.y),
        );
      } else {
        documentViewer.zoomTo(currentZoom * factor);
      }
      scheduleViewportRefreshRef.current();
    },
    [],
  );

  useEffect(() => {
    onPageNumberChangeRef.current = onPageNumberChange;
  }, [onPageNumberChange]);

  useEffect(() => {
    markupToolRef.current = markupTool;
  }, [markupTool]);

  // ── Bluebeam-style grab-to-pan (markup overlay active) ────────────────────
  // While a markup tool is mounted the overlay owns pointer input and stops
  // propagation whenever it claims a gesture (annotation drag, drawing, …).
  // Anything that reaches the surface is free space: left-drag pans in select
  // mode, middle-drag pans with any tool — mirroring Bluebeam.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    return attachDragPan(surface, {
      getScrollTarget: () => scrollViewRef.current,
      shouldStartPan: (event) =>
        event.button === 1 ||
        (event.button === 0 && markupToolRef.current === "select"),
      onPanningChange: setIsPanning,
    });
  }, []);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const handleOverlayWheel = (event: WheelEvent) => {
      // The vendor iframe fills the surface, so surface-relative coordinates
      // line up with the viewer-relative anchor zoomTo expects.
      const rect = surface.getBoundingClientRect();
      zoomFromWheel(
        event,
        { width: rect.width, height: rect.height },
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
      );
    };

    // React's delegated wheel event can be passive. The annotation overlay
    // requires a native non-passive listener so the browser does not scroll
    // instead of letting the drawing viewer consume the gesture.
    surface.addEventListener("wheel", handleOverlayWheel, { passive: false });
    return () => surface.removeEventListener("wheel", handleOverlayWheel);
  }, [zoomFromWheel]);

  useImperativeHandle(ref, () => {
    const refreshAfterControl = () => {
      scheduleViewportRefreshRef.current();
      window.setTimeout(() => scheduleViewportRefreshRef.current(), 150);
    };

    const zoomBy = (factor: number) => {
      const documentViewer = documentViewerRef.current;
      if (!documentViewer) return;

      if (documentViewer.zoomIn && factor > 1) {
        documentViewer.zoomIn();
        refreshAfterControl();
        return;
      }

      if (documentViewer.zoomOut && factor < 1) {
        documentViewer.zoomOut();
        refreshAfterControl();
        return;
      }

      const currentZoom = getCurrentZoom(documentViewer);
      if (currentZoom !== null && documentViewer.zoomTo) {
        documentViewer.zoomTo(currentZoom * factor);
        refreshAfterControl();
        return;
      }

      console.error("Drawing viewer zoom controls are unavailable for this PDF.js Express instance.");
    };

    const rotateBy = (direction: "clockwise" | "counter-clockwise") => {
      const documentViewer = documentViewerRef.current;
      if (!documentViewer) return;

      const rotate =
        direction === "clockwise"
          ? documentViewer.rotateClockwise
          : documentViewer.rotateCounterClockwise;

      if (rotate) {
        rotate.call(documentViewer);
        refreshAfterControl();
        return;
      }

      const currentRotation = getCurrentRotation(documentViewer);
      if (currentRotation !== null && documentViewer.setRotation) {
        const delta = direction === "clockwise" ? 1 : -1;
        documentViewer.setRotation((currentRotation + delta + 4) % 4);
        refreshAfterControl();
        return;
      }

      console.error("Drawing viewer rotation controls are unavailable for this PDF.js Express instance.");
    };

    return {
      zoomIn: () => zoomBy(ZOOM_STEP),
      zoomOut: () => zoomBy(1 / ZOOM_STEP),
      rotateClockwise: () => rotateBy("clockwise"),
      rotateCounterClockwise: () => rotateBy("counter-clockwise"),
      undo: () => markupOverlayRef.current?.undo(),
    };
  }, []);

  useEffect(() => {
    if (!licenseKey?.trim()) {
      setError(
        "Missing NEXT_PUBLIC_PDFJS_EXPRESS_LICENSE_KEY. The drawings viewer cannot initialize without a PDF.js Express license key.",
      );
      return;
    }

    const hostElement = viewerRef.current;
    if (!hostElement) {
      return;
    }

    let cancelled = false;
    let initializeTimeout: number | null = null;
    let animationFrame: number | null = null;
    let viewportRetryTimeout: number | null = null;
    let viewportRetries = 0;
    let removeViewportListeners: (() => void) | null = null;
    // React Strict Mode re-runs effects in development. A new child prevents
    // WebViewer from seeing a previous instance on the same host element.
    const viewerElement = document.createElement("div");
    // The vendor sets iframe height as an HTML attribute. CSS height is also
    // required for the iframe to resolve the parent's full available height.
    viewerElement.className = "h-full w-full [&>iframe]:h-full";
    hostElement.replaceChildren(viewerElement);

    initializeTimeout = window.setTimeout(() => {
      void import("@pdftron/pdfjs-express-viewer")
      .then(({ default: WebViewer }) =>
        WebViewer(
          {
            path: "/webviewer/lib",
            initialDoc: fileUrl,
            licenseKey,
          },
          viewerElement,
        ),
      )
      .then((instance) => {
        if (cancelled) {
          return;
        }

        const { Core } = instance;
        instance.UI.disableElements(["header", "toolsHeader"]);
        documentViewerRef.current = Core.documentViewer;
        const emitPageState = (pageNumber?: number) => {
          const currentPage = pageNumber ?? Core.documentViewer.getCurrentPage();
          const totalPages = Core.documentViewer.getPageCount();
          onPageNumberChangeRef.current?.(currentPage, totalPages);
        };

        const updatePageViewport = () => {
          if (cancelled) return;

          const scrollView = Core.documentViewer.getScrollViewElement();
          const currentPage = Core.documentViewer.getCurrentPage();
          const pageContainer = Array.from(
            scrollView.querySelectorAll<HTMLElement>(".pageContainer, [data-page-number]"),
          ).find((element) => {
            const pageNumber = element.dataset.pageNumber ?? element.getAttribute("data-page-number");
            return pageNumber === String(currentPage);
          });
          const canvas = pageContainer?.querySelector<HTMLCanvasElement>("canvas")
            ?? Array.from(scrollView.querySelectorAll<HTMLCanvasElement>("canvas")).find(
              (element) => element.getBoundingClientRect().width > 20 && element.getBoundingClientRect().height > 20,
            );
          const rect = (pageContainer ?? canvas)?.getBoundingClientRect();

          if (!rect || rect.width <= 0 || rect.height <= 0) {
            setPageViewport(null);
            if (viewportRetries < 20) {
              viewportRetries += 1;
              viewportRetryTimeout = window.setTimeout(schedulePageViewportUpdate, 100);
            }
            return;
          }

          viewportRetries = 0;
          setPageViewport({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
        };

        const schedulePageViewportUpdate = () => {
          if (animationFrame !== null) return;
          animationFrame = window.requestAnimationFrame(() => {
            animationFrame = null;
            updatePageViewport();
          });
        };
        scheduleViewportRefreshRef.current = schedulePageViewportUpdate;

        Core.documentViewer.addEventListener("documentLoaded", () => {
          setError(null);
          emitPageState();
          schedulePageViewportUpdate();
        });
        Core.documentViewer.addEventListener("pageNumberUpdated", (pageNumber) => {
          emitPageState(pageNumber);
          schedulePageViewportUpdate();
        });
        Core.documentViewer.addEventListener("pageComplete", schedulePageViewportUpdate);
        Core.documentViewer.addEventListener("zoomUpdated", schedulePageViewportUpdate);
        Core.documentViewer.addEventListener("rotationUpdated", schedulePageViewportUpdate);

        const scrollView = Core.documentViewer.getScrollViewElement();
        scrollViewRef.current = scrollView;
        scrollView.addEventListener("scroll", schedulePageViewportUpdate, { passive: true });
        const handleVendorWheel = (event: WheelEvent) => {
          const rect = scrollView.getBoundingClientRect();
          zoomFromWheel(
            event,
            { width: rect.width, height: rect.height },
            { x: event.clientX - rect.left, y: event.clientY - rect.top },
          );
        };
        scrollView.addEventListener("wheel", handleVendorWheel, { passive: false });
        // Grab-to-pan while the vendor viewer owns pointer input (idle tool).
        // The vendor renders in an iframe, so these events never bubble to the
        // surface-level pan handler — the scroll element needs its own.
        const detachIdleDragPan = attachDragPan(scrollView, {
          getScrollTarget: () => scrollView,
          shouldStartPan: (event) =>
            (event.button === 0 || event.button === 1) &&
            markupToolRef.current === "idle",
          onPanningChange: (panning) => {
            scrollView.style.cursor = panning ? "grabbing" : "";
          },
        });
        window.addEventListener("resize", schedulePageViewportUpdate);
        removeViewportListeners = () => {
          detachIdleDragPan();
          scrollView.removeEventListener("scroll", schedulePageViewportUpdate);
          scrollView.removeEventListener("wheel", handleVendorWheel);
          window.removeEventListener("resize", schedulePageViewportUpdate);
          Core.documentViewer.removeEventListener("rotationUpdated", schedulePageViewportUpdate);
          Core.documentViewer.removeEventListener("zoomUpdated", schedulePageViewportUpdate);
          Core.documentViewer.removeEventListener("pageComplete", schedulePageViewportUpdate);
        };
      })
      .catch((viewerError: unknown) => {
        if (cancelled) {
          return;
        }
        console.error("PDF.js Express initialization failed.", viewerError);
        const message = describeViewerInitializationError(viewerError);
        setError(`Failed to initialize PDF.js Express: ${message}`);
      });
    }, 0);

    return () => {
      cancelled = true;
      if (initializeTimeout !== null) window.clearTimeout(initializeTimeout);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      if (viewportRetryTimeout !== null) window.clearTimeout(viewportRetryTimeout);
      removeViewportListeners?.();
      documentViewerRef.current = null;
      scrollViewRef.current = null;
      scheduleViewportRefreshRef.current = () => undefined;
      setPageViewport(null);
      // PDF.js Express may re-parent this mount node below its own wrapper.
      // Element.remove() detaches it from its actual parent without assuming it
      // remains a direct child of our host during React cleanup.
      viewerElement.remove();
    };
  }, [fileUrl, licenseKey, zoomFromWheel]);

  if (error) {
    return (
      <ErrorState
        title="Failed to load drawing viewer"
        description={error}
        className="h-full"
      />
    );
  }

  return (
    <div
      ref={surfaceRef}
      className={cn("relative h-full w-full", className)}
      data-drawing-markup-surface="true"
      data-markup-tool={markupTool}
      style={{ cursor: isPanning ? "grabbing" : activeCursor }}
    >
      <div
        ref={viewerRef}
        className="h-full w-full"
        style={{ pointerEvents: markupInteractionActive ? "none" : "auto" }}
      />
      <PdfjsExpressMarkupOverlay
        ref={markupOverlayRef}
        projectId={projectId}
        drawingId={drawingId}
        page={page}
        tool={markupTool}
        color={markupColor}
        pageViewport={pageViewport}
        pins={pins}
        hiddenMarkupTypes={hiddenMarkupTypes}
        hiddenPinTypes={hiddenPinTypes}
        showPins={showPins}
        onPinClick={onPinClick}
        onLinkPosition={onLinkPosition}
        onNoteOpen={onNoteOpen}
        onUndoAvailabilityChange={onUndoAvailabilityChange}
      />
    </div>
  );
});
