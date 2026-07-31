/**
 * Contract specs for every AI-assistant WRITE tool.
 *
 * This is the source of truth the harness iterates over. Each entry declares
 * how to exercise one tool and how to PROVE the effect actually happened —
 * the check the prompt→tool LLM evals never did (they score the model's words
 * and tool-call trace, not the database).
 *
 * Two modes:
 *   - "write"   → call the tool with confirmed:true, then read the row back
 *                 from the DB and assert it exists. Catches silent no-ops.
 *   - "preview" → call with confirmed:false and assert the tool returns a sane
 *                 preview without throwing. Used for tools that send OUTSIDE the
 *                 app (Outlook, Teams, GitHub) or run an LLM — we never trigger
 *                 the real side effect from a test. Their real write path needs
 *                 a separate integration test with the provider mocked.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ToolExecute = (input: Record<string, unknown>) => Promise<unknown>;
export type ToolEntry = {
  execute: ToolExecute;
  /** The zod inputSchema the AI SDK parses against before calling execute. */
  inputSchema?: { parse?: (input: unknown) => Record<string, unknown> };
};
export type ToolMap = Record<string, ToolEntry>;

export type SpecContext = {
  sb: SupabaseClient;
  tools: ToolMap;
  projectId: number;
  userId: string;
  stamp: string;
  /** Per-spec scratch populated by `prereq` (fixture ids, original values). */
  fixture: Record<string, unknown>;
};

export type WriteToolSpec = {
  tool: string;
  mode: "write" | "preview";
  /** Table to read back from / clean up (write mode, default verify/cleanup). */
  table?: string;
  /** Why this tool is preview-only (sends externally / runs an LLM). */
  externalReason?: string;
  /**
   * Preview mode only: a business-rule error that counts as a PASS because it
   * proves the tool's validation ran correctly (e.g. "recipient has no linked
   * Teams account"). Without this, any returned error fails the spec.
   */
  acceptError?: RegExp;
  /** Create parent rows / capture originals before the tool runs. */
  prereq?: (ctx: SpecContext) => Promise<void>;
  /** Tool input WITHOUT `confirmed` (the harness adds it per mode). */
  input: (ctx: SpecContext) => Record<string, unknown>;
  /**
   * Custom read-back assertion (write mode). Receives the tool result.
   * Default when omitted: extract the new row id, SELECT it from `table`,
   * assert the row exists.
   */
  verify?: (result: unknown, ctx: SpecContext) => Promise<void>;
  /** Custom cleanup. Default: delete the created row by id from `table`. */
  cleanup?: (result: unknown, ctx: SpecContext) => Promise<void>;
};

/** Pull the new row id (string UUID or numeric PK) out of the various shapes. */
export function extractId(result: unknown): string | number | undefined {
  const r = result as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return undefined;
  const rec = r.record as Record<string, unknown> | undefined;
  const data = r.data as Record<string, unknown> | undefined;
  const candidates = [
    rec?.id,
    (rec?.person as Record<string, unknown> | undefined)?.id,
    (rec?.membership as Record<string, unknown> | undefined)?.id,
    (rec?.assignment as Record<string, unknown> | undefined)?.id,
    data?.id,
    r.id,
    r.itemId,
    r.feedbackId,
    (r.person as Record<string, unknown> | undefined)?.id,
  ];
  const id = candidates.find(
    (c) => (typeof c === "string" && c.length > 0) || typeof c === "number",
  );
  return id as string | number | undefined;
}

/** Assert a tool result is a real success (not a swallowed-error object). */
export function expectSuccess(result: unknown): asserts result is Record<
  string,
  unknown
> {
  const r = result as Record<string, unknown> | null;
  if (!r || typeof r !== "object") {
    throw new Error(`Tool returned non-object result: ${JSON.stringify(result)}`);
  }
  if (r.error) {
    throw new Error(`Tool returned an error: ${String(r.error)}`);
  }
  if (r.action === "preview") {
    throw new Error(
      "Tool returned a PREVIEW even though confirmed:true was sent — the " +
        "write gate did not open (this is the silent-no-op class of bug).",
    );
  }
  if (r.success !== true) {
    throw new Error(
      `Tool did not report success:true. Result: ${JSON.stringify(result)}`,
    );
  }
}

const text = (s: string) => s;

export const WRITE_TOOL_SPECS: WriteToolSpec[] = [
  // ---- Straight DB-write tools: write → read back → delete ----------------
  {
    tool: "createTask",
    mode: "write",
    table: "schedule_tasks",
    input: (c) => ({ projectId: c.projectId, name: c.stamp, priority: "normal" }),
  },
  {
    tool: "createGeneratedTask",
    mode: "write",
    table: "tasks",
    input: (c) => ({ projectId: c.projectId, title: c.stamp, description: text("contract test") }),
  },
  {
    tool: "createRFI",
    mode: "write",
    table: "rfis",
    input: (c) => ({ projectId: c.projectId, subject: c.stamp, question: text("contract test question") }),
  },
  {
    tool: "createChangeOrder",
    mode: "write",
    table: "prime_contract_change_orders",
    input: (c) => ({ projectId: c.projectId, title: c.stamp }),
  },
  {
    tool: "createChangeEvent",
    mode: "write",
    table: "change_events",
    input: (c) => ({ projectId: c.projectId, title: c.stamp, description: text("contract test") }),
  },
  {
    tool: "createSubmittal",
    mode: "write",
    table: "submittals",
    input: (c) => ({ projectId: c.projectId, title: c.stamp }),
  },
  {
    tool: "createMeetingNote",
    mode: "write",
    table: "document_metadata",
    input: (c) => ({ projectId: c.projectId, title: c.stamp, date: "2026-06-26", summary: text("contract test summary") }),
  },
  {
    tool: "logDailyReport",
    mode: "write",
    table: "daily_logs",
    input: (c) => ({ projectId: c.projectId, logDate: "2026-06-26", workPerformed: c.stamp }),
  },
  {
    tool: "flagProjectRisk",
    mode: "write",
    table: "insight_cards",
    input: (c) => ({ projectId: c.projectId, title: c.stamp, description: text("contract test risk"), severity: "medium" }),
  },
  {
    tool: "createInitiativeCard",
    mode: "write",
    table: "initiative_cards",
    input: (c) => ({ title: c.stamp, description: text("contract test initiative") }),
  },
  {
    tool: "createCommitment",
    mode: "write",
    table: "subcontracts",
    // The WRITE path requires a resolvable vendor company (is_vendor=true).
    prereq: async (c) => {
      const { data, error } = await c.sb
        .from("companies")
        .insert({ name: `Contract Vendor ${c.stamp}`, is_vendor: true })
        .select("id")
        .single();
      if (error) throw new Error(`vendor fixture failed: ${error.message}`);
      c.fixture.vendorCompanyId = data.id;
    },
    input: (c) => ({
      projectId: c.projectId,
      type: "subcontract",
      title: c.stamp,
      vendorName: `Contract Vendor ${c.stamp}`,
    }),
    cleanup: async (result, c) => {
      const id = extractId(result);
      if (id) await c.sb.from("subcontracts").delete().eq("id", id);
      if (c.fixture.vendorCompanyId) {
        await c.sb.from("companies").delete().eq("id", c.fixture.vendorCompanyId as string);
      }
    },
  },
  {
    tool: "createPrimeContract",
    mode: "write",
    table: "prime_contracts",
    input: (c) => ({
      projectId: c.projectId,
      title: c.stamp,
      contractNumber: `PC-AI-${Date.now()}`,
      status: "draft",
      sovSource: "manual",
      lineItems: [
        {
          description: `Contract SOV ${c.stamp}`,
          amount: 100,
        },
      ],
    }),
    cleanup: async (result, c) => {
      const id = extractId(result);
      if (!id) return;
      await c.sb.from("contract_line_items").delete().eq("contract_id", id);
      await c.sb.from("prime_contracts").delete().eq("id", id);
    },
  },
  {
    tool: "createContact",
    mode: "write",
    table: "people",
    input: (c) => ({ firstName: "Contract", lastName: c.stamp }),
  },
  {
    tool: "addBoardItem",
    mode: "write",
    table: "admin_feedback_items",
    // NOTE: keep the tool zod enum aligned with admin_feedback_items_board_status_check.
    input: (c) => ({ title: c.stamp, description: text("contract test board item"), board_status: "submitted" }),
  },

  // ---- Tools that need a parent row, or mutate an existing one ------------
  {
    tool: "createProjectCompany",
    mode: "write",
    table: "companies",
    input: (c) => ({ projectId: c.projectId, name: `Contract Co ${c.stamp}`, companyType: "VENDOR" }),
    // Read back the global company by the unique name, then clean up the
    // project link and the company.
    verify: async (result, c) => {
      const id = extractId(result);
      const { data, error } = await c.sb
        .from("companies")
        .select("id, name")
        .eq("name", `Contract Co ${c.stamp}`)
        .maybeSingle();
      if (error) throw new Error(`read-back failed: ${error.message}`);
      if (!data) throw new Error("company row not found after create");
      c.fixture.companyId = data.id ?? id;
    },
    cleanup: async (_result, c) => {
      const companyId = c.fixture.companyId as string | undefined;
      if (!companyId) return;
      await c.sb.from("project_companies").delete().eq("company_id", companyId);
      await c.sb.from("companies").delete().eq("id", companyId);
    },
  },
  {
    tool: "createProjectContact",
    mode: "write",
    table: "project_directory_memberships",
    input: (c) => ({ projectId: c.projectId, firstName: "Contract", lastName: c.stamp }),
    // Read the membership back via the person we created (robust to the
    // tool's return shape).
    verify: async (_result, c) => {
      const { data: person } = await c.sb
        .from("people")
        .select("id")
        .eq("first_name", "Contract")
        .eq("last_name", c.stamp)
        .maybeSingle();
      if (!person) throw new Error("contact person not found after create");
      c.fixture.personId = person.id;
      const { data: membership, error } = await c.sb
        .from("project_directory_memberships")
        .select("id")
        .eq("person_id", person.id)
        .eq("project_id", c.projectId)
        .maybeSingle();
      if (error) throw new Error(`read-back failed: ${error.message}`);
      if (!membership) throw new Error("directory membership not found after create");
      c.fixture.membershipId = membership.id;
    },
    cleanup: async (_result, c) => {
      if (c.fixture.membershipId) {
        await c.sb.from("project_directory_memberships").delete().eq("id", c.fixture.membershipId as string);
      }
      if (c.fixture.personId) {
        await c.sb.from("people").delete().eq("id", c.fixture.personId as string);
      }
    },
  },
  {
    tool: "updateProjectStatus",
    mode: "write",
    // CONTRACT: the tool's zod enum is on_track|at_risk|critical|complete|on_hold,
    // but projects.health_status only allows Healthy|At Risk|Needs Attention|
    // Critical. The tool must MAP its enum to the DB value. Until it does, every
    // health update fails the check constraint (a real silent-fail-class bug).
    // This spec encodes the expected mapping on_track -> Healthy.
    prereq: async (c) => {
      const { data } = await c.sb
        .from("projects")
        .select("health_status")
        .eq("id", c.projectId)
        .single();
      c.fixture.originalHealth = data?.health_status ?? null;
    },
    input: (c) => ({ projectId: c.projectId, healthStatus: "on_track" }),
    verify: async (_result, c) => {
      const { data, error } = await c.sb
        .from("projects")
        .select("health_status")
        .eq("id", c.projectId)
        .single();
      if (error) throw new Error(`read-back failed: ${error.message}`);
      if (data?.health_status !== "Healthy") {
        throw new Error(
          `health_status not set to the DB-valid value: expected "Healthy" ` +
            `(mapped from on_track), got ${String(data?.health_status)}. The ` +
            `tool writes its raw enum value, which violates ` +
            `projects_health_status_check.`,
        );
      }
    },
    cleanup: async (_result, c) => {
      await c.sb
        .from("projects")
        .update({ health_status: c.fixture.originalHealth })
        .eq("id", c.projectId);
    },
  },
  {
    tool: "updateGeneratedTask",
    mode: "write",
    table: "tasks",
    prereq: async (c) => {
      // Build the fixture via the createGeneratedTask tool so all required
      // columns (e.g. metadata_id) are populated the same way production does.
      const created = (await c.tools.createGeneratedTask.execute({
        projectId: c.projectId,
        title: `fixture ${c.stamp}`,
        description: "contract fixture",
        confirmed: true,
        idempotencyKey: `fixture-upd-${c.stamp}`,
      })) as Record<string, unknown>;
      const id = extractId(created);
      if (!id) throw new Error("could not create generated-task fixture");
      c.fixture.taskId = id;
    },
    input: (c) => ({ taskId: c.fixture.taskId, title: `updated ${c.stamp}` }),
    verify: async (_result, c) => {
      const { data, error } = await c.sb
        .from("tasks")
        .select("title")
        .eq("id", c.fixture.taskId as string)
        .single();
      if (error) throw new Error(`read-back failed: ${error.message}`);
      if (data?.title !== `updated ${c.stamp}`) {
        throw new Error(`title not updated: got ${String(data?.title)}`);
      }
    },
    cleanup: async (_result, c) => {
      await c.sb.from("tasks").delete().eq("id", c.fixture.taskId as string);
    },
  },
  {
    tool: "deleteGeneratedTask",
    mode: "write",
    prereq: async (c) => {
      const created = (await c.tools.createGeneratedTask.execute({
        projectId: c.projectId,
        title: `fixture-del ${c.stamp}`,
        description: "contract fixture",
        confirmed: true,
        idempotencyKey: `fixture-del-${c.stamp}`,
      })) as Record<string, unknown>;
      const id = extractId(created);
      if (!id) throw new Error("could not create generated-task fixture");
      c.fixture.taskId = id;
    },
    input: (c) => ({ taskId: c.fixture.taskId, reason: "contract test" }),
    verify: async (_result, c) => {
      const { data } = await c.sb
        .from("tasks")
        .select("id")
        .eq("id", c.fixture.taskId as string)
        .maybeSingle();
      if (data) throw new Error("task row still exists after delete");
    },
    cleanup: async (_result, c) => {
      await c.sb.from("tasks").delete().eq("id", c.fixture.taskId as string);
    },
  },
  {
    tool: "updateRFIStatus",
    mode: "write",
    prereq: async (c) => {
      // Use the createRFI tool to make a fixture (also under test separately).
      const created = (await c.tools.createRFI.execute({
        projectId: c.projectId,
        subject: `fixture-rfi ${c.stamp}`,
        question: "contract fixture",
        confirmed: true,
        idempotencyKey: `fixture-rfi-${c.stamp}`,
      })) as Record<string, unknown>;
      const rec = created.record as Record<string, unknown> | undefined;
      if (!rec?.id) throw new Error("could not create RFI fixture");
      c.fixture.rfiId = rec.id;
    },
    input: (c) => ({ projectId: c.projectId, rfiId: c.fixture.rfiId, newStatus: "answered" }),
    verify: async (_result, c) => {
      const { data, error } = await c.sb
        .from("rfis")
        .select("status")
        .eq("id", c.fixture.rfiId as string)
        .single();
      if (error) throw new Error(`read-back failed: ${error.message}`);
      if (data?.status !== "answered") {
        throw new Error(`status not updated: got ${String(data?.status)}`);
      }
    },
    cleanup: async (_result, c) => {
      await c.sb.from("rfis").delete().eq("id", c.fixture.rfiId as string);
    },
  },

  // ---- Preview-only: external sends / LLM. Never trigger the real effect. --
  {
    tool: "generateProjectSummary",
    mode: "preview",
    externalReason: "runs an LLM to synthesize a summary doc",
    input: (c) => ({ projectId: c.projectId }),
  },
  {
    tool: "submitFeedback",
    mode: "preview",
    externalReason: "creates a GitHub issue",
    input: () => ({ type: "bug", description: "contract test — preview only, do not submit" }),
  },
  {
    tool: "draftOutlookEmail",
    mode: "preview",
    externalReason: "creates a draft in a real Outlook mailbox via Graph",
    input: () => ({
      subject: "contract test",
      body: "preview only",
      toRecipients: [{ email: "nobody@example.com", name: "Nobody" }],
    }),
  },
  {
    tool: "createOutlookCalendarInvite",
    mode: "preview",
    externalReason: "sends a calendar invite to attendees via Graph",
    input: () => ({
      subject: "contract test",
      body: "preview only",
      startDateTime: "2026-06-26T15:00:00",
      endDateTime: "2026-06-26T15:30:00",
      attendees: [{ email: "nobody@example.com", name: "Nobody" }],
    }),
  },
  {
    tool: "sendTeamsMessage",
    mode: "preview",
    externalReason: "sends a Teams DM via the Archon bot",
    // A real linked-Teams test user is environment-dependent. The contract here
    // is that recipient resolution + linkage validation runs correctly — either
    // a preview (linked) or the specific not-linked message both pass.
    acceptError: /Alleato login|Archon bot|don't have|not found/i,
    // The preview path resolves the recipient against `people`, so it needs a
    // real name. Resolving is read-only — preview never sends.
    prereq: async (c) => {
      const { data } = await c.sb
        .from("people")
        .select("first_name, last_name")
        .not("first_name", "is", null)
        .not("last_name", "is", null)
        .limit(1);
      const p = data?.[0];
      c.fixture.recipientName = p
        ? `${p.first_name} ${p.last_name}`
        : "Brandon Clymer";
    },
    input: (c) => ({ recipientName: c.fixture.recipientName, message: "preview only" }),
  },
];
