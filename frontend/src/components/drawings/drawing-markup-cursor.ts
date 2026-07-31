import type { PdfjsExpressMarkupTool } from "@/components/drawings/PdfjsExpressMarkupOverlay";

const TOOL_GLYPHS: Record<Exclude<PdfjsExpressMarkupTool, "idle">, string> = {
  select: '<path d="M4 3l7 18 3-7 7-3z"/>',
  pen: '<path d="M4 20l4-1L20 7l-3-3L5 16z"/><path d="M14 6l4 4"/>',
  highlighter: '<path d="M5 17l4 2L20 8l-4-4L5 15z"/><path d="M3 21h18"/>',
  rectangle: '<rect x="4" y="5" width="16" height="14" rx="1"/>',
  cloud: '<path d="M6 18h11a4 4 0 0 0 .5-8 6 6 0 0 0-11-1A4.5 4.5 0 0 0 6 18z"/>',
  arrow: '<path d="M5 19L19 5M10 5h9v9"/>',
  text: '<path d="M5 5h14M12 5v14M8 19h8"/>',
  note: '<path d="M4 5h16v12H9l-5 4z"/><path d="M8 9h8M8 13h5"/>',
  link: '<path d="M9 15l6-6M7 17H6a4 4 0 0 1 0-8h4M17 7h1a4 4 0 0 1 0 8h-4"/>',
  eraser: '<path d="M4 16L14 5l6 6-8 8H7z"/><path d="M11 19h10"/>',
};

const COLORABLE_TOOLS = new Set<PdfjsExpressMarkupTool>([
  "pen",
  "highlighter",
  "rectangle",
  "cloud",
  "arrow",
]);

const GEOMETRY_TOOLS = new Set<PdfjsExpressMarkupTool>([
  "highlighter",
  "rectangle",
  "cloud",
  "arrow",
]);

function safeCursorColor(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#e76f22";
}

export function drawingMarkupCursor(tool: PdfjsExpressMarkupTool, color: string) {
  if (tool === "idle") return "default";
  // Free space in select mode is grab-to-pan; annotations override this with
  // their own move/resize cursors.
  if (tool === "select") return "grab";
  if (GEOMETRY_TOOLS.has(tool)) return "crosshair";
  if (tool === "text") return "text";

  const hasCursorBadge = tool !== "link";
  const badgeColor = COLORABLE_TOOLS.has(tool) ? safeCursorColor(color) : "#24262a";
  const iconStrokeColor = hasCursorBadge ? "#f7f7f5" : "#24262a";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    ${hasCursorBadge ? `<circle cx="12" cy="12" r="10" fill="${badgeColor}" stroke="#f7f7f5" stroke-width="1.5"/>` : ""}
    <g transform="translate(3 3)" fill="none" stroke="${iconStrokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TOOL_GLYPHS[tool]}</g>
  </svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, default`;
}
