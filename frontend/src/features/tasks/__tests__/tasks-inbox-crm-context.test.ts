/** @jest-environment jsdom */

import {
  buildTasksListUrl,
  taskMatchesContext,
} from "@/features/tasks/tasks-inbox-context";
import {
  mapTaskRow,
  type JoinedTaskRow,
} from "@/features/tasks/task-utils";

describe("Tasks inbox CRM context", () => {
  it("requests only CRM-linked tasks while preserving the selected scope", () => {
    expect(buildTasksListUrl({ scope: "mine", context: "crm" })).toBe(
      "/api/tasks?scope=mine&context=crm",
    );
    expect(buildTasksListUrl({ scope: "all", context: "crm" })).toBe(
      "/api/tasks?scope=all&context=crm",
    );
  });

  it("rejects a non-CRM task opened through a CRM deep link", () => {
    expect(
      taskMatchesContext(
        { company_id: null, crm_lead_id: null },
        "crm",
      ),
    ).toBe(false);
    expect(
      taskMatchesContext(
        { company_id: "company-riverview", crm_lead_id: null },
        "crm",
      ),
    ).toBe(true);
    expect(
      taskMatchesContext(
        { company_id: null, crm_lead_id: "lead-riverview" },
        "crm",
      ),
    ).toBe(true);
    expect(
      taskMatchesContext({ company_id: null, crm_lead_id: null }),
    ).toBe(true);
  });

  it("preserves a lead task's direct CRM source link", () => {
    const mapped = mapTaskRow({
      id: "task-1",
      crm_lead_id: "lead-riverview",
      company_id: null,
      description: "Call the new lead",
      source_system: "crm",
      source_type: "crm_follow_up",
      source_url: "/crm/leads?leadId=lead-riverview",
      status: "open",
      created_at: "2026-07-30T00:00:00Z",
      updated_at: "2026-07-30T00:00:00Z",
      extraction_metadata: {},
    } as JoinedTaskRow);

    expect(mapped.crm_lead_id).toBe("lead-riverview");
    expect(mapped.source_type).toBe("crm_follow_up");
    expect(mapped.source_url).toBe("/crm/leads?leadId=lead-riverview");
  });
});
