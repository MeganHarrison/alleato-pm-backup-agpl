"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Pen, Square, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  COLORS,
  composeAnnotatedScreenshot,
  renderShapes,
  type Color,
  type InProgress,
  type Point,
  type Shape,
  type Tool,
} from "./annotate";

export function ScreenshotAnnotator({
  dataUrl,
  onChange,
}: {
  /** Immutable base screenshot. Never overwritten by this component. */
  dataUrl: string;
  /**
   * Receives the flattened (base + shapes) PNG whenever the annotation changes,
   * or the untouched base when annotations are cleared. The parent MUST store
   * this in a separate slot from `dataUrl` — feeding it back into `dataUrl`
   * recreates the "screenshot disappears on annotate" feedback loop.
   */
  onChange: (annotatedDataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const isDrawing = useRef(false);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState<Color>("#ef4444");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [inProgress, setInProgress] = useState<InProgress | null>(null);

  // A new base screenshot (retake / upload / re-pick) starts a clean slate.
  useEffect(() => {
    setShapes([]);
    setInProgress(null);
    isDrawing.current = false;
  }, [dataUrl]);

  // Sync canvas size to the displayed image size. Re-runs when the base image
  // changes so a differently-sized capture re-measures the overlay.
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const sync = () => {
      canvas.width = img.offsetWidth;
      canvas.height = img.offsetHeight;
    };
    if (img.complete) sync();
    else img.addEventListener("load", sync, { once: true });
    const ro = new ResizeObserver(sync);
    ro.observe(img);
    return () => ro.disconnect();
  }, [dataUrl]);

  // Re-render the overlay on every annotation state change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderShapes(ctx, shapes, inProgress, color);
  }, [shapes, inProgress, color]);

  const flatten = useCallback(
    (finalShapes: Shape[]) => {
      const img = imgRef.current;
      if (!img) return;
      const annotated = composeAnnotatedScreenshot({
        image: img,
        shapes: finalShapes,
        color,
      });
      // null = base image was not ready; keep the existing attachment intact
      // rather than emitting an empty "data:," that would blank the screenshot.
      if (annotated) onChange(annotated);
    },
    [color, onChange],
  );

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e);
    if (tool === "arrow") setInProgress({ kind: "arrow", from: pos, to: pos });
    else if (tool === "rect") setInProgress({ kind: "rect", from: pos, to: pos });
    else setInProgress({ kind: "pen", points: [pos] });
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !inProgress) return;
    const pos = getPos(e);
    if (inProgress.kind === "arrow") setInProgress({ ...inProgress, to: pos });
    else if (inProgress.kind === "rect") setInProgress({ ...inProgress, to: pos });
    else setInProgress({ ...inProgress, points: [...inProgress.points, pos] });
  };

  const commit = () => {
    if (!isDrawing.current || !inProgress) return;
    isDrawing.current = false;
    let shape: Shape | null = null;
    if (
      inProgress.kind === "arrow" &&
      (inProgress.to.x !== inProgress.from.x || inProgress.to.y !== inProgress.from.y)
    ) {
      shape = { ...inProgress, color };
    } else if (
      inProgress.kind === "rect" &&
      (inProgress.to.x !== inProgress.from.x || inProgress.to.y !== inProgress.from.y)
    ) {
      shape = { ...inProgress, color };
    } else if (inProgress.kind === "pen" && inProgress.points.length > 1) {
      shape = { ...inProgress, color };
    }
    setInProgress(null);
    if (shape) {
      const next = [...shapes, shape];
      setShapes(next);
      flatten(next);
    }
  };

  const undo = () => {
    const next = shapes.slice(0, -1);
    setShapes(next);
    if (next.length === 0) onChange(dataUrl);
    else flatten(next);
  };

  const clear = () => {
    setShapes([]);
    onChange(dataUrl);
  };

  const cycleColor = () => {
    const index = COLORS.findIndex((c) => c.value === color);
    setColor(COLORS[(index + 1) % COLORS.length].value);
  };

  const activeColorLabel =
    COLORS.find((c) => c.value === color)?.label ?? "Color";

  const tools: { value: Tool; label: string; icon: typeof Pen }[] = [
    { value: "arrow", label: "Arrow", icon: ArrowUpRight },
    { value: "rect", label: "Box", icon: Square },
    { value: "pen", label: "Draw", icon: Pen },
  ];

  return (
    <div className="space-y-2">
      <div
        className="relative w-full select-none overflow-hidden rounded-lg border border-border/60"
        style={{ cursor: "crosshair" }}
      >
        <img
          ref={imgRef}
          src={dataUrl}
          alt="Annotate screenshot"
          className="block w-full object-contain object-top pointer-events-none"
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={commit}
          onMouseLeave={commit}
        />
      </div>

      {/* Controls live below the image: draw tools + color on the left,
          history actions on the right, separated by space (no dividers). */}
      <div className="flex items-center gap-1">
        {tools.map(({ value, label, icon: Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setTool(value)}
                aria-label={label}
                aria-pressed={tool === value}
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  tool === value && "bg-muted text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={cycleColor}
              aria-label={`Color: ${activeColorLabel}. Click to change.`}
            >
              <span
                className="size-3.5 rounded-full ring-2 ring-border ring-offset-1 ring-offset-card"
                style={{ backgroundColor: color }}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{activeColorLabel} — click to change</TooltipContent>
        </Tooltip>

        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={undo}
                disabled={shapes.length === 0}
                aria-label="Undo last annotation"
                className="text-muted-foreground hover:text-foreground"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={clear}
                disabled={shapes.length === 0}
                aria-label="Remove all annotations"
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove all</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
