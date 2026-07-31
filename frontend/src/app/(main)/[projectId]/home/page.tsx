import { createServiceClient } from "@/lib/supabase/service";
import { getApiRouteUser } from "@/lib/supabase/server";
import { PageShell } from "@/components/layout";
import { notFound, redirect } from "next/navigation";
import { ProjectHomeCommandCenterV2 as ProjectHomeClient } from "./project-home-command-center-v2";
import type { ProjectHomeLinkDocument } from "./project-home-links";
import type { BudgetGrandTotals } from "@/types/budget";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface TeamMember {
  id: string;
  role: string;
  person_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  company_name: string;
  phone_office: string;
  phone_mobile: string;
}

interface HomeAlerts {
  hasPrimeContractWithoutFinancialMarkup: boolean;
  changeOrdersWithoutChangeRequestCount: number;
}

interface SubcontractorCompany {
  name: string;
}

interface PendingSsovReview {
  commitmentId: string;
  commitmentNumber: string;
  commitmentTitle: string;
  submittedAt: string | null;
}

const EMPTY_HOME_BUDGET_TOTALS: BudgetGrandTotals = {
  originalBudgetAmount: 0,
  budgetModifications: 0,
  approvedCOs: 0,
  revisedBudget: 0,
  jobToDateCostDetail: 0,
  directCosts: 0,
  pendingChanges: 0,
  projectedBudget: 0,
  committedCosts: 0,
  pendingCostChanges: 0,
  projectedCosts: 0,
  forecastToComplete: 0,
  estimatedCostAtCompletion: 0,
  projectedOverUnder: 0,
};

interface DirectoryTeamMemberRow {
  person_id: string;
  user_type?: string | null;
  role: string | null;
  people: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    company: string | null;
    phone_business: string | null;
    phone_mobile: string | null;
  };
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseTeamMember(rawMember: unknown): Record<string, unknown> {
  if (typeof rawMember === "string") {
    try {
      const parsed = JSON.parse(rawMember) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { name: rawMember };
    }
    return { name: rawMember };
  }

  if (rawMember && typeof rawMember === "object" && !Array.isArray(rawMember)) {
    return rawMember as Record<string, unknown>;
  }

  return {};
}

function mapProjectTeamMembers(rawTeamMembers: unknown): TeamMember[] {
  if (!Array.isArray(rawTeamMembers)) return [];

  return rawTeamMembers
    .map((rawMember, index) => {
      const parsed = parseTeamMember(rawMember);
      const fullName = toStringValue(parsed.full_name) || toStringValue(parsed.name);
      const [firstName = "", ...lastNameParts] = fullName.split(/\s+/).filter(Boolean);
      const lastName = lastNameParts.join(" ");
      const role = toStringValue(parsed.role) || toStringValue(parsed.title) || "Team Member";
      const personId = toStringValue(parsed.person_id) || toStringValue(parsed.id);

      const fallbackIdBase = personId || fullName || `member-${index}`;
      const fallbackId = `project-team-${fallbackIdBase.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`;

      return {
        id: personId || fallbackId,
        role,
        person_id: personId,
        first_name: toStringValue(parsed.first_name) || firstName,
        last_name: toStringValue(parsed.last_name) || lastName,
        full_name: fullName || "Team Member",
        email: toStringValue(parsed.email),
        company_name: toStringValue(parsed.company) || toStringValue(parsed.company_name),
        phone_office: toStringValue(parsed.phone_office) || toStringValue(parsed.office),
        phone_mobile: toStringValue(parsed.phone_mobile) || toStringValue(parsed.phone) || toStringValue(parsed.mobile),
      } satisfies TeamMember;
    })
    .filter((member) => member.full_name.length > 0);
}

function mapDirectoryTeamMembers(rawMembers: unknown): TeamMember[] {
  if (!Array.isArray(rawMembers)) return [];

  return (rawMembers as DirectoryTeamMemberRow[]).map((member) => {
    const person = member.people;
    const firstName = person?.first_name?.trim() || "";
    const lastName = person?.last_name?.trim() || "";
    const fullName = `${firstName} ${lastName}`.trim() || "Team Member";

    return {
      id: person?.id || member.person_id,
      role: member.role?.trim() || "Team Member",
      person_id: person?.id || member.person_id,
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      email: person?.email || "",
      company_name: person?.company || "",
      phone_office: person?.phone_business || "",
      phone_mobile: person?.phone_mobile || "",
    };
  });
}

function buildHomeBudgetTotals({
  budget,
  commitmentTotal,
}: {
  budget: Array<{ original_amount?: number | null }>;
  commitmentTotal: number;
}): BudgetGrandTotals {
  const originalBudgetAmount = budget.reduce(
    (sum, line) => sum + (Number(line.original_amount) || 0),
    0,
  );
  const revisedBudget = originalBudgetAmount;
  const committedCosts = commitmentTotal;
  const projectedCosts = committedCosts;
  const forecastToComplete = Math.max(0, revisedBudget - projectedCosts);
  const estimatedCostAtCompletion = projectedCosts + forecastToComplete;

  return {
    ...EMPTY_HOME_BUDGET_TOTALS,
    originalBudgetAmount,
    revisedBudget,
    projectedBudget: revisedBudget,
    committedCosts,
    projectedCosts,
    forecastToComplete,
    estimatedCostAtCompletion,
    projectedOverUnder: revisedBudget - estimatedCostAtCompletion,
  };
}

function normalizeCompanyName(value: string | null | undefined): string | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : null;
}

export default async function ProjectHomePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const supabase = createServiceClient();
  const { projectId } = await params;
  const numericProjectId = parseInt(projectId, 10);

  // Validate projectId is a valid number
  if (isNaN(numericProjectId)) {
    notFound();
  }

  // Redirect subcontractors to their focused My Work page
  const user = await getApiRouteUser();
  if (user) {
    const { data: authLink } = await supabase
      .from("users_auth")
      .select("person_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (authLink) {
      const { data: membership } = await supabase
        .from("project_directory_memberships")
        .select("user_type")
        .eq("person_id", authLink.person_id)
        .eq("project_id", numericProjectId)
        .eq("status", "active")
        .maybeSingle();
      if (membership?.user_type === "subcontractor") {
        redirect(`/${projectId}/my-work`);
      }
    }
  }

  // Fetch project data with all related information in parallel
  const [
    projectResult,
    tasksResult,
    tasksByProjectIdResult,
    tasksViaDocsResult,
    primeChangeOrdersResult,
    contractChangeOrdersResult,
    rfisResult,
    commitmentsResult,
    contractsResult,
    contractLineItemsResult,
    budgetResult,
    scheduleResult,
    teamResult,
    teamDirectoryResult,
    verticalMarkupCountResult,
    primeCosWithoutChangeRequestCountResult,
    commitmentCosWithoutChangeRequestCountResult,
    ownerInvoicesResult,
    pendingSsovRowsResult,
    subcontractTotalsResult,
    purchaseOrderTotalsResult,
    linkDocumentsResult,
    progressReportsResult,
    submittalsResult,
  ] = await Promise.all([
    // Fetch main project data
    supabase.from("projects").select("*").eq("id", numericProjectId).single(),

    // Fetch tasks — by project_ids array
    supabase
      .from("tasks")
      .select("*")
      .contains("project_ids", [numericProjectId])
      .not("status", "in", '("done","cancelled")')
      .order("created_at", { ascending: false })
      .limit(20),

    // Fetch tasks — by scalar project_id (legacy / partially backfilled rows)
    supabase
      .from("tasks")
      .select("*")
      .eq("project_id", numericProjectId)
      .not("status", "in", '("done","cancelled")')
      .order("created_at", { ascending: false })
      .limit(20),

    // Fetch tasks — via document_metadata link (for tasks with empty project_ids)
    supabase
      .from("tasks")
      .select("*, document_metadata!tasks_metadata_id_fkey!inner(project_id)")
      .eq("document_metadata.project_id", numericProjectId)
      .or("project_ids.is.null,project_ids.eq.{}")
      .not("status", "in", '("done","cancelled")')
      .order("created_at", { ascending: false })
      .limit(20),

    // Fetch prime contract change orders
    supabase
      .from("prime_contract_change_orders")
      .select("*")
      .eq("project_id", numericProjectId)
      .order("created_at", { ascending: false })
      .limit(5),

    // Fetch contract (commitment) change orders via prime_contracts join
    supabase
      .from("contract_change_orders")
      .select("*, prime_contracts!inner(project_id)")
      .eq("prime_contracts.project_id", numericProjectId)
      .order("created_at", { ascending: false })
      .limit(5),

    // Fetch RFIs
    supabase
      .from("rfis")
      .select("*")
      .eq("project_id", numericProjectId)
      .order("created_at", { ascending: false })
      .limit(5),

    // Fetch commitments from unified view (combines subcontracts + purchase_orders — metadata only)
    supabase
      .from("commitments_unified")
      .select("id, project_id, contract_number, contract_company_id, title, status, executed, description, created_at, updated_at, deleted_at")
      .eq("project_id", numericProjectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),

    // Fetch prime contracts
    supabase
      .from("prime_contracts")
      .select("*")
      .eq("project_id", numericProjectId)
      .order("created_at", { ascending: false }),

    // Fetch prime contract SOV line items for contract value rollups
    supabase
      .from("contract_line_items")
      .select("contract_id,total_cost,quantity,unit_cost,cost_code_id,prime_contracts!inner(project_id)")
      .eq("prime_contracts.project_id", numericProjectId),

    // Fetch budget lines
    supabase
      .from("budget_lines")
      .select("id, project_id, original_amount, cost_code_id, cost_code:cost_codes(division_id, division_title, title)")
      .eq("project_id", numericProjectId)
      .order("cost_code_id", { ascending: true }),

    // Fetch schedule tasks
    supabase
      .from("schedule_tasks")
      .select("id")
      .eq("project_id", numericProjectId)
      .limit(1),

    // Fetch project team roster
    supabase.rpc("get_project_team", { p_project_id: numericProjectId }),

    // Fetch active project directory memberships (source of truth for Home team)
    supabase
      .from("project_directory_memberships")
      .select(
        "person_id, user_type, role, people!inner(id, first_name, last_name, email, company, phone_business, phone_mobile)"
      )
      .eq("project_id", numericProjectId)
      .eq("status", "active")
      .limit(50),

    // Count project-level financial markup settings
    supabase
      .from("vertical_markup")
      .select("id", { count: "exact", head: true })
      .eq("project_id", numericProjectId),

    // Count prime contract change orders with no linked change request/event
    supabase
      .from("prime_contract_change_orders")
      .select("id", { count: "exact", head: true })
      .eq("project_id", numericProjectId)
      .is("change_event_id", null),

    // Count commitment change orders with no linked change request/event
    supabase
      .from("contract_change_orders")
      .select("id, prime_contracts!inner(project_id)", { count: "exact", head: true })
      .eq("prime_contracts.project_id", numericProjectId)
      .is("change_event_id", null),

    // Fetch owner invoices via prime contract relation without waiting for contractsResult
    supabase
      .from("owner_invoices")
      .select(
        "id, invoice_number, status, gross_amount, paid_amount, billing_date, prime_contract_id, prime_contracts!owner_invoices_prime_contract_id_fkey!inner(project_id)",
      )
      .eq("prime_contracts.project_id", numericProjectId)
      .order("billing_date", { ascending: false })
      .limit(10),

    // Fetch pending subcontractor SOV reviews
    supabase
      .from("subcontractor_sov_submissions")
      .select("commitment_id, submitted_at")
      .eq("project_id", numericProjectId)
      .eq("status", "under_review")
      .order("submitted_at", { ascending: true }),

    // Fetch subcontract SOV totals (contract amounts live in SOV items, not on the commitment record)
    supabase
      .from("subcontracts_with_totals")
      .select("id, total_sov_amount")
      .eq("project_id", numericProjectId),

    // Fetch purchase order SOV totals
    supabase
      .from("purchase_orders_with_totals")
      .select("id, total_sov_amount")
      .eq("project_id", numericProjectId),

    // Fetch project-scoped external links and media references for the landing Links section.
    supabase
      .from("project_documents")
      .select(
        "id, title, file_name, category, created_at, description, document_type, content_type, file_url, source_system, source_web_url",
      )
      .eq("project_id", numericProjectId)
      .is("deleted_at", null)
      .or("source_web_url.ilike.http%,file_url.ilike.http%")
      .order("created_at", { ascending: false })
      .limit(20),

    // Fetch recent weekly progress reports
    supabase
      .from("project_progress_reports")
      .select("id, title, status, week_start, week_end, sent_at")
      .eq("project_id", numericProjectId)
      .order("week_end", { ascending: false })
      .limit(5),

    // Fetch recent submittals
    supabase
      .from("submittals")
      .select("id, submittal_number, title, status, final_due_date, created_at")
      .eq("project_id", numericProjectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (projectResult.error || !projectResult.data) {
    notFound();
  }

  const project = projectResult.data;

  // Merge tasks from both queries (direct project_ids match + document_metadata link)
  // and deduplicate by id, keeping most-recent-first ordering
  type TaskRow = NonNullable<typeof tasksResult.data>[number];
  const directTasks: TaskRow[] = tasksResult.data || [];
  const directProjectIdTasks: TaskRow[] = tasksByProjectIdResult.data || [];
  const linkedTasksRaw = tasksViaDocsResult.data || [];
  // Strip the joined document_metadata field so shape matches TaskRow
  const linkedTasks: TaskRow[] = linkedTasksRaw.map((row) => {
    const { document_metadata, ...task } = row as TaskRow & { document_metadata: unknown };
    return task;
  });
  // Some rows can match multiple fetch paths (project_ids + project_id + metadata link).
  // Normalize to one task per id before sorting so Home never renders duplicates.
  const allTaskCandidates: TaskRow[] = [
    ...directTasks,
    ...directProjectIdTasks,
    ...linkedTasks,
  ];
  const tasksById = new Map<string, TaskRow>();
  for (const task of allTaskCandidates) {
    const existing = tasksById.get(task.id);
    if (!existing) {
      tasksById.set(task.id, task);
      continue;
    }
    if (new Date(task.created_at).getTime() > new Date(existing.created_at).getTime()) {
      tasksById.set(task.id, task);
    }
  }
  const tasks = Array.from(tasksById.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const changeOrders = [
    ...(primeChangeOrdersResult.data || []),
    ...(contractChangeOrdersResult.data || []),
  ];
  const rfis = rfisResult.data || [];
  // Cast to expected format since commitments_unified is a view — deduplicate by id
  const rawCommitments = ((commitmentsResult.data || []) as unknown) as Array<{
    id: string;
    project_id: number;
    contract_number: string | null;
    contract_company_id: string | null;
    title: string | null;
    status: string;
    executed: boolean;
    description: string | null;
    created_at: string;
    updated_at: string;
  }>;
  const seenCommitmentIds = new Set<string>();
  const commitments = rawCommitments.filter((c) => {
    if (seenCommitmentIds.has(c.id)) return false;
    seenCommitmentIds.add(c.id);
    return true;
  });

  const pendingSsovReviews: PendingSsovReview[] = (pendingSsovRowsResult.data || []).map(
    (row: { commitment_id: string; submitted_at: string | null }) => {
      const commitment = commitments.find((item) => item.id === row.commitment_id);
      return {
        commitmentId: row.commitment_id,
        commitmentNumber: commitment?.contract_number || "",
        commitmentTitle: commitment?.title || "Commitment",
        submittedAt: row.submitted_at || null,
      };
    },
  );

  // Contract amounts live in SOV line items, not on the commitment record itself.
  // Sum total_sov_amount from the *_with_totals views which aggregate them.
  const subcontractTotal = (subcontractTotalsResult.data || []).reduce(
    (sum, row) => sum + (Number(row.total_sov_amount) || 0),
    0,
  );
  const purchaseOrderTotal = (purchaseOrderTotalsResult.data || []).reduce(
    (sum, row) => sum + (Number(row.total_sov_amount) || 0),
    0,
  );
  const commitmentTotal = subcontractTotal + purchaseOrderTotal;

  const contracts = contractsResult.data || [];
  const ownerInvoices = ownerInvoicesResult.data || [];
  const verticalMarkupCount = verticalMarkupCountResult.count || 0;
  const homeAlerts: HomeAlerts = {
    hasPrimeContractWithoutFinancialMarkup:
      contracts.length > 0 && verticalMarkupCount === 0,
    changeOrdersWithoutChangeRequestCount:
      (primeCosWithoutChangeRequestCountResult.count || 0) +
      (commitmentCosWithoutChangeRequestCountResult.count || 0),
  };
  const contractLineItems = contractLineItemsResult.data || [];
  const budget = budgetResult.data || [];
  const budgetGrandTotals = buildHomeBudgetTotals({
    budget,
    commitmentTotal,
  });
  const schedule = scheduleResult.data || [];
  if (teamResult.error) {
    console.error(
      `[project-home] get_project_team RPC failed for project ${numericProjectId}:`,
      teamResult.error,
    );
  }
  if (teamDirectoryResult.error) {
    console.error(
      `[project-home] project_directory_memberships query failed for project ${numericProjectId}:`,
      teamDirectoryResult.error,
    );
  }
  if (linkDocumentsResult.error) {
    console.error(
      `[project-home] project link documents query failed for project ${numericProjectId}:`,
      linkDocumentsResult.error,
    );
  }
  const teamFromRpc = teamResult.data || [];
  const teamFromDirectory = mapDirectoryTeamMembers(teamDirectoryResult.data || []);
  const teamFromProject = mapProjectTeamMembers(project.team_members);
  const team =
    teamFromDirectory.length > 0
      ? teamFromDirectory
      : teamFromRpc.length > 0
      ? teamFromRpc
      : teamFromProject;

  const projectCompaniesResult = await supabase
    .from("project_companies")
    .select("company:companies(name)")
    .eq("project_id", numericProjectId)
    .order("name", { ascending: true, referencedTable: "companies" });

  if (projectCompaniesResult.error) {
    console.error(
      `[project-home] project company query failed for project ${numericProjectId}:`,
      projectCompaniesResult.error,
    );
  }

  const subcontractorCompanies: SubcontractorCompany[] = Array.from(
    new Set(
      ((projectCompaniesResult.data || []) as Array<{
        company?: { name?: string | null } | null;
      }>)
        .map((row) => normalizeCompanyName(row.company?.name))
        .filter((value): value is string => Boolean(value)),
    ),
  )
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({ name }));

  const linkDocuments: ProjectHomeLinkDocument[] = linkDocumentsResult.error
    ? []
    : linkDocumentsResult.data || [];
  const progressReports = progressReportsResult.data || [];
  const submittals = submittalsResult.data || [];

  // Daily synopsis — the executive deep read refreshes this row every day.
  const { data: currentState } = await supabase
    .from("project_current_state")
    .select("current_summary, field_read, schedule_read, financial_read, updated_at")
    .eq("project_id", numericProjectId)
    .maybeSingle();
  const synopsis = currentState
    ? {
        summary: currentState.current_summary,
        fieldRead: currentState.field_read,
        scheduleRead: currentState.schedule_read,
        financialRead: currentState.financial_read,
        updatedAt: currentState.updated_at,
      }
    : null;

  return (
    <PageShell
      variant="dashboard"
      title={project.name ?? "Untitled Project"}
      showHeader={false}
    >
      <ProjectHomeClient
        project={project}
        tasks={tasks}
        changeOrders={changeOrders}
        rfis={rfis}
        commitments={commitments}
        commitmentTotal={commitmentTotal}
        contracts={contracts}
        contractLineItems={contractLineItems}
        budget={budget}
        budgetGrandTotals={budgetGrandTotals}
        schedule={schedule}
        team={team}
        subcontractorCompanies={subcontractorCompanies}
        homeAlerts={homeAlerts}
        pendingSsovReviews={pendingSsovReviews}
        ownerInvoices={ownerInvoices}
        linkDocuments={linkDocuments}
        synopsis={synopsis}
        progressReports={progressReports}
        submittals={submittals}
      />
    </PageShell>
  );
}
