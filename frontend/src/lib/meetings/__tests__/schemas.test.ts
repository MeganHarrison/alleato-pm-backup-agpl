import {
  createCategorySchema,
  createItemSchema,
  createItemTaskSchema,
  createMeetingSchema,
  reorderSchema,
  updateItemSchema,
  updateMeetingSchema,
} from "../schemas";

describe("createMeetingSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = createMeetingSchema.safeParse({ name: "Weekly Sync" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createMeetingSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts the full optional field set", () => {
    const result = createMeetingSchema.safeParse({
      name: "Weekly Sync",
      series_name: "Weekly Sync Series",
      meeting_date: "2026-07-01",
      timezone: "America/Indiana/Indianapolis",
      start_time: "09:00",
      end_time: "10:00",
      location: "Job trailer",
      meeting_link: "https://zoom.us/j/123",
      is_private: true,
      is_draft: false,
      overview: "Weekly project sync",
      attendee_person_ids: ["11111111-1111-4111-8111-111111111111"],
      template_id: "22222222-2222-4222-8222-222222222222",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid attendee id", () => {
    const result = createMeetingSchema.safeParse({
      name: "Weekly Sync",
      attendee_person_ids: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed meeting_date", () => {
    const result = createMeetingSchema.safeParse({
      name: "Weekly Sync",
      meeting_date: "07/01/2026",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid YYYY-MM-DD meeting_date", () => {
    const result = createMeetingSchema.safeParse({
      name: "Weekly Sync",
      meeting_date: "2026-07-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed start_time", () => {
    const result = createMeetingSchema.safeParse({
      name: "Weekly Sync",
      start_time: "9am",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid HH:MM start_time", () => {
    const result = createMeetingSchema.safeParse({
      name: "Weekly Sync",
      start_time: "09:30",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid HH:MM:SS end_time", () => {
    const result = createMeetingSchema.safeParse({
      name: "Weekly Sync",
      end_time: "10:30:45",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateMeetingSchema", () => {
  it("accepts a partial payload with a single field", () => {
    const result = updateMeetingSchema.safeParse({ name: "Renamed" });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (partial allows no-op)", () => {
    const result = updateMeetingSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("createCategorySchema", () => {
  it("requires a non-empty name", () => {
    expect(createCategorySchema.safeParse({ name: "Uncategorized" }).success).toBe(true);
    expect(createCategorySchema.safeParse({ name: "" }).success).toBe(false);
    expect(createCategorySchema.safeParse({}).success).toBe(false);
  });
});

describe("reorderSchema", () => {
  it("accepts a list of uuids", () => {
    const result = reorderSchema.safeParse({
      ordered_ids: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-array", () => {
    const result = reorderSchema.safeParse({ ordered_ids: "not-an-array" });
    expect(result.success).toBe(false);
  });
});

describe("createItemSchema", () => {
  it("requires category_id and title", () => {
    const result = createItemSchema.safeParse({
      category_id: "11111111-1111-4111-8111-111111111111",
      title: "Discuss budget",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing category_id", () => {
    const result = createItemSchema.safeParse({ title: "Discuss budget" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status enum value", () => {
    const result = createItemSchema.safeParse({
      category_id: "11111111-1111-4111-8111-111111111111",
      title: "Discuss budget",
      status: "not-a-status",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the documented status and priority values", () => {
    for (const status of ["open", "in_progress", "closed"]) {
      expect(
        createItemSchema.safeParse({
          category_id: "11111111-1111-4111-8111-111111111111",
          title: "x",
          status,
        }).success,
      ).toBe(true);
    }
    for (const priority of ["low", "medium", "high"]) {
      expect(
        createItemSchema.safeParse({
          category_id: "11111111-1111-4111-8111-111111111111",
          title: "x",
          priority,
        }).success,
      ).toBe(true);
    }
  });

  it("rejects a malformed due_date", () => {
    const result = createItemSchema.safeParse({
      category_id: "11111111-1111-4111-8111-111111111111",
      title: "Discuss budget",
      due_date: "07/15/2026",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid YYYY-MM-DD due_date", () => {
    const result = createItemSchema.safeParse({
      category_id: "11111111-1111-4111-8111-111111111111",
      title: "Discuss budget",
      due_date: "2026-07-15",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateItemSchema", () => {
  it("accepts a single-field partial update", () => {
    const result = updateItemSchema.safeParse({ title: "Renamed item" });
    expect(result.success).toBe(true);
  });

  it("refuses an empty object", () => {
    const result = updateItemSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts official_minutes on its own", () => {
    const result = updateItemSchema.safeParse({ official_minutes: "Resolved in meeting" });
    expect(result.success).toBe(true);
  });
});

describe("createItemTaskSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = createItemTaskSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts the full optional field set", () => {
    const result = createItemTaskSchema.safeParse({
      title: "Follow up with vendor",
      description: "Call about pricing",
      assignee_person_id: "11111111-1111-4111-8111-111111111111",
      due_date: "2026-07-15",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null owner and due date overrides", () => {
    const result = createItemTaskSchema.safeParse({
      title: "Follow up with vendor",
      assignee_person_id: null,
      due_date: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid assignee_person_id", () => {
    const result = createItemTaskSchema.safeParse({ assignee_person_id: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed due_date", () => {
    const result = createItemTaskSchema.safeParse({
      title: "Follow up",
      due_date: "07/15/2026",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid YYYY-MM-DD due_date", () => {
    const result = createItemTaskSchema.safeParse({
      title: "Follow up",
      due_date: "2026-07-15",
    });
    expect(result.success).toBe(true);
  });
});
