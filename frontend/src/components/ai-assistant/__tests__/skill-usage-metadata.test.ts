import {
  extractSkillUsage,
  type SkillUsageMetadataMessage,
} from "../skill-usage-metadata";

function historyMessage(
  overrides: Partial<SkillUsageMetadataMessage> = {},
): SkillUsageMetadataMessage {
  return {
    id: "db-message-1",
    metadata: {
      response_message_id: "sdk-message-1",
      skill_usage: {
        totalSelected: 1,
        selectionReason: "category, project, and keyword relevance",
        skills: [
          {
            id: "skill-1",
            title: "Review stored materials before pay app approval",
            slug: "review-stored-materials-before-pay-app-approval",
            category: "pay_app_review",
            scope: "project",
            projectId: 1009,
            version: 2,
            riskLevel: "medium",
            score: 120,
            reasons: ["category:pay_app_review"],
          },
        ],
      },
    },
    ...overrides,
  };
}

describe("extractSkillUsage", () => {
  it("indexes persisted skill usage by database and streamed response message ids", () => {
    const usageByMessageId = extractSkillUsage([historyMessage()]);

    expect(usageByMessageId["db-message-1"]?.totalSelected).toBe(1);
    expect(usageByMessageId["sdk-message-1"]?.skills[0]?.version).toBe(2);
  });

  it("ignores metadata without selected skills", () => {
    const usageByMessageId = extractSkillUsage([
      historyMessage({
        metadata: {
          skill_usage: {
            totalSelected: 0,
            selectionReason: "none",
            skills: [],
          },
        },
      }),
    ]);

    expect(usageByMessageId).toEqual({});
  });
});
