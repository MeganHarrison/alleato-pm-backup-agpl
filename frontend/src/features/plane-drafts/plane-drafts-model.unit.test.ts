import {
  buildPlaneDraftsUrl,
  formatPlaneDraftUpdatedAt,
  getPlaneDraftPreview,
  getPlaneDraftText,
  matchesPlaneDraftQuery,
  type PlaneDraftArtifact,
  updatePlaneDraftText,
} from "./plane-drafts-model";

const artifact: PlaneDraftArtifact = {
  id: "draft-1",
  user_id: "user-1",
  project_id: 31,
  artifact_type: "note",
  title: "Owner ceiling decision",
  status: "draft",
  version: 2,
  content: { text: "Confirm pricing before Friday." },
  context_snapshot: {},
  session_id: null,
  promoted_to: null,
  promoted_at: null,
  tags: ["owner"],
  created_at: "2026-07-30T10:00:00.000Z",
  updated_at: "2026-07-30T11:00:00.000Z",
};

describe("Plane Drafts workspace-artifact adapter", () => {
  it("builds the authenticated draft-only owner URL with optional project scope", () => {
    expect(buildPlaneDraftsUrl(31)).toBe(
      "/api/plane-drafts?project_id=31",
    );
  });

  it("reads and updates the artifact's existing text field without dropping metadata", () => {
    expect(getPlaneDraftText(artifact.content)).toBe(
      "Confirm pricing before Friday.",
    );
    expect(updatePlaneDraftText(artifact.content, "Revised decision.")).toEqual(
      {
        text: "Revised decision.",
      },
    );
    expect(
      updatePlaneDraftText({ summary: "Old", evidence: ["meeting-1"] }, "New"),
    ).toEqual({ summary: "New", evidence: ["meeting-1"] });
  });

  it("extracts nested change-event narrative when no ordinary text field exists", () => {
    expect(
      getPlaneDraftPreview({
        workflow: {
          draft: {
            narrative:
              "Owner requested a revised ceiling detail before procurement.",
          },
        },
      }),
    ).toBe("Owner requested a revised ceiling detail before procurement.");
  });

  it("searches title, preview, and type label", () => {
    expect(matchesPlaneDraftQuery(artifact, "ceiling")).toBe(true);
    expect(matchesPlaneDraftQuery(artifact, "pricing")).toBe(true);
    expect(matchesPlaneDraftQuery(artifact, "note")).toBe(true);
    expect(matchesPlaneDraftQuery(artifact, "submittal")).toBe(false);
  });

  it("formats invalid and bounded relative timestamps without throwing", () => {
    const now = new Date("2026-07-31T11:00:00.000Z").getTime();
    expect(formatPlaneDraftUpdatedAt("2026-07-31T10:45:00.000Z", now)).toBe(
      "Updated 15m ago",
    );
    expect(formatPlaneDraftUpdatedAt("not-a-date", now)).toBe(
      "Updated recently",
    );
  });
});
