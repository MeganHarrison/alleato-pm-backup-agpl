import {
  createEmptySiteManagementChecklist,
  getSiteManagementChecklistSummary,
  normalizeSiteManagementChecklist,
  serializeSiteManagementChecklist,
  validateSiteManagementChecklist,
} from "./site-management-checklist";

describe("site management checklist helpers", () => {
  it("normalizes persisted checklist payloads into the template shape", () => {
    const checklist = normalizeSiteManagementChecklist({
      version: 1,
      items: {
        "review-daily-schedule": { value: "yes", note: "" },
        "address-delays": { value: "no", note: "Awaiting revised delivery date." },
      },
    });

    expect(checklist["review-daily-schedule"]).toEqual({ value: "yes", note: "" });
    expect(checklist["address-delays"]).toEqual({
      value: "no",
      note: "Awaiting revised delivery date.",
    });
    expect(checklist["verify-ppe"]).toEqual({ value: null, note: "" });
  });

  it("requires a follow-up note for failed checklist items", () => {
    const checklist = createEmptySiteManagementChecklist();
    checklist["verify-ppe"] = { value: "no", note: "" };

    expect(validateSiteManagementChecklist(checklist)).toEqual([
      "Verify PPE usage and safe work practices",
    ]);
  });

  it("returns null for untouched checklists and counts answered items otherwise", () => {
    const emptyChecklist = createEmptySiteManagementChecklist();
    expect(serializeSiteManagementChecklist(emptyChecklist)).toBeNull();

    emptyChecklist["log-daily-report"] = { value: "yes", note: "" };
    emptyChecklist["document-safety-concerns"] = {
      value: "no",
      note: "Open guardrail near loading zone was tagged and corrected.",
    };

    expect(getSiteManagementChecklistSummary(emptyChecklist)).toEqual({
      answered: 2,
      total: 26,
      failures: 1,
    });
    expect(serializeSiteManagementChecklist(emptyChecklist)).toMatchObject({
      version: 1,
      items: {
        "log-daily-report": { value: "yes", note: "" },
        "document-safety-concerns": {
          value: "no",
          note: "Open guardrail near loading zone was tagged and corrected.",
        },
      },
    });
  });
});
