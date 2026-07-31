import {
  mergeProgressReportContacts,
  resolveProgressReportContacts,
} from "@/lib/progress-reports/contacts";
import type { ProgressReportContact } from "@/lib/progress-reports/types";

const contact = (over: Partial<ProgressReportContact>): ProgressReportContact => ({
  role: "",
  name: "",
  email: "",
  phone: "",
  ...over,
});

const bob = contact({ role: "Project Manager", name: "Bob Wright", email: "bwright@alleatogroup.com" });
const amanda = contact({ role: "Sales Rep", name: "Amanda Clark", email: "amanda.clark@alleatogroup.com" });

describe("resolveProgressReportContacts", () => {
  it("returns stored contacts verbatim when the report has any saved contacts", () => {
    // Stored = the curated list (Amanda already removed). Team still has Amanda.
    const stored = [bob];
    const team = [bob, amanda];

    const result = resolveProgressReportContacts(team, stored);

    // Regression guard: a removed team-derived contact must NOT be re-injected
    // on read. This is the exact bug that made deletions appear not to save.
    expect(result).toEqual([bob]);
    expect(result.some((c) => c.email === amanda.email)).toBe(false);
  });

  it("does not re-add team members who are absent from a non-empty stored list", () => {
    const stored = [bob];
    const team = [amanda]; // team member not in the report

    expect(resolveProgressReportContacts(team, stored)).toEqual([bob]);
  });

  it("falls back to the project team only when stored contacts are empty (legacy reports)", () => {
    expect(resolveProgressReportContacts([bob, amanda], [])).toEqual([bob, amanda]);
  });

  it("returns an empty list when both stored and team are empty", () => {
    expect(resolveProgressReportContacts([], [])).toEqual([]);
  });
});

describe("mergeProgressReportContacts", () => {
  it("dedupes by email/name/phone/role with primary ordered first", () => {
    const result = mergeProgressReportContacts([bob], [amanda, bob]);
    expect(result).toEqual([bob, amanda]);
  });

  it("skips entries with no identifying key", () => {
    const blank = contact({});
    expect(mergeProgressReportContacts([blank], [bob])).toEqual([bob]);
  });
});
