import fs from "node:fs";
import path from "node:path";

import type { LearningLibraryItem } from "@/lib/learning/types";

import {
  buildManagerOptions,
  contentNeedsAttention,
  engagementLabel,
  formatReviewDate,
  isReviewDateDue,
  reviewLabel,
} from "../content-catalog-operations";

function libraryItem(
  overrides: Partial<LearningLibraryItem> = {},
): LearningLibraryItem {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "content-item",
    title: "Content item",
    summary: null,
    kind: "article",
    displayArea: "training",
    lifecycle: "published",
    visibility: "internal",
    sourceType: "native_content",
    sourceId: "00000000-0000-0000-0000-000000000002",
    sourceUrl: null,
    href: "/training/content/content-item",
    external: false,
    ownerUserId: "00000000-0000-0000-0000-000000000003",
    ownerName: "Owner",
    reviewerUserId: "00000000-0000-0000-0000-000000000004",
    reviewerName: "Reviewer",
    lastReviewedAt: "2026-07-01T12:00:00.000Z",
    nextReviewAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-07-31T12:00:00.000Z",
    publishedAt: "2026-07-01T12:00:00.000Z",
    engagementTrackingSupported: true,
    uniqueViewers: 0,
    completedCount: 0,
    completionRate: 0,
    watchSeconds: 0,
    lastEngagedAt: null,
    topics: [],
    roles: [],
    skills: [],
    businessAreas: [],
    courseId: null,
    courseOutcome: null,
    courseDifficulty: null,
    estimatedMinutes: null,
    isInternalCourse: false,
    provider: null,
    ...overrides,
  };
}

describe("Content Studio display areas", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/features/content-studio/content-catalog-table.tsx",
    ),
    "utf8",
  );
  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "../supabase/migrations/20260731180000_add_content_creator_operations.sql",
    ),
    "utf8",
  );
  const operations = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/features/content-studio/content-catalog-operations.ts",
    ),
    "utf8",
  );

  it("uses canonical tabs without crowding the mobile creator controls", () => {
    expect(source).toContain('{ value: "training", label: "Training" }');
    expect(source).toContain('{ value: "resources", label: "Resources" }');
    expect(source).toContain('{ value: "sops", label: "SOPs" }');
    expect(source).toContain(
      '{ value: "documentation", label: "Documentation" }',
    );
    expect(source).toContain("mobileActionsInline: false");
    expect(source).toContain("toolbarInlineWithHeader: false");
    expect(source).toContain("toolbarWithTabs: false");
    expect(source).toContain("count: items.filter");
  });

  it("keeps display placement visible and editable through the shared table", () => {
    expect(source).toContain('label: "Displayed in"');
    expect(source).toContain("editableSelectColumn(");
    expect(source).toContain("updateContentDisplayAreaAction");
    expect(source).toContain("enableInlineEditing: true");
  });

  it("reuses shared creator operations instead of adding a parallel dashboard", () => {
    expect(source).toContain('label: "Needs attention"');
    expect(source).toContain('label: "Engagement"');
    expect(source).toContain('savedViewsScope: "content-studio-catalog"');
    expect(source).toContain("enableRowSelection: true");
    expect(source).toContain("bulkUpdateContentGovernanceAction");
    expect(operations).toContain('return "Not tracked"');
    expect(source.indexOf('id: "owner"')).toBeLessThan(
      source.indexOf('id: "displayArea"'),
    );
  });

  it("keeps aggregate reads and bounded bulk writes admin-only", () => {
    expect(migration).toContain("get_knowledge_content_engagement_summary()");
    expect(migration).toContain("bulk_update_knowledge_content_governance(");
    expect(migration).toContain("cardinality(normalized_ids) > 200");
    expect(migration).toContain("current_is_app_admin()");
    expect(migration).not.toContain("current_is_learning_admin()");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("updated_count <> cardinality(normalized_ids)");
  });

  it("treats review deadlines as calendar dates instead of drifting by time", () => {
    expect(isReviewDateDue("2026-08-01T00:00:00.000Z", "2026-07-31")).toBe(
      false,
    );
    expect(isReviewDateDue("2026-08-01T00:00:00.000Z", "2026-08-01")).toBe(
      true,
    );
    expect(formatReviewDate("2026-08-01T00:00:00.000Z")).toBe("Aug 1, 2026");
    expect(contentNeedsAttention(libraryItem(), "2026-07-31")).toBe(false);
    expect(reviewLabel(libraryItem(), "2026-08-01")).toBe("Review due");
  });

  it("formats truthful engagement states without encoding artifacts", () => {
    expect(
      engagementLabel(
        libraryItem({
          uniqueViewers: 1,
          completedCount: 1,
          watchSeconds: 60,
        }),
      ),
    ).toBe("1 viewer | 1 completed | 1m watched");
    expect(
      engagementLabel(
        libraryItem({ engagementTrackingSupported: false }),
      ),
    ).toBe("Not tracked");
  });

  it("disambiguates manager choices with email addresses", () => {
    expect(
      buildManagerOptions([
        {
          id: "00000000-0000-0000-0000-000000000005",
          name: "Alex Smith",
          email: "alex@example.com",
        },
      ]),
    ).toContainEqual({
      value: "00000000-0000-0000-0000-000000000005",
      label: "Alex Smith (alex@example.com)",
    });
  });
});
