import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL environment variable is not set");
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is not set");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function getUserIdByEmail(email: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new Error(`Failed to list users: ${error.message}`);
  }

  const user = data.users.find((candidate: { email?: string }) => candidate.email === email);

  if (!user) {
    throw new Error(`No user found for email ${email}`);
  }

  return user.id;
}

export async function createProject(name: string): Promise<number> {
  const creationRunId = `playwright-db-helper:${crypto.randomUUID()}`;
  const { data, error } = await supabase
    .from("projects")
    .insert({
      name,
      created_by: null,
      created_via: "automation",
      creation_request_id: null,
      creation_run_id: creationRunId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create project: ${error?.message}`);
  }

  return data.id as number;
}

export async function addProjectMember(
  projectId: number,
  userId: string,
  role: "admin" | "editor" | "owner" = "admin",
): Promise<void> {
  // Look up person_id from auth user ID via users_auth
  const { data: userAuth, error: lookupError } = await supabase
    .from("users_auth")
    .select("person_id")
    .eq("auth_user_id", userId)
    .limit(1);

  const personId = userAuth?.[0]?.person_id;

  if (lookupError || !personId) {
    throw new Error(
      `Failed to find person for auth user ${userId}: ${lookupError?.message ?? "not found"}`,
    );
  }

  const { error } = await supabase
    .from("project_directory_memberships")
    .insert({
      project_id: projectId,
      person_id: personId,
      role,
      user_type: "employee",
    });

  if (error) {
    throw new Error(`Failed to add project member: ${error.message}`);
  }
}

export interface SubcontractInput {
  project_id: number;
  contract_number: string;
  title?: string | null;
  status: string;
  executed?: boolean;
  contract_company_id?: string | null;
}

export async function createSubcontract(input: SubcontractInput) {
  const { data, error } = await supabase
    .from("subcontracts")
    .insert({
      executed: false,
      ...input,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create subcontract: ${error?.message}`);
  }

  return data;
}

export async function getSubcontract(id: string) {
  const { data, error } = await supabase
    .from("subcontracts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch subcontract: ${error?.message}`);
  }

  return data;
}

export async function listSubcontractsForProject(projectId: number) {
  const { data, error } = await supabase
    .from("subcontracts")
    .select("*")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list subcontracts: ${error.message}`);
  }

  return data ?? [];
}

export async function deleteSubcontractsByProject(projectId: number) {
  const { error } = await supabase
    .from("subcontracts")
    .delete()
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to delete subcontracts: ${error.message}`);
  }
}

export async function deletePurchaseOrdersByProject(projectId: number) {
  const { error } = await supabase
    .from("purchase_orders")
    .delete()
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to delete purchase orders: ${error.message}`);
  }
}

export interface ChangeOrderInput {
  project_id: number;
  co_number: string;
  title: string;
  description: string;
  status: string;
  amount?: number | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  submitted_by?: string | null;
  contract_id?: number | null;
  change_event_id?: string | null;
  designated_reviewer_id?: string | null;
}

export async function createChangeOrder(input: ChangeOrderInput) {
  const { data, error } = await supabase
    .from("change_orders")
    .insert(input)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create change order: ${error?.message}`);
  }

  return data;
}

export async function getChangeOrder(id: number) {
  const { data, error } = await supabase
    .from("change_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`Failed to fetch change order: ${error.message}`);
  }

  return data;
}

let adminClient: SupabaseClient | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getAdminClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return adminClient;
}

export async function fetchChangeEventById(changeEventId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('change_events')
    .select('*')
    .eq('id', changeEventId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch change event: ${error.message}`);
  }

  return data;
}

export async function listChangeOrdersForProject(projectId: number) {
  const { data, error } = await supabase
    .from("change_orders")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list change orders: ${error.message}`);
  }

  return data || [];
}

export async function countChangeOrdersForProject(projectId: number) {
  const { count, error } = await supabase
    .from("change_orders")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to count change orders: ${error.message}`);
  }

  return count || 0;
}

export async function fetchChangeEventByNumber(projectId: number, number: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('change_events')
    .select('*')
    .eq('project_id', projectId)
    .eq('number', number)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch change event by number: ${error.message}`);
  }

  return data;
}

export async function countChangeEvents(projectId: number) {
  const supabase = getAdminClient();
  const { count, error } = await supabase
    .from('change_events')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);

  if (error) {
    throw new Error(`Failed to count change events: ${error.message}`);
  }

  return count ?? 0;
}

export async function deleteChangeOrder(id: number) {
  const { error } = await supabase.from("change_orders").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete change order: ${error.message}`);
  }
}

export async function deleteChangeOrdersByProject(projectId: number) {
  const { error } = await supabase
    .from("change_orders")
    .delete()
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to delete change orders: ${error.message}`);
  }
}

export async function deleteProjectMembers(projectId: number) {
  const { error } = await supabase
    .from("project_directory_memberships")
    .delete()
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to delete project members: ${error.message}`);
  }
}

export async function deleteProject(projectId: number) {
  const { error } = await supabase.from("projects").delete().eq("id", projectId);

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }
}

// =============================================================================
// Meeting Helpers
// =============================================================================

export async function createMeeting(
  projectId: number,
  title: string,
  opts?: { date?: string; participants?: string; category?: string }
) {
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from("document_metadata")
    .insert({
      id,
      title,
      type: "meeting",
      project_id: projectId,
      date: opts?.date || new Date().toISOString(),
      participants: opts?.participants || null,
      category: opts?.category || null,
      status: "complete",
      access_level: "private",
      source: "e2e-test",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create meeting: ${error.message}`);
  }

  return data;
}

export async function deleteMeetingsByProject(projectId: number) {
  // Delete associated segments first
  const { data: meetings } = await supabase
    .from("document_metadata")
    .select("id")
    .eq("project_id", projectId)
    .eq("type", "meeting")
    .eq("source", "e2e-test");

  if (meetings && meetings.length > 0) {
    const meetingIds = meetings.map((m) => m.id);
    await supabase
      .from("meeting_segments")
      .delete()
      .in("metadata_id", meetingIds);

    await supabase
      .from("document_metadata")
      .delete()
      .in("id", meetingIds);
  }
}

export async function deleteMeeting(meetingId: string) {
  await supabase
    .from("meeting_segments")
    .delete()
    .eq("metadata_id", meetingId);

  const { error } = await supabase
    .from("document_metadata")
    .delete()
    .eq("id", meetingId);

  if (error) {
    throw new Error(`Failed to delete meeting: ${error.message}`);
  }
}

export async function listMeetingsForProject(projectId: number) {
  const { data, error } = await supabase
    .from("document_metadata")
    .select("*")
    .eq("project_id", projectId)
    .eq("type", "meeting")
    .order("date", { ascending: false });

  if (error) {
    throw new Error(`Failed to list meetings: ${error.message}`);
  }

  return data ?? [];
}

export async function fetchLineItems(changeEventId: string) {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('change_event_line_items')
    .select('*')
    .eq('change_event_id', changeEventId);

  if (error) {
    throw new Error(`Failed to fetch line items: ${error.message}`);
  }

  return data ?? [];
}

// =============================================================================
// Schedule Task Helpers
// =============================================================================

export interface ScheduleTaskInput {
  project_id: number;
  name: string;
  parent_task_id?: string | null;
  start_date?: string | null;
  finish_date?: string | null;
  duration_days?: number | null;
  percent_complete?: number;
  status?: string;
  is_milestone?: boolean;
  constraint_type?: string | null;
  constraint_date?: string | null;
  wbs_code?: string | null;
  sort_order?: number;
}

export async function createScheduleTask(input: ScheduleTaskInput) {
  const { data, error } = await supabase
    .from("schedule_tasks")
    .insert(input)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create schedule task: ${error?.message}`);
  }

  return data;
}

export async function deleteScheduleTask(id: string) {
  const { error } = await supabase
    .from("schedule_tasks")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete schedule task: ${error.message}`);
  }
}

export async function listScheduleTasksForProject(projectId: number) {
  const { data, error } = await supabase
    .from("schedule_tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to list schedule tasks: ${error.message}`);
  }

  return data ?? [];
}

export async function deleteScheduleTasksByProject(projectId: number) {
  const { error } = await supabase
    .from("schedule_tasks")
    .delete()
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to delete schedule tasks: ${error.message}`);
  }
}

export async function deleteScheduleTestTasks(projectId: number, prefix = "E2E-") {
  const { error } = await supabase
    .from("schedule_tasks")
    .delete()
    .eq("project_id", projectId)
    .like("name", `${prefix}%`);

  if (error) {
    throw new Error(`Failed to delete test schedule tasks: ${error.message}`);
  }
}

// =============================================================================
// Change Order Advanced Helpers
// =============================================================================

export async function updateChangeOrderStatus(
  id: number,
  status: string,
  additionalFields?: {
    submitted_at?: string;
    submitted_by?: string;
    approved_at?: string;
    approved_by?: string;
    rejection_reason?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("change_orders")
    .update({
      status,
      ...additionalFields,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to update change order status: ${error?.message}`);
  }

  return data;
}

export interface LineItemInput {
  change_event_id: string;
  description?: string | null;
  quantity?: number | null;
  unit_cost?: number | null;
  unit_of_measure?: string | null;
  cost_rom?: number | null;
  revenue_rom?: number | null;
  sort_order?: number;
}

export async function createChangeOrderLineItem(input: LineItemInput) {
  const { data, error } = await supabase
    .from("change_event_line_items")
    .insert({
      change_event_id: input.change_event_id,
      description: input.description,
      quantity: input.quantity,
      unit_cost: input.unit_cost,
      unit_of_measure: input.unit_of_measure,
      cost_rom: input.cost_rom,
      revenue_rom: input.revenue_rom,
      sort_order: input.sort_order ?? 0,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create line item: ${error?.message}`);
  }

  return data;
}

export async function updateChangeOrderLineItem(
  id: string,
  updates: Partial<LineItemInput>
) {
  const { data, error } = await supabase
    .from("change_event_line_items")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to update line item: ${error?.message}`);
  }

  return data;
}

export async function deleteChangeOrderLineItem(id: string) {
  const { error } = await supabase
    .from("change_event_line_items")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete line item: ${error.message}`);
  }
}

export async function deleteChangeOrderLineItems(changeEventId: string) {
  const { error } = await supabase
    .from("change_event_line_items")
    .delete()
    .eq("change_event_id", changeEventId);

  if (error) {
    throw new Error(`Failed to delete line items: ${error.message}`);
  }
}

// =============================================================================
// Change Order Lines Helpers (for change_order_lines table)
// =============================================================================

export interface ChangeOrderLineInput {
  change_order_id: number;
  project_id: number;
  cost_code_id: string;
  cost_type_id: string;
  amount?: number;
  description?: string | null;
  sub_job_id?: string | null;
}

export async function createChangeOrderLine(input: ChangeOrderLineInput) {
  const { data, error } = await supabase
    .from("change_order_lines")
    .insert(input)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create change order line: ${error?.message}`);
  }

  return data;
}

export async function fetchChangeOrderLines(changeOrderId: number) {
  const { data, error } = await supabase
    .from("change_order_lines")
    .select("*")
    .eq("change_order_id", changeOrderId);

  if (error) {
    throw new Error(`Failed to fetch change order lines: ${error.message}`);
  }

  return data ?? [];
}

export async function deleteChangeOrderLine(id: string) {
  const { error } = await supabase
    .from("change_order_lines")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete change order line: ${error.message}`);
  }
}

export async function deleteChangeOrderLinesByChangeOrder(changeOrderId: number) {
  const { error } = await supabase
    .from("change_order_lines")
    .delete()
    .eq("change_order_id", changeOrderId);

  if (error) {
    throw new Error(`Failed to delete change order lines: ${error.message}`);
  }
}

export async function deleteTestChangeOrders(projectId: number, prefix = "CO-E2E-") {
  const { error } = await supabase
    .from("change_orders")
    .delete()
    .eq("project_id", projectId)
    .like("co_number", `${prefix}%`);

  if (error) {
    throw new Error(`Failed to delete test change orders: ${error.message}`);
  }
}

/**
 * Ensures the test user has proper permissions to approve/reject change orders.
 * Creates users_auth entry and project_directory_membership if missing.
 */
export async function ensureTestUserPermissions(
  authUserId: string,
  projectId: number,
  role: "admin" | "editor" | "owner" = "admin"
): Promise<string> {
  // Check if users_auth entry exists
  let { data: userAuth } = await supabase
    .from("users_auth")
    .select("person_id")
    .eq("auth_user_id", authUserId)
    .single();

  let personId: string;

  if (!userAuth) {
    // Create a person for the test user
    const { data: person, error: personError } = await supabase
      .from("people")
      .insert({
        first_name: "Test",
        last_name: "User",
        email: "test1@mail.com",
        is_active: true,
      })
      .select("id")
      .single();

    if (personError) {
      // Person might already exist, try to find it
      const { data: existingPerson } = await supabase
        .from("people")
        .select("id")
        .eq("email", "test1@mail.com")
        .single();

      if (!existingPerson) {
        throw new Error(`Failed to create person: ${personError.message}`);
      }
      personId = existingPerson.id;
    } else {
      personId = person.id;
    }

    // Create users_auth link
    await supabase
      .from("users_auth")
      .upsert({
        auth_user_id: authUserId,
        person_id: personId,
      });
  } else {
    personId = userAuth.person_id;
  }

  // Ensure project membership exists
  const { data: membership } = await supabase
    .from("project_directory_memberships")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("person_id", personId)
    .single();

  if (!membership) {
    // Create membership
    await supabase
      .from("project_directory_memberships")
      .insert({
        project_id: projectId,
        person_id: personId,
        role,
        user_type: "employee",
        status: "active",
      });
  } else if (membership.status !== "active") {
    // Update to active
    await supabase
      .from("project_directory_memberships")
      .update({ status: "active" })
      .eq("id", membership.id);
  }

  return personId;
}
