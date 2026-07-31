// Pure drawing + compositing helpers for the screenshot annotator.
// Kept free of React so the disappearance guardrail (composeAnnotatedScreenshot
// returning null when the base image has no pixels) is unit-testable.

export type Tool = "arrow" | "rect" | "pen";
export type Color = "#ef4444" | "#eab308" | "#3b82f6";
export type Point = { x: number; y: number };

export type Shape =
  | { kind: "arrow"; from: Point; to: Point; color: Color }
  | { kind: "rect"; from: Point; to: Point; color: Color }
  | { kind: "pen"; points: Point[]; color: Color };

export type InProgress =
  | { kind: "arrow"; from: Point; to: Point }
  | { kind: "rect"; from: Point; to: Point }
  | { kind: "pen"; points: Point[] };

export const COLORS: { value: Color; label: string }[] = [
  { value: "#ef4444", label: "Red" },
  { value: "#eab308", label: "Yellow" },
  { value: "#3b82f6", label: "Blue" },
];

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 4) return;
  const headLen = Math.min(22, len * 0.45);
  const angle = Math.atan2(dy, dx);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(
    to.x - headLen * 0.6 * Math.cos(angle),
    to.y - headLen * 0.6 * Math.sin(angle),
  );
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headLen * Math.cos(angle - Math.PI / 6),
    to.y - headLen * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    to.x - headLen * Math.cos(angle + Math.PI / 6),
    to.y - headLen * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}

export function drawRect(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y);
}

export function drawPen(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
) {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

export function renderShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  inProgress: InProgress | null,
  activeColor: Color,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const s of shapes) {
    if (s.kind === "arrow") drawArrow(ctx, s.from, s.to, s.color);
    else if (s.kind === "rect") drawRect(ctx, s.from, s.to, s.color);
    else if (s.kind === "pen") drawPen(ctx, s.points, s.color);
  }
  if (inProgress) {
    if (inProgress.kind === "arrow")
      drawArrow(ctx, inProgress.from, inProgress.to, activeColor);
    else if (inProgress.kind === "rect")
      drawRect(ctx, inProgress.from, inProgress.to, activeColor);
    else if (inProgress.kind === "pen")
      drawPen(ctx, inProgress.points, activeColor);
  }
}

function scalePoint(p: Point, sx: number, sy: number): Point {
  return { x: p.x * sx, y: p.y * sy };
}

export function scaleShape(s: Shape, sx: number, sy: number): Shape {
  if (s.kind === "arrow")
    return { ...s, from: scalePoint(s.from, sx, sy), to: scalePoint(s.to, sx, sy) };
  if (s.kind === "rect")
    return { ...s, from: scalePoint(s.from, sx, sy), to: scalePoint(s.to, sx, sy) };
  return { ...s, points: s.points.map((p) => scalePoint(p, sx, sy)) };
}

/**
 * Flatten the base image plus drawn shapes into a single PNG data URL.
 *
 * Returns `null` when the base image has no usable pixel dimensions — this is
 * the guardrail for the "screenshot disappears on annotate" bug: drawing a
 * stroke while the <img> was mid-reload produced a 0x0 offscreen canvas, whose
 * `toDataURL()` is the empty `"data:,"` string. Feeding that back into the
 * <img src> wiped the screenshot. Callers MUST treat null as "keep the current
 * image, emit nothing" rather than clearing the attachment.
 */
export function composeAnnotatedScreenshot(opts: {
  image: HTMLImageElement;
  shapes: Shape[];
  color: Color;
  createCanvas?: () => HTMLCanvasElement;
}): string | null {
  const { image, shapes, color } = opts;
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const displayWidth = image.offsetWidth;
  const displayHeight = image.offsetHeight;

  // Image not ready / detached: emit nothing so the base screenshot survives.
  if (
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    displayWidth <= 0 ||
    displayHeight <= 0
  ) {
    return null;
  }

  const createCanvas =
    opts.createCanvas ?? (() => document.createElement("canvas"));
  const offscreen = createCanvas();
  offscreen.width = naturalWidth;
  offscreen.height = naturalHeight;
  const ctx = offscreen.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0);
  const sx = naturalWidth / displayWidth;
  const sy = naturalHeight / displayHeight;
  renderShapes(
    ctx,
    shapes.map((s) => scaleShape(s, sx, sy)),
    null,
    color,
  );
  return offscreen.toDataURL("image/png");
}
