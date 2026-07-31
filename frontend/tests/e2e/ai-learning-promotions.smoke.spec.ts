import { expect, test } from "@playwright/test";

const PROMOTION_ID = "11111111-1111-4111-8111-111111111111";
const RETRIEVAL_WEIGHT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

type PromotionStatus = "candidate" | "approved" | "applied" | "rejected" | "superseded";
type RetrievalWeightStatus = "active" | "paused" | "superseded";

function promotion(status: PromotionStatus, retrievalWeightStatus?: RetrievalWeightStatus) {
  return {
    id: PROMOTION_ID,
    created_at: "2026-05-07T14:00:00.000Z",
    reviewed_at: status === "candidate" ? null : "2026-05-07T14:05:00.000Z",
    reviewed_by: status === "candidate" ? null : USER_ID,
    status,
    promotion_type: "retrieval_weight",
    project_id: 983,
    target_id: null,
    source_event_ids: ["44444444-4444-4444-8444-444444444444"],
    destination_table: status === "applied" ? "ai_retrieval_weights" : "ai_retrieval_feedback",
    destination_record_id:
      status === "applied" ? RETRIEVAL_WEIGHT_ID : "55555555-5555-4555-8555-555555555555",
    confidence: 0.8,
    risk_level: "low",
    proposed_learning: {
      signature: "retrieval_weight:boost:semanticSearch|983|doc-1|sprinkler delay",
      ruleKind: "retrieval_weight",
      action: "boost",
      title: "Boost sprinkler delay source",
      toolName: "semanticSearch",
      projectId: 983,
      sourceDocumentId: "doc-1",
      sourceChunkId: "chunk-1",
      querySignature: "sprinkler delay",
      evidenceWindowDays: 30,
      signalCounts: {
        helpful: 4,
        problem: 0,
        total: 4,
      },
      rationale: "Source was repeatedly cited in helpful answers.",
    },
    review_notes: null,
    expires_at: null,
    superseded_by: null,
    retrievalWeight:
      status === "applied"
        ? {
            id: RETRIEVAL_WEIGHT_ID,
            created_at: "2026-05-07T14:06:00.000Z",
            updated_at: "2026-05-07T14:06:00.000Z",
            promotion_id: PROMOTION_ID,
            project_id: 983,
            tool_name: "semanticSearch",
            source_document_id: "doc-1",
            source_chunk_id: "chunk-1",
            query_signature: "sprinkler delay",
            action: "boost",
            weight_multiplier: 1.4,
            confidence: 0.8,
            status: retrievalWeightStatus ?? "active",
            metadata: {},
          }
        : null,
  };
}

test.describe("AI learning promotions", () => {
  test("reviews, previews, applies, pauses, and resumes a retrieval promotion", async ({
    page,
  }) => {
    let currentStatus: PromotionStatus = "candidate";
    let retrievalWeightStatus: RetrievalWeightStatus = "active";

    await page.route("**/api/admin/ai-learning-promotions?**", async (route) => {
      const url = new URL(route.request().url());
      const requestedStatus = url.searchParams.get("status") ?? "candidate";
      const promotions =
        requestedStatus === currentStatus
          ? [promotion(currentStatus, retrievalWeightStatus)]
          : [];

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ promotions }),
      });
    });

    await page.route("**/api/admin/ai-learning-promotions/run", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          inspectedRows: 4,
          groupsInspected: 1,
          candidatesFound: 1,
          candidatesCreated: 1,
          candidatesSkipped: 0,
          dryRun: false,
          candidates: [],
        }),
      });
    });

    await page.route("**/api/admin/ai-learning-promotions/preview", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          multiplier: 1.4,
          inspectedRows: 4,
          matchingRows: 4,
          beforeTop: [
            {
              retrievalFeedbackId: "feedback-1",
              sourceDocumentId: "doc-1",
              sourceChunkId: "chunk-1",
              outcome: "helpful",
              cited: true,
              usedInAnswer: true,
              originalScore: 0.72,
              adjustedScore: 1.008,
              originalRank: 2,
              adjustedRank: 1,
              matchedPromotionSource: true,
            },
          ],
          afterTop: [
            {
              retrievalFeedbackId: "feedback-1",
              sourceDocumentId: "doc-1",
              sourceChunkId: "chunk-1",
              outcome: "helpful",
              cited: true,
              usedInAnswer: true,
              originalScore: 0.72,
              adjustedScore: 1.008,
              originalRank: 2,
              adjustedRank: 1,
              matchedPromotionSource: true,
            },
          ],
          matchedRankChange: {
            beforeBestRank: 2,
            afterBestRank: 1,
          },
        }),
      });
    });

    await page.route("**/api/admin/ai-learning-promotions/stats", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          promotions: {
            candidate: currentStatus === "candidate" ? 1 : 0,
            approved: currentStatus === "approved" ? 1 : 0,
            applied: currentStatus === "applied" ? 1 : 0,
            rejected: 0,
            superseded: 0,
          },
          retrievalWeights: {
            active: currentStatus === "applied" && retrievalWeightStatus === "active" ? 1 : 0,
            paused: currentStatus === "applied" && retrievalWeightStatus === "paused" ? 1 : 0,
            superseded: 0,
          },
          recentActivityCount: 2,
        }),
      });
    });

    await page.route("**/api/admin/ai-learning-promotions/activity?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          events: [
            {
              id: "66666666-6666-4666-8666-666666666666",
              created_at: "2026-05-07T14:08:00.000Z",
              user_id: USER_ID,
              project_id: 983,
              target_id: null,
              session_id: null,
              source_table: "ai_learning_promotions",
              source_record_id: PROMOTION_ID,
              event_type: "retrieval_weight_applied",
              event_family: "retrieval",
              surface: "admin_ai_learning_promotions",
              subject_type: "ai_retrieval_weight",
              subject_id: RETRIEVAL_WEIGHT_ID,
              signal: "accepted",
              reason_category: "retrieval_weight_apply",
              free_text: null,
              before_snapshot: { status: "approved" },
              after_snapshot: { status: "applied" },
              source_context: {},
              metadata: {},
            },
          ],
        }),
      });
    });

    await page.route("**/api/admin/ai-learning-promotions", async (route) => {
      const body = route.request().postDataJSON() as { action: string };
      if (body.action === "approve") currentStatus = "approved";
      if (body.action === "apply") currentStatus = "applied";
      if (body.action === "pause") retrievalWeightStatus = "paused";
      if (body.action === "resume") retrievalWeightStatus = "active";

      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          action: body.action,
          promotion: promotion(currentStatus, retrievalWeightStatus),
          retrievalWeight: promotion(currentStatus, retrievalWeightStatus).retrievalWeight,
        }),
      });
    });

    await page.goto("/ai-learning-promotions");

    await expect(page.getByRole("heading", { name: "AI Learning Promotions" })).toBeVisible();
    await expect(page.getByText("Boost sprinkler delay source")).toBeVisible();

    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Promotion scan complete")).toBeVisible();

    await page.getByRole("button", { name: "Approve promotion" }).click();
    await page.getByRole("tab", { name: "Approved" }).click();
    await expect(page.getByText("Boost sprinkler delay source")).toBeVisible();

    await page.getByText("Boost sprinkler delay source").click();
    await page.getByRole("button", { name: "Preview impact" }).click();
    await expect(page.getByText("Best after")).toBeVisible();
    await expect(page.getByText("#1 helpful · matched")).toBeVisible();

    await page.getByRole("button", { name: "Apply retrieval weight" }).click();
    await page.getByRole("tab", { name: "Applied" }).click();
    await expect(page.getByText("active").first()).toBeVisible();

    await page.getByRole("button", { name: "Pause retrieval weight" }).click();
    await expect(page.getByText("paused").first()).toBeVisible();

    await page.getByRole("button", { name: "Resume retrieval weight" }).click();
    await expect(page.getByText("active").first()).toBeVisible();
  });
});
