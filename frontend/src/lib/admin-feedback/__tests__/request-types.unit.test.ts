import {
  ADMIN_FEEDBACK_PRODUCT_INTAKE_LABEL,
  ADMIN_FEEDBACK_REQUEST_TYPE_LABELS,
} from "@/lib/admin-feedback/constants";
import { buildAdminFeedbackGitHubLabels } from "@/lib/admin-feedback/github";
import { buildAdminFeedbackTitle } from "@/lib/admin-feedback/title";

describe("admin feedback request types", () => {
  it("keeps feature_request as the storage value while presenting it as an idea", () => {
    expect(ADMIN_FEEDBACK_PRODUCT_INTAKE_LABEL).toBe("Ideas");
    expect(ADMIN_FEEDBACK_REQUEST_TYPE_LABELS.feature_request).toBe("Idea");
  });

  it("uses idea language in generated titles", () => {
    expect(
      buildAdminFeedbackTitle({
        requestType: "feature_request",
        comment: "",
        targetText: "project landing page",
        pageTitle: "Project Home",
      }),
    ).toBe("Idea: project landing page");
  });

  it("keeps GitHub labels compatible with the existing feedback workflow", () => {
    expect(buildAdminFeedbackGitHubLabels("feature_request")).toContain(
      "feedback:feature_request",
    );
  });
});
