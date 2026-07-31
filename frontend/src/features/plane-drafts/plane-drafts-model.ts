/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const PLANE_DRAFT_ARTIFACT_TYPES = [
  "owner_update",
  "risk_report",
  "meeting_prep",
  "analysis",
  "briefing",
  "note",
  "change_event_draft",
] as const;

export type PlaneDraftArtifactType =
  (typeof PLANE_DRAFT_ARTIFACT_TYPES)[number];

export type PlaneDraftArtifact = {
  id: string;
  user_id: string;
  project_id: number | null;
  artifact_type: PlaneDraftArtifactType;
  title: string;
  status: "draft";
  version: number;
  content: Record<string, unknown>;
  context_snapshot: Record<string, unknown>;
  session_id: string | null;
  promoted_to: string | null;
  promoted_at: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export const PLANE_DRAFT_TYPE_LABELS: Record<PlaneDraftArtifactType, string> = {
  owner_update: "Owner update",
  risk_report: "Risk report",
  meeting_prep: "Meeting prep",
  analysis: "Analysis",
  briefing: "Briefing",
  note: "Note",
  change_event_draft: "Change event",
};

const TEXT_KEYS = ["text", "body", "summary", "notes", "description"] as const;

export function buildPlaneDraftsUrl(projectId: number) {
  return `/api/plane-drafts?project_id=${projectId}`;
}

export function getPlaneDraftText(content: Record<string, unknown>) {
  for (const key of TEXT_KEYS) {
    const value = content[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

export function updatePlaneDraftText(
  content: Record<string, unknown>,
  text: string,
) {
  const existingKey = TEXT_KEYS.find((key) => typeof content[key] === "string");
  return {
    ...content,
    [existingKey ?? "text"]: text,
  };
}

export function getPlaneDraftPreview(content: Record<string, unknown>) {
  const text = getPlaneDraftText(content).replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 160);

  const workflow = content.workflow;
  if (workflow && typeof workflow === "object" && !Array.isArray(workflow)) {
    const draft = (workflow as Record<string, unknown>).draft;
    if (draft && typeof draft === "object" && !Array.isArray(draft)) {
      const narrative = (draft as Record<string, unknown>).narrative;
      if (typeof narrative === "string" && narrative.trim()) {
        return narrative.replace(/\s+/g, " ").trim().slice(0, 160);
      }
    }
  }

  return "No draft content yet";
}

export function matchesPlaneDraftQuery(
  artifact: PlaneDraftArtifact,
  query: string,
) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return `${artifact.title} ${getPlaneDraftPreview(artifact.content)} ${
    PLANE_DRAFT_TYPE_LABELS[artifact.artifact_type]
  }`
    .toLocaleLowerCase()
    .includes(normalized);
}

export function formatPlaneDraftUpdatedAt(isoString: string, now = Date.now()) {
  const updatedAt = new Date(isoString).getTime();
  if (!Number.isFinite(updatedAt)) return "Updated recently";
  const minutes = Math.max(0, Math.floor((now - updatedAt) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}
