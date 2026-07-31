import { buildBrandedLastPageFooterOverlayPlan } from "@/lib/documents/branded-letterhead";
import { buildPrintPageCss } from "@/lib/documents/print-layout";

describe("buildPrintPageCss", () => {
  it("emits landscape page sizing when requested", () => {
    expect(buildPrintPageCss({ landscape: true })).toContain(
      "size: landscape;",
    );
  });

  it("keeps portrait-style output by omitting landscape sizing by default", () => {
    expect(buildPrintPageCss()).not.toContain("size: landscape;");
  });

  it("builds a shared footer overlay plan with a last-page override", () => {
    const plan = buildBrandedLastPageFooterOverlayPlan({
      documentTitle: "Weekly Progress Report",
      generatedAtLabel: "7/6/2026",
    });

    expect(plan.marginBottom).toBe("1.35in");
    expect(plan.defaultVariant).toMatchObject({
      kind: "simple",
      companyName: "Alleato Group",
      documentTitle: "Weekly Progress Report",
      generatedAtLabel: "7/6/2026",
    });
    expect(plan.lastPageVariant).toMatchObject({
      kind: "detailed",
      companyName: "Alleato Group",
    });
  });
});
