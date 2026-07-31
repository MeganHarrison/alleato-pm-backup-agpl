import type { KnowledgeNodeType } from "./graph-types";

/**
 * Per-category presentation metadata. Colors are CSS custom-property names
 * defined in `company-brain.module.css` (design-token derived) — the canvas
 * reads them at runtime so classNames stay token-only and themes stay honored.
 * `fallback` is a literal used only if the CSS variable can't be read.
 */
export interface CategoryMeta {
  type: KnowledgeNodeType;
  label: string;
  /** Singular label for tooltips/detail ("Meeting" vs "Meetings"). */
  singular: string;
  cssVar: string;
  fallback: string;
  /** Illustrative corpus counts for labels (mock; replaced by live counts). */
  count: number;
  today: number;
}

export const CATEGORY_META: CategoryMeta[] = [
  { type: "meeting", label: "Meetings", singular: "Meeting", cssVar: "--cb-meeting", fallback: "hsl(211 82% 66%)", count: 1284, today: 14 },
  { type: "email", label: "Emails", singular: "Email", cssVar: "--cb-email", fallback: "hsl(258 78% 74%)", count: 18420, today: 287 },
  { type: "teams_message", label: "Teams", singular: "Teams message", cssVar: "--cb-teams", fallback: "hsl(232 74% 72%)", count: 9640, today: 96 },
  { type: "document", label: "Documents", singular: "Document", cssVar: "--cb-document", fallback: "hsl(190 78% 60%)", count: 3210, today: 41 },
  { type: "drawing", label: "Drawings", singular: "Drawing", cssVar: "--cb-drawing", fallback: "hsl(202 82% 70%)", count: 1870, today: 22 },
  { type: "task", label: "Tasks", singular: "Task", cssVar: "--cb-task", fallback: "hsl(172 64% 52%)", count: 2440, today: 33 },
  { type: "rfi", label: "RFIs", singular: "RFI", cssVar: "--cb-rfi", fallback: "hsl(276 66% 72%)", count: 612, today: 6 },
  { type: "submittal", label: "Submittals", singular: "Submittal", cssVar: "--cb-submittal", fallback: "hsl(38 92% 62%)", count: 894, today: 9 },
  { type: "change_event", label: "Change events", singular: "Change event", cssVar: "--cb-change", fallback: "hsl(22 92% 62%)", count: 238, today: 3 },
  { type: "decision", label: "Decisions", singular: "Decision", cssVar: "--cb-decision", fallback: "hsl(150 62% 56%)", count: 342, today: 8 },
  { type: "risk", label: "Risks", singular: "Risk", cssVar: "--cb-risk", fallback: "hsl(0 78% 66%)", count: 156, today: 2 },
  { type: "opportunity", label: "Opportunities", singular: "Opportunity", cssVar: "--cb-opportunity", fallback: "hsl(45 92% 62%)", count: 98, today: 1 },
];

export const CATEGORY_BY_TYPE: Record<KnowledgeNodeType, CategoryMeta> = CATEGORY_META.reduce(
  (acc, m) => { acc[m.type] = m; return acc; },
  {} as Record<KnowledgeNodeType, CategoryMeta>,
);

export function relationshipLabel(type: string): string {
  return type.replace(/_/g, " ");
}
