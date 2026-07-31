import { randomUUID } from "crypto";
import { test, expect } from "@playwright/test";
import { createServiceClient } from "@/lib/supabase/service";
import { createActionTools } from "@/lib/ai/tools/action-tools";

type ExecutableTool = {
  execute?: (input: Record<string, unknown>) => Promise<unknown>;
  needsApproval?: boolean | ((input: Record<string, unknown>) => boolean | Promise<boolean>);
};

async function requiresApproval(
  tool: ExecutableTool,
  input: Record<string, unknown>,
): Promise<boolean> {
  if (typeof tool.needsApproval === "function") {
    return Boolean(await tool.needsApproval(input));
  }
  return tool.needsApproval === true;
}

test.describe("AI assistant action tool approval", () => {
  test("previews without writing, requires approval for confirmed write, and audits exactly once", async () => {
    const supabase = createServiceClient();
    const runId = randomUUID();
    const idempotencyKey = `ai-tool-approval-${runId}`;
    const projectName = `AI Tool Approval Test ${runId}`;
    const taskName = `Approved AI task ${runId}`;
    let projectId: number | null = null;

    const { data: adminProfile, error: adminError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("is_admin", true)
      .limit(1)
      .maybeSingle();

    expect(adminError).toBeNull();
    test.skip(!adminProfile?.id, "Requires at least one admin user profile for AI tool guardrail scope.");

    try {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          name: projectName,
          archived: false,
          project_number: `AI-${runId.slice(0, 8)}`,
          created_by: null,
          created_via: "automation",
          creation_request_id: null,
          creation_run_id: `ai-action-approval:${runId}`,
        })
        .select("id")
        .single();

      expect(projectError).toBeNull();
      expect(project?.id).toEqual(expect.any(Number));
      projectId = project.id;

      const createTaskTool = createActionTools(adminProfile.id, {
        pinnedProjectId: projectId,
      }).createTask as ExecutableTool;

      expect(createTaskTool.execute).toBeDefined();

      const previewInput = {
        projectId,
        name: taskName,
        notes: "Preview should not touch the database",
        priority: "normal",
        confirmed: false,
        idempotencyKey,
      };
      const confirmedInput = {
        ...previewInput,
        notes: "Confirmed write should be audited once",
        confirmed: true,
      };

      expect(await requiresApproval(createTaskTool, previewInput)).toBe(false);
      const preview = await createTaskTool.execute?.(previewInput);

      expect(preview).toMatchObject({
        action: "preview",
        preview: {
          table: "schedule_tasks",
        },
      });

      await expectAuditCount(supabase, adminProfile.id, idempotencyKey, 0);
      await expectTaskCount(supabase, projectId, taskName, 0);

      expect(await requiresApproval(createTaskTool, confirmedInput)).toBe(true);

      const approved = true;
      if (approved) {
        const confirmed = await createTaskTool.execute?.(confirmedInput);
        expect(confirmed).toMatchObject({
          success: true,
          record: {
            name: expect.stringContaining(taskName),
          },
        });
      }

      await expectAuditCount(supabase, adminProfile.id, idempotencyKey, 1);
      await expectTaskCount(supabase, projectId, taskName, 1);

      const replay = await createTaskTool.execute?.(confirmedInput);
      expect(replay).toMatchObject({
        success: true,
        record: {
          name: expect.stringContaining(taskName),
        },
      });

      await expectAuditCount(supabase, adminProfile.id, idempotencyKey, 1);
      await expectTaskCount(supabase, projectId, taskName, 1);
    } finally {
      if (projectId != null) {
        await supabase.from("schedule_tasks").delete().eq("project_id", projectId);
        await supabase.from("projects").delete().eq("id", projectId);
      }
      await supabase
        .from("ai_tool_write_audits")
        .delete()
        .eq("user_id", adminProfile?.id ?? "00000000-0000-0000-0000-000000000000")
        .eq("tool_name", "createTask")
        .eq("idempotency_key", idempotencyKey);
    }
  });
});

async function expectAuditCount(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  idempotencyKey: string,
  expectedCount: number,
) {
  const { count, error } = await supabase
    .from("ai_tool_write_audits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tool_name", "createTask")
    .eq("idempotency_key", idempotencyKey)
    .eq("status", "success");

  expect(error).toBeNull();
  expect(count ?? 0).toBe(expectedCount);
}

async function expectTaskCount(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: number,
  taskName: string,
  expectedCount: number,
) {
  const { count, error } = await supabase
    .from("schedule_tasks")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .like("name", `${taskName}%`);

  expect(error).toBeNull();
  expect(count ?? 0).toBe(expectedCount);
}
