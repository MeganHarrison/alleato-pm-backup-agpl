import {
  getAppKnowledgeToolCategory,
  getTrainingDocToolCategory,
} from "../app-knowledge";
import type { PublishedTrainingDoc } from "@/lib/training-docs/docs-site";

function doc(overrides: Partial<PublishedTrainingDoc>): PublishedTrainingDoc {
  return {
    title: "Training Doc",
    slug: "training-doc",
    summary: null,
    audience: "internal",
    status: "published",
    sourceRoute: null,
    publishedDocPath: "project-management-tools/training-docs/training-doc.mdx",
    lastPublishedAt: "2026-06-30T12:00:00Z",
    appToolCategory: null,
    ...overrides,
  };
}

describe("app knowledge categories", () => {
  it("resolves canonical tool categories by slug", () => {
    expect(getAppKnowledgeToolCategory("budget")?.title).toBe("Budget");
    expect(getAppKnowledgeToolCategory("rfis-and-submittals")?.title).toBe(
      "RFIs and Submittals",
    );
  });

  it("uses metadata category before route fallback", () => {
    expect(
      getTrainingDocToolCategory(
        doc({
          appToolCategory: "Meetings",
          sourceRoute: "/1009/budget",
        }),
      )?.title,
    ).toBe("Meetings");
  });

  it("maps project-scoped source routes to tool categories", () => {
    expect(
      getTrainingDocToolCategory(doc({ sourceRoute: "/create-project" }))?.title,
    ).toBe("Projects");
    expect(
      getTrainingDocToolCategory(doc({ sourceRoute: "/1009/budget" }))?.title,
    ).toBe("Budget");
    expect(
      getTrainingDocToolCategory(doc({ sourceRoute: "/1009/meetings" }))?.title,
    ).toBe("Meetings");
  });

  it("maps admin training doc routes to the training docs category", () => {
    expect(
      getTrainingDocToolCategory(doc({ sourceRoute: "/training-docs" }))?.title,
    ).toBe("Training Docs");
  });
});
