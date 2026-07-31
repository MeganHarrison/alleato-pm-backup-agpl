import type { Json } from "@/types/database.types";

export const siteManagementChecklistSections = [
  {
    id: "planning-coordination",
    title: "Planning & Coordination",
    items: [
      { id: "review-daily-schedule", label: "Review daily schedule and 2-3 week look-ahead plan" },
      { id: "confirm-material-deliveries", label: "Confirm material deliveries are on schedule" },
      { id: "verify-equipment-availability", label: "Verify equipment availability and operational status" },
      { id: "coordinate-required-inspections", label: "Coordinate required inspections and inspection readiness" },
      { id: "communicate-safety-focus", label: "Communicate safety focus" },
      { id: "review-scope-and-objectives", label: "Review scope of work and discuss daily objectives" },
    ],
  },
  {
    id: "morning-site-activities",
    title: "Morning Site Activities",
    items: [
      { id: "conduct-site-walk", label: "Conduct site walk for safety, readiness, and logistics review" },
      { id: "lead-daily-huddle", label: "Lead daily huddle with crew and foremen" },
    ],
  },
  {
    id: "project-execution",
    title: "Project Execution",
    items: [
      { id: "monitor-progress", label: "Monitor progress against project schedule" },
      { id: "address-delays", label: "Identify and address potential delays" },
      { id: "coordinate-trades", label: "Coordinate trades and subcontractor activities" },
      { id: "verify-work-quality", label: "Verify quality of work in progress" },
    ],
  },
  {
    id: "safety-compliance",
    title: "Safety & Compliance",
    items: [
      { id: "verify-ppe", label: "Verify PPE usage and safe work practices" },
      { id: "document-safety-concerns", label: "Address and document safety concerns" },
      { id: "verify-cleanliness-security", label: "Verify site cleanliness and security" },
    ],
  },
  {
    id: "documentation-reporting",
    title: "Documentation & Reporting",
    items: [
      { id: "document-racking-progress", label: "Document racking installation progress with detailed photos" },
      { id: "document-sprinkler-progress", label: "Document sprinkler installation progress with detailed photos" },
      { id: "update-progress-tracker", label: "Update project progress tracker" },
      { id: "log-daily-report", label: "Log daily report on Job Planner" },
      { id: "include-progress-photos", label: "Include clear progress photos" },
      { id: "record-manpower-counts", label: "Record manpower counts" },
      { id: "note-weather-conditions", label: "Note weather conditions if applicable" },
    ],
  },
  {
    id: "end-of-day-closeout",
    title: "End of Day Closeout",
    items: [
      { id: "verify-site-organization", label: "Verify site cleanliness and organization" },
      { id: "confirm-lock-up", label: "Confirm site security and lock-up procedures" },
      { id: "review-completed-work", label: "Review completed work versus planned work" },
      { id: "identify-next-day-priorities", label: "Identify priorities and resource needs for the next day" },
    ],
  },
] as const;

export type SiteManagementChecklistValue = "yes" | "no" | "na";

export interface SiteManagementChecklistEntry {
  value: SiteManagementChecklistValue | null;
  note: string;
}

export type SiteManagementChecklistState = Record<string, SiteManagementChecklistEntry>;
type SiteManagementChecklistLike = Partial<SiteManagementChecklistState> | null | undefined;

const itemDefinitions: ReadonlyArray<{ id: string; label: string }> =
  siteManagementChecklistSections.flatMap((section) =>
    section.items.map((item) => ({ id: item.id, label: item.label })),
  );

export const siteManagementChecklistItemMap = new Map(
  itemDefinitions.map((item) => [item.id, item.label] as const),
);

export const siteManagementChecklistItemIds = itemDefinitions.map((item) => item.id);

function emptyEntry(): SiteManagementChecklistEntry {
  return { value: null, note: "" };
}

export function createEmptySiteManagementChecklist(): SiteManagementChecklistState {
  return Object.fromEntries(siteManagementChecklistItemIds.map((id) => [id, emptyEntry()]));
}

export function normalizeSiteManagementChecklist(
  value: unknown,
): SiteManagementChecklistState {
  const base = createEmptySiteManagementChecklist();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return base;
  }

  const rawItems =
    "items" in value && value.items && typeof value.items === "object" && !Array.isArray(value.items)
      ? value.items
      : value;

  for (const itemId of siteManagementChecklistItemIds) {
    const rawEntry = Reflect.get(rawItems, itemId);
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      continue;
    }

    const rawValue = Reflect.get(rawEntry, "value");
    const rawNote = Reflect.get(rawEntry, "note");

    base[itemId] = {
      value: rawValue === "yes" || rawValue === "no" || rawValue === "na" ? rawValue : null,
      note: typeof rawNote === "string" ? rawNote : "",
    };
  }

  return base;
}

export function serializeSiteManagementChecklist(
  state: SiteManagementChecklistLike,
): Json | null {
  const hasSelections = siteManagementChecklistItemIds.some((itemId) => state?.[itemId]?.value);
  if (!hasSelections) {
    return null;
  }

  return {
    version: 1,
    items: Object.fromEntries(
      siteManagementChecklistItemIds.map((itemId) => [
        itemId,
        {
          value: state?.[itemId]?.value ?? null,
          note: state?.[itemId]?.note?.trim() ?? "",
        },
      ]),
    ),
  };
}

export function getSiteManagementChecklistSummary(state: SiteManagementChecklistLike) {
  return siteManagementChecklistItemIds.reduce(
    (summary, itemId) => {
      const value = state?.[itemId]?.value ?? null;
      if (value) {
        summary.answered += 1;
      }
      if (value === "no") {
        summary.failures += 1;
      }
      return summary;
    },
    { answered: 0, total: siteManagementChecklistItemIds.length, failures: 0 },
  );
}

export function validateSiteManagementChecklist(state: SiteManagementChecklistLike): string[] {
  const errors: string[] = [];

  for (const itemId of siteManagementChecklistItemIds) {
    const entry = state?.[itemId];
    if (entry?.value === "no" && !entry.note.trim()) {
      errors.push(siteManagementChecklistItemMap.get(itemId) ?? itemId);
    }
  }

  return errors;
}
