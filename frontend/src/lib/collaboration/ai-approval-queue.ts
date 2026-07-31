import type { Json } from "@/types/database.types";

export const AI_APPROVAL_QUEUE_NOTIFICATION_KIND = "ai_notification_decision";

export const AI_APPROVAL_QUEUE_EVENT_TYPES = [
  "ai_change_event_awaiting_approval",
  "ai_commitment_awaiting_approval",
  "client_report_ready_to_send",
] as const;

const AI_APPROVAL_QUEUE_EVENT_TYPE_SET = new Set<string>(
  AI_APPROVAL_QUEUE_EVENT_TYPES,
);

const APPROVAL_EVENT_PATTERNS = [
  "awaiting_approval",
  "ready_to_send",
  "requires_response",
  "requires_review",
  "review_needed",
  "awaiting_review",
];

export type AiApprovalQueueMetadata = {
  eventType?: string;
  requiredAction?: string;
  reason?: string;
  failureLoudBehavior?: string;
  source?: string;
  tier?: string;
};

export type AiApprovalQueuePreviewField = {
  key: string;
  label: string;
  value: string;
};

export type AiApprovalQueuePreview = {
  table?: string;
  fields: AiApprovalQueuePreviewField[];
};

export type AiApprovalQueueReviewCheck = {
  id: string;
  label: string;
};

export type AiApprovalQueueCandidate = {
  kind: string;
  metadata?: Json | null;
};

const FIELD_LABELS: Record<string, string> = {
  contract_company_id: "Vendor record",
  contract_number: "Contract number",
  default_retainage_percent: "Retainage %",
  description: "Description",
  estimated_completion_date: "Completion date",
  expecting_revenue: "Expecting revenue",
  line_item_revenue_source: "Revenue source",
  line_items: "Line items",
  origin: "Origin",
  project_id: "Project",
  reason: "Reason",
  scope: "Scope",
  start_date: "Start date",
  status: "Status",
  title: "Title",
  type: "Type",
  vendor_name_resolved: "Vendor",
};

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getMetadataRecord(
  metadata: Json | null | undefined,
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata as Record<string, unknown>;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function formatFieldLabel(key: string): string {
  return (
    FIELD_LABELS[key] ??
    key
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function formatLineItems(value: unknown): string {
  if (!Array.isArray(value)) return "Not provided";
  if (value.length === 0) return "None";

  const total = value.reduce((sum, item) => {
    const record = getRecord(item);
    const amount = record && typeof record.amount === "number" ? record.amount : 0;
    return sum + amount;
  }, 0);
  const count = `${value.length} line item${value.length === 1 ? "" : "s"}`;

  return total > 0
    ? `${count} totaling ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(total)}`
    : count;
}

function formatFieldValue(key: string, value: unknown): string | null {
  if (key === "line_items") return formatLineItems(value);
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.length > 0 ? `${value.length} items` : null;
  if (typeof value === "object") return "Configured";
  return null;
}

export function getAiApprovalQueueMetadata(
  metadata: Json | null | undefined,
): AiApprovalQueueMetadata {
  const record = getMetadataRecord(metadata);
  if (!record) return {};

  return {
    eventType: cleanString(record.eventType),
    requiredAction: cleanString(record.requiredAction),
    reason: cleanString(record.reason),
    failureLoudBehavior: cleanString(record.failureLoudBehavior),
    source: cleanString(record.source),
    tier: cleanString(record.tier),
  };
}

export function getAiApprovalQueuePreview(
  metadata: Json | null | undefined,
): AiApprovalQueuePreview | null {
  const record = getMetadataRecord(metadata);
  const preview = getRecord(record?.preview);
  const fields = getRecord(preview?.fields);

  if (!preview || !fields) return null;

  const displayFields = Object.entries(fields)
    .map(([key, value]) => {
      const formatted = formatFieldValue(key, value);
      return formatted
        ? {
            key,
            label: formatFieldLabel(key),
            value: formatted,
          }
        : null;
    })
    .filter((field): field is AiApprovalQueuePreviewField => Boolean(field));

  if (displayFields.length === 0) return null;

  return {
    table: cleanString(preview.table),
    fields: displayFields,
  };
}

export function getAiApprovalQueueReviewChecks(
  preview: AiApprovalQueuePreview | null,
): AiApprovalQueueReviewCheck[] {
  if (!preview) return [];

  const fieldKeys = new Set(preview.fields.map((field) => field.key));
  const checks: AiApprovalQueueReviewCheck[] = [
    {
      id: "generated-fields",
      label: "Generated fields match the intended record.",
    },
  ];

  if (
    fieldKeys.has("start_date") ||
    fieldKeys.has("estimated_completion_date") ||
    fieldKeys.has("due_date")
  ) {
    checks.push({
      id: "dates",
      label: "Dates are correct.",
    });
  }

  if (fieldKeys.has("contract_company_id") || fieldKeys.has("vendor_name_resolved")) {
    checks.push({
      id: "vendor",
      label: "Vendor and contract details are correct.",
    });
  }

  if (fieldKeys.has("line_items")) {
    checks.push({
      id: "line-items",
      label: "Line items and totals are correct.",
    });
  }

  if (
    fieldKeys.has("scope") ||
    fieldKeys.has("type") ||
    fieldKeys.has("expecting_revenue") ||
    fieldKeys.has("line_item_revenue_source")
  ) {
    checks.push({
      id: "scope-revenue",
      label: "Scope and revenue assumptions are correct.",
    });
  }

  return checks;
}

export function isAiApprovalQueueEventType(
  eventType: string | null | undefined,
): boolean {
  const normalized = cleanString(eventType);
  if (!normalized) return false;

  return (
    AI_APPROVAL_QUEUE_EVENT_TYPE_SET.has(normalized) ||
    APPROVAL_EVENT_PATTERNS.some((pattern) => normalized.includes(pattern))
  );
}

export function isAiApprovalQueueNotification(
  notification: AiApprovalQueueCandidate,
): boolean {
  if (notification.kind !== AI_APPROVAL_QUEUE_NOTIFICATION_KIND) return false;

  const metadata = getAiApprovalQueueMetadata(notification.metadata);
  return isAiApprovalQueueEventType(metadata.eventType);
}

export function getAiApprovalQueueEventTypesParam(): string {
  return AI_APPROVAL_QUEUE_EVENT_TYPES.join(",");
}

export function formatAiApprovalQueueEventLabel(
  eventType: string | null | undefined,
): string {
  const normalized = cleanString(eventType);
  if (!normalized) return "AI review";

  return normalized
    .replace(/^ai_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const ENTITY_ROUTE_SEGMENTS: Record<string, string> = {
  change_events: "change-events",
  "change-events": "change-events",
  progress_reports: "progress-reports",
  "progress-reports": "progress-reports",
  commitments: "commitments",
  submittals: "submittals",
  rfi: "rfis",
  rfis: "rfis",
};

export function getAiApprovalQueueRelatedHref(input: {
  projectId: number | null;
  entityType: string | null;
  entityId: string | null;
}): string | null {
  if (!input.projectId || !input.entityType) return null;

  const routeSegment =
    ENTITY_ROUTE_SEGMENTS[input.entityType] ??
    input.entityType.replaceAll("_", "-");

  if (!input.entityId) {
    return `/${input.projectId}/${routeSegment}`;
  }

  return `/${input.projectId}/${routeSegment}/${input.entityId}`;
}
