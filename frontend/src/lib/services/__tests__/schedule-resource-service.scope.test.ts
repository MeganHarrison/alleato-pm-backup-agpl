import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { ScheduleResourceService } from "../schedule-resource-service";

type QueryResult = { data: unknown; error: null; count?: number | null };

function query(result: QueryResult) {
  const builder = {
    select: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    or: jest.fn(),
    order: jest.fn(),
    range: jest.fn(),
    then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.or.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.range.mockReturnValue(builder);
  return builder;
}

function pagedQuery(results: QueryResult[]) {
  let activeResult = results[0] ?? { data: [], error: null };
  const builder = query(activeResult);
  builder.range.mockImplementation((from: number) => {
    activeResult = results[Math.floor(from / 500)] ?? { data: [], error: null };
    return builder;
  });
  builder.then = (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(activeResult).then(resolve, reject);
  return builder;
}

describe("ScheduleResourceService project scope", () => {
  it("scopes every project-owned roster query and excludes inactive candidates", async () => {
    const memberships = query({
      data: [
        { project_id: 67, person_id: "11111111-1111-4111-8111-111111111111", status: "active" },
        { project_id: 67, person_id: "22222222-2222-4222-8222-222222222222", status: "inactive" },
      ],
      error: null,
    });
    const resources = query({
      data: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", project_id: 67, person_id: "22222222-2222-4222-8222-222222222222" }],
      error: null,
    });
    const assignments = query({
      data: [{
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        project_id: 67,
        task_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        resource_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        allocation_percent: 50,
      }],
      error: null,
    });
    const legacy = query({ data: null, error: null, count: 2 });
    const people = query({
      data: [
        { id: "11111111-1111-4111-8111-111111111111", first_name: "Active", last_name: "Person", email: "active@example.com", job_title: null, status: "active" },
        { id: "22222222-2222-4222-8222-222222222222", first_name: "Former", last_name: "Member", email: null, job_title: "Superintendent", status: "active" },
      ],
      error: null,
    });
    const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
    const tables = {
      project_directory_memberships: memberships,
      schedule_resources: resources,
      schedule_task_assignments: assignments,
      schedule_tasks: legacy,
      people,
    };
    const from = jest.fn((table: keyof typeof tables) => tables[table]);
    const service = new ScheduleResourceService({ from, rpc } as unknown as SupabaseClient<Database>);

    const result = await service.getProjectRoster(67);

    expect(memberships.eq).toHaveBeenCalledWith("project_id", 67);
    expect(resources.eq).toHaveBeenCalledWith("project_id", 67);
    expect(assignments.eq).toHaveBeenCalledWith("project_id", 67);
    expect(memberships.range).toHaveBeenCalledWith(0, 499);
    expect(resources.range).toHaveBeenCalledWith(0, 499);
    expect(assignments.range).toHaveBeenCalledWith(0, 499);
    expect(legacy.eq).toHaveBeenCalledWith("project_id", 67);
    expect(result.candidates).toEqual([
      expect.objectContaining({ display_name: "Active Person", resource_id: null }),
    ]);
    expect(result.resources).toEqual([
      expect.objectContaining({ display_name: "Former Member", eligible: false, membership_status: "inactive" }),
    ]);
    expect(result.assignments).toEqual([
      expect.objectContaining({ person_id: "22222222-2222-4222-8222-222222222222", allocation_percent: 50 }),
    ]);
    expect(result.legacy_assignment_count).toBe(2);
    expect(result.can_manage).toBe(true);
  });

  it("paginates project rows and chunks people lookups below URL limits", async () => {
    const membershipRows = Array.from({ length: 501 }, (_, index) => ({
      project_id: 67,
      person_id: `person-${String(index).padStart(4, "0")}`,
      status: "active",
    }));
    const peopleRows = membershipRows.map((membership, index) => ({
      id: membership.person_id,
      first_name: "Person",
      last_name: String(index),
      email: null,
      job_title: null,
      status: "active",
    }));
    const memberships = pagedQuery([
      { data: membershipRows.slice(0, 500), error: null },
      { data: membershipRows.slice(500), error: null },
    ]);
    const emptyResources = query({ data: [], error: null });
    const emptyAssignments = query({ data: [], error: null });
    const legacy = query({ data: null, error: null, count: 0 });
    const people = query({ data: [], error: null });
    let selectedPeople: typeof peopleRows = [];
    people.in.mockImplementation((_column: string, ids: string[]) => {
      selectedPeople = peopleRows.filter((person) => ids.includes(person.id));
      return people;
    });
    people.then = (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: selectedPeople, error: null }).then(resolve, reject);
    const tables = {
      project_directory_memberships: memberships,
      schedule_resources: emptyResources,
      schedule_task_assignments: emptyAssignments,
      schedule_tasks: legacy,
      people,
    };
    const service = new ScheduleResourceService({
      from: jest.fn((table: keyof typeof tables) => tables[table]),
      rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
    } as unknown as SupabaseClient<Database>);

    const result = await service.getProjectRoster(67);

    expect(result.candidates).toHaveLength(501);
    expect(memberships.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(memberships.range).toHaveBeenNthCalledWith(2, 500, 999);
    expect(people.in).toHaveBeenCalledTimes(6);
    expect(people.in.mock.calls.every(([, ids]) => ids.length <= 100)).toBe(true);
  });

  it("fails loudly if a project-owned query returns a row from another project", async () => {
    const empty = query({ data: [], error: null });
    const resources = query({
      data: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", project_id: 68, person_id: "11111111-1111-4111-8111-111111111111" }],
      error: null,
    });
    const legacy = query({ data: null, error: null, count: 0 });
    const tables = {
      project_directory_memberships: empty,
      schedule_resources: resources,
      schedule_task_assignments: empty,
      schedule_tasks: legacy,
      people: empty,
    };
    const service = new ScheduleResourceService({
      from: jest.fn((table: keyof typeof tables) => tables[table]),
      rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
    } as unknown as SupabaseClient<Database>);

    await expect(service.getProjectRoster(67)).rejects.toThrow("outside project 67");
  });

  it("replaces assignments through one guarded RPC and returns the refreshed task set", async () => {
    const empty = query({ data: [], error: null });
    const legacy = query({ data: null, error: null, count: 0 });
    const assignmentRows = query({
      data: [{
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        project_id: 67,
        task_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        resource_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        allocation_percent: 75,
      }],
      error: null,
    });
    const resourceRows = query({
      data: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", project_id: 67, person_id: "11111111-1111-4111-8111-111111111111" }],
      error: null,
    });
    const membershipRows = query({ data: [{ project_id: 67, person_id: "11111111-1111-4111-8111-111111111111", status: "active" }], error: null });
    const peopleRows = query({ data: [{ id: "11111111-1111-4111-8111-111111111111", first_name: "Active", last_name: "Person", email: null, job_title: null, status: "active" }], error: null });
    const tables = {
      project_directory_memberships: membershipRows,
      schedule_resources: resourceRows,
      schedule_task_assignments: assignmentRows,
      schedule_tasks: legacy,
      people: peopleRows,
    };
    const rpc = jest.fn().mockResolvedValueOnce({ data: [], error: null });
    const service = new ScheduleResourceService({
      from: jest.fn((table: keyof typeof tables) => tables[table]),
      rpc,
    } as unknown as SupabaseClient<Database>);

    const result = await service.replaceTaskAssignments(
      67,
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      [{ person_id: "11111111-1111-4111-8111-111111111111", allocation_percent: 75 }],
    );

    expect(rpc).toHaveBeenNthCalledWith(1, "replace_schedule_task_assignments", {
      p_project_id: 67,
      p_task_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      p_assignments: [{ person_id: "11111111-1111-4111-8111-111111111111", allocation_percent: 75 }],
    });
    expect(result).toEqual([expect.objectContaining({ allocation_percent: 75 })]);
  });
});
