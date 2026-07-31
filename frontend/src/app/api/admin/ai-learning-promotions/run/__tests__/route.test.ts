import { NextRequest } from "next/server";

import {
  generateAttributionRulePromotionCandidates,
  generateEmailVoicePromotionCandidates,
  generateRetrievalPromotionCandidates,
  generateTaskPromotionCandidates,
} from "@/lib/ai/services/feedback-event-service";
import { requireAiLearningPromotionsAdmin } from "../../_shared";
import { POST } from "../route";

jest.mock("@/lib/ai/services/feedback-event-service", () => ({
  generateAttributionRulePromotionCandidates: jest.fn(),
  generateEmailVoicePromotionCandidates: jest.fn(),
  generateRetrievalPromotionCandidates: jest.fn(),
  generateTaskPromotionCandidates: jest.fn(),
}));

jest.mock("../../_shared", () => ({
  requireAiLearningPromotionsAdmin: jest.fn(),
}));

const emptyResult = {
  inspectedRows: 0,
  candidatesFound: 0,
  candidatesCreated: 0,
  candidatesSkipped: 0,
  candidates: [],
};

describe("POST /api/admin/ai-learning-promotions/run", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(requireAiLearningPromotionsAdmin)
      .mockResolvedValue({ id: "app-admin" } as never);
    jest
      .mocked(generateRetrievalPromotionCandidates)
      .mockResolvedValue(emptyResult);
    jest.mocked(generateTaskPromotionCandidates).mockResolvedValue(emptyResult);
    jest
      .mocked(generateEmailVoicePromotionCandidates)
      .mockResolvedValue(emptyResult);
    jest
      .mocked(generateAttributionRulePromotionCandidates)
      .mockResolvedValue(emptyResult);
  });

  it("uses the learning-review app-admin contract for the Generate action", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/admin/ai-learning-promotions/run", {
        method: "POST",
        body: JSON.stringify({ dryRun: true }),
      }),
    );

    expect(response.status).toBe(200);
    expect(requireAiLearningPromotionsAdmin).toHaveBeenCalledWith(
      "api.admin.ai-learning-promotions.run.POST",
    );
  });
});
