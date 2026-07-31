import {
  PlaneIntakeActionRequestSchema,
  buildPlaneIntakeState,
  isProjectScopedTask,
  mergePlaneIntakeMetadata,
  outlookSourceKey,
} from "./contracts";

describe("Plane Intake action contracts", () => {
  const now = "2026-07-31T12:00:00.000Z";

  it("requires a future ISO timestamp for snooze", () => {
    const result = PlaneIntakeActionRequestSchema.safeParse({
      source: "task",
      sourceId: "1f665092-2708-4bc0-987d-296a698b0114",
      projectId: 31,
      action: "snooze",
      snoozeUntil: "2020-01-01T12:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("rejects marking a task as a duplicate of itself", () => {
    const taskId = "1f665092-2708-4bc0-987d-296a698b0114";
    const result = PlaneIntakeActionRequestSchema.safeParse({
      source: "task",
      sourceId: taskId,
      projectId: 31,
      action: "duplicate",
      duplicateTaskId: taskId,
    });

    expect(result.success).toBe(false);
  });

  it.each(["42.5", "0042", " 42 ", "0", "9007199254740992"])(
    "rejects invalid Outlook source ID %s",
    (sourceId) => {
      expect(
        PlaneIntakeActionRequestSchema.safeParse({
          source: "outlook",
          sourceId,
          projectId: 31,
          action: "decline",
        }).success,
      ).toBe(false);
    },
  );

  it("rejects non-UUID task source IDs", () => {
    expect(
      PlaneIntakeActionRequestSchema.safeParse({
        source: "task",
        sourceId: "not-a-task-uuid",
        projectId: 31,
        action: "decline",
      }).success,
    ).toBe(false);
  });

  it("preserves unrelated metadata while recording a decline", () => {
    const request = PlaneIntakeActionRequestSchema.parse({
      source: "outlook",
      sourceId: "42",
      projectId: 31,
      action: "decline",
    });
    const state = buildPlaneIntakeState(request, "user-1", now);

    expect(mergePlaneIntakeMetadata({ existing: "value" }, state)).toEqual({
      existing: "value",
      plane_intake: {
        decision: "declined",
        snoozed_till: null,
        duplicate_task_id: null,
        accepted_task_id: null,
        resolved_at: now,
        updated_at: now,
        updated_by: "user-1",
      },
    });
  });

  it("stores duplicate resolution and clears snooze state", () => {
    const targetId = "a42e005f-a01c-4bc4-8c68-2a134a867489";
    const request = PlaneIntakeActionRequestSchema.parse({
      source: "outlook",
      sourceId: "42",
      projectId: 31,
      action: "duplicate",
      duplicateTaskId: targetId,
    });

    expect(buildPlaneIntakeState(request, "user-1", now)).toMatchObject({
      decision: "duplicate",
      duplicate_task_id: targetId,
      snoozed_till: null,
      resolved_at: now,
    });
  });

  it("recognizes both canonical task project ownership shapes", () => {
    expect(isProjectScopedTask(31, { project_id: 31, project_ids: null })).toBe(
      true,
    );
    expect(
      isProjectScopedTask(31, { project_id: null, project_ids: [12, 31] }),
    ).toBe(true);
    expect(isProjectScopedTask(31, { project_id: 12, project_ids: [12] })).toBe(
      false,
    );
  });

  it("uses a deterministic Outlook source key for idempotent acceptance", () => {
    expect(outlookSourceKey(42)).toBe("outlook-intake:42");
  });
});
