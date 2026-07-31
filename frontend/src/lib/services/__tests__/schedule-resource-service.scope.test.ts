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

function serviceClient(from: jest.Mock, rpc: jest.Mock): SupabaseClient<Database> {
  const client = Object.create(null) as SupabaseClient<Database>;
  Object.assign(client, { from, rpc });
  return client;
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
        cost_version: 3,
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
      [{
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        person_id: "11111111-1111-4111-8111-111111111111",
        cost_version: 3,
      }],
    );

    expect(rpc).toHaveBeenNthCalledWith(1, "replace_schedule_task_assignments", {
      p_project_id: 67,
      p_task_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      p_assignments: [{ person_id: "11111111-1111-4111-8111-111111111111", allocation_percent: 75 }],
      p_expected_assignments: [{
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        person_id: "11111111-1111-4111-8111-111111111111",
        cost_version: 3,
      }],
    });
    expect(result).toEqual([expect.objectContaining({ allocation_percent: 75 })]);
  });

  it("loads person, equipment, and material cost facts within one project scope", async () => {
    const resources = query({
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          project_id: 67,
          person_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          resource_kind: "person",
          display_name: "Project Engineer",
          standard_rate: 75,
          cost_per_use: 0,
          rate_unit: "hour",
          cost_version: 2,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          project_id: 67,
          person_id: null,
          resource_kind: "equipment",
          display_name: "Tower crane",
          standard_rate: 900,
          cost_per_use: 250,
          rate_unit: "day",
          cost_version: 1,
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          project_id: 67,
          person_id: null,
          resource_kind: "material",
          display_name: "Structural steel",
          standard_rate: 1.25,
          cost_per_use: 0,
          rate_unit: "unit",
          cost_version: 4,
        },
      ],
      error: null,
    });
    const assignments = query({
      data: [{
        id: "44444444-4444-4444-8444-444444444444",
        project_id: 67,
        task_id: "55555555-5555-4555-8555-555555555555",
        resource_id: "33333333-3333-4333-8333-333333333333",
        allocation_percent: 100,
        planned_units: 400,
        actual_units: 250,
        actual_rate: 1.3,
        actual_cost: 325,
        cost_version: 3,
      }],
      error: null,
    });
    const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
    const tables = {
      schedule_resources: resources,
      schedule_task_assignments: assignments,
    };
    const service = new ScheduleResourceService(serviceClient(
      jest.fn((table: keyof typeof tables) => tables[table]),
      rpc,
    ));

    const result = await service.getCostModel(67);

    expect(resources.eq).toHaveBeenCalledWith("project_id", 67);
    expect(assignments.eq).toHaveBeenCalledWith("project_id", 67);
    expect(rpc).toHaveBeenCalledWith("current_can_manage_schedule", {
      p_project_id: 67,
    });
    expect(result.can_manage).toBe(true);
    expect(result.resources.map((resource) => resource.resource_kind)).toEqual([
      "person",
      "equipment",
      "material",
    ]);
    expect(result.assignments).toEqual([
      expect.objectContaining({
        planned_units: 400,
        actual_cost: 325,
        cost_version: 3,
      }),
    ]);
  });

  it("writes cost resources and assignments only through guarded CAS RPCs", async () => {
    const resource = {
      id: "33333333-3333-4333-8333-333333333333",
      project_id: 67,
      person_id: null,
      resource_kind: "material" as const,
      display_name: "Structural steel",
      standard_rate: 1.25,
      cost_per_use: 0,
      rate_unit: "unit" as const,
      cost_version: 5,
    };
    const assignment = {
      id: "44444444-4444-4444-8444-444444444444",
      project_id: 67,
      task_id: "55555555-5555-4555-8555-555555555555",
      resource_id: resource.id,
      allocation_percent: 100,
      planned_units: 400,
      actual_units: 250,
      actual_rate: 1.3,
      actual_cost: 325,
      cost_version: 4,
    };
    const rpc = jest
      .fn()
      .mockResolvedValueOnce({ data: resource, error: null })
      .mockResolvedValueOnce({ data: assignment, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    const service = new ScheduleResourceService(serviceClient(jest.fn(), rpc));

    await expect(
      service.upsertCostResource(67, {
        id: resource.id,
        resource_kind: "material",
        display_name: resource.display_name,
        standard_rate: 1.25,
        cost_per_use: 0,
        rate_unit: "unit",
        expected_cost_version: 4,
      }),
    ).resolves.toEqual(resource);
    await expect(
      service.upsertCostAssignment(67, {
        task_id: assignment.task_id,
        resource_id: resource.id,
        allocation_percent: 100,
        planned_units: 400,
        actual_units: 250,
        actual_rate: 1.3,
        actual_cost: 325,
        expected_cost_version: 3,
      }),
    ).resolves.toEqual(assignment);
    await service.deleteCostAssignment(67, assignment.id, 4);
    await service.deleteCostResource(67, resource.id, 5);

    expect(rpc).toHaveBeenNthCalledWith(1, "upsert_schedule_cost_resource", {
      p_project_id: 67,
      p_resource_id: resource.id,
      p_resource_kind: "material",
      p_display_name: "Structural steel",
      p_standard_rate: 1.25,
      p_cost_per_use: 0,
      p_rate_unit: "unit",
      p_expected_cost_version: 4,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "upsert_schedule_cost_assignment", {
      p_project_id: 67,
      p_task_id: assignment.task_id,
      p_resource_id: resource.id,
      p_allocation_percent: 100,
      p_planned_units: 400,
      p_actual_units: 250,
      p_actual_rate: 1.3,
      p_actual_cost: 325,
      p_expected_cost_version: 3,
    });
    expect(rpc).toHaveBeenNthCalledWith(3, "delete_schedule_cost_assignment", {
      p_project_id: 67,
      p_assignment_id: assignment.id,
      p_expected_cost_version: 4,
    });
    expect(rpc).toHaveBeenNthCalledWith(4, "delete_schedule_cost_resource", {
      p_project_id: 67,
      p_resource_id: resource.id,
      p_expected_cost_version: 5,
    });
  });
});
