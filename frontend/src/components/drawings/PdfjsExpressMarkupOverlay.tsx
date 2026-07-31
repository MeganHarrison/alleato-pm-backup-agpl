"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { drawingMarkupCursor } from "@/components/drawings/drawing-markup-cursor";
import type { DrawingMarkupPin } from "@/hooks/use-drawing-pins";
import { createHttpDrawingAnnotationStore, type StoredDrawingAnnotation } from "@/components/drawings/drawing-annotation-store";
import { DrawingPhotoPreview } from "@/components/drawings/DrawingPhotoPreview";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

export type PdfjsExpressMarkupTool =
  | "idle"
  | "select"
  | "pen"
  | "highlighter"
  | "rectangle"
  | "cloud"
  | "arrow"
  | "text"
  | "note"
  | "link"
  | "eraser";

type MarkupType = Exclude<PdfjsExpressMarkupTool, "idle" | "select" | "link" | "eraser">;
type Point = { x: number; y: number };
type ResizeHandle = "nw" | "ne" | "se" | "sw";
type TransformAction = "move" | "resize";

interface MarkupData {
  points?: Point[];
  start?: Point;
  end?: Point;
  position?: Point;
  text?: string;
  /** Coordinates are percentages of the rendered PDF page, not the browser viewport. */
  page_percent?: true;
}

export interface PdfjsExpressPageViewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface MarkupAnnotation {
  id: string;
  type: MarkupType;
  page: number;
  color: string;
  strokeWidth: number;
  data: MarkupData;
  pending?: boolean;
}

interface TextDraft {
  annotationId?: string;
  type: Extract<MarkupType, "text" | "note">;
  position: Point;
  value: string;
}

interface AnnotationBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface TransformSession {
  action: TransformAction;
  annotation: MarkupAnnotation;
  handle?: ResizeHandle;
  pointerStart: Point;
  updated: MarkupAnnotation;
}

type StoredAnnotationRow = StoredDrawingAnnotation;

interface PdfjsExpressMarkupOverlayProps {
  projectId: string;
  drawingId: string;
  page: number;
  tool: PdfjsExpressMarkupTool;
  color: string;
  pageViewport: PdfjsExpressPageViewport | null;
  pins?: DrawingMarkupPin[];
  hiddenMarkupTypes?: MarkupType[];
  hiddenPinTypes?: DrawingMarkupPin["pin_type"][];
  showPins?: boolean;
  onPinClick?: (pin: DrawingMarkupPin) => void;
  onLinkPosition?: (position: { x: number; y: number; page: number }) => void;
  onNoteOpen?: () => void;
  onUndoAvailabilityChange?: (canUndo: boolean) => void;
  strokeWidth?: number;
}

export interface PdfjsExpressMarkupOverlayHandle {
  undo: () => void;
}

const PIN_COLORS: Record<DrawingMarkupPin["pin_type"], string> = {
  rfi: "#3b82f6",
  punch_item: "#f97316",
  coordination_issue: "#dc2626",
  drawing: "#7c3aed",
  document: "#0891b2",
  photo: "#16a34a",
  submittal: "#0ea5e9",
  task: "#ca8a04",
};

function temporaryId() {
  return `pending-${crypto.randomUUID()}`;
}

function isMarkupType(value: string): value is MarkupType {
  return ["pen", "highlighter", "rectangle", "cloud", "arrow", "text", "note"].includes(value);
}

function isCanonicalPageMarkup(row: StoredAnnotationRow): row is StoredAnnotationRow & {
  annotation_type: MarkupType;
  data: MarkupData & { page_percent: true; color?: string; strokeWidth?: number };
} {
  return (
    isMarkupType(row.annotation_type) &&
    typeof row.data === "object" &&
    row.data !== null &&
    !Array.isArray(row.data) &&
    (row.data as MarkupData).page_percent === true
  );
}

function rowToAnnotation(row: StoredAnnotationRow & {
  annotation_type: MarkupType;
  data: MarkupData & { page_percent: true; color?: string; strokeWidth?: number };
}): MarkupAnnotation {
  const { color = "#ef4444", strokeWidth = 2, ...data } = row.data;
  return {
    id: row.id,
    type: row.annotation_type,
    page: row.page,
    color,
    strokeWidth,
    data,
  };
}

function pointsToPath(points: Point[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function markupStrokeWidth(annotation: Pick<MarkupAnnotation, "strokeWidth">) {
  return Math.max(0.24, annotation.strokeWidth * 0.22);
}

function cloudPath(start: Point, end: Point) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.max(Math.abs(end.x - start.x), 0.1);
  const height = Math.max(Math.abs(end.y - start.y), 0.1);
  const segmentCountX = Math.max(5, Math.round(width / 3.5));
  const segmentCountY = Math.max(4, Math.round(height / 3.5));
  const dx = width / segmentCountX;
  const dy = height / segmentCountY;
  const radiusX = Math.min(dx * 0.55, 2.8);
  const radiusY = Math.min(dy * 0.55, 2.8);
  const commands: string[] = [`M ${x} ${y + dy / 2}`];

  for (let index = 0; index < segmentCountX; index += 1) {
    commands.push(`a ${radiusX} ${radiusY} 0 0 1 ${dx} 0`);
  }
  for (let index = 0; index < segmentCountY; index += 1) {
    commands.push(`a ${radiusX} ${radiusY} 0 0 1 0 ${dy}`);
  }
  for (let index = segmentCountX; index > 0; index -= 1) {
    commands.push(`a ${radiusX} ${radiusY} 0 0 1 ${-dx} 0`);
  }
  for (let index = segmentCountY; index > 0; index -= 1) {
    commands.push(`a ${radiusX} ${radiusY} 0 0 1 0 ${-dy}`);
  }

  return `${commands.join(" ")} Z`;
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const projected = { x: start.x + t * dx, y: start.y + t * dy };
  return Math.hypot(point.x - projected.x, point.y - projected.y);
}

function pointInBounds(point: Point, start: Point, end: Point, padding = 0) {
  const minX = Math.min(start.x, end.x) - padding;
  const maxX = Math.max(start.x, end.x) + padding;
  const minY = Math.min(start.y, end.y) - padding;
  const maxY = Math.max(start.y, end.y) + padding;
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

function pointHitsAnnotation(point: Point, annotation: MarkupAnnotation) {
  if (annotation.type === "rectangle" || annotation.type === "cloud") {
    const { start, end } = annotation.data;
    return Boolean(start && end && pointInBounds(point, start, end, 0.8));
  }

  if (annotation.type === "arrow") {
    const { start, end } = annotation.data;
    return Boolean(start && end && distanceToSegment(point, start, end) <= 1.6);
  }

  if (annotation.type === "text" || annotation.type === "note") {
    const { position } = annotation.data;
    return Boolean(position && Math.abs(point.x - position.x) <= 4 && Math.abs(point.y - position.y) <= 2.8);
  }

  const points = annotation.data.points ?? [];
  return points.some((candidate, index) => {
    const previous = points[index - 1];
    if (!previous) return Math.hypot(point.x - candidate.x, point.y - candidate.y) <= 1.6;
    return distanceToSegment(point, previous, candidate) <= 1.6;
  });
}

function annotationBounds(annotation: MarkupAnnotation): AnnotationBounds | null {
  if (annotation.data.start && annotation.data.end) {
    return {
      minX: Math.min(annotation.data.start.x, annotation.data.end.x),
      minY: Math.min(annotation.data.start.y, annotation.data.end.y),
      maxX: Math.max(annotation.data.start.x, annotation.data.end.x),
      maxY: Math.max(annotation.data.start.y, annotation.data.end.y),
    };
  }

  const points = annotation.data.points ?? [];
  if (points.length > 0) {
    return {
      minX: Math.min(...points.map((point) => point.x)),
      minY: Math.min(...points.map((point) => point.y)),
      maxX: Math.max(...points.map((point) => point.x)),
      maxY: Math.max(...points.map((point) => point.y)),
    };
  }

  if (annotation.data.position) {
    const { position } = annotation.data;
    return {
      minX: position.x - 0.8,
      minY: position.y - 1.8,
      maxX: position.x + Math.max(2.5, (annotation.data.text?.length ?? 1) * 1.35),
      maxY: position.y + 0.8,
    };
  }

  return null;
}

function resizeHandleAt(point: Point, bounds: AnnotationBounds): ResizeHandle | null {
  const handles: Array<[ResizeHandle, Point]> = [
    ["nw", { x: bounds.minX, y: bounds.minY }],
    ["ne", { x: bounds.maxX, y: bounds.minY }],
    ["se", { x: bounds.maxX, y: bounds.maxY }],
    ["sw", { x: bounds.minX, y: bounds.maxY }],
  ];
  return handles.find(([, handle]) => Math.abs(point.x - handle.x) <= 1.6 && Math.abs(point.y - handle.y) <= 1.6)?.[0] ?? null;
}

function moveAnnotation(annotation: MarkupAnnotation, pointerStart: Point, pointer: Point): MarkupAnnotation {
  const bounds = annotationBounds(annotation);
  if (!bounds) return annotation;
  const requestedX = pointer.x - pointerStart.x;
  const requestedY = pointer.y - pointerStart.y;
  const dx = Math.max(-bounds.minX, Math.min(requestedX, 100 - bounds.maxX));
  const dy = Math.max(-bounds.minY, Math.min(requestedY, 100 - bounds.maxY));
  const translate = (point: Point) => ({ x: point.x + dx, y: point.y + dy });

  return {
    ...annotation,
    data: {
      ...annotation.data,
      ...(annotation.data.start ? { start: translate(annotation.data.start) } : {}),
      ...(annotation.data.end ? { end: translate(annotation.data.end) } : {}),
      ...(annotation.data.position ? { position: translate(annotation.data.position) } : {}),
      ...(annotation.data.points ? { points: annotation.data.points.map(translate) } : {}),
    },
  };
}

function resizeAnnotation(annotation: MarkupAnnotation, handle: ResizeHandle, pointer: Point): MarkupAnnotation {
  const bounds = annotationBounds(annotation);
  if (!bounds) return annotation;
  const minimumSize = 1;
  const clamped = { x: Math.max(0, Math.min(pointer.x, 100)), y: Math.max(0, Math.min(pointer.y, 100)) };
  let { minX, minY, maxX, maxY } = bounds;

  if (handle.includes("n")) minY = Math.min(clamped.y, maxY - minimumSize);
  if (handle.includes("s")) maxY = Math.max(clamped.y, minY + minimumSize);
  if (handle.includes("w")) minX = Math.min(clamped.x, maxX - minimumSize);
  if (handle.includes("e")) maxX = Math.max(clamped.x, minX + minimumSize);

  return {
    ...annotation,
    data: {
      ...annotation.data,
      start: { x: minX, y: minY },
      end: { x: maxX, y: maxY },
    },
  };
}

export const PdfjsExpressMarkupOverlay = forwardRef<
  PdfjsExpressMarkupOverlayHandle,
  PdfjsExpressMarkupOverlayProps
>(function PdfjsExpressMarkupOverlay({
  projectId,
  drawingId,
  page,
  tool,
  color,
  pageViewport,
  pins = [],
  hiddenMarkupTypes = [],
  hiddenPinTypes = [],
  showPins = true,
  onPinClick,
  onLinkPosition,
  onNoteOpen,
  onUndoAvailabilityChange,
  strokeWidth = 2,
}, ref) {
  const [annotations, setAnnotations] = useState<MarkupAnnotation[]>([]);
  const [annotationLoadAttempt, setAnnotationLoadAttempt] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const draftRef = useRef<MarkupAnnotation | null>(null);
  const transformRef = useRef<TransformSession | null>(null);
  const persistedDraftIdsRef = useRef<Set<string>>(new Set());
  const deletingAnnotationIdsRef = useRef<Set<string>>(new Set());
  const deletedAnnotationIdsRef = useRef<Set<string>>(new Set());
  const transformingAnnotationIdsRef = useRef<Set<string>>(new Set());
  const [draft, setDraft] = useState<MarkupAnnotation | null>(null);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const [undoableAnnotationIds, setUndoableAnnotationIds] = useState<string[]>([]);

  const annotationStore = useMemo(
    () => createHttpDrawingAnnotationStore(projectId, drawingId),
    [projectId, drawingId],
  );
  const active = tool !== "idle";
  const activeCursor = drawingMarkupCursor(tool, color);

  useEffect(() => {
    const controller = new AbortController();
    persistedDraftIdsRef.current.clear();
    deletingAnnotationIdsRef.current.clear();
    deletedAnnotationIdsRef.current.clear();
    transformingAnnotationIdsRef.current.clear();
    draftRef.current = null;
    transformRef.current = null;
    setAnnotations([]);
    setActiveId(null);
    setDraft(null);
    setTextDraft(null);
    setUndoableAnnotationIds([]);
    void annotationStore.load(controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        const loaded = rows
          .filter(isCanonicalPageMarkup)
          .map(rowToAnnotation)
          .filter((annotation) => !deletedAnnotationIdsRef.current.has(annotation.id));
        // The initial GET may resolve after a create, transform, or delete.
        // Merge its snapshot behind current client state so stale hydration can
        // never remove or roll back an annotation the user just changed.
        setAnnotations((current) => {
          const merged = new Map(loaded.map((annotation) => [annotation.id, annotation]));
          current.forEach((annotation) => merged.set(annotation.id, annotation));
          return [...merged.values()].filter(
            (annotation) => !deletedAnnotationIdsRef.current.has(annotation.id),
          );
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Unknown markup loading error.";
        toast.error("Saved markup could not be loaded", {
          description: `${message} Try loading the saved markup again.`,
          action: {
            label: "Retry",
            onClick: () => setAnnotationLoadAttempt((attempt) => attempt + 1),
          },
        });
      });

    return () => controller.abort();
  }, [annotationLoadAttempt, annotationStore]);

  const pointFor = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  };

  const persist = (annotation: MarkupAnnotation) => {
    if (persistedDraftIdsRef.current.has(annotation.id)) return;
    persistedDraftIdsRef.current.add(annotation.id);
    setAnnotations((current) => [
      ...current.filter((item) => item.id !== annotation.id),
      annotation,
    ]);
    void annotationStore.create({
      annotation_type: annotation.type,
      page: annotation.page,
      data: { ...annotation.data, color: annotation.color, strokeWidth: annotation.strokeWidth },
    })
      .then((savedRow) => {
        if (!isCanonicalPageMarkup(savedRow)) {
          throw new Error("The saved markup did not retain the canonical PDF page coordinate contract.");
        }
        const saved = rowToAnnotation(savedRow);
        setAnnotations((current) => current.map((item) => item.id === annotation.id ? saved : item));
        setActiveId((current) => current === annotation.id ? saved.id : current);
        setUndoableAnnotationIds((current) => [...current, saved.id]);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown markup save error.";
        persistedDraftIdsRef.current.delete(annotation.id);
        setAnnotations((current) => current.filter((item) => item.id !== annotation.id));
        toast.error("Markup could not be saved", {
          description: `${message} The unsaved markup was removed so the drawing stays authoritative. Retry to send it again.`,
          action: {
            label: "Retry",
            onClick: () => persist({ ...annotation, pending: true }),
          },
        });
      });
  };

  const persistTransform = (
    previous: MarkupAnnotation,
    updated: MarkupAnnotation,
    action: TransformAction,
  ) => {
    transformingAnnotationIdsRef.current.add(updated.id);
    void annotationStore.update(updated.id, {
      ...updated.data,
      color: updated.color,
      strokeWidth: updated.strokeWidth,
    })
      .then((savedRow) => {
        transformingAnnotationIdsRef.current.delete(updated.id);
        if (!isCanonicalPageMarkup(savedRow)) {
          throw new Error("The updated markup did not retain the canonical PDF page coordinate contract.");
        }
      })
      .catch((error: unknown) => {
        transformingAnnotationIdsRef.current.delete(updated.id);
        const message = error instanceof Error ? error.message : "Unknown markup update error.";
        setAnnotations((current) => current.map((annotation) => annotation.id === previous.id ? previous : annotation));
        setActiveId(previous.id);
        toast.error(`Annotation could not be ${action === "resize" ? "resized" : "moved"}`, {
          description: `${message} The previous saved geometry was restored.`,
        });
      });
  };

  const deleteAnnotation = useCallback((annotation: MarkupAnnotation) => {
    if (annotation.pending) return;
    if (deletingAnnotationIdsRef.current.has(annotation.id)) return;
    deletingAnnotationIdsRef.current.add(annotation.id);
    deletedAnnotationIdsRef.current.add(annotation.id);
    const wasUndoable = undoableAnnotationIds.includes(annotation.id);
    setUndoableAnnotationIds((current) => current.filter((id) => id !== annotation.id));
    setAnnotations((current) => current.filter((item) => item.id !== annotation.id));
    setActiveId((current) => (current === annotation.id ? null : current));
    void annotationStore.remove(annotation.id)
      .then(() => {
        deletingAnnotationIdsRef.current.delete(annotation.id);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown markup delete error.";
        deletingAnnotationIdsRef.current.delete(annotation.id);
        deletedAnnotationIdsRef.current.delete(annotation.id);
        setAnnotations((current) => [...current, annotation]);
        if (wasUndoable) {
          setUndoableAnnotationIds((current) => [...current, annotation.id]);
        }
        setActiveId(annotation.id);
        toast.error("Annotation could not be deleted", {
          description: `${message} The annotation was restored and remains selected.`,
        });
      });
  }, [annotationStore, undoableAnnotationIds]);

  useEffect(() => {
    if (tool !== "select" || !activeId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")) return;
      if (event.key === "Escape") {
        setActiveId(null);
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const selected = annotations.find((annotation) => annotation.id === activeId);
      if (!selected) return;
      event.preventDefault();
      deleteAnnotation(selected);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeId, annotations, deleteAnnotation, tool]);

  const undoableAnnotation = [...undoableAnnotationIds]
    .reverse()
    .map((id) => annotations.find((annotation) => annotation.id === id))
    .find((annotation): annotation is MarkupAnnotation => Boolean(annotation));

  useImperativeHandle(
    ref,
    () => ({
      undo: () => {
        if (undoableAnnotation) deleteAnnotation(undoableAnnotation);
      },
    }),
    [deleteAnnotation, undoableAnnotation],
  );

  useEffect(() => {
    onUndoAvailabilityChange?.(Boolean(undoableAnnotation));
  }, [onUndoAvailabilityChange, undoableAnnotation]);

  const persistTextDraft = () => {
    if (!textDraft?.value.trim()) {
      setTextDraft(null);
      return;
    }

    if (textDraft.annotationId) {
      const existing = annotations.find((annotation) => annotation.id === textDraft.annotationId);
      if (!existing) {
        toast.error("Text could not be updated", {
          description: "The original annotation is no longer available. Reload the drawing and try again.",
        });
        return;
      }

      const draftToRestore = textDraft;
      const updated: MarkupAnnotation = {
        ...existing,
        data: {
          ...existing.data,
          position: textDraft.position,
          text: textDraft.value.trim(),
          page_percent: true,
        },
      };

      setAnnotations((current) => current.map((annotation) => annotation.id === updated.id ? updated : annotation));
      setTextDraft(null);
      setActiveId(updated.id);
      void annotationStore.update(updated.id, {
        ...updated.data,
        color: updated.color,
        strokeWidth: updated.strokeWidth,
      })
        .then((savedRow) => {
          if (!isCanonicalPageMarkup(savedRow)) {
            throw new Error("The updated text did not retain the canonical PDF page coordinate contract.");
          }
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Unknown markup update error.";
          setAnnotations((current) => current.map((annotation) => annotation.id === existing.id ? existing : annotation));
          setTextDraft(draftToRestore);
          toast.error("Text could not be updated", {
            description: `${message} Your text is still in the editor.`,
          });
        });
      return;
    }

    const draftId = temporaryId();
    persist({
      id: draftId,
      type: textDraft.type,
      page,
      color,
      strokeWidth,
      data: {
        position: textDraft.position,
        text: textDraft.value.trim(),
        page_percent: true,
      },
      pending: true,
    });
    setTextDraft(null);
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!active) return;
    if (draftRef.current) return;
    // Only the primary button draws or selects. Other buttons bubble to the
    // surface drag-pan handler so middle-drag pans with any tool active.
    if (event.button !== 0) return;
    const point = pointFor(event);

    if (tool === "select") {
      event.preventDefault();
      const selected = visible.find((annotation) => annotation.id === activeId);
      const selectedBounds = selected ? annotationBounds(selected) : null;
      const handle = selected && selectedBounds && (selected.type === "rectangle" || selected.type === "cloud")
        ? resizeHandleAt(point, selectedBounds)
        : null;
      const hit = handle && selected
        ? selected
        : [...visible].reverse().find((annotation) => pointHitsAnnotation(point, annotation));

      if (!hit) {
        // Free space: deselect and let the gesture bubble to the surface
        // drag-pan handler so left-drag pans the sheet.
        setActiveId(null);
        return;
      }

      // The overlay owns this gesture (selection/move/resize) — keep it away
      // from the surface drag-pan handler, which would steal pointer capture.
      event.stopPropagation();
      setActiveId(hit.id);
      if (
        hit.pending ||
        transformingAnnotationIdsRef.current.has(hit.id) ||
        hit.type === "text" ||
        hit.type === "note"
      ) return;
      transformRef.current = {
        action: handle ? "resize" : "move",
        annotation: hit,
        handle: handle ?? undefined,
        pointerStart: point,
        updated: hit,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    // Every remaining tool owns the primary-button gesture end-to-end; stop it
    // from also starting a surface-level pan.
    event.stopPropagation();

    if (tool === "eraser") {
      event.preventDefault();
      const hit = [...visible].reverse().find((annotation) => pointHitsAnnotation(point, annotation));
      if (hit) deleteAnnotation(hit);
      return;
    }

    if (tool === "link") {
      event.preventDefault();
      onLinkPosition?.({ ...point, page });
      return;
    }

    if (tool === "text" || tool === "note") {
      event.preventDefault();
      setTextDraft({
        type: tool,
        position: point,
        value: "",
      });
      return;
    }

    const type = tool as Exclude<MarkupType, "text" | "note">;
    const draftId = temporaryId();
    const next: MarkupAnnotation = {
      id: draftId,
      type,
      page,
      color,
      strokeWidth,
      data:
        tool === "pen" || tool === "highlighter"
          ? { points: [point], page_percent: true }
          : { start: point, end: point, page_percent: true },
      pending: true,
    };
    draftRef.current = next;
    setDraft(next);
    setAnnotations((current) => [...current, next]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const transform = transformRef.current;
    if (transform) {
      const point = pointFor(event);
      const updated = transform.action === "resize" && transform.handle
        ? resizeAnnotation(transform.annotation, transform.handle, point)
        : moveAnnotation(transform.annotation, transform.pointerStart, point);
      transform.updated = updated;
      setAnnotations((current) => current.map((annotation) => annotation.id === updated.id ? updated : annotation));
      return;
    }

    const current = draftRef.current;
    if (!current) return;
    const point = pointFor(event);
    const next: MarkupAnnotation = {
      ...current,
      data:
        current.type === "pen" || current.type === "highlighter"
          ? { ...current.data, points: [...(current.data.points ?? []), point] }
          : { ...current.data, end: point },
    };
    draftRef.current = next;
    setDraft(next);
    setAnnotations((current) => current.map((annotation) =>
      annotation.id === next.id ? next : annotation,
    ));
  };

  const completeDraft = () => {
    const completed = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!completed) return;

    const points = completed.data.points ?? [];
    const start = completed.data.start;
    const end = completed.data.end;
    if ((points.length < 2 && !end) || (start && end && start.x === end.x && start.y === end.y)) {
      setAnnotations((current) => current.filter((annotation) => annotation.id !== completed.id));
      return;
    }
    persist(completed);
  };

  const completeTransform = () => {
    const transform = transformRef.current;
    transformRef.current = null;
    if (!transform) return;
    if (JSON.stringify(transform.annotation.data) !== JSON.stringify(transform.updated.data)) {
      persistTransform(transform.annotation, transform.updated, transform.action);
    }
  };

  const cancelPointerInteraction = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const transform = transformRef.current;
    transformRef.current = null;
    if (transform) {
      setAnnotations((current) => current.map((annotation) =>
        annotation.id === transform.annotation.id ? transform.annotation : annotation,
      ));
    }
    const canceledDraft = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (canceledDraft) {
      setAnnotations((current) => current.filter((annotation) => annotation.id !== canceledDraft.id));
    }
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const transform = transformRef.current;
    if (transform) {
      completeTransform();
      return;
    }

    if (tool === "eraser") {
      const point = pointFor(event);
      const hit = [...visible].reverse().find((annotation) => pointHitsAnnotation(point, annotation));
      if (hit) deleteAnnotation(hit);
      return;
    }

    completeDraft();
  };

  const visible = annotations.filter(
    (annotation) => annotation.page === page && annotation.data.page_percent && !hiddenMarkupTypes.includes(annotation.type),
  );
  const visiblePins = showPins
    ? pins.filter((pin) => pin.page === page && !hiddenPinTypes.includes(pin.pin_type))
    : [];
  const selectedAnnotation = visible.find((annotation) => annotation.id === activeId) ?? null;
  const selectedBounds = selectedAnnotation ? annotationBounds(selectedAnnotation) : null;
  const renderAnnotation = (annotation: MarkupAnnotation) => {
    const selected = activeId === annotation.id;
    const common = <T extends SVGElement>(): React.SVGProps<T> & { "data-drawing-annotation-id": string } => ({
      "data-drawing-annotation-id": annotation.id,
      "aria-label": `${annotation.type} annotation`,
      onClick: (event) => {
        event.stopPropagation();
        if (tool === "eraser") return;
        else if (
          annotation.type === "text" &&
          tool === "select" &&
          !annotation.pending &&
          annotation.data.position
        ) {
          setActiveId(annotation.id);
          setTextDraft({
            annotationId: annotation.id,
            type: "text",
            position: annotation.data.position,
            value: annotation.data.text ?? "",
          });
        }
        else if (annotation.type === "note") {
          setActiveId(annotation.id);
          onNoteOpen?.();
        } else if (tool === "select") setActiveId(annotation.id);
      },
      style: {
        cursor: tool === "select" && !["text", "note"].includes(annotation.type) ? "move" : activeCursor,
        pointerEvents: tool === "eraser" ? "all" : "auto",
      },
    });
    const emphasis = selected ? "#0f5d8f" : annotation.color;

    if (annotation.type === "pen" || annotation.type === "highlighter") {
      const points = annotation.data.points ?? [];
      return (
        <path
          key={annotation.id}
          {...common<SVGPathElement>()}
          d={pointsToPath(points)}
          fill="none"
          stroke={emphasis}
          strokeWidth={annotation.type === "highlighter" ? 1.8 : markupStrokeWidth(annotation)}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={annotation.type === "highlighter" ? 0.32 : 1}
        />
      );
    }

    if (annotation.type === "rectangle" && annotation.data.start && annotation.data.end) {
      const { start, end } = annotation.data;
      return (
        <rect
          key={annotation.id}
          {...common<SVGRectElement>()}
          x={Math.min(start.x, end.x)}
          y={Math.min(start.y, end.y)}
          width={Math.abs(end.x - start.x)}
          height={Math.abs(end.y - start.y)}
          fill={`${annotation.color}22`}
          stroke={emphasis}
          strokeWidth={markupStrokeWidth(annotation)}
        />
      );
    }

    if (annotation.type === "cloud" && annotation.data.start && annotation.data.end) {
      return (
        <path
          key={annotation.id}
          {...common<SVGPathElement>()}
          d={cloudPath(annotation.data.start, annotation.data.end)}
          fill="none"
          stroke={emphasis}
          strokeWidth={markupStrokeWidth(annotation)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }

    if (annotation.type === "arrow" && annotation.data.start && annotation.data.end) {
      const { start, end } = annotation.data;
      return (
        <line
          key={annotation.id}
          {...common<SVGLineElement>()}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={emphasis}
          strokeWidth={markupStrokeWidth(annotation)}
          markerEnd="url(#alleato-overlay-arrowhead)"
        />
      );
    }

    if (annotation.type === "text" && annotation.data.position) {
      return (
        <text
          key={annotation.id}
          {...common<SVGTextElement>()}
          x={annotation.data.position.x}
          y={annotation.data.position.y}
          fill={emphasis}
          fontSize="2.4"
          fontWeight="600"
        >
          {annotation.data.text}
        </text>
      );
    }

    if (annotation.type === "note" && annotation.data.position) {
      const { position } = annotation.data;
      const initials = annotation.data.text?.trim().slice(0, 1).toUpperCase() || "C";
      return (
        <g key={annotation.id} {...common<SVGGElement>()}>
          <circle cx={position.x} cy={position.y} r="1.85" fill="#38bdf8" stroke="white" strokeWidth="0.28" />
          <text
            x={position.x}
            y={position.y + 0.55}
            fill="white"
            fontSize="1.65"
            fontWeight="700"
            textAnchor="middle"
          >
            {initials}
          </text>
          <title>{annotation.data.text}</title>
        </g>
      );
    }

    return null;
  };

  if (!pageViewport || pageViewport.width <= 0 || pageViewport.height <= 0) {
    return null;
  }

  return (
    <>
      <svg
        aria-label="Drawing markup overlay"
        data-markup-tool={tool}
        data-markup-draft={draft?.type ?? ""}
        data-annotation-count={annotations.length}
        data-visible-annotation-count={visible.length}
        data-annotation-page={page}
        className="absolute z-20"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          left: pageViewport.left,
          top: pageViewport.top,
          width: pageViewport.width,
          height: pageViewport.height,
          pointerEvents: active ? "auto" : "none",
          touchAction: "none",
          cursor: activeCursor,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={cancelPointerInteraction}
      >
        <defs>
          <marker id="alleato-overlay-arrowhead" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
            <path d="M 0 0 L 4 2 L 0 4 z" fill="currentColor" />
          </marker>
        </defs>
        <g data-annotation-layer="true">
          {visible.map(renderAnnotation)}
        </g>
        {tool === "select" && selectedAnnotation && selectedBounds && (
          <g aria-label={`Selected ${selectedAnnotation.type} annotation`}>
            <rect
              x={selectedBounds.minX}
              y={selectedBounds.minY}
              width={Math.max(selectedBounds.maxX - selectedBounds.minX, 0.1)}
              height={Math.max(selectedBounds.maxY - selectedBounds.minY, 0.1)}
              fill="none"
              stroke="#0f5d8f"
              strokeWidth="1"
              strokeDasharray="3 2"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            {(selectedAnnotation.type === "rectangle" || selectedAnnotation.type === "cloud") && ([
              ["nw", selectedBounds.minX, selectedBounds.minY],
              ["ne", selectedBounds.maxX, selectedBounds.minY],
              ["se", selectedBounds.maxX, selectedBounds.maxY],
              ["sw", selectedBounds.minX, selectedBounds.maxY],
            ] as const).map(([handle, x, y]) => (
              <rect
                key={handle}
                data-resize-handle={handle}
                x={x - 0.65}
                y={y - 0.65}
                width="1.3"
                height="1.3"
                rx="0.2"
                fill="white"
                stroke="#0f5d8f"
                strokeWidth="1.25"
                vectorEffect="non-scaling-stroke"
                pointerEvents="all"
                style={{ cursor: handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize" }}
              />
            ))}
          </g>
        )}
      </svg>

      {tool === "select" && selectedAnnotation && selectedBounds && (
        !selectedAnnotation.pending
      ) && (
        <Button
          type="button"
          variant="secondary"
          size="icon-xs"
          className="absolute z-30 text-muted-foreground shadow-sm hover:text-destructive"
          style={{
            left: Math.min(
              pageViewport.left + pageViewport.width - 30,
              pageViewport.left + (pageViewport.width * selectedBounds.maxX) / 100 + 6,
            ),
            top: Math.max(
              pageViewport.top + 30,
              pageViewport.top + (pageViewport.height * selectedBounds.minY) / 100 - 4,
            ),
            transform: "translateY(-100%)",
          }}
          aria-label="Delete selected annotation"
          title="Delete annotation (Delete)"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => deleteAnnotation(selectedAnnotation)}
        >
          <Trash2 />
        </Button>
      )}

      {visiblePins.map((pin) => {
        const label = pin.entity_number ?? pin.entity_label ?? pin.pin_type.replace("_", " ");
        const color = pin.color ?? PIN_COLORS[pin.pin_type];
        const pinButton = (
          <Button
            key={pin.id}
            type="button"
            variant="ghost"
            size="sm"
            className="absolute z-30 h-6 min-w-6 rounded-sm px-1 text-[10px] font-semibold shadow-sm hover:brightness-95"
            style={{
              left: pageViewport.left + (pageViewport.width * pin.x_pct) / 100,
              top: pageViewport.top + (pageViewport.height * pin.y_pct) / 100,
              backgroundColor: color,
              color: "white",
              transform: "translate(-50%, -100%)",
            }}
            aria-label={`Open linked ${label}`}
            title={`Open ${label}`}
            onPointerDownCapture={(event) => event.stopPropagation()}
            onClick={() => onPinClick?.(pin)}
          >
            {pin.entity_number ?? pin.pin_type.slice(0, 1).toUpperCase()}
          </Button>
        );

        if (pin.pin_type === "photo" && pin.entity_id) {
          return (
            <DrawingPhotoPreview
              key={pin.id}
              projectId={projectId}
              photoId={pin.entity_id}
              label={label}
              triggerClickOpensDialog={false}
              trigger={React.cloneElement(pinButton, { onClick: undefined })}
            />
          );
        }

        return (
          <HoverCard key={pin.id} openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>{pinButton}</HoverCardTrigger>
            <HoverCardContent side="top" align="center" className="w-64 space-y-1.5 p-3">
              <p className="text-xs font-medium text-foreground">
                {pin.entity_number ? `${pin.pin_type.replace(/_/g, " ")} ${pin.entity_number}` : pin.pin_type.replace(/_/g, " ")}
              </p>
              <p className="text-sm font-medium text-foreground">{pin.entity_label ?? "Linked record"}</p>
              <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {pin.entity_description ?? "No description is available for this linked record."}
              </p>
              {pin.entity_status && <p className="text-xs capitalize text-muted-foreground">{pin.entity_status.replace(/_/g, " ")}</p>}
            </HoverCardContent>
          </HoverCard>
        );
      })}

      {textDraft && (
        <form
          aria-label={
            textDraft.annotationId
              ? "Edit drawing text"
              : textDraft.type === "note"
                ? "Add drawing note"
                : "Add drawing text"
          }
          className="absolute z-30 flex items-center gap-1"
          style={{
            left: pageViewport.left + (pageViewport.width * textDraft.position.x) / 100,
            top: pageViewport.top + (pageViewport.height * textDraft.position.y) / 100,
          }}
          onSubmit={(event) => {
            event.preventDefault();
            persistTextDraft();
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Input
            aria-label={textDraft.type === "note" ? "Note text" : "Markup text"}
            autoFocus
            className="h-7 w-48 bg-primary-foreground text-xs text-foreground dark:text-background"
            value={textDraft.value}
            onChange={(event) => setTextDraft((current) => current ? { ...current, value: event.target.value } : null)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setTextDraft(null);
            }}
          />
          <Button type="submit" size="sm" className="h-7 px-2 text-xs">
            Save
          </Button>
        </form>
      )}
    </>
  );
});
