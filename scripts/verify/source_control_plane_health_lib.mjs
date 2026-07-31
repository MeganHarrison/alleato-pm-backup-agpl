export const SOURCE_FAMILY_CONFIG = [
  {
    key: "meetings",
    label: "Meeting transcripts",
    maxSyncAgeHours: 48,
    runSources: new Set(["fireflies"]),
    matchesDocument(row) {
      return String(row.source ?? "") === "fireflies";
    },
  },
  {
    key: "teams",
    label: "Teams messages",
    maxSyncAgeHours: 24,
    runSources: new Set(["teams_channel", "teams_dm", "teams_message", "teams_chat_export"]),
    matchesDocument(row) {
      return (
        String(row.source ?? "") === "microsoft_graph" &&
        (String(row.category ?? "") === "teams_message" ||
          String(row.type ?? "").includes("teams"))
      );
    },
  },
  {
    key: "emails",
    label: "Emails",
    maxSyncAgeHours: 24,
    runSources: new Set(["outlook_email"]),
    matchesDocument(row) {
      return (
        String(row.source ?? "") === "microsoft_graph" &&
        (String(row.category ?? "") === "email" ||
          String(row.type ?? "") === "email" ||
          String(row.type ?? "") === "email_attachment" ||
          String(row.id ?? "").startsWith("outlook_"))
      );
    },
  },
  {
    key: "sharepoint",
    label: "SharePoint files",
    maxSyncAgeHours: 24,
    runSources: new Set([
      "sharepoint_file",
      "sharepoint",
      "onedrive_file",
      "microsoft_graph_sharepoint",
    ]),
    matchesDocument(row) {
      return (
        String(row.source ?? "") === "microsoft_graph" &&
        (String(row.id ?? "").startsWith("sharepoint_") ||
          String(row.source_item_id ?? "").startsWith("sharepoint_") ||
          String(row.source_item_id ?? "").startsWith("sites/") ||
          String(row.source_item_id ?? "").includes("sharepoint") ||
          String(row.source_system ?? "").includes("sharepoint"))
      );
    },
  },
];

export const STAGE_GRACE_MINUTES = {
  chunking: 120,
  embeddings: 120,
  projectDisposition: 120,
  taskExtraction: 1440,
};

export function newest(values) {
  const sorted = values
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return sorted[0] ?? null;
}

export function ageHours(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return (Date.now() - then) / (1000 * 60 * 60);
}

export function coverageStatus(cleared, total, threshold) {
  if (total === 0) return "unknown";
  const ratio = cleared / total;
  if (ratio >= threshold) return "healthy";
  if (cleared > 0) return "warning";
  return "critical";
}

export function normalizeRunSource(rawSource) {
  const source = String(rawSource ?? "").toLowerCase();
  if (source === "fireflies") return "fireflies";
  if (source === "outlook_email") return "outlook_email";
  if (source === "sharepoint_file") return "sharepoint_file";
  if (source === "onedrive_file") return "onedrive_file";
  if (source === "sharepoint") return "sharepoint";
  if (source === "microsoft_graph_sharepoint") return "microsoft_graph_sharepoint";
  if (source === "teams_message") return "teams_message";
  if (source === "teams_chat_export") return "teams_chat_export";
  if (source === "teams_channel") return "teams_channel";
  if (source === "teams_dm") return "teams_dm";
  return source;
}
