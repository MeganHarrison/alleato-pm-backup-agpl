import {
  COMPANY_SETTINGS_SECTIONS,
  DEFAULT_COMPANY_SETTINGS_SECTION_ID,
} from "../registry";

describe("company settings registry", () => {
  it("has a valid default section", () => {
    expect(COMPANY_SETTINGS_SECTIONS.some((section) => section.id === DEFAULT_COMPANY_SETTINGS_SECTION_ID)).toBe(true);
  });

  it("only exposes management links for canonical configuration owners", () => {
    for (const section of COMPANY_SETTINGS_SECTIONS) {
      for (const item of section.items) {
        if (item.availability === "available") {
          expect(item.href).toMatch(/^\//);
          expect(item.actionLabel).toBeTruthy();
        } else {
          expect(item.href).toBeUndefined();
          expect(item.protectionReason).toBeTruthy();
        }
      }
    }
  });
});

