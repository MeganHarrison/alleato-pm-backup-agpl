import { GuardrailError } from "@/lib/guardrails/errors";
import { recordSubmittalWorkflowResponse } from "../workflow-response-service";

type QueryResult = { data?: unknown; error?: { message: string } | null };

class SupabaseMock {
  calls: Array<{
    table: string;
    operation: string;
    payload?: unknown;
    filters: Array<[string, unknown]>;
  }> = [];

  private results: Record<string, QueryResult[]>;

  constructor(results: Record<string, QueryResult[]>) {
    this.results = results;
  }

  from(table: string) {
    return new QueryMock(this, table);
  }

  next(table: string, operation: string) {
    const key = `${table}.${operation}`;
    const result = this.results[key]?.shift();
    if (!result && key === "users_auth.select") {
      return { data: null, error: null };
    }
    if (!result) {
      throw new Error(`No mock result queued for ${key}`);
    }
    return result;
  }
}

class QueryMock {
  private filters: Array<[string, unknown]> = [];
  private operation: "select" | "update" | "insert" | null = null;
  private payload: unknown;

  constructor(
    private readonly db: SupabaseMock,
    private readonly table: string,
  ) {}

  select() {
    this.operation ??= "select";
    return this;
  }

  update(payload: unknown) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  insert(payload: unknown) {
    this.operation = "insert";
    this.payload = payload;
    const result = this.db.next(this.table, "insert");
    this.db.calls.push({
      table: this.table,
      operation: "insert",
      payload,
      filters: [...this.filters],
    });
    return Promise.resolve({ data: result.data, error: result.error ?? null });
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  in(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  order() {
    return this;
  }

  then<TResult1 = { data?: unknown; error?: { message: string } | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data?: unknown; error?: { message: string } | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    try {
      const result = this.db.next(this.table, this.operation ?? "select");
      this.db.calls.push({
        table: this.table,
        operation: this.operation ?? "select",
        payload: this.payload,
        filters: [...this.filters],
      });
      return Promise.resolve({
        data: result.data,
        error: result.error ?? null,
      }).then(onfulfilled, onrejected);
    } catch (error) {
      return Promise.reject(error).then(onfulfilled, onrejected);
    }
  }

  maybeSingle() {
    const result = this.db.next(this.table, this.operation ?? "select");
    this.db.calls.push({
      table: this.table,
      operation: this.operation ?? "select",
      payload: this.payload,
      filters: [...this.filters],
    });
    return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
  }

  single() {
    const result = this.db.next(this.table, this.operation ?? "select");
    this.db.calls.push({
      table: this.table,
      operation: this.operation ?? "select",
      payload: this.payload,
      filters: [...this.filters],
    });
    return Promise.resolve({ data: result.data, error: result.error ?? null });
  }
}

describe("recordSubmittalWorkflowResponse", () => {
  it("persists a submittal history entry for workflow responses", async () => {
    const supabase = new SupabaseMock({
      "submittals.select": [
        {
          data: {
            id: "sub-1",
            project_id: 25125,
            status: "Open",
            submittal_number: "SUB-001",
            title: "Door hardware",
          },
        },
      ],
      "submittal_workflow_steps.select": [
        { data: { id: "step-1" } },
        {
          data: [
            {
              id: "step-1",
              step_order: 1,
              step_type: "Reviewer",
              submittal_responses: [
                { responder_id: "user-1", response_status: "Revise and Resubmit" },
              ],
            },
          ],
        },
      ],
      "submittal_responses.select": [{ data: { id: "response-1" } }],
      "submittal_responses.update": [
        { data: { id: "response-1", response_status: "Revise and Resubmit" } },
      ],
      "submittals.update": [{ data: null }],
      "submittal_history.insert": [{ data: null }],
    });

    await expect(
      recordSubmittalWorkflowResponse({
        supabase: supabase as never,
        projectId: 25125,
        submittalId: "sub-1",
        stepId: "step-1",
        userId: "user-1",
        responseStatus: "Revise and Resubmit",
        comments: "AI review found a finish conflict.",
        where: "projects/[projectId]/submittals/[submittalId]/ai-review/workflow-response#POST",
      }),
    ).resolves.toEqual({
      id: "response-1",
      response_status: "Revise and Resubmit",
      notification: {
        status: "skipped",
        reason: "workflow_complete",
      },
    });

    const historyCall = supabase.calls.find(
      (call) => call.table === "submittal_history",
    );
    expect(historyCall?.payload).toMatchObject({
      action: "workflow_response_recorded",
      actor_id: "user-1",
      previous_status: "Open",
      new_status: "Closed",
      changes: {
        response_status: "Revise and Resubmit",
        comments_present: true,
      },
      metadata: {
        project_id: 25125,
        workflow_step_id: "step-1",
        response_id: "response-1",
        source: "ai_review",
      },
    });
  });

  it("records responses assigned to the signed-in user's linked person id", async () => {
    const supabase = new SupabaseMock({
      "submittals.select": [
        {
          data: {
            id: "sub-1",
            project_id: 25125,
            status: "Open",
            submittal_number: "SUB-001",
            title: "Door hardware",
          },
        },
      ],
      "submittal_workflow_steps.select": [
        { data: { id: "step-1" } },
        {
          data: [
            {
              id: "step-1",
              step_order: 1,
              step_type: "Reviewer",
              submittal_responses: [
                {
                  responder_id: "person-1",
                  response_status: "Approved as Noted",
                },
              ],
            },
          ],
        },
      ],
      "submittal_responses.select": [{ data: { id: "response-1" } }],
      "submittal_responses.update": [
        { data: { id: "response-1", response_status: "Approved as Noted" } },
      ],
      "submittals.update": [{ data: null }],
      "submittal_history.insert": [{ data: null }],
    });
    const identitySupabase = new SupabaseMock({
      "users_auth.select": [{ data: { person_id: "person-1" } }],
    });

    await expect(
      recordSubmittalWorkflowResponse({
        supabase: supabase as never,
        notificationSupabase: identitySupabase as never,
        projectId: 25125,
        submittalId: "sub-1",
        stepId: "step-1",
        userId: "auth-user-1",
        responseStatus: "Approved as Noted",
        comments: null,
        where:
          "projects/[projectId]/submittals/[submittalId]/workflow-steps/[stepId]/respond#POST",
      }),
    ).resolves.toMatchObject({
      id: "response-1",
      response_status: "Approved as Noted",
    });

    const assignedResponseCall = supabase.calls.find(
      (call) =>
        call.table === "submittal_responses" &&
        call.operation === "select",
    );
    expect(assignedResponseCall?.filters).toContainEqual([
      "responder_id",
      ["auth-user-1", "person-1"],
    ]);
  });

  it("creates a next responder notification when workflow advances", async () => {
    const supabase = new SupabaseMock({
      "submittals.select": [
        {
          data: {
            id: "sub-1",
            project_id: 25125,
            status: "Open",
            submittal_number: "SUB-002",
            title: "Storefront glazing",
          },
        },
      ],
      "submittal_workflow_steps.select": [
        { data: { id: "step-1" } },
        {
          data: [
            {
              id: "step-1",
              step_order: 1,
              step_type: "Reviewer",
              submittal_responses: [
                { responder_id: "user-1", response_status: "Approved" },
              ],
            },
            {
              id: "step-2",
              step_order: 2,
              step_type: "Approver",
              submittal_responses: [
                { responder_id: "user-2", response_status: "Pending" },
              ],
            },
          ],
        },
      ],
      "submittal_responses.select": [{ data: { id: "response-1" } }],
      "submittal_responses.update": [
        { data: { id: "response-1", response_status: "Approved" } },
      ],
      "submittals.update": [{ data: null }],
      "submittal_history.insert": [{ data: null }],
      "collaboration_notifications.insert": [{ data: null }],
      "submittal_project_settings.select": [{ data: null }],
      "user_profiles.select": [
        { data: { full_name: "Next Reviewer", email: "next@example.com" } },
        { data: { full_name: "Current Reviewer", email: "current@example.com" } },
      ],
      "projects.select": [{ data: { name: "Goodwill Noblesville" } }],
    });
    const emailSender = jest.fn().mockResolvedValue({
      id: "email-1",
      error: null,
    });

    const result = await recordSubmittalWorkflowResponse({
      supabase: supabase as never,
      notificationSupabase: supabase as never,
      emailSender,
      projectId: 25125,
      submittalId: "sub-1",
      stepId: "step-1",
      userId: "user-1",
      responseStatus: "Approved",
      comments: null,
      where: "workflow-response-test",
    });

    expect(result.notification).toMatchObject({
      status: "created",
      userId: "user-2",
      email: {
        status: "sent",
        id: "email-1",
      },
    });
    expect(emailSender).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "submittal-notification",
        to: "next@example.com",
        subject: "SUB-002 response needed - Storefront glazing",
        entity: { type: "submittal", id: "sub-1" },
        userId: "user-2",
        metadata: expect.objectContaining({
          project_id: 25125,
          submittal_id: "sub-1",
          response_id: "response-1",
          workflow_step_id: "step-2",
          previous_workflow_step_id: "step-1",
        }),
      }),
    );

    const notificationCall = supabase.calls.find(
      (call) => call.table === "collaboration_notifications",
    );
    expect(notificationCall?.payload).toMatchObject({
      user_id: "user-2",
      actor_id: "user-1",
      project_id: 25125,
      entity_type: "submittal",
      entity_id: "sub-1",
      kind: "submittal_workflow_action",
      title: "Submittal response needed",
      body: "SUB-002 - Storefront glazing",
      metadata: {
        source: "workflow",
        response_id: "response-1",
        previous_workflow_step_id: "step-1",
        workflow_step_id: "step-2",
        workflow_step_type: "Approver",
        response_status: "Approved",
      },
    });
  });

  it("skips workflow email when the next responder has no email", async () => {
    const supabase = new SupabaseMock({
      "submittals.select": [
        {
          data: {
            id: "sub-1",
            project_id: 25125,
            status: "Open",
            submittal_number: "SUB-005",
            title: "Access panels",
          },
        },
      ],
      "submittal_workflow_steps.select": [
        { data: { id: "step-1" } },
        {
          data: [
            {
              id: "step-1",
              step_order: 1,
              step_type: "Reviewer",
              submittal_responses: [
                { responder_id: "user-1", response_status: "Approved" },
              ],
            },
            {
              id: "step-2",
              step_order: 2,
              step_type: "Approver",
              submittal_responses: [
                { responder_id: "user-2", response_status: "Pending" },
              ],
            },
          ],
        },
      ],
      "submittal_responses.select": [{ data: { id: "response-1" } }],
      "submittal_responses.update": [
        { data: { id: "response-1", response_status: "Approved" } },
      ],
      "submittals.update": [{ data: null }],
      "submittal_history.insert": [{ data: null }],
      "collaboration_notifications.insert": [{ data: null }],
      "submittal_project_settings.select": [{ data: null }],
      "user_profiles.select": [
        { data: { full_name: "Next Reviewer", email: null } },
        { data: { full_name: "Current Reviewer", email: "current@example.com" } },
      ],
      "projects.select": [{ data: { name: "Goodwill Noblesville" } }],
    });
    const emailSender = jest.fn();

    const result = await recordSubmittalWorkflowResponse({
      supabase: supabase as never,
      notificationSupabase: supabase as never,
      emailSender,
      projectId: 25125,
      submittalId: "sub-1",
      stepId: "step-1",
      userId: "user-1",
      responseStatus: "Approved",
      comments: null,
      where: "workflow-response-test",
    });

    expect(result.notification).toMatchObject({
      status: "created",
      userId: "user-2",
      email: {
        status: "skipped",
        reason: "missing_recipient_email",
      },
    });
    expect(emailSender).not.toHaveBeenCalled();
  });

  it("skips workflow email when project submittal update emails are disabled", async () => {
    const supabase = new SupabaseMock({
      "submittals.select": [
        {
          data: {
            id: "sub-1",
            project_id: 25125,
            status: "Open",
            submittal_number: "SUB-007",
            title: "Lighting controls",
          },
        },
      ],
      "submittal_workflow_steps.select": [
        { data: { id: "step-1" } },
        {
          data: [
            {
              id: "step-1",
              step_order: 1,
              step_type: "Reviewer",
              submittal_responses: [
                { responder_id: "user-1", response_status: "Approved" },
              ],
            },
            {
              id: "step-2",
              step_order: 2,
              step_type: "Approver",
              submittal_responses: [
                { responder_id: "user-2", response_status: "Pending" },
              ],
            },
          ],
        },
      ],
      "submittal_responses.select": [{ data: { id: "response-1" } }],
      "submittal_responses.update": [
        { data: { id: "response-1", response_status: "Approved" } },
      ],
      "submittals.update": [{ data: null }],
      "submittal_history.insert": [{ data: null }],
      "collaboration_notifications.insert": [{ data: null }],
      "submittal_project_settings.select": [
        { data: { email_notify_submittal_updated: false } },
      ],
    });
    const emailSender = jest.fn();

    const result = await recordSubmittalWorkflowResponse({
      supabase: supabase as never,
      notificationSupabase: supabase as never,
      emailSender,
      projectId: 25125,
      submittalId: "sub-1",
      stepId: "step-1",
      userId: "user-1",
      responseStatus: "Approved",
      comments: null,
      where: "workflow-response-test",
    });

    expect(result.notification).toMatchObject({
      status: "created",
      userId: "user-2",
      email: {
        status: "skipped",
        reason: "project_email_disabled",
      },
    });
    expect(emailSender).not.toHaveBeenCalled();
  });

  it("records workflow email failures in submittal history", async () => {
    const supabase = new SupabaseMock({
      "submittals.select": [
        {
          data: {
            id: "sub-1",
            project_id: 25125,
            status: "Open",
            submittal_number: "SUB-006",
            title: "Roof hatch",
          },
        },
      ],
      "submittal_workflow_steps.select": [
        { data: { id: "step-1" } },
        {
          data: [
            {
              id: "step-1",
              step_order: 1,
              step_type: "Reviewer",
              submittal_responses: [
                { responder_id: "user-1", response_status: "Approved" },
              ],
            },
            {
              id: "step-2",
              step_order: 2,
              step_type: "Approver",
              submittal_responses: [
                { responder_id: "user-2", response_status: "Pending" },
              ],
            },
          ],
        },
      ],
      "submittal_responses.select": [{ data: { id: "response-1" } }],
      "submittal_responses.update": [
        { data: { id: "response-1", response_status: "Approved" } },
      ],
      "submittals.update": [{ data: null }],
      "submittal_history.insert": [{ data: null }, { data: null }],
      "collaboration_notifications.insert": [{ data: null }],
      "submittal_project_settings.select": [{ data: null }],
      "user_profiles.select": [
        { data: { full_name: "Next Reviewer", email: "next@example.com" } },
        { data: { full_name: "Current Reviewer", email: "current@example.com" } },
      ],
      "projects.select": [{ data: { name: "Goodwill Noblesville" } }],
    });
    const emailSender = jest.fn().mockResolvedValue({
      id: null,
      error: { message: "resend unavailable" },
    });

    const result = await recordSubmittalWorkflowResponse({
      supabase: supabase as never,
      notificationSupabase: supabase as never,
      emailSender,
      projectId: 25125,
      submittalId: "sub-1",
      stepId: "step-1",
      userId: "user-1",
      responseStatus: "Approved",
      comments: null,
      where: "workflow-response-test",
    });

    expect(result.notification).toMatchObject({
      status: "created",
      userId: "user-2",
      email: {
        status: "failed",
        error: "resend unavailable",
      },
    });

    const emailFailureHistoryCall = supabase.calls
      .filter((call) => call.table === "submittal_history")
      .find(
        (call) =>
          (call.payload as { action?: string }).action ===
          "workflow_email_failed",
      );
    expect(emailFailureHistoryCall?.payload).toMatchObject({
      action: "workflow_email_failed",
      actor_id: "user-1",
      actor_type: "system",
      changes: {
        email_status: "failed",
        target_user_id: "user-2",
      },
      metadata: {
        project_id: 25125,
        workflow_step_id: "step-1",
        next_workflow_step_id: "step-2",
        response_id: "response-1",
        target_user_id: "user-2",
        error: "resend unavailable",
        source: "workflow",
      },
    });
  });

  it("records settings lookup failures before workflow email", async () => {
    const supabase = new SupabaseMock({
      "submittals.select": [
        {
          data: {
            id: "sub-1",
            project_id: 25125,
            status: "Open",
            submittal_number: "SUB-008",
            title: "Fire alarm panel",
          },
        },
      ],
      "submittal_workflow_steps.select": [
        { data: { id: "step-1" } },
        {
          data: [
            {
              id: "step-1",
              step_order: 1,
              step_type: "Reviewer",
              submittal_responses: [
                { responder_id: "user-1", response_status: "Approved" },
              ],
            },
            {
              id: "step-2",
              step_order: 2,
              step_type: "Approver",
              submittal_responses: [
                { responder_id: "user-2", response_status: "Pending" },
              ],
            },
          ],
        },
      ],
      "submittal_responses.select": [{ data: { id: "response-1" } }],
      "submittal_responses.update": [
        { data: { id: "response-1", response_status: "Approved" } },
      ],
      "submittals.update": [{ data: null }],
      "submittal_history.insert": [{ data: null }, { data: null }],
      "collaboration_notifications.insert": [{ data: null }],
      "submittal_project_settings.select": [
        { error: { message: "settings unavailable" } },
      ],
    });
    const emailSender = jest.fn();

    const result = await recordSubmittalWorkflowResponse({
      supabase: supabase as never,
      notificationSupabase: supabase as never,
      emailSender,
      projectId: 25125,
      submittalId: "sub-1",
      stepId: "step-1",
      userId: "user-1",
      responseStatus: "Approved",
      comments: null,
      where: "workflow-response-test",
    });

    expect(result.notification).toMatchObject({
      status: "created",
      userId: "user-2",
      email: {
        status: "failed",
        error: "settings unavailable",
      },
    });
    expect(emailSender).not.toHaveBeenCalled();

    const emailFailureHistoryCall = supabase.calls
      .filter((call) => call.table === "submittal_history")
      .find(
        (call) =>
          (call.payload as { action?: string }).action ===
          "workflow_email_failed",
      );
    expect(emailFailureHistoryCall?.payload).toMatchObject({
      action: "workflow_email_failed",
      metadata: {
        error: "settings unavailable",
        response_id: "response-1",
        source: "workflow",
      },
    });
  });

  it("records notification delivery failures in submittal history", async () => {
    const supabase = new SupabaseMock({
      "submittals.select": [
        {
          data: {
            id: "sub-1",
            project_id: 25125,
            status: "Open",
            submittal_number: "SUB-003",
            title: "Millwork samples",
          },
        },
      ],
      "submittal_workflow_steps.select": [
        { data: { id: "step-1" } },
        {
          data: [
            {
              id: "step-1",
              step_order: 1,
              step_type: "Reviewer",
              submittal_responses: [
                { responder_id: "user-1", response_status: "Approved" },
              ],
            },
            {
              id: "step-2",
              step_order: 2,
              step_type: "Approver",
              submittal_responses: [
                { responder_id: "user-2", response_status: "Pending" },
              ],
            },
          ],
        },
      ],
      "submittal_responses.select": [{ data: { id: "response-1" } }],
      "submittal_responses.update": [
        { data: { id: "response-1", response_status: "Approved" } },
      ],
      "submittals.update": [{ data: null }],
      "submittal_history.insert": [{ data: null }, { data: null }],
      "collaboration_notifications.insert": [
        { error: { message: "notification insert failed" } },
      ],
    });

    const result = await recordSubmittalWorkflowResponse({
      supabase: supabase as never,
      notificationSupabase: supabase as never,
      projectId: 25125,
      submittalId: "sub-1",
      stepId: "step-1",
      userId: "user-1",
      responseStatus: "Approved",
      comments: null,
      where: "workflow-response-test",
    });

    expect(result.notification).toMatchObject({
      status: "failed",
      userId: "user-2",
      error: "notification insert failed",
    });

    const failureHistoryCall = supabase.calls
      .filter((call) => call.table === "submittal_history")
      .find(
        (call) =>
          (call.payload as { action?: string }).action ===
          "workflow_notification_failed",
      );
    expect(failureHistoryCall?.payload).toMatchObject({
      action: "workflow_notification_failed",
      actor_id: "user-1",
      actor_type: "system",
      changes: {
        notification_status: "failed",
        target_user_id: "user-2",
      },
      metadata: {
        project_id: 25125,
        workflow_step_id: "step-1",
        next_workflow_step_id: "step-2",
        response_id: "response-1",
        target_user_id: "user-2",
        error: "notification insert failed",
        source: "workflow",
      },
    });
  });

  it("fails loudly when the history entry cannot be written", async () => {
    const supabase = new SupabaseMock({
      "submittals.select": [
        {
          data: {
            id: "sub-1",
            project_id: 25125,
            status: "Open",
            submittal_number: "SUB-004",
            title: "Finish sample",
          },
        },
      ],
      "submittal_workflow_steps.select": [
        { data: { id: "step-1" } },
        {
          data: [
            {
              id: "step-1",
              step_order: 1,
              step_type: "Reviewer",
              submittal_responses: [
                { responder_id: "user-1", response_status: "Approved" },
              ],
            },
          ],
        },
      ],
      "submittal_responses.select": [{ data: { id: "response-1" } }],
      "submittal_responses.update": [
        { data: { id: "response-1", response_status: "Approved" } },
      ],
      "submittals.update": [{ data: null }],
      "submittal_history.insert": [
        { error: { message: "history insert failed" } },
      ],
    });

    await expect(
      recordSubmittalWorkflowResponse({
        supabase: supabase as never,
        projectId: 25125,
        submittalId: "sub-1",
        stepId: "step-1",
        userId: "user-1",
        responseStatus: "Approved",
        comments: null,
        where: "workflow-response-test",
      }),
    ).rejects.toMatchObject<Partial<GuardrailError>>({
      code: "DB_ERROR",
      message:
        "Could not write submittal workflow response history: history insert failed",
    });
  });
});
