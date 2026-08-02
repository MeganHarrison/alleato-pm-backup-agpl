import { buildAccountabilityAnalytics } from "../accountability";

describe("buildAccountabilityAnalytics", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");

  it("counts only exact Employee and Subcontractor classifications and keeps legacy types explicit", () => {
    const result = buildAccountabilityAnalytics({
      people: [
        { auth_user_id: "employee-1", first_name: "Ada", last_name: "Admin", person_type: "employee" },
        { auth_user_id: "subcontractor-1", first_name: "Sam", last_name: "Sub", person_type: "subcontractor" },
        { auth_user_id: "legacy-1", first_name: "Lee", last_name: "Legacy", person_type: "user" },
      ],
      profiles: [{ id: "employee-1", is_admin: true }],
      sessions: [],
      rangeDays: 30,
      now,
      isComplete: true,
    });

    expect(result.accountCounts).toEqual({ employees: 1, subcontractors: 1, admins: 1, unclassified: 1 });
  });

  it("uses authenticated sessions for current activity, previous-period delta, weekly trend, and recency", () => {
    const result = buildAccountabilityAnalytics({
      people: [
        { auth_user_id: "employee-1", first_name: "Ada", last_name: "Admin", person_type: "employee" },
        { auth_user_id: "employee-2", first_name: "Pat", last_name: "Project", person_type: "employee" },
        { auth_user_id: "legacy-1", first_name: "Lee", last_name: "Legacy", person_type: "user" },
      ],
      profiles: [],
      sessions: [
        { user_id: "employee-1", last_seen_at: "2026-07-30T10:00:00.000Z", entry_surface: "main" },
        { user_id: "employee-1", last_seen_at: "2026-07-29T10:00:00.000Z", entry_surface: "admin" },
        { user_id: "employee-2", last_seen_at: "2026-06-15T10:00:00.000Z", entry_surface: "main" },
        { user_id: "legacy-1", last_seen_at: "2026-07-31T10:00:00.000Z", entry_surface: "main" },
      ],
      rangeDays: 30,
      now,
      isComplete: true,
    });

    expect(result.activeEmployees).toBe(1);
    expect(result.activeEmployeeDelta).toBe(0);
    expect(result.recentActivity).toEqual([
      { userId: "employee-1", fullName: "Ada Admin", entrySurface: "main", lastSeenAt: "2026-07-30T10:00:00.000Z" },
    ]);
    expect(result.weeklyActivity.some((point) => point.activeEmployees === 1)).toBe(true);
  });
});
